// routes/riderRoutes.js - Fixed version
const express = require('express');
const router = express.Router();
const RiderSocketController = require('../controllers/SOCKETIO/RidaerControllerSK');

// GET /riders/orders - Get orders for riders (with optional rider filtering)
router.get('/orders', RiderSocketController.getOrdersWithItems);

// POST /riders/assign_rider - Rider accepts a job
router.post('/assign_rider', RiderSocketController.assignRider);

// PUT /riders/update_order_status - Update order status
router.put(
  '/update_order_status',
  RiderSocketController.uploadDeliveryPhoto, // Middleware สำหรับรับรูป
  RiderSocketController.updateOrderStatus
);

// GET /riders/orders/:orderId - Get specific order details
router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        // This should call a method to get single order details
        // You may need to implement this method in your controller
        const result = await RiderSocketController.getOrderById(orderId);
        res.json(result);
    } catch (error) {
        console.error('❌ Get order by ID error:', error);
        res.status(500).json({
            success: false,
            error: "Failed to get order details",
            message: error.message
        });
    }
});

// GET /riders/ping - Health check endpoint
router.get('/ping', (req, res) => {
    res.json({
        success: true,
        message: "Rider API is working",
        timestamp: new Date().toISOString(),
        server_time: Date.now()
    });
});

module.exports = router;