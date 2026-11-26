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
   * @param {Record<string, unknown>} [extra] field bổ sung gửi kèm trong body, vd { retryAfter: 45 }
   */
  constructor(status, message, code, extra) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
    if (extra) this.extra = extra;
  }
}

/**
 * Đặt status cho response và trả về HttpError để `throw` (giữ cách viết quen thuộc trong controller):
 *   throw httpError(res, 403, 'Tài khoản của bạn đã bị khóa!', ERROR_CODES.ACCOUNT_BLOCKED);
 *   throw httpError(res, 429, 'Vui lòng đợi 45 giây...', ERROR_CODES.OTP_COOLDOWN, { retryAfter: 45 });
 */
export const httpError = (res, status, message, code, extra) => {
  res.status(status);
  return new HttpError(status, message, code, extra);
};

/** Danh sách mã lỗi. Thêm mã mới thì cập nhật cả schema ErrorResponse trong docs/swagger.js */
export const ERROR_CODES = Object.freeze({
  // Chung
  VALIDATION_ERROR: 'VALIDATION_ERROR', // dữ liệu không qua được validate của schema
  DUPLICATE_KEY: 'DUPLICATE_KEY', // trùng dữ liệu unique (trường hợp chung)
  INVALID_JSON: 'INVALID_JSON', // body JSON sai cú pháp
  RATE_LIMITED: 'RATE_LIMITED', // 429: gửi quá nhiều yêu cầu; body có retryAfter (số giây)
  MISSING_FIELDS: 'MISSING_FIELDS', // thiếu dữ liệu bắt buộc
  NOT_FOUND: 'NOT_FOUND', // 404: đường dẫn API không tồn tại, hoặc ID trên URL sai định dạng
  INTERNAL_ERROR: 'INTERNAL_ERROR', // 500: lỗi không lường trước (ngoài development chỉ trả câu chung, chi tiết ghi log)
  NOT_OWNER: 'NOT_OWNER', // 403: thao tác trên chuyến đi / đánh giá / mục yêu thích của người khác
  // Xác thực / phân quyền
  AUTH_REQUIRED: 'AUTH_REQUIRED', // 401: chưa đăng nhập (không có token)
  TOKEN_INVALID: 'TOKEN_INVALID', // 401: token sai / hết hạn
  USER_NOT_FOUND: 'USER_NOT_FOUND', // 401: token hợp lệ nhưng người dùng đã bị xóa; 404: không có tài khoản với email / id này
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // 401: sai email hoặc mật khẩu
  ACCOUNT_UNVERIFIED: 'ACCOUNT_UNVERIFIED', // 400: tài khoản chưa xác thực email
  ACCOUNT_ALREADY_VERIFIED: 'ACCOUNT_ALREADY_VERIFIED', // 400: tài khoản đã xác thực rồi (không cần nhập OTP nữa)
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED', // 403: tài khoản bị khóa
  NOT_ADMIN: 'NOT_ADMIN', // 403: không phải quản trị viên
  EMAIL_EXISTS: 'EMAIL_EXISTS', // 400: email đã được sử dụng
  INVALID_EMAIL: 'INVALID_EMAIL', // 400: email sai định dạng
  WEAK_PASSWORD: 'WEAK_PASSWORD', // 400: mật khẩu không đủ mạnh (>= 6 ký tự, có hoa, thường, số)
  CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT', // 400: đổi mật khẩu, nhập sai mật khẩu hiện tại
  SAME_PASSWORD: 'SAME_PASSWORD', // 400: mật khẩu mới trùng mật khẩu hiện tại
  GOOGLE_TOKEN_INVALID: 'GOOGLE_TOKEN_INVALID', // 401: Google ID token sai / hết hạn; 400: token không có email
  GOOGLE_EMAIL_UNVERIFIED: 'GOOGLE_EMAIL_UNVERIFIED', // 401: email Google chưa được Google xác minh
  // OTP
  OTP_INVALID: 'OTP_INVALID', // 400: mã sai hoặc đã bị hủy
  OTP_EXPIRED: 'OTP_EXPIRED', // 400: mã hết hạn
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED', // 400: nhập sai quá số lần, mã bị hủy
  OTP_COOLDOWN: 'OTP_COOLDOWN', // 429: phải đợi trước khi gửi mã mới; body có retryAfter (số giây)
  // Thành phố
  CITY_EXISTS: 'CITY_EXISTS', // 400: trùng tên thành phố
  CITY_NOT_FOUND: 'CITY_NOT_FOUND', // 404 (API thành phố) hoặc 400 (city gửi kèm khi lưu địa điểm / import)
  CITY_HAS_PLACES: 'CITY_HAS_PLACES', // 400: xóa thành phố còn địa điểm khi chưa cascade
  CITY_HAS_TRIPS: 'CITY_HAS_TRIPS', // 400: xóa thành phố còn chuyến đi của người dùng
  // Import OpenStreetMap
  OSM_UNAVAILABLE: 'OSM_UNAVAILABLE', // 503: máy chủ OpenStreetMap (Overpass / Nominatim) quá tải, lỗi hoặc quá thời gian; body có retryAfter (số giây)
  GEOCODE_FAILED: 'GEOCODE_FAILED', // 400: không tìm thấy tọa độ của thành phố theo tên (sai chính tả, không phải địa danh Việt Nam...)
  // Địa điểm
  INVALID_PLACE_TYPE: 'INVALID_PLACE_TYPE', // 400: loại địa điểm không phải Attraction / Hotel / Restaurant / Cafe
  PLACE_NOT_FOUND: 'PLACE_NOT_FOUND', // 404: không có địa điểm (xem chi tiết, thêm yêu thích, đánh giá, thêm vào lịch trình, admin)
  // Chuyến đi
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND', // 404: không có chuyến đi
  TRIP_DAY_NOT_FOUND: 'TRIP_DAY_NOT_FOUND', // 400: ngày không có trong lịch trình của chuyến đi
  SCHEDULE_ITEM_NOT_FOUND: 'SCHEDULE_ITEM_NOT_FOUND', // 404: địa điểm không có trong lịch trình
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE', // 400: ngày bắt đầu sau ngày kết thúc
  // Đánh giá / yêu thích
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND', // 404: không có đánh giá
  REVIEW_EXISTS: 'REVIEW_EXISTS', // 400: đã đánh giá địa điểm này rồi
  FAVORITE_NOT_FOUND: 'FAVORITE_NOT_FOUND', // 404: không có mục yêu thích
  FAVORITE_EXISTS: 'FAVORITE_EXISTS', // 400: địa điểm đã có trong danh sách yêu thích
  // Quản lý người dùng (admin)
  LAST_ADMIN: 'LAST_ADMIN', // 400: xóa / gỡ quyền / khóa quản trị viên cuối cùng
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF', // 400: admin tự xóa, tự khóa hoặc tự gỡ quyền admin của mình
  // Upload ảnh
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE', // 400: không phải ảnh JPG / PNG / WEBP
  FILE_TOO_LARGE: 'FILE_TOO_LARGE', // 400: ảnh quá 5MB
  UPLOAD_FAILED: 'UPLOAD_FAILED', // 500: lưu ảnh thất bại hoặc máy chủ chưa cấu hình / cấu hình sai Cloudinary
  // Trợ lý AI
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED', // 500: máy chủ chưa cấu hình GEMINI_API_KEY
  AI_BUSY: 'AI_BUSY', // 429: Gemini hết hạn mức tạm thời
  AI_FAILED: 'AI_FAILED', // 502: Gemini lỗi hoặc trả kết quả không hợp lệ
});
