import express from 'express';
import {
  createTrip,
  getMyTrips,
  getTripById,
  deleteTrip,
  addPlaceToSchedule,
  removePlaceFromSchedule,
  reorderSchedulePlaces,
  checkInPlace,
  updateTripDiary,
  updateTripMetadata
} from '../../controllers/customer/tripController.js';
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
 *     summary: "Lấy danh sách chuyến đi của tôi (Phân nhóm: Sắp tới, Đang đi, Lịch sử)"
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
  .put(protect, updateTripMetadata)
  .delete(protect, deleteTrip);

/**
 * @swagger
 * /trips/{id}/schedule/places:
 *   post:
 *     summary: Thêm địa điểm vào lịch trình ngày của chuyến đi (Yêu cầu Đăng nhập)
 *     tags: [Trips - Itinerary]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chuyến đi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - day
 *               - placeType
 *               - placeId
 *             properties:
 *               day:
 *                 type: integer
 *                 description: Số thứ tự ngày (Ví dụ 1, 2, 3...)
 *               placeType:
 *                 type: string
 *                 enum: [Attraction, Hotel, Restaurant, Cafe]
 *               placeId:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Thông tin không hợp lệ hoặc ngày không tồn tại
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 */
router.post('/:id/schedule/places', protect, addPlaceToSchedule);

/**
 * @swagger
 * /trips/{id}/schedule/reorder:
 *   put:
 *     summary: Sắp xếp lại thứ tự điểm đi trong ngày (Yêu cầu Đăng nhập)
 *     tags: [Trips - Itinerary]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chuyến đi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - day
 *               - placesOrder
 *             properties:
 *               day:
 *                 type: integer
 *               placesOrder:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Mảng chứa các ID phụ (places._id) theo thứ tự mới
 *     responses:
 *       200:
 *         description: Sắp xếp thành công
 *       400:
 *         description: Lỗi đầu vào
 */
router.put('/:id/schedule/reorder', protect, reorderSchedulePlaces);

/**
 * @swagger
 * /trips/{id}/schedule/places/{subId}:
 *   delete:
 *     summary: Xóa địa điểm khỏi lịch trình ngày (Yêu cầu Đăng nhập)
 *     tags: [Trips - Itinerary]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chuyến đi
 *       - in: path
 *         name: subId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phụ của địa điểm trong schedule (places._id)
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/:id/schedule/places/:subId', protect, removePlaceFromSchedule);

/**
 * @swagger
 * /trips/{id}/schedule/places/{subId}/check-in:
 *   patch:
 *     summary: Đánh dấu đã tham quan / Check-in địa điểm (Dành riêng cho Mobile App)
 *     description: Endpoint này phục vụ chính cho tính năng Check-in thực tế trên Mobile App dựa trên GPS hoặc hành động của người dùng tại địa điểm.
 *     tags: [Trips - Itinerary]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chuyến đi
 *       - in: path
 *         name: subId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phụ của địa điểm (places._id) trong lịch trình
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visited
 *             properties:
 *               visited:
 *                 type: boolean
 *                 description: "Trạng thái check-in (true: đã đi, false: chưa đi)"
 *     responses:
 *       200:
 *         description: Cập nhật check-in thành công, trả về chi tiết chuyến đi
 *       400:
 *         description: Thiếu trường dữ liệu visited
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 */
router.patch('/:id/schedule/places/:subId/check-in', protect, checkInPlace);

/**
 * @swagger
 * /trips/{id}/diary:
 *   put:
 *     summary: Cập nhật Nhật ký chuyến đi & Hình ảnh tải lên (Dùng cho cả Web và Mobile)
 *     description: Người dùng viết chia sẻ trải nghiệm (diary notes) và đính kèm danh sách ảnh (url) sau chuyến đi.
 *     tags: [Trips - Itinerary]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chuyến đi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Ghi chú nhật ký trải nghiệm
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Mảng chứa các link ảnh du lịch (tải lên thông qua CDN / Cloudinary)
 *     responses:
 *       200:
 *         description: Cập nhật nhật ký thành công
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 */
router.put('/:id/diary', protect, updateTripDiary);

export default router;
