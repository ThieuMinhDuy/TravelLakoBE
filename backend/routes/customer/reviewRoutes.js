import express from 'express';
import { getPlaceReviews, createReview, deleteMyReview } from '../../controllers/customer/reviewController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: string
 *           description: ID của User viết review
 *         itemType:
 *           type: string
 *           enum: [Attraction, Hotel, Restaurant, Cafe]
 *         itemId:
 *           type: string
 *           description: ID của địa điểm
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         comment:
 *           type: string
 *       example:
 *         _id: "60d0fe4f5311236168a109cb"
 *         user: "60d0fe4f5311236168a109ca"
 *         itemType: "Hotel"
 *         itemId: "60d0fe4f5311236168a109c9"
 *         rating: 5
 *         comment: "Khách sạn rất đẹp, phục vụ chu đáo!"
 */

/**
 * @swagger
 * /reviews/{itemType}/{itemId}:
 *   get:
 *     summary: Lấy danh sách đánh giá của một địa điểm cụ thể
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: itemType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Attraction, Hotel, Restaurant, Cafe]
 *         description: Loại địa điểm
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của địa điểm
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 reviews:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 */
router.get('/:itemType/:itemId', getPlaceReviews);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Viết đánh giá mới cho địa điểm (Yêu cầu Đăng nhập)
 *     tags: [Reviews]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemType
 *               - itemId
 *               - rating
 *               - comment
 *             properties:
 *               itemType:
 *                 type: string
 *                 enum: [Attraction, Hotel, Restaurant, Cafe]
 *               itemId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Viết đánh giá thành công
 *       400:
 *         description: Thiếu thông tin hoặc đã đánh giá trước đó
 *       401:
 *         description: Chưa đăng nhập
 */
router.post('/', protect, createReview);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Xóa đánh giá của chính mình (Yêu cầu Đăng nhập)
 *     tags: [Reviews]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của đánh giá cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Không có quyền xóa
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.delete('/:id', protect, deleteMyReview);

export default router;
