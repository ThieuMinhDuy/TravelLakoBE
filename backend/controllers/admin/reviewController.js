import asyncHandler from 'express-async-handler';
import Review from '../../models/reviewModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

// @desc    Get all reviews
// @route   GET /api/admin/reviews
// @access  Private/Admin
const getReviews = asyncHandler(async (req, res) => {
  const { city, itemType, itemId } = req.query;
  const filter = {};

  if (itemId) {
    // 1. Nếu lọc theo địa điểm cụ thể
    filter.itemId = itemId;
  } else if (city) {
    // 2. Nếu lọc theo thành phố
    if (itemType) {
      // 2a. Lọc theo thành phố và loại địa điểm cụ thể (VD: Khách sạn ở Nha Trang)
      let model;
      if (itemType === 'Attraction') model = Attraction;
      else if (itemType === 'Hotel') model = Hotel;
      else if (itemType === 'Restaurant') model = Restaurant;
      else if (itemType === 'Cafe') model = Cafe;

      if (model) {
        const places = await model.find({ city }).select('_id');
        filter.itemId = { $in: places.map((p) => p._id) };
      }
      filter.itemType = itemType;
    } else {
      // 2b. Chỉ lọc theo thành phố (lấy tất cả các loại địa điểm ở Nha Trang)
      const [attractions, hotels, restaurants, cafes] = await Promise.all([
        Attraction.find({ city }).select('_id'),
        Hotel.find({ city }).select('_id'),
        Restaurant.find({ city }).select('_id'),
        Cafe.find({ city }).select('_id'),
      ]);

      const placeIds = [
        ...attractions.map((a) => a._id),
        ...hotels.map((h) => h._id),
        ...restaurants.map((r) => r._id),
        ...cafes.map((c) => c._id),
      ];

      filter.itemId = { $in: placeIds };
    }
  } else if (itemType) {
    // 3. Chỉ lọc theo loại địa điểm trên toàn hệ thống
    filter.itemType = itemType;
  }

  // Populate user info, and dynamically populate the referenced place (Attraction, Hotel, Restaurant, Cafe)
  const reviews = await Review.find(filter)
    .populate('user', 'name email avatar')
    .populate({
      path: 'itemId',
      select: 'name address images city',
    });

  res.json({
    total: reviews.length,
    reviews
  });
});

// @desc    Delete a review
// @route   DELETE /api/admin/reviews/:id
// @access  Private/Admin
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (review) {
    const { itemId, itemType } = review;

    // Xóa review khỏi DB
    await Review.deleteOne({ _id: req.params.id });

    // Tính toán lại rating trung bình và số lượng review cho địa điểm này
    const remainingReviews = await Review.find({ itemId });
    const numReviews = remainingReviews.length;
    const rating = numReviews > 0
      ? parseFloat((remainingReviews.reduce((acc, item) => acc + item.rating, 0) / numReviews).toFixed(1))
      : 0;

    // Xác định model tương ứng
    let Model;
    if (itemType === 'Attraction') Model = Attraction;
    else if (itemType === 'Hotel') Model = Hotel;
    else if (itemType === 'Restaurant') Model = Restaurant;
    else if (itemType === 'Cafe') Model = Cafe;

    if (Model) {
      await Model.findByIdAndUpdate(itemId, { rating, numReviews });
    }

    res.json({ message: 'Review removed successfully' });
  } else {
    res.status(404);
    throw new Error('Review not found');
  }
});

export { getReviews, deleteReview };
