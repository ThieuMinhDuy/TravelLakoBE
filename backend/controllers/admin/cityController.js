import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Review from '../../models/reviewModel.js';
import Favorite from '../../models/favoriteModel.js';
import Trip from '../../models/tripModel.js';
import findCityByName from '../../utils/findCityByName.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';

/** Kiểm tra tên thành phố hợp lệ, trả về tên đã trim (ném 400 nếu rỗng) */
const requireCityName = (name, res) => {
  if (typeof name !== 'string' || !name.trim()) {
    throw httpError(res, 400, 'Tên thành phố không được để trống', ERROR_CODES.MISSING_FIELDS);
  }
  return name.trim();
};

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
    throw httpError(res, 404, 'Không tìm thấy thành phố', ERROR_CODES.CITY_NOT_FOUND);
  }
});

// @desc    Create a city
// @route   POST /api/admin/cities
// @access  Private/Admin
const createCity = asyncHandler(async (req, res) => {
  const { name, description, image, coordinates } = req.body;
  const normalizedName = requireCityName(name, res);

  // So khớp không phân biệt hoa/thường và dấu: đã có "Da Lat" thì không tạo thêm "Đà Lạt"
  const cityExists = await findCityByName(normalizedName);

  if (cityExists) {
    throw httpError(res, 400, 'Thành phố đã tồn tại', ERROR_CODES.CITY_EXISTS);
  }

  const city = new City({
    name: normalizedName,
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
    // Chỉ cập nhật field có gửi lên (kể cả chuỗi rỗng, để xóa được mô tả / ảnh)
    if (name !== undefined) {
      const normalizedName = requireCityName(name, res);
      const duplicate = await findCityByName(normalizedName, { excludeId: city._id });
      if (duplicate) {
        throw httpError(res, 400, 'Thành phố đã tồn tại', ERROR_CODES.CITY_EXISTS);
      }
      city.name = normalizedName;
    }
    if (description !== undefined) city.description = description ?? '';
    if (image !== undefined) city.image = image ?? '';
    if (coordinates && typeof coordinates === 'object') {
      city.coordinates = {
        lat: coordinates.lat !== undefined ? coordinates.lat : city.coordinates.lat,
        lng: coordinates.lng !== undefined ? coordinates.lng : city.coordinates.lng,
      };
    }

    const updatedCity = await city.save();
    res.json(updatedCity);
  } else {
    throw httpError(res, 404, 'Không tìm thấy thành phố', ERROR_CODES.CITY_NOT_FOUND);
  }
});

// @desc    Delete a city
// @route   DELETE /api/admin/cities/:id
// @access  Private/Admin
const deleteCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);

  if (!city) {
    throw httpError(res, 404, 'Không tìm thấy thành phố', ERROR_CODES.CITY_NOT_FOUND);
  }

  // 1. Chặn xóa khi còn chuyến đi của người dùng ở thành phố này (kể cả khi cascade=true):
  //    Trip.city là bắt buộc, xóa thành phố sẽ làm hỏng chuyến đi của người dùng.
  const totalTrips = await Trip.countDocuments({ city: city._id });
  if (totalTrips > 0) {
    res.status(400);
    return res.json({
      message: `Không thể xóa thành phố này vì đang có ${totalTrips} chuyến đi của người dùng.`,
      code: ERROR_CODES.CITY_HAS_TRIPS,
      totalTrips,
    });
  }

  // 2. Lấy thông tin số lượng địa điểm thuộc thành phố này
  const [attractions, hotels, restaurants, cafes] = await Promise.all([
    Attraction.find({ city: req.params.id }).select('_id'),
    Hotel.find({ city: req.params.id }).select('_id'),
    Restaurant.find({ city: req.params.id }).select('_id'),
    Cafe.find({ city: req.params.id }).select('_id'),
  ]);

  const totalPlaces = attractions.length + hotels.length + restaurants.length + cafes.length;

  // 3. Nếu không yêu cầu cascade delete nhưng có địa điểm tồn tại
  if (req.query.cascade !== 'true' && totalPlaces > 0) {
    res.status(400);
    return res.json({
      message: `Thành phố này đang chứa ${totalPlaces} địa điểm. Bạn có muốn xóa toàn bộ thành phố cùng tất cả địa điểm và đánh giá liên quan không?`,
      code: ERROR_CODES.CITY_HAS_PLACES,
      requiresCascade: true,
      totalPlaces,
    });
  }

  // 4. Thực hiện xóa liên đới (Cascade Delete) nếu được chỉ định
  if (totalPlaces > 0) {
    const placeIds = [
      ...attractions.map((p) => p._id),
      ...hotels.map((p) => p._id),
      ...restaurants.map((p) => p._id),
      ...cafes.map((p) => p._id),
    ];

    // Xóa đánh giá, mục yêu thích của các địa điểm này và gỡ chúng khỏi lịch trình
    // (phòng trường hợp chuyến đi ở thành phố khác có thêm địa điểm của thành phố này)
    await Promise.all([
      Review.deleteMany({ itemId: { $in: placeIds } }),
      Favorite.deleteMany({ itemId: { $in: placeIds } }),
      Trip.updateMany(
        { 'schedule.places.placeId': { $in: placeIds } },
        { $pull: { 'schedule.$[].places': { placeId: { $in: placeIds } } } }
      ),
    ]);

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
