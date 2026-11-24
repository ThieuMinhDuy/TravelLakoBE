import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import findCityByName from '../../utils/findCityByName.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import { enrichImportedPlaces } from '../../utils/importEnrichment.js';
import { buildOverpassQuery, geocodeCity, queryNominatimPlaces, queryOverpass } from '../../utils/osm.js';

const DEFAULT_IMPORT_LIMIT = 30;
const MAX_IMPORT_LIMIT = 50;

// Kho ảnh Unsplash mẫu chất lượng cao cho từng danh mục
const SAMPLE_IMAGES = {
  Hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd',
    'https://images.unsplash.com/photo-1540548948273-b45a2a7b2c29',
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427',
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32',
    'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6',
    'https://images.unsplash.com/photo-1529290130-4ca3753253ae',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461',
    'https://images.unsplash.com/photo-1568495248636-6432b97bd949',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4'
  ],
  Attraction: [
    'https://images.unsplash.com/photo-1509062522246-3755977927d7',
    'https://images.unsplash.com/photo-1559592481-74153d4edd19',
    'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7',
    'https://images.unsplash.com/photo-1528127269322-539801943592',
    'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
    'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1472214222541-d510753a4707',
    'https://images.unsplash.com/photo-1518391846015-55a9cc003b25'
  ],
  Restaurant: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
    'https://images.unsplash.com/photo-1541832676-9b763b0239ab',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
    'https://images.unsplash.com/photo-1498654896293-37aacf113fd9',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288',
    'https://images.unsplash.com/photo-1502301197179-6522b4b12d68',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929',
    'https://images.unsplash.com/photo-1543353071-10c8ba85a904'
  ],
  Cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085',
    'https://images.unsplash.com/photo-1447078806655-40579c2520d6',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24',
    'https://images.unsplash.com/photo-1511920170033-f8396924c348',
    'https://images.unsplash.com/photo-1498804103079-a6351b050096',
    'https://images.unsplash.com/photo-1541167760496-1628856ab772',
    'https://images.unsplash.com/photo-1497935586351-b67a49e012bf',
    'https://images.unsplash.com/photo-1507133750040-4a8f57021571',
    'https://images.unsplash.com/photo-1459756269037-a7dc693965a6',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd',
    'https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6',
    'https://images.unsplash.com/photo-1497515114629-f71d768fd07c',
    'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e'
  ]
};

// Helper gán ảnh ngẫu nhiên từ danh mục
const getRandomImages = (type, count = 5) => {
  const list = SAMPLE_IMAGES[type] || [];
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Helper sinh mô tả tiếng Việt ngẫu nhiên phù hợp với địa điểm
const generateDescription = (name, cityName, type) => {
  const templates = {
    Hotel: [
      `Khách sạn ${name} cung cấp dịch vụ lưu trú chất lượng cao, đầy đủ tiện nghi hiện đại tọa lạc tại khu vực trung tâm ${cityName}.`,
      `${name} là điểm dừng chân nghỉ dưỡng lý tưởng cho du khách khi ghé thăm ${cityName} với phòng nghỉ sạch sẽ và dịch vụ tận tâm.`,
      `Trải nghiệm kỳ nghỉ tuyệt vời tại ${name} với vị trí đắc địa ở ${cityName}, thuận tiện di chuyển tới các điểm tham quan.`
    ],
    Attraction: [
      `${name} là một trong những điểm tham quan du lịch nổi tiếng hàng đầu tại ${cityName}, mang đậm dấu ấn lịch sử văn hóa.`,
      `Ghé thăm ${name} tại ${cityName} để khám phá cảnh quan thiên nhiên tuyệt đẹp và lưu giữ những kỷ niệm đáng nhớ.`,
      `Khám phá nét độc đáo của danh thắng ${name}, điểm đến thu hút hàng vạn lượt khách mỗi năm tại thành phố ${cityName}.`
    ],
    Restaurant: [
      `Nhà hàng ${name} phục vụ thực đơn phong phú với những món ăn đặc sản đậm đà hương vị truyền thống ngay giữa lòng ${cityName}.`,
      `Thưởng thức tinh hoa ẩm thực tại ${name} với không gian ấm cúng, sang trọng và phong cách phục vụ chuyên nghiệp tại ${cityName}.`,
      `${name} là địa chỉ ẩm thực quen thuộc cho thực khách yêu thích khám phá các món ngon đặc trưng của vùng đất ${cityName}.`
    ],
    Cafe: [
      `Quán cafe ${name} sở hữu không gian yên tĩnh, thiết kế xinh xắn, là góc chill tuyệt vời cho du khách tại ${cityName}.`,
      `Thưởng thức những ly cà phê thơm ngon đậm vị và thư giãn trong không gian tràn ngập ánh sáng tại ${name} ${cityName}.`,
      `${name} là địa điểm gặp gỡ bạn bè lý tưởng, phục vụ đa dạng các thức uống giải khát hiện đại tại ${cityName}.`
    ]
  };

  const list = templates[type] || ['Địa điểm du lịch lý thú tại Việt Nam.'];
  return list[Math.floor(Math.random() * list.length)];
};

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * Dữ liệu để tạo 1 địa điểm import. `ai` là dữ liệu Gemini đã kiểm tra (có thể null hoặc thiếu field);
 * field nào thiếu thì dùng dữ liệu mẫu ngẫu nhiên. Ảnh luôn là ảnh mẫu (Gemini không cung cấp ảnh).
 */
const buildPlaceData = (type, item, cityName, ai) => {
  const base = {
    ...item,
    description: ai?.description || generateDescription(item.name, cityName, type),
    images: getRandomImages(type, 5),
  };

  switch (type) {
    case 'Hotel':
      return {
        ...base,
        stars: ai?.stars ?? Math.floor(Math.random() * 3) + 3, // 3 - 5 sao
        pricePerNight: ai?.price ?? (Math.floor(Math.random() * 6) + 2) * 400000, // 800k - 3.2tr
      };
    case 'Attraction':
      return { ...base, admissionFee: ai?.price ?? pickRandom([0, 20000, 30000, 50000, 100000]) };
    case 'Restaurant':
      return {
        ...base,
        cuisineType: ai?.cuisineType || pickRandom(['Ẩm thực Việt Nam', 'Đặc sản địa phương', 'Hải sản tươi sống', 'Món ăn gia đình']),
        price: ai?.price ?? pickRandom([50000, 80000, 100000, 150000, 200000, 300000, 500000]),
      };
    case 'Cafe':
      return { ...base, price: ai?.price ?? pickRandom([20000, 30000, 45000, 60000, 80000, 100000]) };
    default:
      return base;
  }
};

// Mỗi loại lấy dư từ OSM (limit × 3, tối đa 150) rồi mới chọn `limit` địa điểm CHƯA có trong DB,
// nhờ vậy import lại lần sau lấy được nhóm địa điểm tiếp theo thay vì nhận lại đúng các địa điểm cũ
const FETCH_MULTIPLIER = 3;
const MAX_FETCH_PER_TYPE = 150;

const ATTRACTION_TOURISM_TAGS = ['attraction', 'museum', 'viewpoint'];

/** Loại địa điểm của 1 phần tử OSM (thứ tự ưu tiên giữ như trước: khách sạn > nhà hàng > cafe > điểm tham quan) */
const classifyOsmElement = (tags) => {
  if (tags.tourism === 'hotel') return 'Hotel';
  if (tags.amenity === 'restaurant') return 'Restaurant';
  if (tags.amenity === 'cafe') return 'Cafe';
  if (ATTRACTION_TOURISM_TAGS.includes(tags.tourism)) return 'Attraction';
  return null;
};

/** Tên, địa chỉ, tọa độ của 1 phần tử OSM. Khu vực (way / relation) dùng tọa độ tâm (`center`) */
const toPlaceItem = (el, city) => {
  const tags = el.tags || {};
  const name = (tags.name || tags.name_vi || tags.name_en || '').trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name,
    city: city._id,
    address: tags['addr:street']
      ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
      : `${city.name}, Việt Nam`,
    coordinates: { lat, lng },
  };
};

// @desc    Import POIs from OpenStreetMap (OSM)
// @route   POST /api/admin/import/osm
// @access  Private/Admin
const importFromOSM = asyncHandler(async (req, res) => {
  const { cityId, cityName, limit } = req.body;

  if (!cityId && !cityName) {
    throw httpError(res, 400, 'Please provide either cityId or cityName', ERROR_CODES.MISSING_FIELDS);
  }

  // Số địa điểm MỚI tối đa cho MỖI loại theo tham số limit của Admin (1-50, mặc định 30).
  // Chặn trên để prompt gửi Gemini và thời gian import không quá lớn.
  const parsedLimit = Number.parseInt(limit, 10);
  const perTypeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_IMPORT_LIMIT) : DEFAULT_IMPORT_LIMIT;

  // 1. Xác định thành phố và tọa độ.
  //    Thành phố chưa có thì chỉ lấy tọa độ từ Nominatim, CHƯA lưu: Overpass lỗi thì không để lại thành phố trống.
  let city = null;
  let newCityName = null;
  let coordinates;

  if (cityId) {
    city = await City.findById(cityId);
    if (!city) {
      throw httpError(res, 404, 'City not found', ERROR_CODES.CITY_NOT_FOUND);
    }
  } else {
    // Tìm theo tên thành phố, không phân biệt hoa/thường và dấu:
    // đã có "Da Lat" thì import "Đà Lạt" sẽ dùng lại thành phố đó, không tạo trùng
    if (typeof cityName !== 'string' || !cityName.trim()) {
      throw httpError(res, 400, 'Please provide either cityId or cityName', ERROR_CODES.MISSING_FIELDS);
    }
    newCityName = cityName.trim();
    city = await findCityByName(newCityName);
    if (!city) {
      console.log(`[Import Tool] Geocoding city name "${newCityName}"...`);
      coordinates = await geocodeCity(newCityName);
    }
  }

  if (city) {
    const { lat, lng } = city.coordinates || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400);
      throw new Error('City coordinates are missing');
    }
    coordinates = { lat, lng };
  }

  // 2. Lấy địa điểm quanh thành phố (bán kính khoảng 5-10km) từ Overpass.
  //    Overpass quá tải / quá hạn chót thì chuyển sang nguồn dự phòng Nominatim (ít địa điểm hơn, không có khu vực).
  const perTypeFetch = Math.min(perTypeLimit * FETCH_MULTIPLIER, MAX_FETCH_PER_TYPE);
  let elements;
  let source = 'overpass';
  try {
    ({ elements } = await queryOverpass(buildOverpassQuery(coordinates, perTypeFetch)));
  } catch (err) {
    if (err?.code !== ERROR_CODES.OSM_UNAVAILABLE) throw err;
    console.warn('[Import Tool] Overpass không trả kết quả, chuyển sang nguồn dự phòng Nominatim');
    elements = await queryNominatimPlaces(coordinates, perTypeFetch);
    source = 'nominatim';
  }

  // 3. Lấy được địa điểm rồi mới tạo thành phố mới
  if (!city) {
    // Một request import khác có thể đã tạo thành phố này trong lúc chờ Overpass
    city = await findCityByName(newCityName);
    if (!city) {
      const cityImages = SAMPLE_IMAGES.Attraction;
      city = await City.create({
        name: newCityName,
        description: `Thành phố du lịch nổi tiếng ${newCityName}, Việt Nam.`,
        image: cityImages[Math.floor(Math.random() * cityImages.length)],
        coordinates,
      });
      console.log(`[Import Tool] Created new city "${newCityName}" at lat: ${coordinates.lat}, lng: ${coordinates.lng}`);
    }
  }

  // 4. Phân loại các phần tử OSM thu được
  const groups = [
    { type: 'Hotel', Model: Hotel, statKey: 'hotelsImported' },
    { type: 'Attraction', Model: Attraction, statKey: 'attractionsImported' },
    { type: 'Restaurant', Model: Restaurant, statKey: 'restaurantsImported' },
    { type: 'Cafe', Model: Cafe, statKey: 'cafesImported' },
  ].map((group) => ({ ...group, items: [] }));
  const groupByType = Object.fromEntries(groups.map((g) => [g.type, g]));

  for (const el of elements) {
    const type = classifyOsmElement(el.tags || {});
    const item = type && toPlaceItem(el, city);
    if (item) groupByType[type].items.push(item);
  }

  // 5. Chọn tối đa `limit` địa điểm CHƯA có trong DB cho mỗi loại
  //    (chống trùng theo tên + thành phố, kể cả trùng trong cùng lần import; mỗi loại 1 truy vấn DB)
  //    Không ghi rating / numReviews: để mặc định 0, chỉ đánh giá thật của người dùng mới tính điểm
  await Promise.all(groups.map(async (group) => {
    const seen = new Set();
    const candidates = group.items.filter((item) => !seen.has(item.name) && seen.add(item.name));
    const existing = candidates.length
      ? new Set(await group.Model.distinct('name', { city: city._id, name: { $in: candidates.map((item) => item.name) } }))
      : new Set();
    group.newItems = candidates.filter((item) => !existing.has(item.name)).slice(0, perTypeLimit);
  }));

  // 6. Gemini viết mô tả + giá tham khảo (mỗi loại 1 lần gọi, chạy song song).
  //    Gemini lỗi / chưa cấu hình thì dùng mô tả mẫu + giá ngẫu nhiên như trước.
  const enrichment = await enrichImportedPlaces({
    cityName: city.name,
    groups: Object.fromEntries(groups.map((g) => [g.type, g.newItems.map((item) => item.name)])),
    timeoutMs: Number(process.env.GEMINI_IMPORT_TIMEOUT_MS) || undefined,
  });

  // 7. Lưu vào DB: mỗi loại 1 lần insertMany. Địa điểm không qua validate (hiếm) thì bỏ qua và ghi log.
  const stats = {};
  let aiGenerated = 0;
  let templateGenerated = 0;

  await Promise.all(groups.map(async (group) => {
    const aiDetails = enrichment.details[group.type] || [];
    const docs = [];
    group.newItems.forEach((item, i) => {
      const ai = aiDetails[i] || null;
      const data = buildPlaceData(group.type, item, city.name, ai);
      const invalid = new group.Model(data).validateSync();
      if (invalid) {
        console.warn(`[Import Tool] Bỏ qua ${group.type} "${item.name}": ${invalid.message}`);
        return;
      }
      docs.push(data);
      if (ai) aiGenerated++;
      else templateGenerated++;
    });
    if (docs.length) await group.Model.insertMany(docs);
    stats[group.statKey] = docs.length;
  }));
  // Giữ thứ tự field của stats như trước
  const orderedStats = Object.fromEntries(groups.map((g) => [g.statKey, stats[g.statKey]]));
  orderedStats.totalImported = aiGenerated + templateGenerated;

  res.json({
    message: `Successfully imported places for ${city.name} from OpenStreetMap`,
    // Nguồn dữ liệu: 'overpass' (chính) | 'nominatim' (dự phòng khi Overpass quá tải; ít địa điểm hơn)
    source,
    stats: orderedStats,
    enrichment: {
      // Số địa điểm có mô tả + giá do Gemini viết / do mẫu có sẵn sinh ngẫu nhiên
      aiGenerated,
      templateGenerated,
      // false khi server chưa cấu hình GEMINI_API_KEY
      geminiEnabled: enrichment.enabled,
      // Các loại địa điểm Gemini lỗi (hết hạn mức, quá thời gian...) nên dùng dữ liệu mẫu
      failedTypes: enrichment.failedTypes,
    },
  });
});

// Danh sách 63 tỉnh thành và các địa danh du lịch phổ biến của Việt Nam
const VIETNAM_CITIES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định", 
  "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", 
  "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", 
  "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", 
  "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", 
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", 
  "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", 
  "Tiền Giang", "TP. Hồ Chí Minh", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
  "Phú Quốc", "Hội An", "Nha Trang", "Đà Lạt", "Sa Pa", "Phan Thiết", "Vũng Tàu", "Quy Nhơn", 
  "Huế", "Sầm Sơn", "Đồ Sơn", "Côn Đảo", "Mũi Né", "Phan Rang", "Tuy Hòa", "Móng Cái", "Hạ Long"
];

const getVietnamCities = asyncHandler(async (req, res) => {
  res.status(200).json(VIETNAM_CITIES);
});

export { importFromOSM, getVietnamCities };
