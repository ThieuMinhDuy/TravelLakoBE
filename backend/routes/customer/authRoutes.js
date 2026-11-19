import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  googleLogin,
} from '../../controllers/customer/authController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { loginLimiter, otpEmailLimiter, otpVerifyLimiter } from '../../middleware/rateLimitMiddleware.js';
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
 *         avatar:
 *           type: string
 *           description: URL ảnh đại diện
 *         phone:
 *           type: string
 *           description: Số điện thoại
 *         gender:
 *           type: string
 *           description: Giới tính
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: Ngày sinh
 *         travelPreferences:
 *           type: array
 *           items:
 *             type: string
 *           description: Sở thích du lịch
 *         favoriteBudget:
 *           type: string
 *           description: Ngân sách ưa thích
 *         isAdmin:
 *           type: boolean
 *           description: Quyền Admin (true/false)
 *       example:
 *         _id: "60d0fe4f5311236168a109ca"
 *         name: "John Doe"
 *         email: "john@example.com"
 *         avatar: ""
 *         phone: "0987654321"
 *         gender: "Nam"
 *         dateOfBirth: "2004-01-01"
 *         travelPreferences: ["Biển", "Cafe", "Ẩm thực"]
 *         favoriteBudget: "Trung bình"
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
 *               avatar:
 *                 type: string
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ, Khác, '']
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               travelPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *               favoriteBudget:
 *                 type: string
 *                 enum: [Tiết kiệm, Trung bình, Cao cấp, '']
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

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Xác thực mã OTP đăng ký tài khoản
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Xác thực thành công, đăng nhập luôn và trả về thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Mã OTP sai hoặc đã hết hạn
 */

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Gửi lại mã OTP xác thực
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi lại mã thành công
 */

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Yêu cầu gửi OTP để quên mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi mã OTP thành công đến email
 */

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng mã OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Đăng nhập hoặc đăng ký bằng Google ID Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Chuỗi Google ID Token (credential) nhận từ Google SDK phía Frontend
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về thông tin user và cấp JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Thiếu token hoặc token không lấy được email
 *       401:
 *         description: Google ID Token không hợp lệ hoặc đã hết hạn
 *       403:
 *         description: Tài khoản đã bị khóa
 */

const router = express.Router();

router.post('/register', otpEmailLimiter, registerUser);
router.post('/login', loginLimiter, authUser);
router.post('/google', loginLimiter, googleLogin);
router.post('/logout', logoutUser);
router.post('/verify-otp', otpVerifyLimiter, verifyOTP);
router.post('/resend-otp', otpEmailLimiter, resendOTP);
router.post('/forgot-password', otpEmailLimiter, forgotPassword);
router.post('/reset-password', otpVerifyLimiter, resetPassword);
router
  .route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

export default router;
