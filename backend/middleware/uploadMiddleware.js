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

// Multer upload middleware
const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileTypes(file, cb);
  },
});

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
    // Remove local file after uploading to Cloudinary
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return result.secure_url;
  } catch (error) {
    // If Cloudinary fails, we don't delete local file so it can still be served locally as fallback if needed,
    // but here we throw error to let user know
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export { upload, uploadToCloudinary };
