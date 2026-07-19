import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

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

// @desc    Import POIs from OpenStreetMap (OSM)
// @route   POST /api/admin/import/osm
// @access  Private/Admin
const importFromOSM = asyncHandler(async (req, res) => {
  let { cityId, cityName, limit = 30 } = req.body;

  if (!cityId && !cityName) {
    res.status(400);
    throw new Error('Please provide either cityId or cityName');
  }

  let city;
  if (cityId) {
    // 1. Kiểm tra thành phố theo ID có tồn tại
    city = await City.findById(cityId);
    if (!city) {
      res.status(404);
      throw new Error('City not found');
    }
  } else {
    // 2. Tìm theo tên thành phố (không phân biệt hoa thường)
    const normalizedName = cityName.trim();
    city = await City.findOne({ name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } });

    if (!city) {
      // Gọi API địa lý Nominatim miễn phí của OpenStreetMap để định vị tọa độ
      console.log(`[Import Tool] Geocoding city name "${normalizedName}"...`);
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalizedName + ', Vietnam')}&format=json&limit=1`;
      
      try {
        const geoRes = await fetch(geocodeUrl, {
          headers: { 'User-Agent': 'TravelLakoPlannerAgent/1.0' }
        });
        const geoData = await geoRes.json();

        if (!geoRes.ok || !geoData || geoData.length === 0) {
          res.status(400);
          throw new Error(`Không thể tìm thấy tọa độ cho thành phố "${normalizedName}". Vui lòng kiểm tra lại chính tả!`);
        }

        const lat = parseFloat(geoData[0].lat);
        const lng = parseFloat(geoData[0].lon);

        // Gán một ảnh phong cảnh ngẫu nhiên từ thư viện
        const cityImages = SAMPLE_IMAGES.Attraction;
        const randomCityImage = cityImages[Math.floor(Math.random() * cityImages.length)];

        // Tạo thành phố mới lưu vào database
        city = await City.create({
          name: normalizedName,
          description: `Thành phố du lịch nổi tiếng ${normalizedName}, Việt Nam.`,
          image: randomCityImage,
          coordinates: { lat, lng }
        });
        console.log(`[Import Tool] Created new city "${normalizedName}" at lat: ${lat}, lng: ${lng}`);
      } catch (err) {
        if (res.statusCode === 200) res.status(400);
        throw new Error(err.message || 'Geocoding failed');
      }
    }
  }

  const { lat, lng } = city.coordinates || {};
  if (!lat || !lng) {
    res.status(400);
    throw new Error('City coordinates are missing');
  }

  // Cập nhật lại cityId để dùng lưu địa điểm
  cityId = city._id;

  // 2. Tính toán Bounding Box (bán kính khoảng 5-10km bao quanh lat, lng)
  const offset = 0.05;
  const minLat = lat - offset;
  const maxLat = lat + offset;
  const minLng = lng - offset;
  const maxLng = lng + offset;

  // 3. Xây dựng truy vấn Overpass QL
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"="hotel"](${minLat},${minLng},${maxLat},${maxLng});
      node["amenity"="restaurant"](${minLat},${minLng},${maxLat},${maxLng});
      node["amenity"="cafe"](${minLat},${minLng},${maxLat},${maxLng});
      node["tourism"~"attraction|museum|viewpoint"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out body 200;
  `;

  // Danh sách mirror Overpass API dự phòng
  const mirrors = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  let osmData = null;
  let successMirror = '';

  // Gọi API với cơ chế Timeout và Fallback
  for (const url of mirrors) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 giây timeout

    try {
      console.log(`[Import Tool] Querying OSM from: ${url}...`);
      const targetUrl = `${url}?data=${encodeURIComponent(query)}`;
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'TravelLakoPlannerAgent/1.0' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        osmData = await response.json();
        successMirror = url;
        break; // Thành công thì thoát vòng lặp
      } else {
        console.warn(`[Import Tool] Mirror ${url} returned status: ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Import Tool] Mirror ${url} failed or timed out: ${err.message}`);
    }
  }

  if (!osmData || !osmData.elements) {
    res.status(503);
    throw new Error('All OpenStreetMap Overpass servers are currently busy or timed out. Please try again in a few moments.');
  }

  console.log(`[Import Tool] Successfully fetched ${osmData.elements.length} elements from ${successMirror}`);

  // 4. Phân loại các phần tử OSM thu được
  const fetchedHotels = [];
  const fetchedAttractions = [];
  const fetchedRestaurants = [];
  const fetchedCafes = [];

  osmData.elements.forEach(el => {
    const name = el.tags.name || el.tags.name_en || el.tags.name_vi;
    if (!name) return; // Bỏ qua địa điểm không có tên

    const coordinates = { lat: el.lat, lng: el.lon };
    const address = el.tags['addr:street'] 
      ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
      : `${city.name}, Việt Nam`;

    const basePlace = {
      name,
      city: cityId,
      address,
      coordinates,
    };

    if (el.tags.tourism === 'hotel') {
      fetchedHotels.push(basePlace);
    } else if (el.tags.amenity === 'restaurant') {
      fetchedRestaurants.push(basePlace);
    } else if (el.tags.amenity === 'cafe') {
      fetchedCafes.push(basePlace);
    } else if (['attraction', 'museum', 'viewpoint'].includes(el.tags.tourism)) {
      fetchedAttractions.push(basePlace);
    }
  });

  // Giới hạn số lượng nhập theo tham số limit của Admin
  const targetHotels = fetchedHotels.slice(0, limit);
  const targetAttractions = fetchedAttractions.slice(0, limit);
  const targetRestaurants = fetchedRestaurants.slice(0, limit);
  const targetCafes = fetchedCafes.slice(0, limit);

  // 5. Hàm lưu và chống trùng lặp dữ liệu vào DB
  const importStats = {
    hotels: 0,
    attractions: 0,
    restaurants: 0,
    cafes: 0
  };

  // Import Khách sạn
  for (const item of targetHotels) {
    const exists = await Hotel.findOne({ name: item.name, city: cityId });
    if (!exists) {
      await Hotel.create({
        ...item,
        description: generateDescription(item.name, city.name, 'Hotel'),
        images: getRandomImages('Hotel', 5),
        stars: Math.floor(Math.random() * 3) + 3, // 3 - 5 sao
        pricePerNight: (Math.floor(Math.random() * 6) + 2) * 400000, // 800k - 3.2tr
        rating: parseFloat((Math.random() * 0.8 + 4.0).toFixed(1)), // 4.0 - 4.8
        numReviews: Math.floor(Math.random() * 25) + 5 // 5 - 30 reviews
      });
      importStats.hotels++;
    }
  }

  // Import Điểm tham quan
  for (const item of targetAttractions) {
    const exists = await Attraction.findOne({ name: item.name, city: cityId });
    if (!exists) {
      const fees = [0, 20000, 30000, 50000, 100000];
      await Attraction.create({
        ...item,
        description: generateDescription(item.name, city.name, 'Attraction'),
        images: getRandomImages('Attraction', 5),
        admissionFee: fees[Math.floor(Math.random() * fees.length)],
        rating: parseFloat((Math.random() * 0.8 + 4.0).toFixed(1)),
        numReviews: Math.floor(Math.random() * 25) + 5
      });
      importStats.attractions++;
    }
  }

  // Import Nhà hàng
  for (const item of targetRestaurants) {
    const exists = await Restaurant.findOne({ name: item.name, city: cityId });
    if (!exists) {
      const cuisines = ['Ẩm thực Việt Nam', 'Đặc sản địa phương', 'Hải sản tươi sống', 'Món ăn gia đình'];
      const prices = [50000, 80000, 100000, 150000, 200000, 300000, 500000];
      await Restaurant.create({
        ...item,
        description: generateDescription(item.name, city.name, 'Restaurant'),
        images: getRandomImages('Restaurant', 5),
        cuisineType: cuisines[Math.floor(Math.random() * cuisines.length)],
        price: prices[Math.floor(Math.random() * prices.length)],
        rating: parseFloat((Math.random() * 0.8 + 4.0).toFixed(1)),
        numReviews: Math.floor(Math.random() * 25) + 5
      });
      importStats.restaurants++;
    }
  }

  // Import Quán cafe
  for (const item of targetCafes) {
    const exists = await Cafe.findOne({ name: item.name, city: cityId });
    if (!exists) {
      const prices = [20000, 30000, 45000, 60000, 80000, 100000];
      await Cafe.create({
        ...item,
        description: generateDescription(item.name, city.name, 'Cafe'),
        images: getRandomImages('Cafe', 5),
        price: prices[Math.floor(Math.random() * prices.length)],
        rating: parseFloat((Math.random() * 0.8 + 4.0).toFixed(1)),
        numReviews: Math.floor(Math.random() * 25) + 5
      });
      importStats.cafes++;
    }
  }

  res.json({
    message: `Successfully imported places for ${city.name} from OpenStreetMap`,
    stats: {
      hotelsImported: importStats.hotels,
      attractionsImported: importStats.attractions,
      restaurantsImported: importStats.restaurants,
      cafesImported: importStats.cafes,
      totalImported: importStats.hotels + importStats.attractions + importStats.restaurants + importStats.cafes
    }
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
