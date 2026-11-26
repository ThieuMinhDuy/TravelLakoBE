import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Favorite from '../../models/favoriteModel.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import { findPlace, matchPlaceType, INVALID_PLACE_TYPE_MESSAGE, PLACE_NOT_FOUND_MESSAGE } from '../../utils/placeTypes.js';

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
    throw httpError(res, 400, 'Vui lòng chọn địa điểm cần thêm vào yêu thích (itemType, itemId)', ERROR_CODES.MISSING_FIELDS);
  }

  const typeMatch = matchPlaceType(itemType);
  if (!typeMatch) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }

  // Check if place exists
  const place = await findPlace(typeMatch, itemId);
  if (!place) {
    throw httpError(res, 404, PLACE_NOT_FOUND_MESSAGE, ERROR_CODES.PLACE_NOT_FOUND);
  }

  // Check if already favorited
  const favoriteExists = await Favorite.findOne({
    user: req.user._id,
    itemType: typeMatch,
    itemId
  });

  if (favoriteExists) {
    throw httpError(res, 400, 'Địa điểm này đã có trong danh sách yêu thích của bạn', ERROR_CODES.FAVORITE_EXISTS);
  }

  const favorite = new Favorite({
    user: req.user._id,
    itemType: typeMatch,
    itemId
  });

  const createdFavorite = await favorite.save();

  res.status(201).json({
    message: 'Đã thêm vào danh sách yêu thích',
    favorite: createdFavorite
  });
});

// @desc    Remove a place from favorites
// @route   DELETE /api/favorites/:id
// @access  Private
const removeFavorite = asyncHandler(async (req, res) => {
  const favorite = mongoose.isValidObjectId(req.params.id) ? await Favorite.findById(req.params.id) : null;

  if (!favorite) {
    throw httpError(res, 404, 'Không tìm thấy mục yêu thích', ERROR_CODES.FAVORITE_NOT_FOUND);
  }

  // Check ownership
  if (favorite.user.toString() !== req.user._id.toString()) {
    throw httpError(res, 403, 'Bạn không có quyền xóa mục yêu thích này!', ERROR_CODES.NOT_OWNER);
  }

  await Favorite.deleteOne({ _id: req.params.id });

  res.json({ message: 'Đã xóa khỏi danh sách yêu thích' });
});

export { getMyFavorites, addFavorite, removeFavorite };
