import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import escapeRegex from '../../utils/escapeRegex.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import { getPlaceModel, INVALID_PLACE_TYPE_MESSAGE, PLACE_NOT_FOUND_MESSAGE } from '../../utils/placeTypes.js';

// Loại địa điểm trên URL (attraction, hotel...) -> Mongoose Model
const getModelByType = getPlaceModel;

// @desc    Get all places of a specific type with filters
// @route   GET /api/places/:type
// @access  Public
const getPlaces = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const Model = getModelByType(type);

  if (!Model) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  const query = {};

  // 1. General filters
  if (req.query.city) {
    query.city = req.query.city;
  }

  if (req.query.search) {
    query.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
  }

  // 2. Type-specific filters
  const typeLower = type.toLowerCase();
  
  if (typeLower === 'hotel') {
    if (req.query.stars) {
      query.stars = Number(req.query.stars);
    }
    if (req.query.minPrice || req.query.maxPrice) {
      query.pricePerNight = {};
      if (req.query.minPrice) query.pricePerNight.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.pricePerNight.$lte = Number(req.query.maxPrice);
    }
  }

  if (typeLower === 'attraction') {
    if (req.query.minFee || req.query.maxFee) {
      query.admissionFee = {};
      if (req.query.minFee) query.admissionFee.$gte = Number(req.query.minFee);
      if (req.query.maxFee) query.admissionFee.$lte = Number(req.query.maxFee);
    }
  }

  if (typeLower === 'restaurant') {
    if (req.query.cuisineType) {
      query.cuisineType = { $regex: escapeRegex(req.query.cuisineType), $options: 'i' };
    }
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }
  }

  if (typeLower === 'cafe') {
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }
  }

  const places = await Model.find(query).populate('city', 'name');
  res.json({
    total: places.length,
    places
  });
});

// @desc    Get place details by type and ID
// @route   GET /api/places/:type/:id
// @access  Public
const getPlaceById = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const Model = getModelByType(type);

  if (!Model) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  const place = mongoose.isValidObjectId(id) ? await Model.findById(id).populate('city') : null;

  if (place) {
    res.json(place);
  } else {
    throw httpError(res, 404, PLACE_NOT_FOUND_MESSAGE, ERROR_CODES.PLACE_NOT_FOUND);
  }
});

// @desc    Global search across all 4 place types
// @route   GET /api/places/search
// @access  Public
const globalSearch = asyncHandler(async (req, res) => {
  const keyword = req.query.q || req.query.keyword || '';
  const cityId = req.query.city;

  const query = {};
  if (keyword) {
    query.name = { $regex: escapeRegex(keyword), $options: 'i' };
  }
  if (cityId) {
    query.city = cityId;
  }

  const limit = keyword || cityId ? 10 : 5;
  // Đánh giá cao trước, cùng điểm thì nhiều lượt đánh giá trước, rồi theo tên.
  // Không sắp xếp thì MongoDB trả theo thứ tự thêm vào, địa điểm tốt có thể bị limit cắt mất.
  const sort = { rating: -1, numReviews: -1, name: 1 };

  const [attractions, hotels, restaurants, cafes] = await Promise.all([
    Attraction.find(query).sort(sort).limit(limit).populate('city', 'name'),
    Hotel.find(query).sort(sort).limit(limit).populate('city', 'name'),
    Restaurant.find(query).sort(sort).limit(limit).populate('city', 'name'),
    Cafe.find(query).sort(sort).limit(limit).populate('city', 'name'),
  ]);

  res.json({
    attractions,
    hotels,
    restaurants,
    cafes,
  });
});

export { getPlaces, getPlaceById, globalSearch };
