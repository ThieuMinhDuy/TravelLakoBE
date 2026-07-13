import express from 'express';
import {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
} from '../../controllers/admin/placeController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Tất cả các tuyến đường này yêu cầu đăng nhập & là Admin
router.use(protect, admin);

/**
 * @swagger
 * components:
 *   schemas:
 *     Coordinates:
 *       type: object
 *       properties:
 *         lat:
 *           type: number
 *         lng:
 *           type: number
 *       example:
 *         lat: 21.0285
 *         lng: 105.8542
 * 
 *     AttractionInput:
 *       type: object
 *       required:
 *         - name
 *         - city
 *         - description
 *         - admissionFee
 *         - address
 *       properties:
 *         name:
 *           type: string
 *         city:
 *           type: string
 *           description: ID của City
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         admissionFee:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           $ref: '#/components/schemas/Coordinates'
 *       example:
 *         name: "Lăng Bác"
 *         city: "60d0fe4f5311236168a109ca"
 *         description: "Lăng Chủ tịch Hồ Chí Minh."
 *         images: ["https://images.unsplash.com/photo-1599707367072-cd6ada2bc375"]
 *         admissionFee: 0
 *         address: "Hùng Vương, Điện Biên, Ba Đình, Hà Nội"
 *         coordinates:
 *           lat: 21.0368
 *           lng: 105.8346
 * 
 *     HotelInput:
 *       type: object
 *       required:
 *         - name
 *         - city
 *         - description
 *         - stars
 *         - pricePerNight
 *         - address
 *       properties:
 *         name:
 *           type: string
 *         city:
 *           type: string
 *           description: ID của City
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         stars:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         pricePerNight:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           $ref: '#/components/schemas/Coordinates'
 *       example:
 *         name: "Melia Hanoi"
 *         city: "60d0fe4f5311236168a109ca"
 *         description: "Khách sạn 5 sao."
 *         images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945"]
 *         stars: 5
 *         pricePerNight: 2500000
 *         address: "44 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội"
 *         coordinates:
 *           lat: 21.0253
 *           lng: 105.8491
 * 
 *     RestaurantInput:
 *       type: object
 *       required:
 *         - name
 *         - city
 *         - description
 *         - cuisineType
 *         - price
 *         - address
 *       properties:
 *         name:
 *           type: string
 *         city:
 *           type: string
 *           description: ID của City
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         cuisineType:
 *           type: string
 *         price:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           $ref: '#/components/schemas/Coordinates'
 *       example:
 *         name: "Phở Thìn Bờ Hồ"
 *         city: "60d0fe4f5311236168a109ca"
 *         description: "Phở gia truyền lâu đời."
 *         images: ["https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43"]
 *         cuisineType: "Ẩm thực Việt Nam"
 *         price: 50000
 *         address: "61 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội"
 *         coordinates:
 *           lat: 21.0298
 *           lng: 105.8524
 * 
 *     CafeInput:
 *       type: object
 *       required:
 *         - name
 *         - city
 *         - description
 *         - price
 *         - address
 *       properties:
 *         name:
 *           type: string
 *         city:
 *           type: string
 *           description: ID của City
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         price:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           $ref: '#/components/schemas/Coordinates'
 *       example:
 *         name: "Cộng Cà Phê"
 *         city: "60d0fe4f5311236168a109ca"
 *         description: "Không gian thời bao cấp."
 *         images: ["https://images.unsplash.com/photo-1554118811-1e0d58224f24"]
 *         price: 45000
 *         address: "27 Nhà Thờ, Hoàn Kiếm, Hà Nội"
 *         coordinates:
 *           lat: 21.0287
 *           lng: 105.8489
 */

/**
 * @swagger
 * /admin/places/{type}:
 *   get:
 *     summary: Lấy danh sách địa điểm theo loại (Admin)
 *     tags: [Admin - Places]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *         description: Loại địa điểm cần lấy danh sách
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: (Tùy chọn) Lọc theo ID thành phố
 *     responses:
 *       200:
 *         description: Danh sách địa điểm tương ứng
 *       400:
 *         description: Loại địa điểm không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 * 
 *   post:
 *     summary: Tạo một địa điểm mới theo loại (Admin)
 *     tags: [Admin - Places]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *         description: Loại địa điểm cần tạo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/AttractionInput'
 *               - $ref: '#/components/schemas/HotelInput'
 *               - $ref: '#/components/schemas/RestaurantInput'
 *               - $ref: '#/components/schemas/CafeInput'
 *     responses:
 *       201:
 *         description: Tạo thành công
 *       400:
 *         description: Dữ liệu gửi lên lỗi hoặc không tìm thấy City
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 */

/**
 * @swagger
 * /admin/places/{type}/{id}:
 *   get:
 *     summary: Lấy chi tiết địa điểm theo ID và Loại (Admin)
 *     tags: [Admin - Places]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết địa điểm
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy địa điểm
 * 
 *   put:
 *     summary: Cập nhật thông tin địa điểm (Admin)
 *     tags: [Admin - Places]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/AttractionInput'
 *               - $ref: '#/components/schemas/HotelInput'
 *               - $ref: '#/components/schemas/RestaurantInput'
 *               - $ref: '#/components/schemas/CafeInput'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy địa điểm hoặc thành phố
 * 
 *   delete:
 *     summary: Xóa địa điểm (Admin)
 *     tags: [Admin - Places]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *                   example: "Place removed successfully"
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy địa điểm
 */
router.route('/:type').get(getPlaces).post(createPlace);
router.route('/:type/:id').get(getPlaceById).put(updatePlace).delete(deletePlace);

export default router;
