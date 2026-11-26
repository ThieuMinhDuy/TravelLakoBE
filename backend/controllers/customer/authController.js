import asyncHandler from 'express-async-handler';
import validator from 'validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../../models/userModel.js';
import Trip from '../../models/tripModel.js';
import Favorite from '../../models/favoriteModel.js';
import Review from '../../models/reviewModel.js';
import generateToken, { clearTokenCookie } from '../../utils/generateToken.js';
import sendEmail from '../../utils/sendEmail.js';
import { assertOtpCooldown, issueOtp, verifyOtpOrThrow, clearOtp, OTP_SELECT } from '../../utils/otp.js';
import { httpError, ERROR_CODES } from '../../utils/httpError.js';

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

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const NAME_ERROR = `Họ tên phải từ ${NAME_MIN_LENGTH} đến ${NAME_MAX_LENGTH} ký tự`;

/** Họ tên đã bỏ khoảng trắng hai đầu nếu dài 2-50 ký tự, ngược lại null */
const normalizeName = (value) => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length >= NAME_MIN_LENGTH && name.length <= NAME_MAX_LENGTH ? name : null;
};

// @desc    Auth user & get token
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw httpError(res, 400, 'Vui lòng nhập Email và Mật khẩu!', ERROR_CODES.MISSING_FIELDS);
  }

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // Chặn đăng nhập nếu tài khoản bị khóa
    if (user.isBlocked) {
      throw httpError(res, 403, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!', ERROR_CODES.ACCOUNT_BLOCKED);
    }

    // Chặn đăng nhập nếu chưa xác thực email
    if (!user.isVerified) {
      throw httpError(res, 400, 'Tài khoản chưa được xác thực. Vui lòng xác thực email trước!', ERROR_CODES.ACCOUNT_UNVERIFIED);
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
    throw httpError(res, 401, 'Email hoặc mật khẩu không chính xác!', ERROR_CODES.INVALID_CREDENTIALS);
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Kiểm tra các trường bắt buộc
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw httpError(res, 400, 'Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!', ERROR_CODES.MISSING_FIELDS);
  }

  const trimmedName = normalizeName(name);
  if (!trimmedName) {
    throw httpError(res, 400, NAME_ERROR, ERROR_CODES.VALIDATION_ERROR);
  }

  // 2. Kiểm tra định dạng email (Chỉ chấp nhận đuôi @gmail.com)
  const emailLower = email.toLowerCase();
  if (!validator.isEmail(email) || !emailLower.endsWith('@gmail.com')) {
    throw httpError(res, 400, 'Sai định dạng email!', ERROR_CODES.INVALID_EMAIL);
  }

  // 3. Kiểm tra độ mạnh của mật khẩu (Tối thiểu 6 ký tự, 1 chữ hoa, 1 chữ thường, 1 chữ số)
  if (!validator.isStrongPassword(password, STRONG_PASSWORD_OPTIONS)) {
    throw httpError(res, 400, 'Mật khẩu phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!', ERROR_CODES.WEAK_PASSWORD);
  }

  // 4. Kiểm tra email đã tồn tại chưa
  const userExists = await User.findOne({ email }).select(OTP_SELECT);

  if (userExists) {
    if (userExists.isVerified) {
      throw httpError(res, 400, 'Email này đã được sử dụng!', ERROR_CODES.EMAIL_EXISTS);
    } else {
      // Nếu email đã đăng ký nhưng chưa xác thực, cập nhật lại thông tin mới và gửi OTP mới
      assertOtpCooldown(userExists, res);
      userExists.name = trimmedName;
      userExists.password = password;
      const otpCode = issueOtp(userExists);
      await userExists.save();

      // Gửi email OTP
      await sendEmail({
        to: email,
        subject: 'Mã xác thực đăng ký tài khoản - TravelLako',
        html: `<h3>Chào ${trimmedName},</h3>
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
    name: trimmedName,
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
    throw httpError(res, 400, 'Dữ liệu người dùng không hợp lệ', ERROR_CODES.VALIDATION_ERROR);
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ message: 'Đã đăng xuất' });
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

const PHONE_REGEX = /^(0\d{9})?$/; // rỗng (xóa số) hoặc 10 chữ số bắt đầu bằng 0
const GENDERS = ['Nam', 'Nữ', 'Khác', ''];
const BUDGETS = ['Tiết kiệm', 'Trung bình', 'Cao cấp', ''];
const MAX_TRAVEL_PREFERENCES = 6;
const MAX_TRAVEL_PREFERENCE_LENGTH = 50;
const MIN_DATE_OF_BIRTH = new Date('1900-01-01T00:00:00.000Z');

/**
 * Kiểm tra và chuẩn hóa dữ liệu PUT /api/auth/profile. Field không gửi lên thì giữ nguyên.
 * @returns {{ updates: Record<string, unknown>, errors: string[] }}
 */
const parseProfileUpdates = (body) => {
  const updates = {};
  const errors = [];

  if (body.name !== undefined) {
    const name = normalizeName(body.name);
    if (name) updates.name = name;
    else errors.push(NAME_ERROR);
  }

  if (body.avatar !== undefined) {
    if (isValidImageUrlOrEmpty(body.avatar)) updates.avatar = body.avatar;
    else errors.push('Ảnh đại diện không hợp lệ! Vui lòng tải ảnh lên và dùng URL http(s) được trả về.');
  }

  if (body.coverImage !== undefined) {
    if (isValidImageUrlOrEmpty(body.coverImage)) updates.coverImage = body.coverImage;
    else errors.push('Ảnh bìa không hợp lệ! Vui lòng tải ảnh lên và dùng URL http(s) được trả về.');
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    if (phone !== null && PHONE_REGEX.test(phone)) updates.phone = phone;
    else errors.push('Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0');
  }

  if (body.gender !== undefined) {
    if (GENDERS.includes(body.gender)) updates.gender = body.gender;
    else errors.push('Giới tính không hợp lệ');
  }

  if (body.favoriteBudget !== undefined) {
    if (BUDGETS.includes(body.favoriteBudget)) updates.favoriteBudget = body.favoriteBudget;
    else errors.push('Mức ngân sách không hợp lệ');
  }

  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth === '') {
      updates.dateOfBirth = null; // xóa ngày sinh
    } else {
      const date = typeof body.dateOfBirth === 'string' ? new Date(body.dateOfBirth) : null;
      if (!date || Number.isNaN(date.getTime()) || date < MIN_DATE_OF_BIRTH) errors.push('Ngày sinh không hợp lệ');
      else if (date > new Date()) errors.push('Ngày sinh không được ở tương lai');
      else updates.dateOfBirth = date;
    }
  }

  if (body.travelPreferences !== undefined) {
    const list = body.travelPreferences;
    if (!Array.isArray(list) || !list.every((item) => typeof item === 'string')) {
      errors.push('Sở thích du lịch phải là danh sách chữ');
    } else {
      // Bỏ khoảng trắng, mục rỗng và mục trùng
      const preferences = [...new Set(list.map((item) => item.trim()).filter(Boolean))];
      if (preferences.length > MAX_TRAVEL_PREFERENCES) {
        errors.push(`Chỉ được chọn tối đa ${MAX_TRAVEL_PREFERENCES} sở thích du lịch`);
      } else if (preferences.some((item) => item.length > MAX_TRAVEL_PREFERENCE_LENGTH)) {
        errors.push(`Mỗi sở thích du lịch tối đa ${MAX_TRAVEL_PREFERENCE_LENGTH} ký tự`);
      } else {
        updates.travelPreferences = preferences;
      }
    }
  }

  return { updates, errors };
};

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
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
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
      throw httpError(res, 400, 'Vui lòng dùng chức năng Đổi mật khẩu', ERROR_CODES.VALIDATION_ERROR);
    }

    // Kiểm tra mọi field trước khi ghi: có lỗi thì không lưu gì, báo tất cả lỗi trong 1 câu
    const { updates, errors } = parseProfileUpdates(req.body);
    if (errors.length) {
      throw httpError(res, 400, errors.join('. '), ERROR_CODES.VALIDATION_ERROR);
    }
    Object.assign(user, updates);

    const updatedUser = await user.save();

    res.json(buildProfileResponse(updatedUser));
  } else {
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
  }
});

// @desc    Change password (verify current password) or set first password (Google account)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!isNonEmptyString(newPassword)) {
    throw httpError(res, 400, 'Vui lòng nhập mật khẩu mới!', ERROR_CODES.MISSING_FIELDS);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
  }

  // Tài khoản đã có mật khẩu: bắt buộc xác minh mật khẩu hiện tại.
  // Tài khoản Google chưa có mật khẩu: được đặt mật khẩu lần đầu mà không cần currentPassword.
  // Lưu ý: lỗi nghiệp vụ dùng 400, KHÔNG dùng 401 (FE coi 401 là hết phiên và tự đăng xuất).
  if (user.password) {
    if (!isNonEmptyString(currentPassword)) {
      throw httpError(res, 400, 'Vui lòng nhập mật khẩu hiện tại!', ERROR_CODES.MISSING_FIELDS);
    }

    if (!(await user.matchPassword(currentPassword))) {
      throw httpError(res, 400, 'Mật khẩu hiện tại không chính xác!', ERROR_CODES.CURRENT_PASSWORD_INCORRECT);
    }
  }

  if (!validator.isStrongPassword(newPassword, STRONG_PASSWORD_OPTIONS)) {
    throw httpError(res, 400, 'Mật khẩu phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!', ERROR_CODES.WEAK_PASSWORD);
  }

  if (user.password && (await user.matchPassword(newPassword))) {
    throw httpError(res, 400, 'Mật khẩu mới phải khác mật khẩu hiện tại!', ERROR_CODES.SAME_PASSWORD);
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
    throw httpError(res, 400, 'Vui lòng cung cấp Email và mã OTP!', ERROR_CODES.MISSING_FIELDS);
  }

  const user = await User.findOne({ email }).select(OTP_SELECT);

  if (!user) {
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
  }

  if (user.isVerified) {
    throw httpError(res, 400, 'Tài khoản này đã được xác thực trước đó!', ERROR_CODES.ACCOUNT_ALREADY_VERIFIED);
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
    throw httpError(res, 400, 'Vui lòng cung cấp Email!', ERROR_CODES.MISSING_FIELDS);
  }

  const user = await User.findOne({ email }).select(OTP_SELECT);

  if (!user) {
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
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
    throw httpError(res, 400, 'Vui lòng nhập Email!', ERROR_CODES.MISSING_FIELDS);
  }

  const user = await User.findOne({ email }).select(OTP_SELECT);

  if (!user) {
    throw httpError(res, 404, 'Không tìm thấy tài khoản với email này!', ERROR_CODES.USER_NOT_FOUND);
  }

  if (!user.isVerified) {
    throw httpError(res, 400, 'Tài khoản này chưa được xác thực email. Không thể sử dụng tính năng này!', ERROR_CODES.ACCOUNT_UNVERIFIED);
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
    throw httpError(res, 400, 'Vui lòng cung cấp đầy đủ Email, mã OTP và Mật khẩu mới!', ERROR_CODES.MISSING_FIELDS);
  }

  // Kiểm tra mật khẩu mới có mạnh không (trước khi kiểm tra OTP để không tốn lượt thử)
  if (!validator.isStrongPassword(newPassword, STRONG_PASSWORD_OPTIONS)) {
    throw httpError(res, 400, 'Mật khẩu mới phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!', ERROR_CODES.WEAK_PASSWORD);
  }

  const user = await User.findOne({ email }).select(OTP_SELECT);

  if (!user) {
    throw httpError(res, 404, 'Không tìm thấy người dùng!', ERROR_CODES.USER_NOT_FOUND);
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
    throw httpError(res, 400, 'Vui lòng cung cấp Google ID Token (idToken hoặc credential)!', ERROR_CODES.MISSING_FIELDS);
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    console.error('Lỗi xác thực Google Token:', error.message);
    throw httpError(res, 401, 'Google ID Token không hợp lệ hoặc đã hết hạn!', ERROR_CODES.GOOGLE_TOKEN_INVALID);
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw httpError(res, 400, 'Không thể lấy thông tin email từ Google Token!', ERROR_CODES.GOOGLE_TOKEN_INVALID);
  }

  // Chỉ tin email đã được Google xác minh, tránh gộp nhầm vào tài khoản local có cùng email
  if (payload.email_verified !== true) {
    throw httpError(res, 401, 'Email Google của bạn chưa được xác minh!', ERROR_CODES.GOOGLE_EMAIL_UNVERIFIED);
  }

  const { sub: googleId, email, name, picture } = payload;

  // Tìm user theo email hoặc googleId
  let user = await User.findOne({
    $or: [{ email }, { googleId }],
  });

  if (user) {
    if (user.isBlocked) {
      throw httpError(res, 403, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!', ERROR_CODES.ACCOUNT_BLOCKED);
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
      // Giữ đúng quy tắc 2-50 ký tự để người dùng sửa hồ sơ được mà không phải đổi tên
      name: normalizeName(typeof name === 'string' ? name.trim().slice(0, NAME_MAX_LENGTH) : '') || 'Người dùng Google',
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
