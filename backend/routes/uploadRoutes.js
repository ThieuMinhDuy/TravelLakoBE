import express from 'express';
import asyncHandler from 'express-async-handler';
import { httpError, ERROR_CODES } from '../utils/httpError.js';
import {
  uploadSingleImage,
  uploadToCloudinary,
  isCloudinaryConfigured,
  removeLocalFile,
} from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Tải ảnh lên Cloudinary (chỉ khi chạy local mới lưu vào thư mục uploads/)
 *     tags: [Upload]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh cần tải lên
 *     responses:
 *       200:
 *         description: Tải ảnh lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tải ảnh lên thành công"
 *                 url:
 *                   type: string
 *                   example: "https://res.cloudinary.com/...image.jpg"
 *       400:
 *         description: Chưa chọn file, sai định dạng (chỉ jpg/jpeg/png/webp) hoặc vượt quá 5MB
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi khi tải ảnh, máy chủ chưa cấu hình Cloudinary (ngoài môi trường development) hoặc cấu hình Cloudinary sai
 */

const router = express.Router();

router.post(
  '/',
  protect,
  uploadSingleImage('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw httpError(res, 400, 'Vui lòng chọn ảnh để tải lên', ERROR_CODES.MISSING_FIELDS);
    }

    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary and return secure URL (file tạm local luôn được xóa)
      // Lỗi đã là HttpError 500 UPLOAD_FAILED với câu dễ hiểu (xem uploadToCloudinary)
      const imageUrl = await uploadToCloudinary(req.file.path);
      res.status(200).json({
        message: 'Tải ảnh lên thành công',
        url: imageUrl,
      });
    } else if (process.env.NODE_ENV !== 'development') {
      // Ngoài môi trường local không lưu ảnh vào ổ đĩa server: trên Render ổ đĩa bị xóa
      // sau mỗi lần deploy nên ảnh sẽ mất. Báo lỗi rõ ràng để sửa cấu hình.
      removeLocalFile(req.file.path);
      console.error('[Upload] Thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
      throw httpError(res, 500, 'Máy chủ chưa cấu hình lưu trữ ảnh. Vui lòng báo quản trị viên!', ERROR_CODES.UPLOAD_FAILED);
    } else {
      // Chỉ khi chạy local (NODE_ENV=development): lưu ảnh vào thư mục uploads/ của server
      // Normalize backslashes to forward slashes for Windows compatibility in URLs
      const relativePath = `/${req.file.path.replace(/\\/g, '/')}`;
      res.status(200).json({
        message: 'Tải ảnh lên thành công (lưu trên máy chủ do chưa cấu hình Cloudinary)',
        url: relativePath,
      });
    }
  })
);

export default router;
