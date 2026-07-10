import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Review from '../../models/reviewModel.js';

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
    res.status(400);
    throw new Error('City is required');
  }
  const cityExists = await City.findById(req.body.city);
  if (!cityExists) {
    res.status(400);
    throw new Error('City not found');
  }

  // Create place with req.body (Mongoose will filter out extra fields based on Schema definitions)
  const place = new Model(req.body);
  const createdPlace = await place.save();
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
  if (req.body.city) {
    const cityExists = await City.findById(req.body.city);
    if (!cityExists) {
      res.status(400);
      throw new Error('City not found');
    }
  }

  const place = await Model.findById(req.params.id);

  if (place) {
    // Update fields dynamically from request body
    Object.keys(req.body).forEach((key) => {
      // Avoid overwriting nested structures like coordinates partially unless handled
      if (key === 'coordinates' && req.body.coordinates) {
        place.coordinates = {
          lat: req.body.coordinates.lat !== undefined ? req.body.coordinates.lat : place.coordinates.lat,
          lng: req.body.coordinates.lng !== undefined ? req.body.coordinates.lng : place.coordinates.lng,
        };
      } else {
        place[key] = req.body[key];
      }
    });

    const updatedPlace = await place.save();
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
    // Xóa tất cả reviews liên quan đến địa điểm này
    await Review.deleteMany({ itemId: req.params.id });

    await Model.deleteOne({ _id: req.params.id });
    res.json({ message: 'Place removed successfully along with associated reviews' });
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
