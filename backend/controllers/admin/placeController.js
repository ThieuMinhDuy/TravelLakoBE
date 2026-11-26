import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import City from '../../models/cityModel.js';
import Review from '../../models/reviewModel.js';
import Favorite from '../../models/favoriteModel.js';
import Trip from '../../models/tripModel.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import { getPlaceModel, INVALID_PLACE_TYPE_MESSAGE, PLACE_NOT_FOUND_MESSAGE } from '../../utils/placeTypes.js';

// Loại địa điểm trên URL (attraction, hotel...) -> Mongoose Model
const getModelByType = getPlaceModel;

/** Địa điểm theo :id; ID sai định dạng coi như không tìm thấy */
const findPlaceById = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id) : null);

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
 * Kiểm tra thành phố gửi lên có tồn tại. ID sai định dạng cũng trả 400 CITY_NOT_FOUND
 * (trước đây rơi vào CastError -> 404, dễ nhầm là không tìm thấy địa điểm).
 */
const assertCityExists = async (cityId, res) => {
  const cityExists = mongoose.isValidObjectId(cityId) ? await City.exists({ _id: cityId }) : null;
  if (!cityExists) {
    throw httpError(res, 400, 'Không tìm thấy thành phố', ERROR_CODES.CITY_NOT_FOUND);
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
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
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
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  const place = await findPlaceById(Model, req.params.id)?.populate('city', 'name');

  if (place) {
    res.json(place);
  } else {
    throw httpError(res, 404, PLACE_NOT_FOUND_MESSAGE, ERROR_CODES.PLACE_NOT_FOUND);
  }
});

// @desc    Create a new place of a specific type
// @route   POST /api/admin/places/:type
// @access  Private/Admin
const createPlace = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  // Validate if city exists
  if (!req.body.city) {
    throw httpError(res, 400, 'Vui lòng chọn thành phố', ERROR_CODES.MISSING_FIELDS);
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
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  // Validate if city exists if it is being updated
  if (req.body.city !== undefined) {
    await assertCityExists(req.body.city, res);
  }

  const place = await findPlaceById(Model, req.params.id);

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
    throw httpError(res, 404, PLACE_NOT_FOUND_MESSAGE, ERROR_CODES.PLACE_NOT_FOUND);
  }
});

// @desc    Delete a place of a specific type
// @route   DELETE /api/admin/places/:type/:id
// @access  Private/Admin
const deletePlace = asyncHandler(async (req, res) => {
  const Model = getModelByType(req.params.type);
  if (!Model) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  const place = await findPlaceById(Model, req.params.id);

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
      message: 'Đã xóa địa điểm cùng các đánh giá và mục yêu thích liên quan',
      // Số chuyến đi đã bị gỡ địa điểm này khỏi lịch trình
      affectedTrips: tripUpdate.modifiedCount,
    });
  } else {
    throw httpError(res, 404, PLACE_NOT_FOUND_MESSAGE, ERROR_CODES.PLACE_NOT_FOUND);
  }
});

export {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
};
