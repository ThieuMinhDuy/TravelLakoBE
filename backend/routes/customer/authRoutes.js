import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
} from '../../controllers/customer/authController.js';
import { protect } from '../../middleware/authMiddleware.js';
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID tự động của User
 *         name:
 *           type: string
 *           description: Tên người dùng
 *         email:
 *           type: string
 *           description: Địa chỉ email của người dùng
 *         isAdmin:
 *           type: boolean
 *           description: Quyền Admin (true/false)
 *       example:
 *         _id: "60d0fe4f5311236168a109ca"
 *         name: "John Doe"
 *         email: "john@example.com"
 *         isAdmin: false
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký người dùng mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công và trả về thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc User đã tồn tại
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập người dùng
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Sai email hoặc mật khẩu
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất người dùng (xóa cookie token)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Lấy thông tin cá nhân của người dùng hiện tại
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin cá nhân của user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực (Không có token)
 *   put:
 *     summary: Cập nhật thông tin cá nhân người dùng hiện tại
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công, trả về thông tin user mới
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy User
 */

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/logout', logoutUser);
router
  .route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

export default router;
