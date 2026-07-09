import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';

// @desc    Get all cities
// @route   GET /api/admin/cities
// @access  Private/Admin
const getCities = asyncHandler(async (req, res) => {
  const cities = await City.find({});
  res.json(cities);
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

  if (city) {
    await City.deleteOne({ _id: req.params.id });
    res.json({ message: 'City removed successfully' });
  } else {
    res.status(404);
    throw new Error('City not found');
  }
});

export {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
};
