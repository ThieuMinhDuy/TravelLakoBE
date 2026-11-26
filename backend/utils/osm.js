// Gọi các dịch vụ miễn phí của OpenStreetMap dùng cho import:
//   - Nominatim: tìm tọa độ thành phố theo tên; và là nguồn địa điểm DỰ PHÒNG khi Overpass không trả kết quả
//   - Overpass: nguồn địa điểm chính (khách sạn / nhà hàng / cafe / điểm tham quan quanh tọa độ thành phố)
// Các máy chủ Overpass công cộng rất hay quá tải (lúc trả trong 2 giây, lúc treo quá 100 giây, lúc báo 502 "at capacity",
// lúc báo 429 theo IP), nên gọi song song nhiều máy chủ, máy chủ nào lỗi thì nghỉ rồi gọi lại, có hạn chót tổng.
import { HttpError, ERROR_CODES } from './httpError.js';

const USER_AGENT = 'TravelLakoPlannerAgent/1.0';

// FE nhận diện lỗi này bằng code OSM_UNAVAILABLE, không dựa vào câu chữ
const OSM_BUSY_MESSAGE = 'Máy chủ OpenStreetMap đang bận hoặc không phản hồi, vui lòng thử lại sau ít phút';
const OSM_RETRY_AFTER_SECONDS = 60;

const DEFAULT_OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
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
// Làm tròn tọa độ 6 chữ số (~0,1 m), tránh sai số kiểu 21.080000000000002 trong truy vấn
const coord = (n) => Number(n.toFixed(6));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTimeout = (err) => err?.name === 'AbortError' || err?.name === 'TimeoutError';

// Chính sách Nominatim: tối đa 1 request / giây. Mọi request Nominatim của server (tìm tọa độ + nguồn dự phòng,
// kể cả khi 2 admin import cùng lúc) xếp hàng qua đây, request sau cách request trước ít nhất 1,1 giây.
let nominatimQueue = Promise.resolve();
let lastNominatimAt = 0;
const nominatimFetch = (url, timeoutMs) => {
  const run = async () => {
    const gap = envNumber('NOMINATIM_MIN_INTERVAL_MS', 1100) - (Date.now() - lastNominatimAt);
    if (gap > 0) await sleep(gap);
    lastNominatimAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };
  const result = nominatimQueue.then(run, run);
  nominatimQueue = result.catch(() => {});
  return result;
};

/**
 * Tìm tọa độ thành phố (giới hạn trong Việt Nam).
 * Không tìm thấy -> 400 GEOCODE_FAILED. Nominatim lỗi / treo quá 10 giây / trả về không phải JSON -> 503 OSM_UNAVAILABLE.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export const geocodeCity = async (cityName) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cityName}, Vietnam`)}&format=json&limit=1`;
  const timeoutMs = envNumber('NOMINATIM_TIMEOUT_MS', 10000);
  const t0 = Date.now();

  let data;
  try {
    data = await nominatimFetch(url, timeoutMs);
  } catch (err) {
    const reason = isTimeout(err) ? `quá ${seconds(timeoutMs)}` : err.message;
    console.warn(`[Import Tool] Nominatim lỗi sau ${seconds(Date.now() - t0)}: ${reason}`);
    throw osmUnavailable();
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
  const bbox = `${coord(lat - offset)},${coord(lng - offset)},${coord(lat + offset)},${coord(lng + offset)}`;
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
  deadlineMs = envNumber('OVERPASS_DEADLINE_MS', 50000),
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

/**
 * Các lượt tìm Nominatim cho nguồn dự phòng. `accept` lọc đúng loại (tìm "hotel" có thể trả cả địa điểm có chữ hotel
 * trong tên nhưng thuộc loại khác), `tags` đổi kết quả về tag OSM giống Overpass để importController phân loại như cũ.
 */
const NOMINATIM_SEARCHES = [
  {
    q: 'hotel',
    accept: (x) => x.category === 'tourism' && ['hotel', 'hostel', 'guest_house', 'motel'].includes(x.type),
    tags: () => ({ tourism: 'hotel' }),
  },
  { q: 'restaurant', accept: (x) => x.category === 'amenity' && x.type === 'restaurant', tags: () => ({ amenity: 'restaurant' }) },
  { q: 'cafe', accept: (x) => x.category === 'amenity' && x.type === 'cafe', tags: () => ({ amenity: 'cafe' }) },
  ...['attraction', 'museum', 'viewpoint'].map((type) => ({
    q: `[tourism=${type}]`,
    accept: (x) => x.category === 'tourism' && x.type === type,
    tags: () => ({ tourism: type }),
  })),
];
const NOMINATIM_PAGE_SIZE = 40; // Nominatim trả tối đa 40 kết quả mỗi lần tìm

/**
 * Nguồn dự phòng khi Overpass không trả kết quả: tìm địa điểm theo loại bằng Nominatim, giới hạn trong khung quanh
 * thành phố (cùng khung với truy vấn Overpass). Gọi lần lượt (tối đa 1 request / giây), mỗi lượt tìm lấy thêm trang sau
 * bằng exclude_place_ids tới khi đủ `perTypeFetch` hoặc hết kết quả (tối đa NOMINATIM_MAX_PAGES trang).
 *  - 1 lần tìm lỗi thì bỏ qua lần đó, vẫn dùng kết quả của các lần khác;
 *  - Nominatim báo 429 / 403 (đang chặn) thì dừng luôn; quá `deadlineMs` thì dừng và dùng phần đã lấy được;
 *  - không lần tìm nào thành công -> 503 OSM_UNAVAILABLE.
 * @returns {Promise<object[]>} phần tử cùng dạng Overpass ({ type, id, lat, lon, tags })
 */
export const queryNominatimPlaces = async ({ lat, lng }, perTypeFetch, {
  offset = 0.05,
  deadlineMs = envNumber('NOMINATIM_FALLBACK_DEADLINE_MS', 30000),
  maxPages = envNumber('NOMINATIM_MAX_PAGES', 3),
  timeoutMs = envNumber('NOMINATIM_TIMEOUT_MS', 10000),
} = {}) => {
  const viewbox = `${coord(lng - offset)},${coord(lat + offset)},${coord(lng + offset)},${coord(lat - offset)}`;
  const startedAt = Date.now();
  const elements = [];
  let succeeded = 0;
  let blocked = false;

  for (const search of NOMINATIM_SEARCHES) {
    const excluded = [];
    let found = 0;
    for (let page = 1; page <= maxPages && found < perTypeFetch && !blocked; page++) {
      const remaining = deadlineMs - (Date.now() - startedAt);
      if (remaining <= 0) break;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search.q)}`
        + `&viewbox=${viewbox}&bounded=1&format=jsonv2&addressdetails=1&limit=${NOMINATIM_PAGE_SIZE}`
        + (excluded.length ? `&exclude_place_ids=${excluded.join(',')}` : '');
      const t0 = Date.now();
      let results;
      try {
        results = await nominatimFetch(url, Math.min(timeoutMs, remaining));
        if (!Array.isArray(results)) throw new Error('Response không phải danh sách');
      } catch (err) {
        console.warn(`[Import Tool] Nominatim "${search.q}" trang ${page} lỗi sau ${seconds(Date.now() - t0)}: ${isTimeout(err) ? 'quá thời gian' : err.message}`);
        if (err.status === 429 || err.status === 403) blocked = true;
        break;
      }
      succeeded++;
      for (const x of results) {
        if (x.place_id != null) excluded.push(x.place_id);
        const name = typeof x.name === 'string' ? x.name.trim() : '';
        if (!name || !search.accept(x)) continue;
        found++;
        elements.push({
          type: 'node',
          id: x.place_id,
          lat: Number(x.lat),
          lon: Number(x.lon),
          tags: { name, 'addr:street': x.address?.road, 'addr:housenumber': x.address?.house_number, ...search.tags() },
        });
      }
      console.log(`[Import Tool] Nominatim "${search.q}" trang ${page}: ${results.length} kết quả sau ${seconds(Date.now() - t0)}`);
      if (results.length < NOMINATIM_PAGE_SIZE) break; // hết kết quả
    }
    if (blocked || Date.now() - startedAt >= deadlineMs) break;
  }

  if (!succeeded) {
    console.warn(`[Import Tool] Nominatim (dự phòng): không lần tìm nào thành công (${seconds(Date.now() - startedAt)})`);
    throw osmUnavailable();
  }
  console.log(`[Import Tool] Nominatim (dự phòng): ${elements.length} địa điểm sau ${seconds(Date.now() - startedAt)}`);
  return elements;
};
