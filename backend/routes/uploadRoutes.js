import express from 'express';
import asyncHandler from 'express-async-handler';
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
 *                   example: "Image uploaded to Cloudinary successfully"
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
      res.status(400);
      throw new Error('Please upload an image file');
    }

    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary and return secure URL (file tạm local luôn được xóa)
      let imageUrl;
      try {
        imageUrl = await uploadToCloudinary(req.file.path);
      } catch (error) {
        res.status(500);
        throw error;
      }
      res.status(200).json({
        message: 'Image uploaded to Cloudinary successfully',
        url: imageUrl,
      });
    } else if (process.env.NODE_ENV !== 'development') {
      // Ngoài môi trường local không lưu ảnh vào ổ đĩa server: trên Render ổ đĩa bị xóa
      // sau mỗi lần deploy nên ảnh sẽ mất. Báo lỗi rõ ràng để sửa cấu hình.
      removeLocalFile(req.file.path);
      console.error('[Upload] Thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
      res.status(500);
      throw new Error('Máy chủ chưa cấu hình lưu trữ ảnh. Vui lòng báo quản trị viên!');
    } else {
      // Chỉ khi chạy local (NODE_ENV=development): lưu ảnh vào thư mục uploads/ của server
      // Normalize backslashes to forward slashes for Windows compatibility in URLs
      const relativePath = `/${req.file.path.replace(/\\/g, '/')}`;
      res.status(200).json({
        message: 'Image uploaded locally successfully (Cloudinary config missing)',
        url: relativePath,
      });
    }
  })
);

export default router;
