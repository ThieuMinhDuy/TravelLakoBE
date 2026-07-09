import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../../controllers/admin/userController.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Lấy danh sách toàn bộ người dùng (Admin)
 *     tags: [Admin - User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 */

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết người dùng theo ID (Admin)
 *     tags: [Admin - User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết người dùng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy người dùng
 * 
 *   put:
 *     summary: Cập nhật thông tin/trạng thái người dùng (Admin)
 *     tags: [Admin - User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               isAdmin:
 *                 type: boolean
 *               isBlocked:
 *                 type: boolean
 *       example:
 *         name: "John Doe Updated"
 *         email: "john_updated@example.com"
 *         isAdmin: false
 *         isBlocked: true
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy người dùng
 * 
 *   delete:
 *     summary: Xóa người dùng (Admin)
 *     tags: [Admin - User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: Không thể xóa quản trị viên duy nhất
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.route('/').get(getUsers);
router.route('/:id').get(getUserById).put(updateUser).delete(deleteUser);

export default router;
