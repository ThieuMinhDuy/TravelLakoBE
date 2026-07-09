import express from 'express';
import { getReviews, deleteReview } from '../../controllers/admin/reviewController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);

/**
 * @swagger
 * /admin/reviews:
 *   get:
 *     summary: Lấy toàn bộ danh sách đánh giá của hệ thống (Admin)
 *     tags: [Admin - Review]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đánh giá kèm thông tin người dùng và địa điểm tương ứng
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   user:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                   rating:
 *                     type: number
 *                   comment:
 *                     type: string
 *                   itemId:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                   itemType:
 *                     type: string
 *                     enum: [Attraction, Hotel, Restaurant, Cafe]
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 */

/**
 * @swagger
 * /admin/reviews/{id}:
 *   delete:
 *     summary: Xóa một đánh giá không phù hợp (Admin)
 *     tags: [Admin - Review]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Review removed successfully"
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.route('/').get(getReviews);
router.route('/:id').delete(deleteReview);

export default router;
