import crypto from 'crypto';
import { httpError, ERROR_CODES } from './httpError.js';

export const OTP_TTL_MS = 5 * 60 * 1000; // Mã có hiệu lực 5 phút
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // Tối thiểu 60 giây giữa 2 lần gửi mã
export const OTP_MAX_ATTEMPTS = 5; // Nhập sai quá 5 lần thì mã bị hủy

// Các field OTP bị ẩn mặc định (select: false trong userModel); thêm vào truy vấn khi cần đọc OTP
export const OTP_SELECT = '+otp.code +otp.expiresAt +otp.attempts +otp.lastSentAt';

/**
 * Chặn gửi mã mới nếu lần gửi trước chưa đủ thời gian cooldown.
 * Ném lỗi 429 kèm số giây cần đợi.
 */
export const assertOtpCooldown = (user, res) => {
  const lastSentAt = user.otp?.lastSentAt;
  if (!lastSentAt) return;

  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
    throw httpError(res, 429, `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã OTP mới!`, ERROR_CODES.OTP_COOLDOWN);
  }
};

/**
 * Sinh mã OTP 6 chữ số mới (crypto-secure), gán vào user (chưa save).
 * @returns {string} mã OTP để gửi email
 */
export const issueOtp = (user) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.otp = {
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(),
  };
  return code;
};

/** Hủy mã hiện tại nhưng giữ lastSentAt để cooldown vẫn áp dụng */
const invalidateOtp = (user) => {
  user.otp = {
    code: null,
    expiresAt: null,
    attempts: 0,
    lastSentAt: user.otp?.lastSentAt || null,
  };
};

/**
 * Kiểm tra mã OTP người dùng nhập. Sai thì tăng số lần thử (và lưu DB),
 * sai quá OTP_MAX_ATTEMPTS lần thì hủy mã. Đúng thì không làm gì —
 * caller tự gọi clearOtp() rồi save cùng các thay đổi khác.
 */
export const verifyOtpOrThrow = async (user, otpInput, res) => {
  if (!user.otp?.code) {
    throw httpError(res, 400, 'Mã OTP không hợp lệ hoặc đã bị hủy. Vui lòng yêu cầu mã mới!', ERROR_CODES.OTP_INVALID);
  }

  if (user.otp.expiresAt < new Date()) {
    throw httpError(res, 400, 'Mã OTP đã hết hạn! Vui lòng yêu cầu mã mới.', ERROR_CODES.OTP_EXPIRED);
  }

  if (String(otpInput ?? '').trim() !== user.otp.code) {
    const attempts = (user.otp.attempts || 0) + 1;

    if (attempts >= OTP_MAX_ATTEMPTS) {
      invalidateOtp(user);
      await user.save();
      throw httpError(res, 400, 'Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu mã mới!', ERROR_CODES.OTP_ATTEMPTS_EXCEEDED);
    }

    user.otp.attempts = attempts;
    await user.save();
    throw httpError(
      res,
      400,
      `Mã OTP không chính xác! Bạn còn ${OTP_MAX_ATTEMPTS - attempts} lần thử.`,
      ERROR_CODES.OTP_INVALID
    );
  }
};

/** Xóa hoàn toàn OTP sau khi dùng thành công */
export const clearOtp = (user) => {
  user.otp = { code: null, expiresAt: null, attempts: 0, lastSentAt: null };
};
