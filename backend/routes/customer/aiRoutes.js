import express from 'express';
import {
  generateAISuggestion,
  optimizeExistingTrip
} from '../../controllers/customer/aiController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI Assistant
 *   description: Trợ lý ảo AI thiết lập và tối ưu lịch trình du lịch sử dụng Gemini API
 */

/**
 * @swagger
 * /api/ai/suggest:
 *   post:
 *     summary: "Gợi ý lịch trình du lịch thông minh bằng AI"
 *     description: "Nhận yêu cầu của người dùng, lấy địa điểm thực tế từ cơ sở dữ liệu và gọi Gemini 2.5 Flash để sinh lịch trình gợi ý dạng JSON chuẩn. Có thể truyền trực tiếp cityId hoặc tin nhắn tự do để tự phát hiện thành phố."
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cityId:
 *                 type: string
 *                 description: "ID của thành phố đích trong Database (không bắt buộc nếu gõ tin nhắn tự do)"
 *                 example: "6a4fb11ab3962de0d90efa6e"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: "Ngày bắt đầu chuyến đi (mặc định hôm nay)"
 *                 example: "2026-08-05T00:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: "Ngày kết thúc chuyến đi (mặc định hôm nay + 2 ngày)"
 *                 example: "2026-08-08T00:00:00.000Z"
 *               budget:
 *                 type: string
 *                 description: "Phân khúc ngân sách mong muốn"
 *                 enum: [Tiết kiệm, Trung bình, Sang trọng]
 *                 example: "Trung bình"
 *               preferences:
 *                 type: string
 *                 description: "Sở thích hoặc phong cách du lịch"
 *                 example: "Biển, ngắm cảnh hoàng hôn, ăn hải sản"
 *               notes:
 *                 type: string
 *                 description: "Lời nhắn/yêu cầu thêm từ người dùng (hoặc lời nhắn chứa tên thành phố tự phát hiện)"
 *                 example: "Tôi muốn đi du lịch Phú Quốc vào tuần tới"
 *     responses:
 *       200:
 *         description: "Gợi ý lịch trình thành công dưới dạng JSON chuẩn khớp với Trip schema"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 city:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     image:
 *                       type: string
 *                 suggestedTitle:
 *                   type: string
 *                   example: "Hành trình nghỉ dưỡng 3 ngày tại Phú Quốc"
 *                 estimatedTotalCost:
 *                   type: number
 *                   example: 4500000
 *                 schedule:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: integer
 *                         example: 1
 *                       places:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             placeType:
 *                               type: string
 *                               enum: [Hotel, Attraction, Restaurant, Cafe]
 *                             placeId:
 *                               type: string
 *                               example: "6a4fb11ab3962de0d90efa8a"
 *                             order:
 *                               type: integer
 *                               example: 0
 *                             note:
 *                               type: string
 *                               example: "Nhận phòng khách sạn và nghỉ ngơi"
 *       400:
 *         description: "Lỗi không tìm thấy thành phố hoặc tham số thiếu"
 *       429:
 *         description: "AI vượt quá hạn mức yêu cầu (Quota Limit)"
 *       500:
 *         description: "Lỗi server hoặc lỗi kết nối Gemini API"
 */
router.post('/suggest', protect, generateAISuggestion);

/**
 * @swagger
 * /api/ai/optimize/{tripId}:
 *   post:
 *     summary: "Tối ưu hóa thứ tự di chuyển lịch trình hiện có"
 *     description: "Nhận ID chuyến đi hiện tại, gửi tọa độ địa lý của các địa điểm lên Gemini để AI tính toán và sắp xếp lại thứ tự di chuyển tối ưu nhất."
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID của chuyến đi cần tối ưu"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: "Yêu cầu tối ưu hóa đặc biệt từ người dùng"
 *                 example: "Hãy sắp xếp các quán cafe vào buổi sáng nhé"
 *     responses:
 *       200:
 *         description: "Tối ưu lịch trình thành công"
 *       501:
 *         description: "Tính năng chưa được triển khai (Sẽ hoàn thiện ở Sprint 3)"
 */
router.post('/optimize/:tripId', protect, optimizeExistingTrip);

export default router;
