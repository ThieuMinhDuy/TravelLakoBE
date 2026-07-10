import asyncHandler from 'express-async-handler';
import User from '../../models/userModel.js';
import Trip from '../../models/tripModel.js';
import Review from '../../models/reviewModel.js';
import Favorite from '../../models/favoriteModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json({
    total: users.length,
    users
  });
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
    user.isBlocked = req.body.isBlocked !== undefined ? req.body.isBlocked : user.isBlocked;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      isAdmin: updatedUser.isAdmin,
      isBlocked: updatedUser.isBlocked,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.isAdmin && (await User.countDocuments({ isAdmin: true })) <= 1) {
      res.status(400);
      throw new Error('Cannot delete the last administrator');
    }

    // 1. Tìm các review của user này để biết những địa điểm nào bị ảnh hưởng
    const userReviews = await Review.find({ user: req.params.id }).select('itemId itemType');

    // 2. Xóa các reviews, trips, favorites của user này
    await Promise.all([
      Review.deleteMany({ user: req.params.id }),
      Trip.deleteMany({ user: req.params.id }),
      Favorite.deleteMany({ user: req.params.id }),
    ]);

    // 3. Tính toán lại rating & numReviews cho các địa điểm bị ảnh hưởng
    if (userReviews.length > 0) {
      // Nhóm theo itemId để tránh tính toán trùng lặp
      const affectedPlaces = {};
      userReviews.forEach(rev => {
        if (rev.itemId && rev.itemType) {
          affectedPlaces[rev.itemId.toString()] = rev.itemType;
        }
      });

      // Recalculate cho từng địa điểm bị ảnh hưởng
      for (const [itemId, itemType] of Object.entries(affectedPlaces)) {
        const remainingReviews = await Review.find({ itemId });
        const numReviews = remainingReviews.length;
        const rating = numReviews > 0
          ? parseFloat((remainingReviews.reduce((acc, item) => acc + item.rating, 0) / numReviews).toFixed(1))
          : 0;

        let Model;
        if (itemType === 'Attraction') Model = Attraction;
        else if (itemType === 'Hotel') Model = Hotel;
        else if (itemType === 'Restaurant') Model = Restaurant;
        else if (itemType === 'Cafe') Model = Cafe;

        if (Model) {
          await Model.findByIdAndUpdate(itemId, { rating, numReviews });
        }
      }
    }

    // 4. Xóa chính người dùng
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'User and all associated data (trips, favorites, reviews) removed successfully' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export { getUsers, getUserById, updateUser, deleteUser };
