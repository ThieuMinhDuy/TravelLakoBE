/**
 * Lỗi nghiệp vụ có kèm `code`: chuỗi cố định, KHÔNG đổi theo ngôn ngữ / câu chữ của message.
 * FE nên nhận diện lỗi bằng `code` thay vì so khớp message.
 * errorHandler chỉ gửi `code` của HttpError (không gửi mã lỗi hệ thống như ENOENT, mã của Cloudinary...).
 */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message thông báo hiển thị cho người dùng
   * @param {string} [code] mã lỗi cố định, vd 'ACCOUNT_BLOCKED'
   */
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
  }
}

/**
 * Đặt status cho response và trả về HttpError để `throw` (giữ cách viết quen thuộc trong controller):
 *   throw httpError(res, 403, 'Tài khoản của bạn đã bị khóa!', ERROR_CODES.ACCOUNT_BLOCKED);
 */
export const httpError = (res, status, message, code) => {
  res.status(status);
  return new HttpError(status, message, code);
};

/** Danh sách mã lỗi. Thêm mã mới thì cập nhật cả schema ErrorResponse trong docs/swagger.js */
export const ERROR_CODES = Object.freeze({
  // Chung
  VALIDATION_ERROR: 'VALIDATION_ERROR', // dữ liệu không qua được validate của schema
  DUPLICATE_KEY: 'DUPLICATE_KEY', // trùng dữ liệu unique (trường hợp chung)
  INVALID_JSON: 'INVALID_JSON', // body JSON sai cú pháp
  RATE_LIMITED: 'RATE_LIMITED', // gửi quá nhiều yêu cầu (429)
  MISSING_FIELDS: 'MISSING_FIELDS', // thiếu dữ liệu bắt buộc
  // Xác thực / phân quyền
  AUTH_REQUIRED: 'AUTH_REQUIRED', // 401: chưa đăng nhập (không có token)
  TOKEN_INVALID: 'TOKEN_INVALID', // 401: token sai / hết hạn
  USER_NOT_FOUND: 'USER_NOT_FOUND', // 401: token hợp lệ nhưng người dùng đã bị xóa
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // 401: sai email hoặc mật khẩu
  ACCOUNT_UNVERIFIED: 'ACCOUNT_UNVERIFIED', // 400: tài khoản chưa xác thực email
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED', // 403: tài khoản bị khóa
  NOT_ADMIN: 'NOT_ADMIN', // 403: không phải quản trị viên
  EMAIL_EXISTS: 'EMAIL_EXISTS', // 400: email đã được sử dụng
  // OTP
  OTP_INVALID: 'OTP_INVALID', // 400: mã sai hoặc đã bị hủy
  OTP_EXPIRED: 'OTP_EXPIRED', // 400: mã hết hạn
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED', // 400: nhập sai quá số lần, mã bị hủy
  OTP_COOLDOWN: 'OTP_COOLDOWN', // 429: phải đợi trước khi gửi mã mới
  // Thành phố
  CITY_EXISTS: 'CITY_EXISTS', // 400: trùng tên thành phố
  CITY_NOT_FOUND: 'CITY_NOT_FOUND', // 404 (API thành phố) hoặc 400 (city gửi kèm khi lưu địa điểm / import)
  CITY_HAS_PLACES: 'CITY_HAS_PLACES', // 400: xóa thành phố còn địa điểm khi chưa cascade
  CITY_HAS_TRIPS: 'CITY_HAS_TRIPS', // 400: xóa thành phố còn chuyến đi của người dùng
});
