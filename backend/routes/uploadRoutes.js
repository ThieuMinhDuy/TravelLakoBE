import express from 'express';
import asyncHandler from 'express-async-handler';
import { uploadSingleImage, uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Tải ảnh lên (cục bộ hoặc Cloudinary)
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
 *         description: Lỗi hệ thống khi tải ảnh
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

    // Check if Cloudinary credentials are set in environment
    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
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
    } else {
      // Fallback: serve image locally
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
