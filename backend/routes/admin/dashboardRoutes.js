import express from 'express';
import { getDashboardStats } from '../../controllers/admin/dashboardController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Lấy dữ liệu thống kê tổng hợp cho trang chủ Admin Dashboard
 *     tags: [Admin - Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Thông tin thống kê người dùng, chuyến đi, địa điểm và đánh giá
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: number
 *                   example: 25
 *                 trips:
 *                   type: number
 *                   example: 10
 *                 places:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 45
 *                     attractions:
 *                       type: number
 *                       example: 15
 *                     hotels:
 *                       type: number
 *                       example: 10
 *                     restaurants:
 *                       type: number
 *                       example: 12
 *                     cafes:
 *                       type: number
 *                       example: 8
 *                 reviews:
 *                   type: number
 *                   example: 120
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 */
router.route('/stats').get(getDashboardStats);

export default router;
