import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Tạo limiter theo IP, trả lỗi 429 cùng format { message } với errorHandler
 * để FE hiển thị được thông báo.
 */
const createLimiter = ({ limit, windowMs = FIFTEEN_MINUTES, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // Trả header RateLimit / Retry-After
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({ message });
    },
  });

// Đăng nhập (local + Google): tối đa 10 lần THẤT BẠI / 15 phút / IP
const loginLimiter = createLimiter({
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút!',
});

// Các thao tác gửi email OTP (đăng ký, gửi lại OTP, quên mật khẩu): 5 lần / 15 phút / IP
const otpEmailLimiter = createLimiter({
  limit: 5,
  message: 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau 15 phút!',
});

// Nhập mã OTP (xác thực tài khoản, đặt lại mật khẩu): 20 lần / 15 phút / IP
const otpVerifyLimiter = createLimiter({
  limit: 20,
  message: 'Bạn đã thử mã OTP quá nhiều lần. Vui lòng thử lại sau 15 phút!',
});

// Đổi mật khẩu: tối đa 10 lần THẤT BẠI / 15 phút / IP (chặn dò mật khẩu hiện tại khi lộ token)
const changePasswordLimiter = createLimiter({
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút!',
});

export { loginLimiter, otpEmailLimiter, otpVerifyLimiter, changePasswordLimiter };
