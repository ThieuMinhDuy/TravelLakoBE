import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import City from '../../models/cityModel.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';

// @desc    Get all cities
// @route   GET /api/cities
// @access  Public
const getCities = asyncHandler(async (req, res) => {
  const cities = await City.find({});
  res.json({
    total: cities.length,
    cities
  });
});

// @desc    Get city by ID
// @route   GET /api/cities/:id
// @access  Public
const getCityById = asyncHandler(async (req, res) => {
  const city = mongoose.isValidObjectId(req.params.id) ? await City.findById(req.params.id) : null;

  if (city) {
    res.json(city);
  } else {
    throw httpError(res, 404, 'Không tìm thấy thành phố', ERROR_CODES.CITY_NOT_FOUND);
  }
});

export { getCities, getCityById };
