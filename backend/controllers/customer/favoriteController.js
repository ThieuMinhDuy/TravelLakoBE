import asyncHandler from 'express-async-handler';
import Favorite from '../../models/favoriteModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

// @desc    Get user favorites list
// @route   GET /api/favorites
// @access  Private
const getMyFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id })
    .populate({
      path: 'itemId',
      populate: { path: 'city', select: 'name' }
    });

  // Filter out any favorites where the referenced item no longer exists (e.g. was deleted)
  const activeFavorites = favorites.filter(fav => fav.itemId !== null);

  res.json({
    total: activeFavorites.length,
    favorites: activeFavorites
  });
});

// @desc    Add a place to favorites
// @route   POST /api/favorites
// @access  Private
const addFavorite = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.body;

  if (!itemType || !itemId) {
    res.status(400);
    throw new Error('Please provide itemType and itemId');
  }

  const validTypes = ['Attraction', 'Hotel', 'Restaurant', 'Cafe'];
  const typeMatch = validTypes.find(t => t.toLowerCase() === itemType.toLowerCase());

  if (!typeMatch) {
    res.status(400);
    throw new Error('Invalid itemType. Must be: Attraction, Hotel, Restaurant, Cafe');
  }

  // Check if place exists
  let Model;
  if (typeMatch === 'Attraction') Model = Attraction;
  else if (typeMatch === 'Hotel') Model = Hotel;
  else if (typeMatch === 'Restaurant') Model = Restaurant;
  else if (typeMatch === 'Cafe') Model = Cafe;

  const place = await Model.findById(itemId);
  if (!place) {
    res.status(404);
    throw new Error(`${typeMatch} not found`);
  }

  // Check if already favorited
  const favoriteExists = await Favorite.findOne({
    user: req.user._id,
    itemType: typeMatch,
    itemId
  });

  if (favoriteExists) {
    res.status(400);
    throw new Error('This place is already in your favorites');
  }

  const favorite = new Favorite({
    user: req.user._id,
    itemType: typeMatch,
    itemId
  });

  const createdFavorite = await favorite.save();

  res.status(201).json({
    message: 'Added to favorites successfully',
    favorite: createdFavorite
  });
});

// @desc    Remove a place from favorites
// @route   DELETE /api/favorites/:id
// @access  Private
const removeFavorite = asyncHandler(async (req, res) => {
  const favorite = await Favorite.findById(req.params.id);

  if (!favorite) {
    res.status(404);
    throw new Error('Favorite not found');
  }

  // Check ownership
  if (favorite.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to remove this favorite');
  }

  await Favorite.deleteOne({ _id: req.params.id });

  res.json({ message: 'Removed from favorites successfully' });
});

export { getMyFavorites, addFavorite, removeFavorite };
