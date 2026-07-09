import asyncHandler from 'express-async-handler';
import Review from '../../models/reviewModel.js';

// @desc    Get all reviews
// @route   GET /api/admin/reviews
// @access  Private/Admin
const getReviews = asyncHandler(async (req, res) => {
  // Populate user info, and dynamically populate the referenced place (Attraction, Hotel, Restaurant, Cafe)
  const reviews = await Review.find({})
    .populate('user', 'name email avatar')
    .populate({
      path: 'itemId',
      select: 'name address images city',
    });

  res.json(reviews);
});

// @desc    Delete a review
// @route   DELETE /api/admin/reviews/:id
// @access  Private/Admin
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (review) {
    await Review.deleteOne({ _id: req.params.id });
    res.json({ message: 'Review removed successfully' });
  } else {
    res.status(404);
    throw new Error('Review not found');
  }
});

export { getReviews, deleteReview };
