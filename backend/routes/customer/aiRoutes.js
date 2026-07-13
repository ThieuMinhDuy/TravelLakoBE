import express from 'express';
import {
  generateAISuggestion,
  chatWithAI,
  optimizeExistingTrip,
  getChatHistory,
  clearChatHistory
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
 * /api/ai/chat:
 *   post:
 *     summary: "Trò chuyện tự do với Trợ lý ảo AI"
 *     description: "Nhận tin nhắn của người dùng và lịch sử hội thoại, gửi lên Gemini API để trả về câu trả lời tự nhiên dạng văn bản."
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: "Tin nhắn gửi lên AI"
 *                 example: "Hạ Long có những điểm du lịch nào nổi tiếng?"
 *               history:
 *                 type: array
 *                 description: "Lịch sử cuộc hội thoại (tùy chọn)"
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     parts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text:
 *                             type: string
 *     responses:
 *       200:
 *         description: "Câu trả lời của AI"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       401:
 *         description: "Chưa đăng nhập"
 *       429:
 *         description: "AI vượt quá giới hạn yêu cầu (Quota Limit)"
 *   get:
 *     summary: "Tải lịch sử trò chuyện của người dùng hiện tại"
 *     description: "Lấy danh sách các tin nhắn đã trò chuyện giữa người dùng và AI được lưu trong cơ sở dữ liệu."
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Danh sách lịch sử tin nhắn"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [user, model]
 *                   parts:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         text:
 *                           type: string
 *       401:
 *         description: "Chưa đăng nhập"
 *       500:
 *         description: "Lỗi server"
 *   delete:
 *     summary: "Xóa toàn bộ lịch sử trò chuyện của người dùng hiện tại"
 *     description: "Xóa vĩnh viễn tài liệu lưu trữ cuộc trò chuyện của người dùng khỏi cơ sở dữ liệu."
 *     tags: [AI Assistant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Xóa lịch sử thành công"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã xóa lịch sử cuộc trò chuyện."
 *       401:
 *         description: "Chưa đăng nhập"
 *       500:
 *         description: "Lỗi server"
 */
router.route('/chat')
  .post(protect, chatWithAI)
  .get(protect, getChatHistory)
  .delete(protect, clearChatHistory);

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
 *         description: "Tối ưu lịch trình thành công và trả về thông tin chuyến đi đã cập nhật"
 *       404:
 *         description: "Chuyến đi không tồn tại hoặc không thuộc về người dùng"
 *       500:
 *         description: "Lỗi server hoặc lỗi kết nối Gemini API"
 */
router.post('/optimize/:tripId', protect, optimizeExistingTrip);

export default router;
