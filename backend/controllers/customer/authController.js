import asyncHandler from 'express-async-handler';
import validator from 'validator';
import User from '../../models/userModel.js';
import Trip from '../../models/tripModel.js';
import Favorite from '../../models/favoriteModel.js';
import Review from '../../models/reviewModel.js';
import generateToken from '../../utils/generateToken.js';
import sendEmail from '../../utils/sendEmail.js';

// @desc    Auth user & get token
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
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
  if (!name || !email || !password || name.trim() === '' || email.trim() === '' || password.trim() === '') {
    res.status(400);
    throw new Error('Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!');
  }

  // 2. Kiểm tra định dạng email (Chỉ chấp nhận đuôi @gmail.com)
  const emailLower = email.toLowerCase();
  if (!validator.isEmail(email) || (!emailLower.endsWith('@gmail.com') && !emailLower.endsWith('@gamil.com'))) {
    res.status(400);
    throw new Error('Sai định dạng email!');
  }

  // 3. Kiểm tra độ mạnh của mật khẩu (Tối thiểu 6 ký tự, 1 chữ hoa, 1 chữ thường, 1 chữ số)
  if (
    !validator.isStrongPassword(password, {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    })
  ) {
    res.status(400);
    throw new Error('Mật khẩu phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!');
  }

  // Tạo mã OTP 6 chữ số ngẫu nhiên & hạn dùng 5 phút
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // 4. Kiểm tra email đã tồn tại chưa
  const userExists = await User.findOne({ email });

  if (userExists) {
    if (userExists.isVerified) {
      res.status(400);
      throw new Error('Email này đã được sử dụng!');
    } else {
      // Nếu email đã đăng ký nhưng chưa xác thực, cập nhật lại thông tin mới và gửi OTP mới
      userExists.name = name;
      userExists.password = password;
      userExists.otp = { code: otpCode, expiresAt: otpExpiresAt };
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
  const user = await User.create({
    name,
    email,
    password,
    isVerified: false,
    otp: {
      code: otpCode,
      expiresAt: otpExpiresAt,
    },
  });

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
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
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
    user.name = req.body.name || user.name;
    
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
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

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      phone: updatedUser.phone,
      gender: updatedUser.gender,
      dateOfBirth: updatedUser.dateOfBirth,
      travelPreferences: updatedUser.travelPreferences,
      favoriteBudget: updatedUser.favoriteBudget,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Verify OTP for registration
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
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

  if (!user.otp || user.otp.code !== otp) {
    res.status(400);
    throw new Error('Mã OTP không chính xác!');
  }

  if (user.otp.expiresAt < new Date()) {
    res.status(400);
    throw new Error('Mã OTP đã hết hạn! Vui lòng yêu cầu mã mới.');
  }

  // Xác thực thành công
  user.isVerified = true;
  user.otp = { code: null, expiresAt: null };
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

  if (!email) {
    res.status(400);
    throw new Error('Vui lòng cung cấp Email!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng!');
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  user.otp = { code: otpCode, expiresAt: otpExpiresAt };
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

  if (!email) {
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

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  user.otp = { code: otpCode, expiresAt: otpExpiresAt };
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

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Vui lòng cung cấp đầy đủ Email, mã OTP và Mật khẩu mới!');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng!');
  }

  if (!user.otp || user.otp.code !== otp) {
    res.status(400);
    throw new Error('Mã OTP không chính xác!');
  }

  if (user.otp.expiresAt < new Date()) {
    res.status(400);
    throw new Error('Mã OTP đã hết hạn!');
  }

  // Kiểm tra mật khẩu mới có mạnh không
  if (
    !validator.isStrongPassword(newPassword, {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    })
  ) {
    res.status(400);
    throw new Error('Mật khẩu mới phải tối thiểu 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số!');
  }

  // Cập nhật mật khẩu mới (Mongoose pre-save hook sẽ tự động hash)
  user.password = newPassword;
  user.otp = { code: null, expiresAt: null };
  await user.save();

  res.status(200).json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });
});

export {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
};
