import express from 'express';
import { importFromOSM, getVietnamCities } from '../../controllers/admin/importController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Tất cả các route này yêu cầu quyền đăng nhập & là Admin
router.use(protect, admin);

/**
 * @swagger
 * /admin/import/vietnam-cities:
 *   get:
 *     summary: Lấy danh sách các thành phố Việt Nam để lựa chọn
 *     tags: [Admin - Import]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Danh sách thành phố thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["An Giang", "Đà Nẵng", "Hà Nội", "Đà Lạt"]
 */
router.get('/vietnam-cities', getVietnamCities);

/**
 * @swagger
 * /admin/import/osm:
 *   post:
 *     summary: Import dữ liệu địa điểm du lịch tự động từ OpenStreetMap (Admin)
 *     tags: [Admin - Import]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Gửi `cityId` hoặc `cityName` (một trong hai)
 *             properties:
 *               cityId:
 *                 type: string
 *                 description: ID của thành phố đã có trong hệ thống
 *               cityName:
 *                 type: string
 *                 description: |
 *                   Tên thành phố. Nếu đã có thành phố trùng tên (không phân biệt hoa/thường và dấu,
 *                   vd "Da Lat" = "Đà Lạt") thì dùng lại thành phố đó; chưa có thì tự tạo mới (tọa độ lấy từ Nominatim).
 *                 example: "Đà Lạt"
 *               limit:
 *                 type: number
 *                 description: Giới hạn số lượng địa điểm cào cho mỗi nhóm (mặc định 30)
 *                 example: 30
 *     responses:
 *       200:
 *         description: Import dữ liệu và tự động làm giàu thông tin thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     hotelsImported:
 *                       type: number
 *                     attractionsImported:
 *                       type: number
 *                     restaurantsImported:
 *                       type: number
 *                     cafesImported:
 *                       type: number
 *                     totalImported:
 *                       type: number
 *       400:
 *         description: Yêu cầu không hợp lệ hoặc thiếu tham số
 *       404:
 *         description: Không tìm thấy thành phố
 *       503:
 *         description: Máy chủ OpenStreetMap quá tải hoặc gặp sự cố
 */
router.post('/osm', importFromOSM);

export default router;
