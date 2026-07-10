import asyncHandler from 'express-async-handler';
import Review from '../../models/reviewModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

// Helper to update rating and review count on a place
const updatePlaceRating = async (itemId, itemType) => {
  const remainingReviews = await Review.find({ itemId });
  const numReviews = remainingReviews.length;
  const rating = numReviews > 0
    ? parseFloat((remainingReviews.reduce((acc, item) => acc + item.rating, 0) / numReviews).toFixed(1))
    : 0;

  let Model;
  const typeLower = itemType.toLowerCase();
  if (typeLower === 'attraction') Model = Attraction;
  else if (typeLower === 'hotel') Model = Hotel;
  else if (typeLower === 'restaurant') Model = Restaurant;
  else if (typeLower === 'cafe') Model = Cafe;

  if (Model) {
    await Model.findByIdAndUpdate(itemId, { rating, numReviews });
  }
};

// @desc    Get reviews for a specific place
// @route   GET /api/reviews/:itemType/:itemId
// @access  Public
const getPlaceReviews = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;

  const validTypes = ['Attraction', 'Hotel', 'Restaurant', 'Cafe'];
  // Case-insensitive mapping to valid types
  const typeMatch = validTypes.find(t => t.toLowerCase() === itemType.toLowerCase());

  if (!typeMatch) {
    res.status(400);
    throw new Error('Invalid itemType. Must be: Attraction, Hotel, Restaurant, Cafe');
  }

  const reviews = await Review.find({ itemId, itemType: typeMatch })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 });

  res.json({
    total: reviews.length,
    reviews
  });
});

// @desc    Create a review for a place
// @route   POST /api/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { itemType, itemId, rating, comment } = req.body;

  if (!itemType || !itemId || !rating || !comment) {
    res.status(400);
    throw new Error('Please provide all fields: itemType, itemId, rating, comment');
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

  // Optional: prevent multiple reviews from the same user on the same place
  const alreadyReviewed = await Review.findOne({
    user: req.user._id,
    itemId,
    itemType: typeMatch
  });

  if (alreadyReviewed) {
    res.status(400);
    throw new Error('You have already reviewed this place');
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
    message: 'Review added successfully',
    review
  });
});

// @desc    Delete user's own review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteMyReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check review ownership
  if (review.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to delete this review');
  }

  const { itemId, itemType } = review;

  await Review.deleteOne({ _id: req.params.id });

  // Recalculate average rating and numReviews
  await updatePlaceRating(itemId, itemType);

  res.json({ message: 'Review removed successfully' });
});

export { getPlaceReviews, createReview, deleteMyReview };
