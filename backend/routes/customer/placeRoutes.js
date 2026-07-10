import express from 'express';
import { getPlaces, getPlaceById, globalSearch } from '../../controllers/customer/placeController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Attraction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         admissionFee:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         rating:
 *           type: number
 *         numReviews:
 *           type: number
 *     Hotel:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         stars:
 *           type: number
 *         pricePerNight:
 *           type: number
 *         address:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         rating:
 *           type: number
 *         numReviews:
 *           type: number
 *     Restaurant:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         cuisineType:
 *           type: string
 *         priceRange:
 *           type: string
 *         address:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         rating:
 *           type: number
 *         numReviews:
 *           type: number
 *     Cafe:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         priceRange:
 *           type: string
 *         address:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         rating:
 *           type: number
 *         numReviews:
 *           type: number
 */

/**
 * @swagger
 * /places/search:
 *   get:
 *     summary: Tìm kiếm tổng hợp trên tất cả loại địa điểm (Global Search)
 *     tags: [Places]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm theo tên địa điểm
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Lọc theo ID thành phố
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attractions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attraction'
 *                 hotels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Hotel'
 *                 restaurants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Restaurant'
 *                 cafes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cafe'
 */
router.get('/search', globalSearch);

/**
 * @swagger
 * /places/{type}:
 *   get:
 *     summary: Lấy danh sách địa điểm theo phân loại (attraction, hotel, restaurant, cafe) kèm bộ lọc
 *     tags: [Places]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *         description: Loại địa điểm cần lấy
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Lọc theo ID thành phố
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm tên địa điểm
 *       - in: query
 *         name: stars
 *         schema:
 *           type: integer
 *         description: Lọc theo số sao (chỉ cho hotel)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Giá thấp nhất (chỉ cho hotel)
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Giá cao nhất (chỉ cho hotel)
 *       - in: query
 *         name: minFee
 *         schema:
 *           type: number
 *         description: Phí vào cửa thấp nhất (chỉ cho attraction)
 *       - in: query
 *         name: maxFee
 *         schema:
 *           type: number
 *         description: Phí vào cửa cao nhất (chỉ cho attraction)
 *       - in: query
 *         name: cuisineType
 *         schema:
 *           type: string
 *         description: Loại ẩm thực (chỉ cho restaurant)
 *       - in: query
 *         name: priceRange
 *         schema:
 *           type: string
 *           enum: [$, $$, $$$]
 *         description: Khoảng phân khúc giá (cho restaurant, cafe)
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
 *                 places:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/:type', getPlaces);

/**
 * @swagger
 * /places/{type}/{id}:
 *   get:
 *     summary: Xem thông tin chi tiết một địa điểm theo loại và ID
 *     tags: [Places]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attraction, hotel, restaurant, cafe]
 *         description: Loại địa điểm
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của địa điểm
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy địa điểm
 */
router.get('/:type/:id', getPlaceById);

export default router;
