import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  googleLogin,
} from '../../controllers/customer/authController.js';
import { protect } from '../../middleware/authMiddleware.js';
import {
  loginLimiter,
  otpEmailLimiter,
  otpVerifyLimiter,
  changePasswordLimiter,
} from '../../middleware/rateLimitMiddleware.js';
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
 *         coverImage:
 *           type: string
 *           description: URL ảnh bìa trang cá nhân ('' nếu chưa có)
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
 *         coverImage: ""
 *         phone: "0987654321"
 *         gender: "Nam"
 *         dateOfBirth: "2004-01-01"
 *         travelPreferences: ["Biển", "Cafe", "Ẩm thực"]
 *         favoriteBudget: "Trung bình"
 *         isAdmin: false
 *
 *     UserProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           properties:
 *             authType:
 *               type: string
 *               enum: [local, google]
 *               description: Cách tạo tài khoản
 *             hasPassword:
 *               type: boolean
 *               description: Tài khoản đã có mật khẩu chưa (false → FE hiện form "Tạo mật khẩu")
 *             stats:
 *               type: object
 *               description: Chỉ có ở GET /auth/profile
 *               properties:
 *                 trips:
 *                   type: integer
 *                 favorites:
 *                   type: integer
 *                 reviews:
 *                   type: integer
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
 *                 description: 2-50 ký tự sau khi bỏ khoảng trắng hai đầu
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
 *         description: Trả về thông tin cá nhân của user (kèm authType, hasPassword, stats)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
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
 *                 description: 2-50 ký tự sau khi bỏ khoảng trắng hai đầu
 *               avatar:
 *                 type: string
 *                 description: URL http(s) từ POST /upload, hoặc '' để xóa ảnh đại diện
 *               coverImage:
 *                 type: string
 *                 description: URL http(s) từ POST /upload, hoặc '' để xóa ảnh bìa
 *               phone:
 *                 type: string
 *                 description: 10 chữ số bắt đầu bằng 0, hoặc '' để xóa
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ, Khác, '']
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: Từ 1900 tới hôm nay; null hoặc '' để xóa ngày sinh
 *               travelPreferences:
 *                 type: array
 *                 maxItems: 6
 *                 description: Tối đa 6 mục, mỗi mục tối đa 50 ký tự (bỏ mục rỗng và mục trùng)
 *                 items:
 *                   type: string
 *               favoriteBudget:
 *                 type: string
 *                 enum: [Tiết kiệm, Trung bình, Cao cấp, '']
 *     responses:
 *       200:
 *         description: Cập nhật thành công, trả về thông tin user mới (kèm authType, hasPassword; không có stats)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: |
 *           `VALIDATION_ERROR`: một hoặc nhiều field không hợp lệ (message gộp mọi lỗi, cách nhau bởi ". ";
 *           không field nào được lưu), hoặc body có `password` (phải dùng PUT /auth/change-password)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0. Ngày sinh không được ở tương lai"
 *               code: VALIDATION_ERROR
 *               stack: null
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy User
 */

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu (xác minh mật khẩu hiện tại) hoặc tạo mật khẩu lần đầu cho tài khoản Google
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Bắt buộc nếu tài khoản đã có mật khẩu (hasPassword = true)
 *               newPassword:
 *                 type: string
 *                 description: Tối thiểu 6 ký tự, ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số
 *           example:
 *             currentPassword: "Abc123"
 *             newPassword: "Newpass1"
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đổi mật khẩu thành công!"
 *       400:
 *         description: Thiếu mật khẩu mới / thiếu hoặc sai mật khẩu hiện tại / mật khẩu mới yếu / trùng mật khẩu hiện tại
 *       401:
 *         description: Chưa xác thực (thiếu hoặc sai token)
 *       429:
 *         description: Thử sai quá 10 lần trong 15 phút
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
router.put('/change-password', protect, changePasswordLimiter, changePassword);

export default router;
