// routes/riderRoutes.js - Fixed version
const express = require('express');
const router = express.Router();
const RiderSocketController = require('../controllers/SOCKETIO/RidaerControllerSK');

// Helper function to log all requests
const logRequest = (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n🚀 [${timestamp}] ${req.method} ${req.originalUrl}`);
    console.log(`📍 IP: ${req.ip}`);
    if (Object.keys(req.query).length > 0) {
        console.log(`🔍 Query:`, req.query);
    }
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`📦 Body:`, req.body);
    }
    console.log('─'.repeat(50));
    next();
};

// Apply logging middleware to all routes
router.use(logRequest);

// GET /riders/orders - Get orders for riders (with optional rider filtering)
router.get('/orders', RiderSocketController.getOrdersWithItems);

// POST /riders/assign_rider - Rider accepts a job
router.post('/assign_rider', RiderSocketController.assignRider);

// PUT /riders/update_order_status - Update order status
router.put('/update_order_status', async (req, res) => {
    const { order_id, status, additional_data } = req.body;
    
    if (!order_id || !status) {
        return res.status(400).json({
            success: false,
            error: "order_id and status are required"
        });
    }

    try {
        // You'll need to implement this in your RiderSocketController
        // For now, let's create a simple implementation
        const result = await RiderSocketController.updateOrderStatus(req, res);
        return result;
    } catch (error) {
        console.error('❌ Update order status error:', error);
        return res.status(500).json({
            success: false,
            error: "Failed to update order status",
            message: error.message
        });
    }
});

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