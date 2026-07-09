import asyncHandler from 'express-async-handler';
import User from '../../models/userModel.js';
import Trip from '../../models/tripModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Review from '../../models/reviewModel.js';

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    usersCount,
    tripsCount,
    attractionsCount,
    hotelsCount,
    restaurantsCount,
    cafesCount,
    reviewsCount,
  ] = await Promise.all([
    User.countDocuments({}),
    Trip.countDocuments({}),
    Attraction.countDocuments({}),
    Hotel.countDocuments({}),
    Restaurant.countDocuments({}),
    Cafe.countDocuments({}),
    Review.countDocuments({}),
  ]);

  res.json({
    users: usersCount,
    trips: tripsCount,
    places: {
      total: attractionsCount + hotelsCount + restaurantsCount + cafesCount,
      attractions: attractionsCount,
      hotels: hotelsCount,
      restaurants: restaurantsCount,
      cafes: cafesCount,
    },
    reviews: reviewsCount,
  });
});

export { getDashboardStats };
