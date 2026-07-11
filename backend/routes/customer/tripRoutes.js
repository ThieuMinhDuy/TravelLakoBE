import express from 'express';
import { createTrip, getMyTrips, getTripById, deleteTrip } from '../../controllers/customer/tripController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Trip:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: string
 *           description: ID của User sở hữu chuyến đi
 *         title:
 *           type: string
 *           description: Tên chuyến đi
 *         city:
 *           type: string
 *           description: ID thành phố điểm đến
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         budget:
 *           type: number
 *         schedule:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               day:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date-time
 *               places:
 *                 type: array
 *                 items:
 *                   type: object
 *         diary:
 *           type: object
 *           properties:
 *             notes:
 *               type: string
 *             photos:
 *               type: array
 *               items:
 *                 type: string
 */

/**
 * @swagger
 * /trips:
 *   post:
 *     summary: Tạo chuyến đi mới (Tự động sinh schedule ngày)
 *     tags: [Trips]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - city
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               city:
 *                 type: string
 *                 description: ID của City
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-07-20"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-07-22"
 *               budget:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tạo chuyến đi thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *   get:
 *     summary: Lấy danh sách chuyến đi của tôi (Phân nhóm: Sắp tới, Đang đi, Lịch sử)
 *     tags: [Trips]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 upcoming:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trip'
 *                 ongoing:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trip'
 *                 past:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trip'
 */
router.route('/')
  .post(protect, createTrip)
  .get(protect, getMyTrips);

/**
 * @swagger
 * /trips/{id}:
 *   get:
 *     summary: Xem chi tiết lịch trình chuyến đi (Populate địa điểm)
 *     tags: [Trips]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 *       404:
 *         description: Không tìm thấy chuyến đi
 *   delete:
 *     summary: Xóa chuyến đi
 *     tags: [Trips]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 *       404:
 *         description: Không tìm thấy chuyến đi
 */
router.route('/:id')
  .get(protect, getTripById)
  .delete(protect, deleteTrip);

export default router;
