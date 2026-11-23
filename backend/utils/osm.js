// Gọi các dịch vụ miễn phí của OpenStreetMap dùng cho import:
//   - Nominatim: tìm tọa độ thành phố theo tên
//   - Overpass: lấy khách sạn / nhà hàng / cafe / điểm tham quan quanh tọa độ đó
// Các máy chủ Overpass công cộng rất hay quá tải (lúc trả trong 2 giây, lúc treo quá 100 giây, lúc báo 502 "at capacity"),
// nên gọi song song nhiều máy chủ, máy chủ nào lỗi thì nghỉ rồi gọi lại, có hạn chót tổng.
import { HttpError, ERROR_CODES } from './httpError.js';

const USER_AGENT = 'TravelLakoPlannerAgent/1.0';

// Giữ nguyên câu chữ cũ: FE đang dịch câu này (sẽ đổi cùng mục 13). FE nên nhận diện bằng code OSM_UNAVAILABLE.
const OSM_BUSY_MESSAGE = 'All OpenStreetMap Overpass servers are currently busy or timed out. Please try again in a few moments.';
const OSM_RETRY_AFTER_SECONDS = 60;

const DEFAULT_OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const envNumber = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Danh sách máy chủ Overpass, đổi được qua OVERPASS_MIRRORS (cách nhau bởi dấu phẩy) */
const getOverpassMirrors = () => {
  const fromEnv = (process.env.OVERPASS_MIRRORS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_OVERPASS_MIRRORS;
};

const osmUnavailable = () =>
  new HttpError(503, OSM_BUSY_MESSAGE, ERROR_CODES.OSM_UNAVAILABLE, { retryAfter: OSM_RETRY_AFTER_SECONDS });

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Tìm tọa độ thành phố (giới hạn trong Việt Nam).
 * Không tìm thấy -> 400 GEOCODE_FAILED. Nominatim lỗi / treo quá 10 giây / trả về không phải JSON -> 503 OSM_UNAVAILABLE.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export const geocodeCity = async (cityName) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cityName}, Vietnam`)}&format=json&limit=1`;
  const timeoutMs = envNumber('NOMINATIM_TIMEOUT_MS', 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  let data;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    const reason = err.name === 'AbortError' ? `quá ${seconds(timeoutMs)}` : err.message;
    console.warn(`[Import Tool] Nominatim lỗi sau ${seconds(Date.now() - t0)}: ${reason}`);
    throw osmUnavailable();
  } finally {
    clearTimeout(timer);
  }

  const lat = Number.parseFloat(data?.[0]?.lat);
  const lng = Number.parseFloat(data?.[0]?.lon);
  if (!Array.isArray(data) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpError(
      400,
      `Không thể tìm thấy tọa độ cho thành phố "${cityName}". Vui lòng kiểm tra lại chính tả!`,
      ERROR_CODES.GEOCODE_FAILED,
    );
  }
  return { lat, lng };
};

/**
 * Truy vấn Overpass: mỗi loại có giới hạn riêng (không để loại có ID nhỏ chiếm hết suất), chỉ lấy địa điểm có tên.
 * Điểm tham quan dùng nwr + out center để lấy cả địa điểm vẽ dạng khu vực (hồ, công viên...), tọa độ là tâm khu vực.
 */
export const buildOverpassQuery = ({ lat, lng }, perTypeFetch, offset = 0.05) => {
  const bbox = `${lat - offset},${lng - offset},${lat + offset},${lng + offset}`;
  return `[out:json][timeout:45];
node["tourism"="hotel"]["name"](${bbox})->.hotels;
node["amenity"="restaurant"]["name"](${bbox})->.restaurants;
node["amenity"="cafe"]["name"](${bbox})->.cafes;
nwr["tourism"~"^(attraction|museum|viewpoint)$"]["name"](${bbox})->.attractions;
.hotels out body ${perTypeFetch};
.restaurants out body ${perTypeFetch};
.cafes out body ${perTypeFetch};
.attractions out center ${perTypeFetch};`;
};

/** Gọi 1 máy chủ Overpass. Lỗi HTTP, JSON hỏng hoặc Overpass báo lỗi trong "remark" đều tính là thất bại */
const queryMirror = async (url, query, signal) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT },
    body: new URLSearchParams({ data: query }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.elements)) throw new Error('Response không có elements');
  // Overpass hết thời gian / hết bộ nhớ vẫn trả 200 kèm remark "runtime error", dữ liệu bị thiếu
  if (typeof data.remark === 'string' && /error/i.test(data.remark)) throw new Error(`remark: ${data.remark.slice(0, 120)}`);
  return data;
};

/** Đợi `ms`, hoặc dừng sớm khi signal bị hủy */
const wait = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

/**
 * Gọi song song các máy chủ Overpass, mỗi máy chủ một vòng "gọi, lỗi thì nghỉ rồi gọi lại" cho tới hạn chót:
 *  - lỗi 502 "at capacity" / 504 / 429 / JSON hỏng / remark "runtime error" chỉ là tạm thời: nghỉ rồi gọi lại
 *    (nghỉ 4 giây, mỗi lần lỗi tiếp theo nghỉ lâu hơn 1,5 lần, tối đa 15 giây, để không dồn tải lên máy chủ đang quá tải);
 *  - mỗi máy chủ chỉ có tối đa 1 request đang chạy;
 *  - máy chủ nào trả kết quả hợp lệ trước thì dùng, các request còn lại bị hủy;
 *  - quá `deadlineMs` mà chưa máy chủ nào trả kết quả -> 503 OSM_UNAVAILABLE.
 * @returns {Promise<{ elements: object[], mirror: string }>}
 */
export const queryOverpass = async (query, {
  mirrors = getOverpassMirrors(),
  deadlineMs = envNumber('OVERPASS_DEADLINE_MS', 90000),
  retryDelayMs = envNumber('OVERPASS_RETRY_DELAY_MS', 4000),
  maxRetryDelayMs = envNumber('OVERPASS_MAX_RETRY_DELAY_MS', 15000),
} = {}) => {
  const controller = new AbortController();
  const startedAt = Date.now();
  const deadline = setTimeout(() => controller.abort(), deadlineMs);

  const worker = async (url) => {
    for (let attempt = 1; !controller.signal.aborted; attempt++) {
      const t0 = Date.now();
      console.log(`[Import Tool] Overpass: gọi ${url} (lần ${attempt})`);
      try {
        const data = await queryMirror(url, query, controller.signal);
        console.log(`[Import Tool] Overpass: ${url} trả ${data.elements.length} phần tử sau ${seconds(Date.now() - t0)} (lần ${attempt})`);
        return { elements: data.elements, mirror: url };
      } catch (err) {
        if (controller.signal.aborted) break; // hết hạn chót, hoặc máy chủ khác đã trả kết quả
        const delay = Math.min(retryDelayMs * 1.5 ** (attempt - 1), maxRetryDelayMs);
        console.warn(`[Import Tool] Overpass: ${url} lỗi sau ${seconds(Date.now() - t0)}: ${err.message}; gọi lại sau ${seconds(delay)}`);
        await wait(delay, controller.signal);
      }
    }
    throw new Error('Đã dừng');
  };

  try {
    return await Promise.any(mirrors.map(worker));
  } catch {
    console.warn(`[Import Tool] Overpass: không máy chủ nào trả kết quả trong ${seconds(Date.now() - startedAt)}`);
    throw osmUnavailable();
  } finally {
    clearTimeout(deadline);
    controller.abort(); // hủy các request / lượt chờ còn lại
  }
};
