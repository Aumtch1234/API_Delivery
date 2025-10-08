// routes/ReviewsAPIsRoute.js
const express = require('express');
const router = express.Router();
const ReviewsController = require('../../controllers/Reviews/reviewsController');
const authenticateJWT = require('../../middleware/Client/auth');
const reviewsController = require('../../controllers/Reviews/reviewsController');
const { getMarketFromToken, getRiderFromToken } = require('../../middleware/Reviews/reviewsAuth');

// ต้องใช้ token ทุกอัน
router.post('/market', authenticateJWT, ReviewsController.upsertMarketReview);
router.post('/rider', authenticateJWT, ReviewsController.upsertRiderReview);
router.post('/food', authenticateJWT, reviewsController.upsertFoodReviews);


// ดึง marketId และ riderId จาก token โดยอัตโนมัติ
// router.get('/for/markets', authenticateJWT, getMarketFromToken, ReviewsController.listMarketReviews);
router.get('/markets/:marketId/reviews', authenticateJWT, ReviewsController.getAllMarketReviews);
router.get('/for/riders', authenticateJWT, getRiderFromToken, ReviewsController.listRiderReviews);
router.get('/food/:foodId', reviewsController.listFoodReviews);

// ตรวจว่าออเดอร์นี้รีวิวไปหรือยัง (ทั้งร้าน/ไรเดอร์)
router.get('/orders/:orderId/for-user', authenticateJWT, ReviewsController.getOrderReviewsByUser);

module.exports = router;
