// controllers/SOCKETIO/ordersControllerSK.js - Updated for actual database schema
const pool = require("../../config/db");
const { emitOrderUpdate } = require("../../SocketRoutes/socketEvents");

// API: ดูสถานะออเดอร์
exports.getOrderStatus = async (req, res) => {
    const { order_id } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT 
                order_id,
                user_id,
                market_id,
                rider_id,
                address,
                delivery_type,
                payment_method,
                note,
                distance_km,
                delivery_fee,
                total_price,
                status, 
                created_at,
                updated_at
            FROM orders 
            WHERE order_id = $1`,
            [order_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: "Order not found" 
            });
        }

        const order = result.rows[0];

        res.json({
            success: true,
            data: {
                order_id: parseInt(order_id),
                user_id: order.user_id,
                market_id: order.market_id,
                status: order.status,
                hasShop: order.status !== "waiting",
                hasRider: order.rider_id !== null,
                rider_id: order.rider_id,
                address: order.address,
                delivery_type: order.delivery_type,
                payment_method: order.payment_method,
                note: order.note,
                distance_km: order.distance_km,
                delivery_fee: order.delivery_fee,
                total_price: order.total_price,
                timestamps: {
                    created_at: order.created_at,
                    updated_at: order.updated_at
                }
            }
        });
    } catch (err) {
        console.error("getOrderStatus error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Database error",
            message: err.message
        });
    }
};

// API: ร้านค้ารับออเดอร์
exports.acceptOrder = async (req, res) => {
    const { order_id, market_id } = req.body;
    
    if (!order_id) {
        return res.status(400).json({
            success: false,
            error: "order_id is required"
        });
    }

    try {
        // ตรวจสอบว่าออเดอร์ยังไม่ถูกรับ
        const checkResult = await pool.query(
            "SELECT status, market_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];

        // เปลี่ยนจาก 'pending' เป็น 'waiting' ตามตารางจริง
        if (currentOrder.status !== 'waiting') {
            return res.status(400).json({
                success: false,
                error: "Order already accepted",
                current_status: currentOrder.status
            });
        }

        // ตรวจสอบว่าเป็นร้านเดียวกันหรือไม่ (ถ้ามี market_id ใน request)
        if (market_id && currentOrder.market_id !== market_id) {
            return res.status(403).json({
                success: false,
                error: "This order belongs to another market"
            });
        }

        // อัปเดตสถานะ
        const updateResult = await pool.query(
            `UPDATE orders 
             SET status = 'accepted', 
                 updated_at = NOW()
             WHERE order_id = $1
             RETURNING *`,
            [order_id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                error: "Failed to update order"
            });
        }

        console.log(`✅ Market ${currentOrder.market_id} accepted order ${order_id}`);

        // ส่ง socket event
        const updateData = {
            order_id: parseInt(order_id),
            status: "accepted",
            hasShop: true,
            hasRider: false,
            market_id: currentOrder.market_id,
            timestamp: new Date().toISOString()
        };

        emitOrderUpdate(order_id, updateData);

        res.json({ 
            success: true, 
            message: "Order accepted successfully",
            data: {
                order_id: parseInt(order_id),
                status: "accepted",
                market_id: currentOrder.market_id,
                accepted_at: updateResult.rows[0].updated_at
            }
        });
    } catch (err) {
        console.error("acceptOrder error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Database error",
            message: err.message
        });
    }
};

// API: ไรเดอร์รับงาน
exports.assignRider = async (req, res) => {
    const { order_id, rider_id } = req.body;
    
    if (!order_id || !rider_id) {
        return res.status(400).json({
            success: false,
            error: "order_id and rider_id are required"
        });
    }

    try {
        // ตรวจสอบว่าออเดอร์ถูกร้านรับแล้วและยังไม่มีไรเดอร์
        const checkResult = await pool.query(
            "SELECT status, rider_id, market_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];
        
        if (currentOrder.status === 'waiting') {
            return res.status(400).json({
                success: false,
                error: "Order not yet accepted by shop",
                current_status: currentOrder.status
            });
        }

        if (currentOrder.rider_id !== null) {
            return res.status(400).json({
                success: false,
                error: "Order already has a rider",
                current_rider_id: currentOrder.rider_id
            });
        }

        // อัปเดตสถานะ - เปลี่ยนเป็น 'delivering' แทน 'rider_assigned'
        const updateResult = await pool.query(
            `UPDATE orders 
             SET status = 'delivering', 
                 rider_id = $2, 
                 updated_at = NOW()
             WHERE order_id = $1
             RETURNING *`,
            [order_id, rider_id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                error: "Failed to update order"
            });
        }

        console.log(`✅ Rider ${rider_id} accepted order ${order_id}`);

        // ส่ง socket event
        const updateData = {
            order_id: parseInt(order_id),
            status: "delivering",
            hasShop: true,
            hasRider: true,
            rider_id: parseInt(rider_id),
            market_id: currentOrder.market_id,
            timestamp: new Date().toISOString()
        };

        emitOrderUpdate(order_id, updateData);

        res.json({ 
            success: true, 
            message: "Rider assigned successfully",
            data: {
                order_id: parseInt(order_id),
                status: "delivering",
                rider_id: parseInt(rider_id),
                assigned_at: updateResult.rows[0].updated_at
            }
        });
    } catch (err) {
        console.error("assignRider error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Database error",
            message: err.message
        });
    }
};

// API: อัปเดตสถานะออเดอร์ทั่วไป
exports.updateOrderStatus = async (req, res) => {
    const { order_id, status, additional_data } = req.body;
    
    if (!order_id || !status) {
        return res.status(400).json({
            success: false,
            error: "order_id and status are required"
        });
    }

    // Define valid status transitions ตามตารางจริง
    const validStatuses = [
        'waiting',      // รอการยืนยัน
        'accepted',     // ร้านรับแล้ว
        'delivering',   // ไรเดอร์กำลังส่ง
        'completed',    // เสร็จแล้ว
        'cancelled'     // ยกเลิก
    ];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: "Invalid status",
            valid_statuses: validStatuses
        });
    }

    try {
        // Get current order info
        const currentResult = await pool.query(
            "SELECT status, rider_id, market_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = currentResult.rows[0];

        // Update order status
        const updateResult = await pool.query(
            `UPDATE orders 
             SET status = $2, updated_at = NOW() 
             WHERE order_id = $1
             RETURNING *`,
            [order_id, status]
        );

        console.log(`📦 Order ${order_id} status updated to: ${status}`);

        // Prepare socket event data
        const updateData = {
            order_id: parseInt(order_id),
            status: status,
            hasShop: status !== "waiting",
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            market_id: currentOrder.market_id,
            timestamp: new Date().toISOString(),
            ...additional_data
        };

        // Send socket event
        emitOrderUpdate(order_id, updateData);

        res.json({ 
            success: true, 
            message: "Order status updated successfully",
            data: {
                order_id: parseInt(order_id),
                old_status: currentOrder.status,
                new_status: status,
                updated_at: updateResult.rows[0].updated_at,
                ...updateData
            }
        });
    } catch (err) {
        console.error("updateOrderStatus error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Database error",
            message: err.message
        });
    }
};

// API: ยกเลิกออเดอร์
exports.cancelOrder = async (req, res) => {
    const { order_id, reason } = req.body;
    
    if (!order_id) {
        return res.status(400).json({
            success: false,
            error: "order_id is required"
        });
    }

    try {
        // Check current status
        const checkResult = await pool.query(
            "SELECT status, rider_id, market_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];

        // Check if order can be cancelled
        const nonCancellableStatuses = ['completed', 'cancelled'];
        if (nonCancellableStatuses.includes(currentOrder.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot cancel order with status: ${currentOrder.status}`
            });
        }

        // Update order status to cancelled - เพิ่มคอลัมน์ note สำหรับเก็บเหตุผล
        await pool.query(
            `UPDATE orders 
             SET status = 'cancelled', 
                 note = COALESCE(note, '') || CASE WHEN note IS NULL OR note = '' THEN '' ELSE ' | ' END || 'CANCELLED: ' || $2,
                 updated_at = NOW()
             WHERE order_id = $1`,
            [order_id, reason || 'No reason provided']
        );

        console.log(`❌ Order ${order_id} cancelled. Reason: ${reason}`);

        // Send socket event
        const updateData = {
            order_id: parseInt(order_id),
            status: "cancelled",
            hasShop: currentOrder.status !== "waiting",
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            market_id: currentOrder.market_id,
            cancellation_reason: reason,
            timestamp: new Date().toISOString()
        };

        emitOrderUpdate(order_id, updateData);

        res.json({ 
            success: true, 
            message: "Order cancelled successfully",
            data: updateData
        });
    } catch (err) {
        console.error("cancelOrder error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Database error",
            message: err.message
        });
    }
};

// API: ดึงรายการออเดอร์พร้อมรายการอาหาร
exports.getOrdersWithItems = async (req, res) => {
    const { 
        user_id, 
        market_id, 
        rider_id, 
        status, 
        limit = 20, 
        offset = 0 
    } = req.query;

    try {
        let query = `
            SELECT 
                o.order_id,
                o.user_id,
                o.market_id,
                o.rider_id,
                o.address,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.total_price,
                o.status,
                o.created_at,
                o.updated_at,
                COALESCE(
                    json_agg(
                        CASE WHEN oi.item_id IS NOT NULL THEN
                            json_build_object(
                                'item_id', oi.item_id,
                                'food_id', oi.food_id,
                                'food_name', oi.food_name,
                                'quantity', oi.quantity,
                                'sell_price', oi.sell_price,
                                'subtotal', oi.subtotal,
                                'selected_options', oi.selected_options
                            )
                        ELSE NULL
                        END
                    ) FILTER (WHERE oi.item_id IS NOT NULL),
                    '[]'
                ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
        `;

        const conditions = [];
        const values = [];
        let valueIndex = 1;

        if (user_id) {
            conditions.push(`o.user_id = $${valueIndex++}`);
            values.push(user_id);
        }

        if (market_id) {
            conditions.push(`o.market_id = $${valueIndex++}`);
            values.push(market_id);
        }

        if (rider_id) {
            conditions.push(`o.rider_id = $${valueIndex++}`);
            values.push(rider_id);
        }

        if (status) {
            conditions.push(`o.status = $${valueIndex++}`);
            values.push(status);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += `
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
            LIMIT $${valueIndex++} OFFSET $${valueIndex++}
        `;

        values.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, values);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            }
        });

    } catch (err) {
        console.error("getOrdersWithItems error:", err);
        res.status(500).json({
            success: false,
            error: "Database error",
            message: err.message
        });
    }
};

// API: ดึงสถิติออเดอร์
exports.getOrderStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                status,
                COUNT(*) as count,
                SUM(total_price) as total_amount
            FROM orders 
            WHERE DATE(created_at) = CURRENT_DATE
            GROUP BY status
            
            UNION ALL
            
            SELECT 
                'total' as status,
                COUNT(*) as count,
                SUM(total_price) as total_amount
            FROM orders 
            WHERE DATE(created_at) = CURRENT_DATE
        `;

        const result = await pool.query(statsQuery);

        const stats = {
            today: {
                total_orders: 0,
                total_amount: 0,
                by_status: {}
            }
        };

        result.rows.forEach(row => {
            if (row.status === 'total') {
                stats.today.total_orders = parseInt(row.count);
                stats.today.total_amount = parseFloat(row.total_amount || 0);
            } else {
                stats.today.by_status[row.status] = {
                    count: parseInt(row.count),
                    amount: parseFloat(row.total_amount || 0)
                };
            }
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (err) {
        console.error("getOrderStats error:", err);
        res.status(500).json({
            success: false,
            error: "Database error",
            message: err.message
        });
    }
};