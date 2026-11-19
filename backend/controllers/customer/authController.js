import asyncHandler from 'express-async-handler';
import validator from 'validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../../models/userModel.js';
import Trip from '../../models/tripModel.js';
import Favorite from '../../models/favoriteModel.js';
import Review from '../../models/reviewModel.js';
import generateToken, { clearTokenCookie } from '../../utils/generateToken.js';
import sendEmail from '../../utils/sendEmail.js';
import { assertOtpCooldown, issueOtp, verifyOtpOrThrow, clearOtp } from '../../utils/otp.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const STRONG_PASSWORD_OPTIONS = {
  minLength: 6,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 0,
};

/**
 * Chỉ chấp nhận giá trị dạng chuỗi cho các field dùng làm điều kiện truy vấn
 * (chặn payload kiểu { "email": { "$ne": null } } lọt vào User.findOne).
 */
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

// @desc    Auth user & get token
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400);
    throw new Error('Vui lòng nhập Email và Mật khẩu!');
  }

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // Chặn đăng nhập nếu tài khoản bị khóa
    if (user.isBlocked) {
      res.status(403);
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!');
    }

    // Chặn đăng nhập nếu chưa xác thực email
    if (!user.isVerified) {
      res.status(400);
      throw new Error('Tài khoản chưa được xác thực. Vui lòng xác thực email trước!');
    }

    const token = generateToken(res, user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      token,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Kiểm tra các trường bắt buộc
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400);
    throw new Error('Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!');
  }

  // 2. Kiểm tra định dạng email (Chỉ chấp nhận đuôi @gmail.com)
  const emailLower = email.toLowerCase();
  if (!validator.isEmail(email) || !emailLower.endsWith('@gmail.com')) {
    res.status(400);
    throw new Error('Sai định dạng email!');
  }

  // 3. Kiểm tra độ mạnh của mật khẩu (Tối thiểu 6 ký tự, 1 chữ hoa, 1 chữ thường, 1 chữ số)
  if (!validator.isStrongPassword(password, STRONG_PASSWORD_OPTIONS)) {
    res.status(400);
    throw new Error('Mật khẩu phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!');
  }

  // 4. Kiểm tra email đã tồn tại chưa
  const userExists = await User.findOne({ email });

  if (userExists) {
    if (userExists.isVerified) {
      res.status(400);
      throw new Error('Email này đã được sử dụng!');
    } else {
      // Nếu email đã đăng ký nhưng chưa xác thực, cập nhật lại thông tin mới và gửi OTP mới
      assertOtpCooldown(userExists, res);
      userExists.name = name;
      userExists.password = password;
      const otpCode = issueOtp(userExists);
      await userExists.save();

      // Gửi email OTP
      await sendEmail({
        to: email,
        subject: 'Mã xác thực đăng ký tài khoản - TravelLako',
        html: `<h3>Chào ${name},</h3>
               <p>Mã OTP để xác thực tài khoản đăng ký của bạn là: <b>${otpCode}</b></p>
               <p>Mã này có hiệu lực trong vòng 5 phút.</p>`,
      });

      return res.status(200).json({
        message: 'Tài khoản chưa xác thực trước đó đã được cập nhật. Vui lòng kiểm tra email để nhận mã OTP mới!',
        email,
      });
    }
  }

  // 5. Lưu user mới vào MongoDB với isVerified = false
  const user = new User({
    name,
    email,
    password,
    isVerified: false,
  });
  const otpCode = issueOtp(user);
  await user.save();

  if (user) {
    // Gửi email OTP
    await sendEmail({
      to: email,
      subject: 'Mã xác thực đăng ký tài khoản - TravelLako',
      html: `<h3>Chào ${name},</h3>
             <p>Cảm ơn bạn đã đăng ký tài khoản tại TravelLako.</p>
             <p>Mã OTP để xác thực tài khoản của bạn là: <b>${otpCode}</b></p>
             <p>Mã này có hiệu lực trong vòng 5 phút.</p>`,
    });

    res.status(201).json({
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để nhận mã OTP xác thực tài khoản.',
      email,
    });
  } else {
    res.status(400);
    throw new Error('Dữ liệu người dùng không hợp lệ');
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
};

/**
 * Các trường hồ sơ trả về cho chính chủ tài khoản (GET/PUT /api/auth/profile).
 * Không bao giờ trả hash mật khẩu hay OTP — chỉ trả cờ `hasPassword`.
 */
const buildProfileResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  coverImage: user.coverImage,
  phone: user.phone,
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  travelPreferences: user.travelPreferences,
  favoriteBudget: user.favoriteBudget,
  isAdmin: user.isAdmin,
  authType: user.authType,
  hasPassword: Boolean(user.password),
});

/** Chuỗi rỗng (xóa ảnh) hoặc URL http(s) hợp lệ */
const isValidImageUrlOrEmpty = (value) =>
  typeof value === 'string' &&
  (value === '' ||
    validator.isURL(value, { protocols: ['http', 'https'], require_protocol: true, require_tld: false }));

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    // Query statistics for the user
    const [tripsCount, favoritesCount, reviewsCount] = await Promise.all([
      Trip.countDocuments({ user: user._id }),
      Favorite.countDocuments({ user: user._id }),
      Review.countDocuments({ user: user._id }),
    ]);

    res.json({
      ...buildProfileResponse(user),
      stats: {
        trips: tripsCount,
        favorites: favoritesCount,
        reviews: reviewsCount,
      },
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    // Đổi mật khẩu phải qua PUT /api/auth/change-password (có xác minh mật khẩu hiện tại)
    if (req.body.password !== undefined) {
      res.status(400);
      throw new Error('Vui lòng dùng chức năng Đổi mật khẩu');
    }

    if (req.body.coverImage !== undefined && !isValidImageUrlOrEmpty(req.body.coverImage)) {
      res.status(400);
      throw new Error('Ảnh bìa không hợp lệ! Vui lòng tải ảnh lên và dùng URL http(s) được trả về.');
    }

    user.name = req.body.name || user.name;

    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    }

    if (req.body.coverImage !== undefined) {
      user.coverImage = req.body.coverImage;
    }

    if (req.body.phone !== undefined) {
      user.phone = req.body.phone;
    }

    if (req.body.gender !== undefined) {
      user.gender = req.body.gender;
    }

    if (req.body.dateOfBirth !== undefined) {
      user.dateOfBirth = req.body.dateOfBirth;
    }

    if (req.body.travelPreferences !== undefined) {
      user.travelPreferences = req.body.travelPreferences;
    }

    if (req.body.favoriteBudget !== undefined) {
      user.favoriteBudget = req.body.favoriteBudget;
    }

    const updatedUser = await user.save();

    res.json(buildProfileResponse(updatedUser));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Change password (verify current password) or set first password (Google account)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!isNonEmptyString(newPassword)) {
    res.status(400);
    throw new Error('Vui lòng nhập mật khẩu mới!');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Tài khoản đã có mật khẩu: bắt buộc xác minh mật khẩu hiện tại.
  // Tài khoản Google chưa có mật khẩu: được đặt mật khẩu lần đầu mà không cần currentPassword.
  // Lưu ý: lỗi nghiệp vụ dùng 400, KHÔNG dùng 401 (FE coi 401 là hết phiên và tự đăng xuất).
  if (user.password) {
    if (!isNonEmptyString(currentPassword)) {
      res.status(400);
      throw new Error('Vui lòng nhập mật khẩu hiện tại!');
    }

    if (!(await user.matchPassword(currentPassword))) {
      res.status(400);
      throw new Error('Mật khẩu hiện tại không chính xác!');
    }
  }

  if (!validator.isStrongPassword(newPassword, STRONG_PASSWORD_OPTIONS)) {
    res.status(400);
    throw new Error('Mật khẩu phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!');
  }

  if (user.password && (await user.matchPassword(newPassword))) {
    res.status(400);
    throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại!');
  }

  // Hook pre-save của model sẽ tự hash
  user.password = newPassword;
  await user.save();

  res.status(200).json({ message: 'Đổi mật khẩu thành công!' });
});

// @desc    Verify OTP for registration
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!isNonEmptyString(email) || otp === undefined || otp === null || String(otp).trim() === '') {
    res.status(400);
    throw new Error('Vui lòng cung cấp Email và mã OTP!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng!');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('Tài khoản này đã được xác thực trước đó!');
  }

  // Sai mã -> tăng số lần thử; sai quá 5 lần -> hủy mã
  await verifyOtpOrThrow(user, otp, res);

  // Xác thực thành công
  user.isVerified = true;
  clearOtp(user);
  await user.save();

  // Đăng nhập luôn cho user sau khi xác thực thành công
  const token = generateToken(res, user._id);

  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    travelPreferences: user.travelPreferences,
    favoriteBudget: user.favoriteBudget,
    isAdmin: user.isAdmin,
    token,
  });
});

// @desc    Resend registration/reset OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isNonEmptyString(email)) {
    res.status(400);
    throw new Error('Vui lòng cung cấp Email!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng!');
  }

  assertOtpCooldown(user, res);
  const otpCode = issueOtp(user);
  await user.save();

  await sendEmail({
    to: email,
    subject: 'Gửi lại mã xác thực - TravelLako',
    html: `<h3>Xin chào ${user.name},</h3>
           <p>Mã OTP mới của bạn là: <b>${otpCode}</b></p>
           <p>Mã này có hiệu lực trong vòng 5 phút.</p>`,
  });

  res.status(200).json({ message: 'Mã OTP mới đã được gửi thành công!' });
});

// @desc    Request OTP for forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isNonEmptyString(email)) {
    res.status(400);
    throw new Error('Vui lòng nhập Email!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy tài khoản với email này!');
  }

  if (!user.isVerified) {
    res.status(400);
    throw new Error('Tài khoản này chưa được xác thực email. Không thể sử dụng tính năng này!');
  }

  assertOtpCooldown(user, res);
  const otpCode = issueOtp(user);
  await user.save();

  await sendEmail({
    to: email,
    subject: 'Yêu cầu đặt lại mật khẩu - TravelLako',
    html: `<h3>Xin chào ${user.name},</h3>
           <p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>
           <p>Mã OTP của bạn là: <b>${otpCode}</b></p>
           <p>Mã này có hiệu lực trong vòng 5 phút.</p>`,
  });

  res.status(200).json({ message: 'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn!' });
});

// @desc    Reset password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (
    !isNonEmptyString(email) ||
    otp === undefined || otp === null || String(otp).trim() === '' ||
    !isNonEmptyString(newPassword)
  ) {
    res.status(400);
    throw new Error('Vui lòng cung cấp đầy đủ Email, mã OTP và Mật khẩu mới!');
  }

  // Kiểm tra mật khẩu mới có mạnh không (trước khi kiểm tra OTP để không tốn lượt thử)
  if (!validator.isStrongPassword(newPassword, STRONG_PASSWORD_OPTIONS)) {
    res.status(400);
    throw new Error('Mật khẩu mới phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng!');
  }

  // Sai mã -> tăng số lần thử; sai quá 5 lần -> hủy mã
  await verifyOtpOrThrow(user, otp, res);

  // Cập nhật mật khẩu mới (Mongoose pre-save hook sẽ tự động hash)
  user.password = newPassword;
  clearOtp(user);
  await user.save();

  res.status(200).json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });
});

// @desc    Auth user with Google ID token
// @route   POST /api/auth/google
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
  const idToken = req.body.idToken || req.body.credential || req.body.token;

  if (!idToken) {
    res.status(400);
    throw new Error('Vui lòng cung cấp Google ID Token (idToken hoặc credential)!');
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    console.error('Lỗi xác thực Google Token:', error.message);
    res.status(401);
    throw new Error('Google ID Token không hợp lệ hoặc đã hết hạn!');
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    res.status(400);
    throw new Error('Không thể lấy thông tin email từ Google Token!');
  }

  // Chỉ tin email đã được Google xác minh, tránh gộp nhầm vào tài khoản local có cùng email
  if (payload.email_verified !== true) {
    res.status(401);
    throw new Error('Email Google của bạn chưa được xác minh!');
  }

  const { sub: googleId, email, name, picture } = payload;

  // Tìm user theo email hoặc googleId
  let user = await User.findOne({
    $or: [{ email }, { googleId }],
  });

  if (user) {
    if (user.isBlocked) {
      res.status(403);
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!');
    }

    let isUpdated = false;
    if (!user.googleId) {
      user.googleId = googleId;
      isUpdated = true;
    }
    if (!user.avatar && picture) {
      user.avatar = picture;
      isUpdated = true;
    }
    if (!user.isVerified) {
      user.isVerified = true;
      isUpdated = true;
    }

    if (isUpdated) {
      await user.save();
    }
  } else {
    user = await User.create({
      name: name || 'Người dùng Google',
      email,
      avatar: picture || '',
      googleId,
      authType: 'google',
      isVerified: true,
    });
  }

  const token = generateToken(res, user._id);

  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    isAdmin: user.isAdmin,
    token,
  });
});

export {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  googleLogin,
};
