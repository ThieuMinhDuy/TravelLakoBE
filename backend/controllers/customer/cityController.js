import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';

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
  const city = await City.findById(req.params.id);

  if (city) {
    res.json(city);
  } else {
    res.status(404);
    throw new Error('City not found');
  }
});

export { getCities, getCityById };
