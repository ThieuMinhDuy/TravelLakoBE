import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Connect to DB
import connectDB from '../config/db.js';
connectDB();

// Models
import User from '../models/userModel.js';
import City from '../models/cityModel.js';
import Attraction from '../models/attractionModel.js';
import Hotel from '../models/hotelModel.js';
import Restaurant from '../models/restaurantModel.js';
import Cafe from '../models/cafeModel.js';
import Trip from '../models/tripModel.js';
import Review from '../models/reviewModel.js';
import Favorite from '../models/favoriteModel.js';

// Hashing helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const seedData = async () => {
  try {
    // 1. Dọn dẹp dữ liệu cũ
    console.log('Đang dọn dẹp dữ liệu cũ...');
    await User.deleteMany();
    await City.deleteMany();
    await Attraction.deleteMany();
    await Hotel.deleteMany();
    await Restaurant.deleteMany();
    await Cafe.deleteMany();
    await Trip.deleteMany();
    await Review.deleteMany();
    await Favorite.deleteMany();
    console.log('Đã dọn dẹp xong.');

    // 2. Tạo tài khoản mẫu
    const hashedAdminPassword = await hashPassword('admin123');
    const hashedUserPassword = await hashPassword('user123');

    const createdUsers = await User.insertMany([
      {
        name: 'System Admin',
        email: 'admin@travel.com',
        password: hashedAdminPassword,
        isAdmin: true,
        isVerified: true,
        isBlocked: false,
      },
      {
        name: 'Regular Customer',
        email: 'customer@travel.com',
        password: hashedUserPassword,
        isAdmin: false,
        isVerified: true,
        isBlocked: false,
      },
    ]);
    console.log('-> Tạo tài khoản Admin & Customer thành công.');

    // 3. Khởi tạo 6 thành phố du lịch hàng đầu Việt Nam
    const citiesData = [
      {
        name: 'Hà Nội',
        description: 'Thủ đô ngàn năm văn hiến với nét ẩm thực độc đáo, phố cổ cổ kính và hồ nước thơ mộng.',
        image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7',
        coordinates: { lat: 21.0285, lng: 105.8542 }
      },
      {
        name: 'TP. Hồ Chí Minh',
        description: 'Đô thị năng động nhất Việt Nam, nơi giao hòa giữa nét hiện đại sầm uất và di sản lịch sử phong phú.',
        image: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
        coordinates: { lat: 10.8231, lng: 106.6297 }
      },
      {
        name: 'Đà Nẵng',
        description: 'Thành phố đáng sống bậc nhất miền Trung với những cây cầu độc đáo và bãi biển cát trắng trải dài.',
        image: 'https://images.unsplash.com/photo-1559592481-74153d4edd19',
        coordinates: { lat: 16.0544, lng: 108.2022 }
      },
      {
        name: 'Hội An',
        description: 'Đô thị cổ quyến rũ với những con phố đèn lồng rực rỡ và nhịp sống hoài cổ, bình yên.',
        image: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7',
        coordinates: { lat: 15.8801, lng: 108.338 }
      },
      {
        name: 'Nha Trang',
        description: 'Thiên đường du lịch biển đảo với vịnh biển đẹp thế giới, nắng ấm quanh năm và hải sản phong phú.',
        image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43',
        coordinates: { lat: 12.2388, lng: 109.1967 }
      },
      {
        name: 'Đà Lạt',
        description: 'Thành phố sương mù lãng mạn, khí hậu ôn đới quanh năm mát mẻ với ngập tràn sắc hoa và rừng thông.',
        image: 'https://images.unsplash.com/photo-1589136777351-fd4e30a05503',
        coordinates: { lat: 11.9404, lng: 108.4583 }
      }
    ];

    const createdCities = await City.insertMany(citiesData);
    console.log('-> Tạo 6 thành phố thành công.');

    // Map ID thành phố để tham chiếu dễ dàng
    const cityMap = {};
    createdCities.forEach(city => {
      cityMap[city.name] = city._id;
    });

    // 4. Tạo các địa điểm du lịch cho từng thành phố
    // --- HÀ NỘI ---
    const hanoiId = cityMap['Hà Nội'];
    const hanoiPlaces = {
      attractions: [
        {
          name: 'Hồ Hoàn Kiếm & Đền Ngọc Sơn',
          city: hanoiId,
          description: 'Trái tim của thủ đô Hà Nội, gắn liền với truyền thuyết hoàn gươm thần kì.',
          images: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1'],
          admissionFee: 30000,
          address: 'Đinh Tiên Hoàng, Hàng Trống, Hoàn Kiếm, Hà Nội',
          coordinates: { lat: 21.0286, lng: 105.8522 },
          rating: 4.7,
          numReviews: 250
        },
        {
          name: 'Lăng Chủ tịch Hồ Chí Minh',
          city: hanoiId,
          description: 'Nơi lưu giữ thi hài của Chủ tịch Hồ Chí Minh vĩ đại, điểm viếng thăm linh thiêng.',
          images: ['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375'],
          admissionFee: 0,
          address: 'Hùng Vương, Điện Biên, Ba Đình, Hà Nội',
          coordinates: { lat: 21.0368, lng: 105.8346 },
          rating: 4.9,
          numReviews: 320
        }
      ],
      hotels: [
        {
          name: 'Sofitel Legend Metropole Hanoi',
          city: hanoiId,
          description: 'Khách sạn 5 sao mang phong cách kiến trúc Pháp cổ kính sang trọng tại trung tâm Hà Nội.',
          images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
          stars: 5,
          pricePerNight: 4500000,
          address: '15 Ngô Quyền, Tràng Tiền, Hoàn Kiếm, Hà Nội',
          coordinates: { lat: 21.0262, lng: 105.8561 },
          rating: 4.8,
          numReviews: 180
        },
        {
          name: 'Hanoi La Siesta Hotel & Spa',
          city: hanoiId,
          description: 'Chuỗi khách sạn boutique nổi tiếng với chất lượng dịch vụ chăm sóc khách hàng hàng đầu.',
          images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'],
          stars: 4,
          pricePerNight: 1800000,
          address: '94 Mã Mây, Hàng Buồm, Hoàn Kiếm, Hà Nội',
          coordinates: { lat: 21.0345, lng: 105.8526 },
          rating: 4.7,
          numReviews: 95
        }
      ],
      restaurants: [
        {
          name: 'Phở Thìn Lò Đúc',
          city: hanoiId,
          description: 'Thương hiệu phở bò tái lăn nổi tiếng Hà Nội với nước dùng béo ngậy ngập hành.',
          images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'],
          cuisineType: 'Ẩm thực Việt Nam / Phở',
          priceRange: '$$',
          address: '13 Lò Đúc, Phạm Đình Hổ, Hai Bà Trưng, Hà Nội',
          coordinates: { lat: 21.0189, lng: 105.8559 },
          rating: 4.5,
          numReviews: 140
        },
        {
          name: 'Bún chả Hương Liên (Bun Cha Obama)',
          city: hanoiId,
          description: 'Nơi cựu Tổng thống Mỹ Barack Obama từng ghé thăm và thưởng thức ẩm thực bún chả đặc sản.',
          images: ['https://images.unsplash.com/photo-1541832676-9b763b0239ab'],
          cuisineType: 'Bún chả Hà Nội',
          priceRange: '$$',
          address: '24 Lê Văn Hưu, Phan Chu Trinh, Hai Bà Trưng, Hà Nội',
          coordinates: { lat: 21.0194, lng: 105.8546 },
          rating: 4.4,
          numReviews: 210
        }
      ],
      cafes: [
        {
          name: 'Cafe Giảng',
          city: hanoiId,
          description: 'Quán cà phê trứng lâu đời nhất tại Hà Nội với công thức cà phê trứng gia truyền béo ngậy.',
          images: ['https://images.unsplash.com/photo-1447078806655-40579c2520d6'],
          priceRange: '$',
          address: '39 Nguyễn Hữu Huân, Lý Thái Tổ, Hoàn Kiếm, Hà Nội',
          coordinates: { lat: 21.0335, lng: 105.8553 },
          rating: 4.6,
          numReviews: 350
        }
      ]
    };

    // --- TP. HỒ CHÍ MINH ---
    const hcmId = cityMap['TP. Hồ Chí Minh'];
    const hcmPlaces = {
      attractions: [
        {
          name: 'Dinh Độc Lập',
          city: hcmId,
          description: 'Di tích lịch sử quốc gia đặc biệt, nơi chứng kiến thời khắc lịch sử thống nhất đất nước.',
          images: ['https://images.unsplash.com/photo-1508672019048-805c876b67e2'],
          admissionFee: 40000,
          address: '135 Nam Kỳ Khởi Nghĩa, Bến Thành, Quận 1, TP. HCM',
          coordinates: { lat: 10.7770, lng: 106.6953 },
          rating: 4.6,
          numReviews: 150
        },
        {
          name: 'Nhà thờ Đức Bà Sài Gòn',
          city: hcmId,
          description: 'Công trình kiến trúc tôn giáo Gothic cổ kính bằng gạch đỏ đặc trưng tại trung tâm Sài Gòn.',
          images: ['https://images.unsplash.com/photo-1540959733332-eab4deceeaf7'],
          admissionFee: 0,
          address: '1 Công xã Paris, Bến Nghé, Quận 1, TP. HCM',
          coordinates: { lat: 10.7798, lng: 106.6990 },
          rating: 4.5,
          numReviews: 110
        }
      ],
      hotels: [
        {
          name: 'The Reverie Saigon',
          city: hcmId,
          description: 'Khách sạn siêu sang bậc nhất thành phố mang phong cách hoàng gia Ý tráng lệ.',
          images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'],
          stars: 5,
          pricePerNight: 6500000,
          address: '22-36 Nguyễn Huệ, Bến Nghé, Quận 1, TP. HCM',
          coordinates: { lat: 10.7752, lng: 106.7032 },
          rating: 4.9,
          numReviews: 70
        }
      ],
      restaurants: [
        {
          name: 'Nhà hàng Ngon',
          city: hcmId,
          description: 'Không gian biệt thự Pháp phục vụ hàng trăm món ăn đường phố Việt Nam ba miền tinh tế.',
          images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5'],
          cuisineType: 'Ẩm thực Việt ba miền',
          priceRange: '$$$',
          address: '160 Pasteur, Bến Nghé, Quận 1, TP. HCM',
          coordinates: { lat: 10.7788, lng: 106.6985 },
          rating: 4.4,
          numReviews: 180
        }
      ],
      cafes: [
        {
          name: 'Cộng Cà Phê Bùi Viện',
          city: hcmId,
          description: 'Quán nước mang phong cách thời kỳ bao cấp đặc trưng với món cà phê cốt dừa trứ danh.',
          images: ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb'],
          priceRange: '$$',
          address: '127-129 Bùi Viện, Phạm Ngũ Lão, Quận 1, TP. HCM',
          coordinates: { lat: 10.7674, lng: 106.6934 },
          rating: 4.3,
          numReviews: 90
        }
      ]
    };

    // --- ĐÀ NẴNG ---
    const danangId = cityMap['Đà Nẵng'];
    const danangPlaces = {
      attractions: [
        {
          name: 'Sun World Ba Na Hills (Cầu Vàng)',
          city: danangId,
          description: 'Khu du lịch trên đỉnh núi Chúa nổi tiếng thế giới với Cầu Vàng khổng lồ nâng đỡ bởi bàn tay.',
          images: ['https://images.unsplash.com/photo-1559592481-74153d4edd19'],
          admissionFee: 900000,
          address: 'Hòa Phú, Hòa Vang, Đà Nẵng',
          coordinates: { lat: 15.9949, lng: 107.9965 },
          rating: 4.8,
          numReviews: 450
        },
        {
          name: 'Bán đảo Sơn Trà & Chùa Linh Ứng',
          city: danangId,
          description: 'Lá phổi xanh của Đà Nẵng, nổi bật với tượng Phật Bà Quan Âm cao nhất Việt Nam.',
          images: ['https://images.unsplash.com/photo-1540959733332-eab4deceeaf7'],
          admissionFee: 0,
          address: 'Sơn Trà, Đà Nẵng',
          coordinates: { lat: 16.1205, lng: 108.2783 },
          rating: 4.7,
          numReviews: 280
        }
      ],
      hotels: [
        {
          name: 'InterContinental Danang Sun Peninsula Resort',
          city: danangId,
          description: 'Khu nghỉ dưỡng sang trọng bậc nhất thế giới ẩn mình giữa bán đảo Sơn Trà.',
          images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
          stars: 5,
          pricePerNight: 9500000,
          address: 'Bán đảo Sơn Trà, Đà Nẵng',
          coordinates: { lat: 16.1221, lng: 108.2834 },
          rating: 4.9,
          numReviews: 120
        }
      ],
      restaurants: [
        {
          name: 'Bánh xèo Bà Dưỡng',
          city: danangId,
          description: 'Địa chỉ bánh xèo, nem lụi nổi tiếng bậc nhất Đà Nẵng với nước tương chấm gia truyền đậm đà.',
          images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'],
          cuisineType: 'Đặc sản miền Trung',
          priceRange: '$$',
          address: '280/23 Hoàng Diệu, Bình Hiên, Hải Châu, Đà Nẵng',
          coordinates: { lat: 16.0601, lng: 108.2155 },
          rating: 4.5,
          numReviews: 310
        }
      ],
      cafes: [
        {
          name: 'Reply 1988 Cafe',
          city: danangId,
          description: 'Không gian quán cà phê hiện đại mang đậm tính thẩm mỹ Hàn Quốc, điểm checkin thu hút giới trẻ.',
          images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'],
          priceRange: '$$',
          address: '20 Lê Hồng Phong, Phước Ninh, Hải Châu, Đà Nẵng',
          coordinates: { lat: 16.0628, lng: 108.2223 },
          rating: 4.4,
          numReviews: 75
        }
      ]
    };

    // --- HỘI AN ---
    const hoianId = cityMap['Hội An'];
    const hoianPlaces = {
      attractions: [
        {
          name: 'Chùa Cầu Hội An',
          city: hoianId,
          description: 'Biểu tượng di sản giao lưu văn hóa Việt - Nhật cổ kính tại trung tâm phố cổ.',
          images: ['https://images.unsplash.com/photo-1540959733332-eab4deceeaf7'],
          admissionFee: 0,
          address: 'Nguyễn Thị Minh Khai, Minh An, Hội An, Quảng Nam',
          coordinates: { lat: 15.8771, lng: 108.3260 },
          rating: 4.6,
          numReviews: 210
        }
      ],
      hotels: [
        {
          name: 'Anantara Hoi An Resort',
          city: hoianId,
          description: 'Khu resort 5 sao nằm dọc bờ sông Thu Bồn lãng mạn mang đậm chất kiến trúc thuộc địa.',
          images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'],
          stars: 5,
          pricePerNight: 3500000,
          address: '1 Phạm Hồng Thái, Cẩm Châu, Hội An',
          coordinates: { lat: 15.8795, lng: 108.3361 },
          rating: 4.8,
          numReviews: 80
        }
      ],
      restaurants: [
        {
          name: 'Bánh mì Phượng',
          city: hoianId,
          description: 'Tiệm bánh mì nổi tiếng thế giới được đầu bếp Anthony Bourdain dành nhiều lời khen ngợi.',
          images: ['https://images.unsplash.com/photo-1540713434306-585de5e8b61a'],
          cuisineType: 'Bánh mì đặc sản',
          priceRange: '$',
          address: '2B Phan Chu Trinh, Cẩm Châu, Hội An',
          coordinates: { lat: 15.8789, lng: 108.3323 },
          rating: 4.4,
          numReviews: 400
        }
      ],
      cafes: [
        {
          name: 'Mot Hoi An (Nước Mót)',
          city: hoianId,
          description: 'Nước thảo mộc đặc sản Hội An thơm hương chanh sả quế, trang trí bằng đóa sen trang nhã.',
          images: ['https://images.unsplash.com/photo-1447078806655-40579c2520d6'],
          priceRange: '$',
          address: '150 Trần Phú, Minh An, Hội An',
          coordinates: { lat: 15.8778, lng: 108.3289 },
          rating: 4.7,
          numReviews: 500
        }
      ]
    };

    // --- NHA TRANG ---
    const nhatrangId = cityMap['Nha Trang'];
    const nhatrangPlaces = {
      attractions: [
        {
          name: 'Tháp Bà Ponagar',
          city: nhatrangId,
          description: 'Công trình đền tháp Chăm cổ vĩ đại, điểm nhấn kiến trúc lịch sử đặc trưng vùng duyên hải miền Trung.',
          images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'],
          admissionFee: 30000,
          address: '2 Tháng 4, Vĩnh Phước, Nha Trang',
          coordinates: { lat: 12.2654, lng: 109.1959 },
          rating: 4.6,
          numReviews: 180
        }
      ],
      hotels: [
        {
          name: 'Amiana Resort Nha Trang',
          city: nhatrangId,
          description: 'Khu resort 5 sao sang trọng sở hữu hồ bơi nước biển tự nhiên rộng lớn tại vịnh Nha Trang.',
          images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'],
          stars: 5,
          pricePerNight: 3200000,
          address: 'Phạm Văn Đồng, Vĩnh Hòa, Nha Trang',
          coordinates: { lat: 12.3089, lng: 109.2155 },
          rating: 4.8,
          numReviews: 95
        }
      ],
      restaurants: [
        {
          name: 'Nem nướng Đặng Văn Quyên',
          city: nhatrangId,
          description: 'Quán nem nướng đặc sản Ninh Hòa lâu đời, hương vị nem thơm chấm nước tương đặc trưng.',
          images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5'],
          cuisineType: 'Nem nướng đặc sản',
          priceRange: '$$',
          address: '16A Lãn Ông, Xương Huân, Nha Trang',
          coordinates: { lat: 12.2534, lng: 109.1950 },
          rating: 4.3,
          numReviews: 110
        }
      ],
      cafes: [
        {
          name: 'Rainforest Nha Trang',
          city: nhatrangId,
          description: 'Quán cafe độc đáo thiết kế như một ngôi nhà gỗ giữa rừng nhiệt đới ngập tràn cây xanh.',
          images: ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb'],
          priceRange: '$$',
          address: '146 Võ Trứ, Tân Lập, Nha Trang',
          coordinates: { lat: 12.2415, lng: 109.1901 },
          rating: 4.5,
          numReviews: 130
        }
      ]
    };

    // --- ĐÀ LẠT ---
    const dalatId = cityMap['Đà Lạt'];
    const dalatPlaces = {
      attractions: [
        {
          name: 'Quảng trường Lâm Viên & Hồ Xuân Hương',
          city: dalatId,
          description: 'Không gian dạo mát biểu tượng của Đà Lạt nổi bật với kiến trúc Atisô và hoa Dã Quỳ khổng lồ.',
          images: ['https://images.unsplash.com/photo-1589136777351-fd4e30a05503'],
          admissionFee: 0,
          address: 'Đường Trần Quốc Toản, Phường 1, Đà Lạt',
          coordinates: { lat: 11.9377, lng: 108.4447 },
          rating: 4.7,
          numReviews: 290
        }
      ],
      hotels: [
        {
          name: 'Colline Hotel Dalat',
          city: dalatId,
          description: 'Khách sạn cao cấp hiện đại tọa lạc ngay cạnh Chợ Đà Lạt với thiết kế độc đáo ấn tượng.',
          images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
          stars: 4,
          pricePerNight: 1600000,
          address: '10 Phan Bội Châu, Phường 1, Đà Lạt',
          coordinates: { lat: 11.9427, lng: 108.4385 },
          rating: 4.6,
          numReviews: 115
        }
      ],
      restaurants: [
        {
          name: 'Lẩu gà lá é Tao Ngộ',
          city: dalatId,
          description: 'Món ăn làm nên thương hiệu ẩm thực Đà Lạt giữa tiết trời se lạnh, nước lẩu ngọt thơm vị lá é.',
          images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'],
          cuisineType: 'Lẩu gà đặc sản',
          priceRange: '$$',
          address: '5 Đường 3 Tháng 4, Phường 3, Đà Lạt',
          coordinates: { lat: 11.9312, lng: 108.4441 },
          rating: 4.5,
          numReviews: 240
        }
      ],
      cafes: [
        {
          name: 'Tiệm cà phê Túi Mơ To',
          city: dalatId,
          description: 'Quán cafe nhà gỗ nổi tiếng ngập tràn hoa cúc họa mi với tầm nhìn thung lũng lãng mạn.',
          images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'],
          priceRange: '$$',
          address: 'Hẻm 31 Sào Nam, Phường 11, Đà Lạt',
          coordinates: { lat: 11.9455, lng: 108.4862 },
          rating: 4.8,
          numReviews: 380
        }
      ]
    };

    // Hàm helper lưu đồng loạt
    const savePlaces = async (placesGroup) => {
      await Attraction.insertMany(placesGroup.attractions || []);
      await Hotel.insertMany(placesGroup.hotels || []);
      await Restaurant.insertMany(placesGroup.restaurants || []);
      await Cafe.insertMany(placesGroup.cafes || []);
    };

    // Thực hiện lưu tất cả địa điểm du lịch
    await savePlaces(hanoiPlaces);
    await savePlaces(hcmPlaces);
    await savePlaces(danangPlaces);
    await savePlaces(hoianPlaces);
    await savePlaces(nhatrangPlaces);
    await savePlaces(dalatPlaces);

    console.log('-> Đã nạp thành công dữ liệu địa điểm du lịch thực tế cho 6 thành phố Việt Nam!');
    console.log('\n=== HỆ THỐNG SEEDER DỮ LIỆU VIỆT NAM HOÀN THÀNH XUẤT SẮC ===');
    process.exit(0);

  } catch (error) {
    console.error('Lỗi khi nạp dữ liệu:', error.message);
    process.exit(1);
  }
};

seedData();
