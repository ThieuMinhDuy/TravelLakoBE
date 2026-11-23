import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../utils/httpError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Tạo limiter theo IP, trả lỗi 429 cùng format { message, code } với errorHandler
 * để FE hiển thị được thông báo. Body có thêm retryAfter (số giây đến khi được thử lại),
 * vì header Retry-After không đọc được từ trình duyệt (CORS không expose header này).
 */
const createLimiter = ({ limit, windowMs = FIFTEEN_MINUTES, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // Trả header RateLimit / Retry-After
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res, next, options) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfter = resetTime
        ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      res.status(options.statusCode).json({ message, code: ERROR_CODES.RATE_LIMITED, retryAfter });
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
