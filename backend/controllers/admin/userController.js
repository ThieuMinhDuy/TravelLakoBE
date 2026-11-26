import asyncHandler from 'express-async-handler';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';
import validator from 'validator';
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
    throw httpError(res, 404, 'Không tìm thấy người dùng', ERROR_CODES.USER_NOT_FOUND);
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    const { name, email, isAdmin, isBlocked } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      throw httpError(res, 400, 'Tên người dùng không hợp lệ!', ERROR_CODES.VALIDATION_ERROR);
    }

    if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
      throw httpError(res, 400, 'isAdmin phải là true hoặc false', ERROR_CODES.VALIDATION_ERROR);
    }

    if (isBlocked !== undefined && typeof isBlocked !== 'boolean') {
      throw httpError(res, 400, 'isBlocked phải là true hoặc false', ERROR_CODES.VALIDATION_ERROR);
    }

    // Đổi email: phải đúng định dạng và chưa được tài khoản khác sử dụng
    if (email !== undefined && email !== user.email) {
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        throw httpError(res, 400, 'Email không hợp lệ!', ERROR_CODES.INVALID_EMAIL);
      }
      const emailTaken = await User.exists({ email, _id: { $ne: user._id } });
      if (emailTaken) {
        throw httpError(res, 400, 'Email này đã được tài khoản khác sử dụng!', ERROR_CODES.EMAIL_EXISTS);
      }
    }

    const isSelf = user._id.toString() === req.user._id.toString();
    const willLoseAdmin = isAdmin === false || isBlocked === true;

    // Admin không được tự gỡ quyền hoặc tự khóa chính mình
    if (isSelf && user.isAdmin && willLoseAdmin) {
      throw httpError(res, 400, 'Bạn không thể tự gỡ quyền Admin hoặc tự khóa tài khoản của chính mình!', ERROR_CODES.CANNOT_MODIFY_SELF);
    }

    // Không được gỡ quyền / khóa admin cuối cùng còn hoạt động
    if (user.isAdmin && !user.isBlocked && willLoseAdmin) {
      const activeAdmins = await User.countDocuments({ isAdmin: true, isBlocked: false });
      if (activeAdmins <= 1) {
        throw httpError(res, 400, 'Không thể gỡ quyền hoặc khóa quản trị viên cuối cùng!', ERROR_CODES.LAST_ADMIN);
      }
    }

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    if (isBlocked !== undefined) user.isBlocked = isBlocked;

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
    throw httpError(res, 404, 'Không tìm thấy người dùng', ERROR_CODES.USER_NOT_FOUND);
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user._id.toString() === req.user._id.toString()) {
      throw httpError(res, 400, 'Bạn không thể tự xóa tài khoản của chính mình!', ERROR_CODES.CANNOT_MODIFY_SELF);
    }

    if (user.isAdmin && (await User.countDocuments({ isAdmin: true })) <= 1) {
      throw httpError(res, 400, 'Không thể xóa quản trị viên cuối cùng!', ERROR_CODES.LAST_ADMIN);
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
    res.json({ message: 'Đã xóa người dùng cùng toàn bộ chuyến đi, mục yêu thích và đánh giá của họ' });
  } else {
    throw httpError(res, 404, 'Không tìm thấy người dùng', ERROR_CODES.USER_NOT_FOUND);
  }
});

export { getUsers, getUserById, updateUser, deleteUser };
