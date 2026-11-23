import path from 'path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure local storage (acts as fallback and temporary storage before Cloudinary)
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

// Check file types (images only)
function checkFileTypes(file, cb) {
  const filetypes = /jpe?g|png|webp/;
  const mimetypes = /image\/jpeg|image\/png|image\/webp/;

  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only (jpg, jpeg, png, webp)'));
  }
}

// Giới hạn dung lượng ảnh tải lên: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Multer upload middleware
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: function (req, file, cb) {
    checkFileTypes(file, cb);
  },
});

/**
 * Bọc upload.single(field) để lỗi của multer (sai định dạng, quá dung lượng)
 * trả về 400 thay vì rơi xuống errorHandler với mã 500.
 */
const uploadSingleImage = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();

    res.status(400);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new Error('Ảnh vượt quá dung lượng cho phép (tối đa 5MB)'));
    }
    return next(err);
  });
};

/** Xóa file tạm local nếu còn tồn tại (bỏ qua lỗi) */
const removeLocalFile = (localFilePath) => {
  try {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (error) {
    console.warn(`[Upload] Không thể xóa file tạm ${localFilePath}: ${error.message}`);
  }
};

/** Làm sạch giá trị biến môi trường: bỏ khoảng trắng/xuống dòng và dấu nháy bao ngoài (lỗi hay gặp khi dán vào Render) */
const cleanEnv = (value) => (value || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();

/**
 * Đọc cấu hình Cloudinary TẠI THỜI ĐIỂM GỌI, không đọc lúc import module:
 * với ES module, mọi import chạy trước dotenv.config() trong server.js nên lúc import
 * các biến trong .env chưa có. Trả về null nếu thiếu bất kỳ biến nào.
 */
const getCloudinaryCredentials = () => {
  const cloud_name = cleanEnv(process.env.CLOUDINARY_CLOUD_NAME);
  const api_key = cleanEnv(process.env.CLOUDINARY_API_KEY);
  const api_secret = cleanEnv(process.env.CLOUDINARY_API_SECRET);
  return cloud_name && api_key && api_secret ? { cloud_name, api_key, api_secret } : null;
};

const isCloudinaryConfigured = () => getCloudinaryCredentials() !== null;

/**
 * Upload a local file to Cloudinary and clean up the local file afterwards.
 * @param {string} localFilePath - Path to the local file
 * @returns {Promise<string>} Secure URL from Cloudinary
 */
const uploadToCloudinary = async (localFilePath) => {
  try {
    cloudinary.config(getCloudinaryCredentials());
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: 'travel_planner',
    });
    return result.secure_url;
  } catch (error) {
    // Ghi chi tiết ở log server, chỉ trả câu dễ hiểu cho client
    console.error('[Upload] Cloudinary error:', error?.http_code, error?.message);
    const message = String(error?.message || '');
    if (error?.http_code === 401 || /invalid signature|api[ _]key|cloud[ _]name/i.test(message)) {
      throw new Error('Máy chủ cấu hình lưu trữ ảnh (Cloudinary) chưa đúng. Vui lòng báo quản trị viên!');
    }
    throw new Error('Tải ảnh lên thất bại, vui lòng thử lại!');
  } finally {
    // Luôn xóa file tạm local (dù thành công hay thất bại) để tránh đầy thư mục uploads/
    removeLocalFile(localFilePath);
  }
};

export { upload, uploadSingleImage, uploadToCloudinary, isCloudinaryConfigured, removeLocalFile };
