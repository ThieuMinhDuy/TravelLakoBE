// Gọi các dịch vụ miễn phí của OpenStreetMap dùng cho import:
//   - Nominatim: tìm tọa độ thành phố theo tên
//   - Overpass: lấy khách sạn / nhà hàng / cafe / điểm tham quan quanh tọa độ đó
// Các máy chủ Overpass công cộng rất hay quá tải (lúc trả trong 2 giây, lúc treo quá 100 giây),
// nên gọi theo kiểu "gối đầu" qua nhiều máy chủ và có hạn chót tổng.
import { HttpError, ERROR_CODES } from './httpError.js';

const USER_AGENT = 'TravelLakoPlannerAgent/1.0';

// Giữ nguyên câu chữ cũ: FE đang dịch câu này (sẽ đổi cùng mục 13). FE nên nhận diện bằng code OSM_UNAVAILABLE.
const OSM_BUSY_MESSAGE = 'All OpenStreetMap Overpass servers are currently busy or timed out. Please try again in a few moments.';
const OSM_RETRY_AFTER_SECONDS = 60;

const DEFAULT_OVERPASS_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
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

/**
 * Gọi gối đầu qua các máy chủ Overpass:
 *  - gọi máy chủ 1; sau `hedgeMs` chưa có kết quả thì gọi thêm máy chủ kế tiếp (máy chủ trước vẫn chạy tiếp);
 *  - máy chủ nào báo lỗi mà không còn request nào đang chạy thì gọi máy chủ kế tiếp ngay, không chờ;
 *  - máy chủ nào trả kết quả hợp lệ trước thì dùng, các request còn lại bị hủy;
 *  - quá `deadlineMs` hoặc mọi máy chủ đều lỗi -> 503 OSM_UNAVAILABLE.
 * @returns {Promise<{ elements: object[], mirror: string }>}
 */
export const queryOverpass = (query, {
  mirrors = getOverpassMirrors(),
  hedgeMs = envNumber('OVERPASS_HEDGE_MS', 10000),
  deadlineMs = envNumber('OVERPASS_DEADLINE_MS', 60000),
} = {}) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const controllers = [];
  let next = 0;
  let running = 0;
  let settled = false;
  let hedgeTimer = null;
  let deadlineTimer = null;

  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(hedgeTimer);
    clearTimeout(deadlineTimer);
    controllers.forEach((c) => c.abort());
    fn(value);
  };

  const launch = () => {
    clearTimeout(hedgeTimer);
    if (settled || next >= mirrors.length) return;
    const url = mirrors[next++];
    const controller = new AbortController();
    controllers.push(controller);
    running++;
    const t0 = Date.now();
    console.log(`[Import Tool] Overpass: gọi ${url}`);

    queryMirror(url, query, controller.signal).then(
      (data) => {
        console.log(`[Import Tool] Overpass: ${url} trả ${data.elements.length} phần tử sau ${seconds(Date.now() - t0)}`);
        finish(resolve, { elements: data.elements, mirror: url });
      },
      (err) => {
        running--;
        if (settled) return; // request bị hủy vì máy chủ khác đã trả kết quả / đã hết hạn chót
        console.warn(`[Import Tool] Overpass: ${url} lỗi sau ${seconds(Date.now() - t0)}: ${err.message}`);
        if (running > 0) return; // còn máy chủ đang chạy: chờ nó hoặc tới lượt gối đầu kế tiếp
        if (next < mirrors.length) launch();
        else {
          console.warn(`[Import Tool] Overpass: tất cả máy chủ đều lỗi (${seconds(Date.now() - startedAt)})`);
          finish(reject, osmUnavailable());
        }
      },
    );

    if (next < mirrors.length) hedgeTimer = setTimeout(launch, hedgeMs);
  };

  deadlineTimer = setTimeout(() => {
    console.warn(`[Import Tool] Overpass: hết hạn chót ${seconds(deadlineMs)}, hủy các request đang chạy`);
    finish(reject, osmUnavailable());
  }, deadlineMs);
  launch();
});
