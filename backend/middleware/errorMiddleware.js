import { HttpError, ERROR_CODES } from '../utils/httpError.js';

const INTERNAL_ERROR_MESSAGE = 'Máy chủ gặp sự cố, vui lòng thử lại sau';

const notFound = (req, res, next) => {
  next(new HttpError(404, `Không tìm thấy đường dẫn API: ${req.originalUrl}`, ERROR_CODES.NOT_FOUND));
};

/** Thông báo + mã lỗi cho lỗi trùng unique index (MongoDB code 11000) */
const duplicateKeyError = (err) => {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  const collection = (err.message || '').match(/collection: \S+\.(\S+)/)?.[1];
  if (fields.includes('name') && collection === 'cities') {
    return { message: 'Thành phố đã tồn tại', code: ERROR_CODES.CITY_EXISTS };
  }
  if (fields.includes('email')) {
    return { message: 'Email này đã được sử dụng!', code: ERROR_CODES.EMAIL_EXISTS };
  }
  // 2 request thêm yêu thích cùng lúc lọt qua bước kiểm tra trong controller
  if (collection === 'favorites') {
    return { message: 'Địa điểm này đã có trong danh sách yêu thích của bạn', code: ERROR_CODES.FAVORITE_EXISTS };
  }
  return {
    message: fields.length ? `Dữ liệu đã tồn tại (trùng ${fields.join(', ')})` : 'Dữ liệu đã tồn tại',
    code: ERROR_CODES.DUPLICATE_KEY,
  };
};

/** Gộp các lỗi validate của Mongoose thành một câu (message tiếng Việt khai báo trong schema) */
const validationMessage = (err) =>
  Object.values(err.errors || {})
    .map((e) => (e.name === 'CastError' ? `Trường "${e.path}" có giá trị không hợp lệ` : e.message))
    .join('. ');

const errorHandler = (err, req, res, next) => {
  console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  const isHttpError = err instanceof HttpError;
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  // HttpError tạo ở utils / middleware (không đặt res.status): lấy status ghi trong lỗi
  if (res.statusCode === 200 && isHttpError && Number.isInteger(err.status)) statusCode = err.status;
  let message = err.message;
  // Chỉ gửi code của lỗi do mình tạo (HttpError); err.code của Node / MongoDB / thư viện thì bỏ qua
  let code = isHttpError && typeof err.code === 'string' ? err.code : undefined;

  // Lỗi tự gắn status 4xx nhưng chưa đặt res.status (vd body-parser khi JSON sai cú pháp)
  if (statusCode === 500 && !isHttpError && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    if (err.type === 'entity.parse.failed') {
      message = 'Dữ liệu JSON gửi lên không hợp lệ';
      code = ERROR_CODES.INVALID_JSON;
    } else if (err.type === 'entity.too.large') {
      message = 'Dữ liệu gửi lên quá lớn';
      code = ERROR_CODES.VALIDATION_ERROR;
    }
  }

  if (err.name === 'ValidationError') {
    // Thiếu field bắt buộc, giá trị ngoài khoảng, sai kiểu dữ liệu... là lỗi của dữ liệu gửi lên
    statusCode = 400;
    message = validationMessage(err) || 'Dữ liệu không hợp lệ';
    code = ERROR_CODES.VALIDATION_ERROR;
  } else if (err.code === 11000) {
    statusCode = 400;
    ({ message, code } = duplicateKeyError(err));
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    // ID sai định dạng (trên URL hoặc trong bộ lọc): coi như không tìm thấy
    statusCode = 404;
    message = 'Không tìm thấy dữ liệu (ID không hợp lệ)';
    code = ERROR_CODES.NOT_FOUND;
  } else if (err.name === 'CastError') {
    // Giá trị sai kiểu trong bộ lọc, vd ?stars=abc
    statusCode = 400;
    message = `Trường "${err.path}" có giá trị không hợp lệ`;
    code = ERROR_CODES.VALIDATION_ERROR;
  } else if (!isHttpError && statusCode >= 500) {
    // Lỗi không lường trước (lỗi lập trình, mất kết nối DB...): không đưa câu kỹ thuật tiếng Anh ra giao diện.
    // Chạy local (development) vẫn trả câu gốc để dễ sửa; chi tiết luôn có trong log ở trên.
    code = ERROR_CODES.INTERNAL_ERROR;
    if (process.env.NODE_ENV !== 'development') message = INTERNAL_ERROR_MESSAGE;
  } else if (!isHttpError && !code) {
    // Lỗi 4xx của thư viện chưa được phân loại (câu tiếng Anh của thư viện)
    if (statusCode === 404) {
      message = 'Không tìm thấy dữ liệu';
      code = ERROR_CODES.NOT_FOUND;
    } else {
      message = 'Yêu cầu không hợp lệ';
      code = ERROR_CODES.VALIDATION_ERROR;
    }
  }

  res.status(statusCode).json({
    // Field bổ sung của HttpError (vd retryAfter), đặt trước để không ghi đè được message / code / stack
    ...(isHttpError && err.extra ? err.extra : {}),
    message: message || INTERNAL_ERROR_MESSAGE,
    // Mã lỗi cố định để FE nhận diện
    code,
    // Chỉ lộ stack trace khi chạy local (NODE_ENV=development).
    // Môi trường khác (production, hoặc quên đặt NODE_ENV) không trả stack để tránh lộ đường dẫn/code server.
    stack: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
};

export { notFound, errorHandler };
