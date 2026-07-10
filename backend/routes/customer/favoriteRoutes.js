import express from 'express';
import { getMyFavorites, addFavorite, removeFavorite } from '../../controllers/customer/favoriteController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Favorite:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: string
 *           description: ID của User sở hữu
 *         itemType:
 *           type: string
 *           enum: [Attraction, Hotel, Restaurant, Cafe]
 *         itemId:
 *           type: object
 *           description: Thông tin địa điểm được populate chi tiết
 *       example:
 *         _id: "60d0fe4f5311236168a109cd"
 *         user: "60d0fe4f5311236168a109ca"
 *         itemType: "Hotel"
 *         itemId: {
 *           _id: "60d0fe4f5311236168a109c9",
 *           name: "Khách sạn Mường Thanh",
 *           address: "Đà Nẵng",
 *           city: {
 *             _id: "60d0fe4f5311236168a109ca",
 *             name: "Đà Nẵng"
 *           }
 *         }
 */

/**
 * @swagger
 * /favorites:
 *   get:
 *     summary: Lấy danh sách địa điểm yêu thích của tôi (Yêu cầu Đăng nhập)
 *     tags: [Favorites]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 favorites:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Favorite'
 *       401:
 *         description: Chưa đăng nhập
 *   post:
 *     summary: Thêm địa điểm vào danh sách yêu thích (Yêu cầu Đăng nhập)
 *     tags: [Favorites]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemType
 *               - itemId
 *             properties:
 *               itemType:
 *                 type: string
 *                 enum: [Attraction, Hotel, Restaurant, Cafe]
 *               itemId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Thiếu thông tin hoặc đã lưu trước đó
 *       401:
 *         description: Chưa đăng nhập
 */
router.route('/')
  .get(protect, getMyFavorites)
  .post(protect, addFavorite);

/**
 * @swagger
 * /favorites/{id}:
 *   delete:
 *     summary: Hủy lưu địa điểm yêu thích (Yêu cầu Đăng nhập)
 *     tags: [Favorites]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bản ghi yêu thích cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập hoặc không có quyền
 *       404:
 *         description: Không tìm thấy bản ghi yêu thích
 */
router.delete('/:id', protect, removeFavorite);

export default router;
