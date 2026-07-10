import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Review from '../../models/reviewModel.js';

// @desc    Get all cities
// @route   GET /api/admin/cities
// @access  Private/Admin
const getCities = asyncHandler(async (req, res) => {
  const cities = await City.find({});
  res.json({
    total: cities.length,
    cities
  });
});

// @desc    Get city by ID
// @route   GET /api/admin/cities/:id
// @access  Private/Admin
const getCityById = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);

  if (city) {
    res.json(city);
  } else {
    res.status(404);
    throw new Error('City not found');
  }
});

// @desc    Create a city
// @route   POST /api/admin/cities
// @access  Private/Admin
const createCity = asyncHandler(async (req, res) => {
  const { name, description, image, coordinates } = req.body;

  const cityExists = await City.findOne({ name });

  if (cityExists) {
    res.status(400);
    throw new Error('City already exists');
  }

  const city = new City({
    name,
    description,
    image,
    coordinates,
  });

  const createdCity = await city.save();
  res.status(201).json(createdCity);
});

// @desc    Update a city
// @route   PUT /api/admin/cities/:id
// @access  Private/Admin
const updateCity = asyncHandler(async (req, res) => {
  const { name, description, image, coordinates } = req.body;

  const city = await City.findById(req.params.id);

  if (city) {
    city.name = name || city.name;
    city.description = description || city.description;
    city.image = image || city.image;
    if (coordinates) {
      city.coordinates = {
        lat: coordinates.lat !== undefined ? coordinates.lat : city.coordinates.lat,
        lng: coordinates.lng !== undefined ? coordinates.lng : city.coordinates.lng,
      };
    }

    const updatedCity = await city.save();
    res.json(updatedCity);
  } else {
    res.status(404);
    throw new Error('City not found');
  }
});

// @desc    Delete a city
// @route   DELETE /api/admin/cities/:id
// @access  Private/Admin
const deleteCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);

  if (!city) {
    res.status(404);
    throw new Error('City not found');
  }

  // 1. Lấy thông tin số lượng địa điểm thuộc thành phố này
  const [attractions, hotels, restaurants, cafes] = await Promise.all([
    Attraction.find({ city: req.params.id }).select('_id'),
    Hotel.find({ city: req.params.id }).select('_id'),
    Restaurant.find({ city: req.params.id }).select('_id'),
    Cafe.find({ city: req.params.id }).select('_id'),
  ]);

  const totalPlaces = attractions.length + hotels.length + restaurants.length + cafes.length;

  // 2. Nếu không yêu cầu cascade delete nhưng có địa điểm tồn tại
  if (req.query.cascade !== 'true' && totalPlaces > 0) {
    res.status(400);
    return res.json({
      message: `Thành phố này đang chứa ${totalPlaces} địa điểm. Bạn có muốn xóa toàn bộ thành phố cùng tất cả địa điểm và đánh giá liên quan không?`,
      requiresCascade: true,
      totalPlaces,
    });
  }

  // 3. Thực hiện xóa liên đới (Cascade Delete) nếu được chỉ định hoặc không có địa điểm nào
  if (totalPlaces > 0) {
    const placeIds = [
      ...attractions.map((p) => p._id),
      ...hotels.map((p) => p._id),
      ...restaurants.map((p) => p._id),
      ...cafes.map((p) => p._id),
    ];

    // Xóa tất cả reviews của các địa điểm thuộc thành phố này
    await Review.deleteMany({ itemId: { $in: placeIds } });

    // Xóa tất cả các địa điểm thuộc các bảng
    await Promise.all([
      Attraction.deleteMany({ city: req.params.id }),
      Hotel.deleteMany({ city: req.params.id }),
      Restaurant.deleteMany({ city: req.params.id }),
      Cafe.deleteMany({ city: req.params.id }),
    ]);
  }

  // Xóa chính thành phố
  await City.deleteOne({ _id: req.params.id });

  res.json({
    message: totalPlaces > 0 
      ? `Thành phố và tất cả ${totalPlaces} địa điểm cùng các đánh giá liên quan đã được xóa thành công!`
      : 'Thành phố đã được xóa thành công!',
  });
});

export {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
};
