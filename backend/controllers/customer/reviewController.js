import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Review from '../../models/reviewModel.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import {
  findPlace,
  getPlaceModel,
  matchPlaceType,
  INVALID_PLACE_TYPE_MESSAGE,
  PLACE_NOT_FOUND_MESSAGE,
} from '../../utils/placeTypes.js';

// Helper to update rating and review count on a place
const updatePlaceRating = async (itemId, itemType) => {
  const remainingReviews = await Review.find({ itemId });
  const numReviews = remainingReviews.length;
  const rating = numReviews > 0
    ? parseFloat((remainingReviews.reduce((acc, item) => acc + item.rating, 0) / numReviews).toFixed(1))
    : 0;

  const Model = getPlaceModel(itemType);
  if (Model) {
    await Model.findByIdAndUpdate(itemId, { rating, numReviews });
  }
};

// @desc    Get reviews for a specific place
// @route   GET /api/reviews/:itemType/:itemId
// @access  Public
const getPlaceReviews = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;

  // Case-insensitive mapping to valid types
  const typeMatch = matchPlaceType(itemType);
  if (!typeMatch) {
    throw httpError(res, 400, INVALID_PLACE_TYPE_MESSAGE, ERROR_CODES.INVALID_PLACE_TYPE);
  }
  // ID sai định dạng: không có đánh giá nào (thay vì lỗi CastError)
  if (!mongoose.isValidObjectId(itemId)) {
    return res.json({ total: 0, reviews: [] });
  }

  const reviews = await Review.find({ itemId, itemType: typeMatch })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 });

  res.json({
    total: reviews.length,
    reviews
  });
});

// @desc    Get reviews written by the current user
// @route   GET /api/reviews/me
// @access  Private
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .select('_id rating comment itemType itemId createdAt')
    .populate({
      path: 'itemId',
      select: '_id name images address rating city',
      populate: { path: 'city', select: 'name' },
    })
    .sort({ createdAt: -1 });

  // Bỏ các review mà địa điểm đã bị xóa (itemId null sau populate)
  const activeReviews = reviews.filter((review) => review.itemId !== null);

  res.json({
    total: activeReviews.length,
    reviews: activeReviews,
  });
});

// @desc    Create a review for a place
// @route   POST /api/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { itemType, itemId, rating, comment } = req.body;

  if (!itemType || !itemId || !rating || !comment) {
    throw httpError(res, 400, 'Vui lòng chọn số sao và nhập nội dung đánh giá', ERROR_CODES.MISSING_FIELDS);
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

  // Optional: prevent multiple reviews from the same user on the same place
  const alreadyReviewed = await Review.findOne({
    user: req.user._id,
    itemId,
    itemType: typeMatch
  });

  if (alreadyReviewed) {
    throw httpError(res, 400, 'Bạn đã đánh giá địa điểm này rồi', ERROR_CODES.REVIEW_EXISTS);
  }

  const review = new Review({
    user: req.user._id,
    itemType: typeMatch,
    itemId,
    rating: Number(rating),
    comment
  });

  await review.save();

  // Recalculate average rating and numReviews
  await updatePlaceRating(itemId, typeMatch);

  res.status(201).json({
    message: 'Đã gửi đánh giá',
    review
  });
});

// @desc    Delete user's own review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteMyReview = asyncHandler(async (req, res) => {
  const review = mongoose.isValidObjectId(req.params.id) ? await Review.findById(req.params.id) : null;

  if (!review) {
    throw httpError(res, 404, 'Không tìm thấy đánh giá', ERROR_CODES.REVIEW_NOT_FOUND);
  }

  // Check review ownership
  if (review.user.toString() !== req.user._id.toString()) {
    throw httpError(res, 403, 'Bạn không có quyền xóa đánh giá này!', ERROR_CODES.NOT_OWNER);
  }

  const { itemId, itemType } = review;

  await Review.deleteOne({ _id: req.params.id });

  // Recalculate average rating and numReviews
  await updatePlaceRating(itemId, itemType);

  res.json({ message: 'Đã xóa đánh giá' });
});

export { getPlaceReviews, getMyReviews, createReview, deleteMyReview };
