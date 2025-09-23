// SocketRoutes/SocketRoutes.js
const express = require('express');
const router = express.Router();
const socketController = require('../controllers/SOCKETIO/ordersControllerSK');

// ดูสถานะออเดอร์
router.get('/order_status/:order_id', socketController.getOrderStatus);

// ร้านค้ารับออเดอร์ (HTTP API)
router.post('/accept_order', socketController.acceptOrder);

// ไรเดอร์รับงาน (HTTP API)
router.post('/assign_rider', socketController.assignRider);

// อัปเดตสถานะออเดอร์ทั่วไป
router.put('/update_order_status', socketController.updateOrderStatus);

// อัปเดตสถานะออเดอร์ (Socket API)
router.post('/update_preparation_status', socketController.updatePreparationStatus);

// ยกเลิกออเดอร์
router.post('/cancel_order', socketController.cancelOrder);

// ดึงรายการออเดอร์พร้อมรายการอาหาร
router.get('/orders', socketController.getOrdersWithItems);

// ดึงสถิติออเดอร์
router.get('/order_stats', socketController.getOrderStats);

module.exports = router;