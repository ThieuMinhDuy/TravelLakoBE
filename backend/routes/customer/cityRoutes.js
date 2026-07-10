import express from 'express';
import { getCities, getCityById } from '../../controllers/customer/cityController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     City:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID tự động sinh của thành phố
 *         name:
 *           type: string
 *           description: Tên thành phố
 *         description:
 *           type: string
 *           description: Mô tả về thành phố
 *         image:
 *           type: string
 *           description: URL ảnh phong cảnh thành phố
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *               description: Vĩ độ
 *             lng:
 *               type: number
 *               description: Kinh độ
 *       example:
 *         _id: "60d0fe4f5311236168a109ca"
 *         name: "Đà Nẵng"
 *         description: "Thành phố đáng sống nhất Việt Nam với nhiều bãi biển đẹp."
 *         image: "https://example.com/danang.jpg"
 *         coordinates:
 *           lat: 16.0544
 *           lng: 108.2022
 */

/**
 * @swagger
 * /cities:
 *   get:
 *     summary: Lấy danh sách toàn bộ thành phố
 *     description: Trả về danh sách tất cả các thành phố đang được hỗ trợ trong hệ thống (công khai).
 *     tags: [Cities]
 *     responses:
 *       200:
 *         description: Trả về danh sách thành phố thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 cities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/City'
 */
router.get('/', getCities);

/**
 * @swagger
 * /cities/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một thành phố theo ID
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thành phố cần xem chi tiết
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       404:
 *         description: Không tìm thấy thành phố
 */
router.get('/:id', getCityById);

export default router;
