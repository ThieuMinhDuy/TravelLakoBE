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
 *     description: |
 *       Tên, địa chỉ, tọa độ lấy từ OpenStreetMap. Mô tả tiếng Việt và giá tham khảo (khách sạn thêm số sao,
 *       nhà hàng thêm loại ẩm thực) do Gemini viết; nếu Gemini chưa cấu hình, lỗi hoặc quá thời gian thì dùng
 *       mô tả mẫu + giá ngẫu nhiên (xem `enrichment` trong response). Ảnh luôn là ảnh mẫu.
 *       rating / numReviews của địa điểm mới luôn là 0. Có thể mất 30-60 giây.
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
 *                 description: Số địa điểm tối đa cho MỖI loại, từ 1 đến 50 (mặc định 30; lớn hơn 50 tính là 50)
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
 *                 enrichment:
 *                   type: object
 *                   properties:
 *                     aiGenerated:
 *                       type: number
 *                       description: Số địa điểm có mô tả / giá do Gemini viết
 *                     templateGenerated:
 *                       type: number
 *                       description: Số địa điểm dùng mô tả mẫu + giá ngẫu nhiên
 *                     geminiEnabled:
 *                       type: boolean
 *                       description: false khi server chưa cấu hình GEMINI_API_KEY
 *                     failedTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [Hotel, Attraction, Restaurant, Cafe]
 *                       description: Loại địa điểm mà Gemini lỗi (hết hạn mức, quá thời gian...)
 *             example:
 *               message: "Successfully imported places for Đà Lạt from OpenStreetMap"
 *               stats: { hotelsImported: 2, attractionsImported: 1, restaurantsImported: 1, cafesImported: 1, totalImported: 5 }
 *               enrichment: { aiGenerated: 4, templateGenerated: 1, geminiEnabled: true, failedTypes: ["Attraction"] }
 *       400:
 *         description: Yêu cầu không hợp lệ hoặc thiếu tham số
 *       404:
 *         description: Không tìm thấy thành phố
 *       503:
 *         description: Máy chủ OpenStreetMap quá tải hoặc gặp sự cố
 */
router.post('/osm', importFromOSM);

export default router;
