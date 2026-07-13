import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

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

// @desc    Get all places of a specific type with filters
// @route   GET /api/places/:type
// @access  Public
const getPlaces = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const Model = getModelByType(type);

  if (!Model) {
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  const query = {};

  // 1. General filters
  if (req.query.city) {
    query.city = req.query.city;
  }

  if (req.query.search) {
    query.name = { $regex: req.query.search, $options: 'i' };
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
      query.cuisineType = { $regex: req.query.cuisineType, $options: 'i' };
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
    res.status(400);
    throw new Error('Invalid place type. Must be: attraction, hotel, restaurant, cafe');
  }

  const place = await Model.findById(id).populate('city');

  if (place) {
    res.json(place);
  } else {
    res.status(404);
    throw new Error('Place not found');
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
    query.name = { $regex: keyword, $options: 'i' };
  }
  if (cityId) {
    query.city = cityId;
  }

  const limit = keyword || cityId ? 10 : 5;

  const [attractions, hotels, restaurants, cafes] = await Promise.all([
    Attraction.find(query).limit(limit).populate('city', 'name'),
    Hotel.find(query).limit(limit).populate('city', 'name'),
    Restaurant.find(query).limit(limit).populate('city', 'name'),
    Cafe.find(query).limit(limit).populate('city', 'name'),
  ]);

  res.json({
    attractions,
    hotels,
    restaurants,
    cafes,
  });
});

export { getPlaces, getPlaceById, globalSearch };
