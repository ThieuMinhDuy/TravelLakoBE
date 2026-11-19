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

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a local file to Cloudinary and clean up the local file afterwards.
 * @param {string} localFilePath - Path to the local file
 * @returns {Promise<string>} Secure URL from Cloudinary
 */
const uploadToCloudinary = async (localFilePath) => {
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: 'travel_planner',
    });
    return result.secure_url;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  } finally {
    // Luôn xóa file tạm local (dù thành công hay thất bại) để tránh đầy thư mục uploads/
    removeLocalFile(localFilePath);
  }
};

export { upload, uploadSingleImage, uploadToCloudinary };
