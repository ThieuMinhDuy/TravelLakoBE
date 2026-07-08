import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load env vars
dotenv.config();

// Connect to DB
import connectDB from './config/db.js';
connectDB();

// Models
import User from './models/userModel.js';
import City from './models/cityModel.js';
import Attraction from './models/attractionModel.js';
import Hotel from './models/hotelModel.js';
import Restaurant from './models/restaurantModel.js';
import Cafe from './models/cafeModel.js';
import Trip from './models/tripModel.js';
import Review from './models/reviewModel.js';
import Favorite from './models/favoriteModel.js';

// Hashing helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const importData = async () => {
  try {
    // Clear all existing data
    await User.deleteMany();
    await City.deleteMany();
    await Attraction.deleteMany();
    await Hotel.deleteMany();
    await Restaurant.deleteMany();
    await Cafe.deleteMany();
    await Trip.deleteMany();
    await Review.deleteMany();
    await Favorite.deleteMany();

    console.log('Database cleared...');

    // 1. Create Users
    const hashedAdminPassword = await hashPassword('admin123');
    const hashedUserPassword = await hashPassword('user123');

    const createdUsers = await User.insertMany([
      {
        name: 'System Admin',
        email: 'admin@travel.com',
        password: hashedAdminPassword,
        isAdmin: true,
      },
      {
        name: 'Regular Customer',
        email: 'customer@travel.com',
        password: hashedUserPassword,
        isAdmin: false,
      },
    ]);

    const adminUser = createdUsers[0]._id;
    const regularUser = createdUsers[1]._id;

    // 2. Create Cities
    const createdCities = await City.insertMany([
      {
        name: 'Hà Nội',
        description: 'Thủ đô ngàn năm văn hiến với nét ẩm thực độc đáo.',
        image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7',
        coordinates: { lat: 21.0285, lng: 105.8542 },
      },
      {
        name: 'Đà Nẵng',
        description: 'Thành phố của những cây cầu và những bãi biển đẹp.',
        image: 'https://images.unsplash.com/photo-1559592481-74153d4edd19',
        coordinates: { lat: 16.0544, lng: 108.2022 },
      },
    ]);

    const hanoiId = createdCities[0]._id;
    const danangId = createdCities[1]._id;

    // 3. Create Attractions
    const createdAttractions = await Attraction.insertMany([
      {
        name: 'Lăng Chủ tịch Hồ Chí Minh',
        city: hanoiId,
        description: 'Nơi an nghỉ cuối cùng của vị lãnh tụ kính yêu.',
        images: ['https://images.unsplash.com/photo-1599707367072-cd6ada2bc375'],
        admissionFee: 0,
        address: 'Hùng Vương, Điện Biên, Ba Đình, Hà Nội',
        coordinates: { lat: 21.0368, lng: 105.8346 },
        rating: 4.8,
        numReviews: 120,
      },
    ]);

    const langBacId = createdAttractions[0]._id;

    // 4. Create Hotels
    const createdHotels = await Hotel.insertMany([
      {
        name: 'Melia Hanoi',
        city: hanoiId,
        description: 'Khách sạn 5 sao sang trọng tại trung tâm thành phố.',
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        stars: 5,
        pricePerNight: 2500000,
        address: '44 Lý Thường Kiệt, Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
        coordinates: { lat: 21.0253, lng: 105.8491 },
        rating: 4.5,
        numReviews: 85,
      },
    ]);

    const meliaId = createdHotels[0]._id;

    // 5. Create Restaurants
    const createdRestaurants = await Restaurant.insertMany([
      {
        name: 'Phở Thìn Bờ Hồ',
        city: hanoiId,
        description: 'Quán phở gia truyền nổi tiếng lâu đời.',
        images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43'],
        cuisineType: 'Ẩm thực Việt Nam / Phở',
        priceRange: '$',
        address: '61 Đinh Tiên Hoàng, Lý Thái Tổ, Hoàn Kiếm, Hà Nội',
        coordinates: { lat: 21.0298, lng: 105.8524 },
        rating: 4.2,
        numReviews: 240,
      },
    ]);

    const phoThinId = createdRestaurants[0]._id;

    // 6. Create Cafes
    const createdCafes = await Cafe.insertMany([
      {
        name: 'Cộng Cà Phê - Nhà Thờ',
        city: hanoiId,
        description: 'Không gian hoài niệm thời bao cấp độc đáo.',
        images: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24'],
        priceRange: '$$',
        address: '27 Nhà Thờ, Hàng Trống, Hoàn Kiếm, Hà Nội',
        coordinates: { lat: 21.0287, lng: 105.8489 },
        rating: 4.4,
        numReviews: 150,
      },
    ]);

    const congCafeId = createdCafes[0]._id;

    // 7. Create Reviews
    await Review.insertMany([
      {
        user: regularUser,
        itemType: 'Attraction',
        itemId: langBacId,
        rating: 5,
        comment: 'Nơi rất trang nghiêm và ý nghĩa. Rất đáng đi!',
      },
      {
        user: regularUser,
        itemType: 'Restaurant',
        itemId: phoThinId,
        rating: 4,
        comment: 'Nước dùng đậm đà, thịt bò mềm. Chờ hơi lâu chút vì quán đông.',
      },
    ]);

    // 8. Create Favorites
    await Favorite.insertMany([
      {
        user: regularUser,
        itemType: 'Cafe',
        itemId: congCafeId,
      },
    ]);

    // 9. Create Trip
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 12);

    await Trip.create({
      user: regularUser,
      title: 'Khám phá Hà Nội mùa thu',
      city: hanoiId,
      startDate: startDate,
      endDate: endDate,
      budget: 5000000,
      schedule: [
        {
          day: 1,
          date: startDate,
          places: [
            {
              placeType: 'Attraction',
              placeId: langBacId,
              order: 1,
              note: 'Đi viếng buổi sáng sớm xem lễ thượng cờ.',
              visited: false,
            },
            {
              placeType: 'Restaurant',
              placeId: phoThinId,
              order: 2,
              note: 'Ăn trưa sau khi viếng lăng.',
              visited: false,
            },
          ],
        },
        {
          day: 2,
          date: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
          places: [
            {
              placeType: 'Hotel',
              placeId: meliaId,
              order: 1,
              note: 'Check-in khách sạn nghỉ ngơi.',
              visited: false,
            },
            {
              placeType: 'Cafe',
              placeId: congCafeId,
              order: 2,
              note: 'Uống cafe cốt dừa ngắm phố phường.',
              visited: false,
            },
          ],
        },
      ],
      diary: {
        notes: 'Chuyến đi chuẩn bị bắt đầu, rất hào hứng!',
        photos: [],
      },
    });

    console.log('Dummy Data Imported Successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Error importing data: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await User.deleteMany();
    await City.deleteMany();
    await Attraction.deleteMany();
    await Hotel.deleteMany();
    await Restaurant.deleteMany();
    await Cafe.deleteMany();
    await Trip.deleteMany();
    await Review.deleteMany();
    await Favorite.deleteMany();

    console.log('Database Destroyed!');
    process.exit(0);
  } catch (error) {
    console.error(`Error destroying data: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
