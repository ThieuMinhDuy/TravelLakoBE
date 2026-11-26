import express from 'express';
import {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
} from '../../controllers/admin/cityController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Tất cả các route này yêu cầu quyền đăng nhập & là Admin
router.use(protect, admin);

/**
 * @swagger
 * components:
 *   schemas:
 *     CityInput:
 *       type: object
 *       required:
 *         - name
 *         - coordinates
 *       properties:
 *         name:
 *           type: string
 *           description: Tên thành phố (không được trùng, so khớp không phân biệt hoa/thường và dấu)
 *         description:
 *           type: string
 *           description: Mô tả về thành phố
 *         image:
 *           type: string
 *           description: URL ảnh thành phố
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *       example:
 *         name: "Hà Nội"
 *         description: "Thủ đô ngàn năm văn hiến."
 *         image: "https://images.unsplash.com/photo-1509062522246-3755977927d7"
 *         coordinates:
 *           lat: 21.0285
 *           lng: 105.8542
 * 
 *     City:
 *       allOf:
 *         - type: object
 *           properties:
 *             _id:
 *               type: string
 *               description: ID tự sinh từ MongoDB
 *         - $ref: '#/components/schemas/CityInput'
 */

/**
 * @swagger
 * /admin/cities:
 *   get:
 *     summary: Lấy danh sách toàn bộ thành phố (Admin)
 *     tags: [Admin - City]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Danh sách thành phố
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 * 
 *   post:
 *     summary: Tạo một thành phố mới (Admin)
 *     tags: [Admin - City]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CityInput'
 *     responses:
 *       201:
 *         description: Tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       400:
 *         description: Tên trống, thành phố đã tồn tại (`CITY_EXISTS`, kể cả khi chỉ khác dấu như "Da Lat" / "Đà Lạt") hoặc dữ liệu thiếu
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 */

/**
 * @swagger
 * /admin/cities/{id}:
 *   get:
 *     summary: Lấy chi tiết thành phố theo ID (Admin)
 *     tags: [Admin - City]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thành phố
 *     responses:
 *       200:
 *         description: Chi tiết thành phố
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy thành phố
 * 
 *   put:
 *     summary: Cập nhật thông tin thành phố (Admin)
 *     description: |
 *       Chỉ cập nhật các field có gửi lên. Gửi `description: ""` hoặc `image: ""` để xóa mô tả / ảnh.
 *       `coordinates` có thể gửi một phần (chỉ `lat` hoặc chỉ `lng`).
 *     tags: [Admin - City]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thành phố
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CityInput'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       400:
 *         description: Tên gửi lên rỗng hoặc trùng với thành phố khác (`CITY_EXISTS`)
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy thành phố
 *
 *   delete:
 *     summary: Xóa thành phố (Admin)
 *     description: |
 *       - Còn chuyến đi của người dùng ở thành phố này: luôn chặn (400, `code: CITY_HAS_TRIPS`), kể cả khi `cascade=true`.
 *       - Còn địa điểm mà không có `cascade=true`: 400, `code: CITY_HAS_PLACES`, `requiresCascade: true` để FE hỏi xác nhận.
 *       - `cascade=true`: xóa thành phố cùng toàn bộ địa điểm, đánh giá, mục yêu thích của các địa điểm đó
 *         và gỡ chúng khỏi lịch trình chuyến đi (nếu có).
 *     tags: [Admin - City]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thành phố
 *       - in: query
 *         name: cascade
 *         schema:
 *           type: string
 *           enum: ["true"]
 *         description: Xác nhận xóa luôn các địa điểm thuộc thành phố
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
 *                   example: "Thành phố đã được xóa thành công!"
 *       400:
 *         description: Còn chuyến đi (CITY_HAS_TRIPS) hoặc còn địa điểm mà chưa cascade (CITY_HAS_PLACES)
 *         content:
 *           application/json:
 *             examples:
 *               conTrip:
 *                 summary: Còn chuyến đi
 *                 value: { message: "Không thể xóa thành phố này vì đang có 2 chuyến đi của người dùng.", code: "CITY_HAS_TRIPS", totalTrips: 2 }
 *               conDiaDiem:
 *                 summary: Còn địa điểm, chưa cascade
 *                 value: { message: "Thành phố này đang chứa 5 địa điểm. Bạn có muốn xóa ...?", code: "CITY_HAS_PLACES", requiresCascade: true, totalPlaces: 5 }
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy thành phố
 */
router.route('/').get(getCities).post(createCity);
router.route('/:id').get(getCityById).put(updateCity).delete(deleteCity);

export default router;
