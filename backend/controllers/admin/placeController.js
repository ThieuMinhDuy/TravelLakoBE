import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Review from '../../models/reviewModel.js';
import Favorite from '../../models/favoriteModel.js';
import Trip from '../../models/tripModel.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';

// Helper to map route parameter type to the corresponding Mongoose Model
const getModelByType = (type) => {
  switch (type.toLowerCase()) {
    case 'attraction':
      return Attraction;
    case 'hotel':
      return Hotel;
    case 'restaurant':
      return Restaurant;
    case 'cafe':
      return Cafe;
    default:
      return null;
  }
};

// Các field admin được phép ghi theo từng loại địa điểm.
// Không cho ghi _id, rating, numReviews, createdAt... (rating/numReviews do hệ thống review tính).
const COMMON_FIELDS = ['name', 'city', 'description', 'images', 'address', 'coordinates'];
const EDITABLE_FIELDS = {
  attraction: [...COMMON_FIELDS, 'admissionFee'],
  hotel: [...COMMON_FIELDS, 'stars', 'pricePerNight'],
  restaurant: [...COMMON_FIELDS, 'cuisineType', 'price'],
  cafe: [...COMMON_FIELDS, 'price'],
};

/**
 * Kiểm tra thành phố gửi lên có tồn tại. ID sai định dạng cũng trả 400 "City not found"
 * (trước đây rơi vào CastError -> 404 "Resource not found", dễ nhầm là không tìm thấy địa điểm).
 */
const assertCityExists = async (cityId, res) => {
  const cityExists = mongoose.isValidObjectId(cityId) ? await City.exists({ _id: cityId }) : null;
  if (!cityExists) {
    throw httpError(res, 400, 'City not found', ERROR_CODES.CITY_NOT_FOUND);
  }
};

/** Lấy ra các field hợp lệ từ body theo loại địa điểm */
const pickEditableFields = (type, body = {}) => {
  const allowed = EDITABLE_FIELDS[type.toLowerCase()] || [];
  return allowed.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});
};

// @desc    Get all places of a specific type
// @route   GET /api/admin/places/:type
// @access  Private/Admin
const getPlaces = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  // Allow filtering by city if query is provided
  const filter = {};
  if (req.query.city) {
    filter.city = req.query.city;
  }

  const places = await Model.find(filter).populate('city', 'name');
  res.json({
    total: places.length,
    places
  });
});

// @desc    Get place by ID of a specific type
// @route   GET /api/admin/places/:type/:id
// @access  Private/Admin
const getPlaceById = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  const place = await Model.findById(req.params.id).populate('city', 'name');

  if (place) {
    res.json(place);
  } else {
    res.status(404);
    throw new Error('Place not found');
  }
});

// @desc    Create a new place of a specific type
// @route   POST /api/admin/places/:type
// @access  Private/Admin
const createPlace = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  // Validate if city exists
  if (!req.body.city) {
    throw httpError(res, 400, 'City is required', ERROR_CODES.MISSING_FIELDS);
  }
  await assertCityExists(req.body.city, res);

  // Chỉ nhận các field được phép (không cho tự đặt rating, numReviews, _id...)
  const place = new Model(pickEditableFields(req.params.type, req.body));
  const createdPlace = await place.save();
  // Trả city dạng { _id, name } giống GET danh sách để FE cập nhật cache trực tiếp
  await createdPlace.populate('city', 'name');
  res.status(201).json(createdPlace);
});

// @desc    Update a place of a specific type
// @route   PUT /api/admin/places/:type/:id
// @access  Private/Admin
const updatePlace = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  // Validate if city exists if it is being updated
  if (req.body.city !== undefined) {
    await assertCityExists(req.body.city, res);
  }

  const place = await Model.findById(req.params.id);

  if (place) {
    // Chỉ cập nhật các field được phép theo loại địa điểm
    const updates = pickEditableFields(req.params.type, req.body);
    Object.keys(updates).forEach((key) => {
      // Avoid overwriting nested structures like coordinates partially unless handled
      if (key === 'coordinates') {
        if (!updates.coordinates || typeof updates.coordinates !== 'object') return;
        place.coordinates = {
          lat: updates.coordinates.lat !== undefined ? updates.coordinates.lat : place.coordinates.lat,
          lng: updates.coordinates.lng !== undefined ? updates.coordinates.lng : place.coordinates.lng,
        };
      } else {
        place[key] = updates[key];
      }
    });

    const updatedPlace = await place.save();
    await updatedPlace.populate('city', 'name');
    res.json(updatedPlace);
  } else {
    res.status(404);
    throw new Error('Place not found');
  }
});

// @desc    Delete a place of a specific type
// @route   DELETE /api/admin/places/:type/:id
// @access  Private/Admin
const deletePlace = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  const place = await Model.findById(req.params.id);

  if (place) {
    // Xóa đánh giá, mục yêu thích của địa điểm này và gỡ nó khỏi lịch trình các chuyến đi
    // (trước đây lịch trình còn giữ placeId, populate ra null)
    const [, , tripUpdate] = await Promise.all([
      Review.deleteMany({ itemId: place._id }),
      Favorite.deleteMany({ itemId: place._id }),
      Trip.updateMany(
        { 'schedule.places.placeId': place._id },
        { $pull: { 'schedule.$[].places': { placeId: place._id } } }
      ),
    ]);

    await Model.deleteOne({ _id: place._id });
    res.json({
      message: 'Place removed successfully along with associated reviews',
      // Số chuyến đi đã bị gỡ địa điểm này khỏi lịch trình
      affectedTrips: tripUpdate.modifiedCount,
    });
  } else {
    res.status(404);
    throw new Error('Place not found');
  }
});

export {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
};
