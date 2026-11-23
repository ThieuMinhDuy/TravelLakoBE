import { HttpError, ERROR_CODES } from '../utils/httpError.js';

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/** Thông báo + mã lỗi cho lỗi trùng unique index (MongoDB code 11000) */
const duplicateKeyError = (err) => {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  // Giữ đúng câu chữ FE đang nhận diện cho trường hợp trùng tên thành phố / email
  if (fields.includes('name') && /\.cities /.test(err.message || '')) {
    return { message: 'City already exists', code: ERROR_CODES.CITY_EXISTS };
  }
  if (fields.includes('email')) {
    return { message: 'Email này đã được sử dụng!', code: ERROR_CODES.EMAIL_EXISTS };
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
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  // Chỉ gửi code của lỗi do mình tạo (HttpError); err.code của Node / MongoDB / thư viện thì bỏ qua
  let code = err instanceof HttpError && typeof err.code === 'string' ? err.code : undefined;

  // Lỗi tự gắn status 4xx nhưng chưa đặt res.status (vd body-parser khi JSON sai cú pháp)
  if (statusCode === 500 && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    if (err.type === 'entity.parse.failed') {
      message = 'Dữ liệu JSON gửi lên không hợp lệ';
      code = ERROR_CODES.INVALID_JSON;
    }
    if (err.type === 'entity.too.large') message = 'Dữ liệu gửi lên quá lớn';
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
    // ID trên URL sai định dạng: coi như không tìm thấy
    statusCode = 404;
    message = 'Resource not found';
  }

  res.status(statusCode).json({
    message: message,
    // Mã lỗi cố định để FE nhận diện (không có với lỗi chưa được phân loại)
    code,
    // Chỉ lộ stack trace khi chạy local (NODE_ENV=development).
    // Môi trường khác (production, hoặc quên đặt NODE_ENV) không trả stack để tránh lộ đường dẫn/code server.
    stack: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
};

export { notFound, errorHandler };
