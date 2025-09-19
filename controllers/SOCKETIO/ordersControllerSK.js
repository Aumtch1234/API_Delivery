// controllers/SOCKETIO/ordersControllerSK.js - Updated with logs and matching routes
const pool = require("../../config/db");
const { emitOrderUpdate } = require("../../SocketRoutes/socketEvents");

// Helper function to log API calls
const logAPICall = (endpoint, method, ip, body = null, query = null) => {
    const timestamp = new Date().toISOString();
    console.log(`\n🚀 [${timestamp}] ${method} ${endpoint}`);
    console.log(`📍 IP: ${ip}`);
    if (query && Object.keys(query).length > 0) {
        console.log(`🔍 Query:`, JSON.stringify(query, null, 2));
    }
    if (body && Object.keys(body).length > 0) {
        console.log(`📦 Body:`, JSON.stringify(body, null, 2));
    }
    console.log('─'.repeat(50));
};

// API: ดูสถานะออเดอร์
exports.getOrderStatus = async (req, res) => {
    const { order_id } = req.params;
    logAPICall('/order_status/:order_id', 'GET', req.ip, null, { order_id });

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
            console.log(`❌ Order ${order_id} not found`);
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const order = result.rows[0];
        console.log(`✅ Order ${order_id} found with status: ${order.status}`);

        const responseData = {
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
        };

        console.log(`📤 Sending response:`, JSON.stringify(responseData, null, 2));
        res.json(responseData);
    } catch (err) {
        console.error("❌ getOrderStatus error:", err);
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
    logAPICall('/accept_order', 'POST', req.ip, req.body);

    if (!order_id || !market_id) {
        return res.status(400).json({
            success: false,
            error: "order_id and market_id are required"
        });
    }

    try {
        console.log(`🔍 Checking order ${order_id} status...`);
        const checkResult = await pool.query(
            "SELECT status, market_id, user_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];
        
        if (currentOrder.status !== 'waiting') {
            return res.status(400).json({
                success: false,
                error: "Order already processed",
                current_status: currentOrder.status
            });
        }

        if (currentOrder.market_id !== parseInt(market_id)) {
            return res.status(403).json({
                success: false,
                error: "This order belongs to another market"
            });
        }

        // Update order status
        const updateResult = await pool.query(
            `UPDATE orders 
             SET status = 'accepted', 
                 updated_at = NOW()
             WHERE order_id = $1 AND market_id = $2
             RETURNING *`,
            [order_id, market_id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                error: "Failed to update order"
            });
        }

        console.log(`✅ Market ${market_id} accepted order ${order_id}`);

        // สร้างข้อมูลสำหรับ socket event พร้อมข้อมูลครบถ้วน
        const updateData = {
            order_id: parseInt(order_id),
            user_id: currentOrder.user_id,
            market_id: parseInt(market_id),
            status: "accepted",
            hasShop: true,
            hasRider: false,
            rider_id: null,
            timestamp: new Date().toISOString(),
            action: 'order_accepted' // เพิ่ม action type
        };

        console.log(`📡 Broadcasting order acceptance to all parties:`, updateData);
        
        // Emit socket event ไปทุก room ที่เกี่ยวข้อง
        emitOrderUpdate(order_id, updateData);
        
        // เพิ่ม explicit broadcast เพื่อให้แน่ใจ
        const { getIO } = require("../../SocketRoutes/socketEvents");
        const io = getIO();
        
        // ส่งไปทุก room พร้อมกัน
        io.to(`order:${order_id}`).emit("order:updated", updateData);
        io.to(`customer:${currentOrder.user_id}`).emit("order:updated", updateData);
        io.to(`shop:${market_id}`).emit("order:updated", updateData);
        
        console.log(`📡 Explicit broadcast sent to order:${order_id}, customer:${currentOrder.user_id}, shop:${market_id}`);

        const responseData = {
            success: true,
            message: "Order accepted successfully",
            data: {
                order_id: parseInt(order_id),
                status: "accepted",
                market_id: parseInt(market_id),
                user_id: currentOrder.user_id,
                accepted_at: updateResult.rows[0].updated_at,
                ...updateData
            }
        };

        res.json(responseData);
    } catch (err) {
        console.error("❌ acceptOrder error:", err);
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
    logAPICall('/assign_rider', 'POST', req.ip, req.body);

    if (!order_id || !rider_id) {
        console.log(`❌ Missing required fields. order_id: ${order_id}, rider_id: ${rider_id}`);
        return res.status(400).json({
            success: false,
            error: "order_id and rider_id are required"
        });
    }

    try {
        console.log(`🔍 Checking order ${order_id} for rider assignment...`);
        const checkResult = await pool.query(
            "SELECT status, rider_id, market_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            console.log(`❌ Order ${order_id} not found in database`);
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];
        console.log(`📋 Current order - status: ${currentOrder.status}, rider_id: ${currentOrder.rider_id}, market_id: ${currentOrder.market_id}`);

        if (currentOrder.status === 'waiting') {
            console.log(`❌ Order ${order_id} not yet accepted by shop`);
            return res.status(400).json({
                success: false,
                error: "Order not yet accepted by shop",
                current_status: currentOrder.status
            });
        }

        if (currentOrder.rider_id !== null) {
            console.log(`❌ Order ${order_id} already has rider: ${currentOrder.rider_id}`);
            return res.status(400).json({
                success: false,
                error: "Order already has a rider",
                current_rider_id: currentOrder.rider_id
            });
        }

        console.log(`🔄 Assigning rider ${rider_id} to order ${order_id}...`);
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
            console.log(`❌ Failed to assign rider to order ${order_id}`);
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

        console.log(`📡 Emitting socket event:`, updateData);
        emitOrderUpdate(order_id, updateData);

        const responseData = {
            success: true,
            message: "Rider assigned successfully",
            data: {
                order_id: parseInt(order_id),
                status: "delivering",
                rider_id: parseInt(rider_id),
                assigned_at: updateResult.rows[0].updated_at
            }
        };

        console.log(`📤 Sending response:`, JSON.stringify(responseData, null, 2));
        res.json(responseData);
    } catch (err) {
        console.error("❌ assignRider error:", err);
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
    logAPICall('/update_order_status', 'PUT', req.ip, req.body);

    if (!order_id || !status) {
        return res.status(400).json({
            success: false,
            error: "order_id and status are required"
        });
    }

    const validStatuses = ['waiting', 'accepted', 'delivering', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: "Invalid status",
            valid_statuses: validStatuses
        });
    }

    try {
        // Get current order info including user_id
        const currentResult = await pool.query(
            "SELECT status, rider_id, market_id, user_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = currentResult.rows[0];
        console.log(`📋 Updating order ${order_id}: ${currentOrder.status} -> ${status}`);

        // Update order status
        const updateResult = await pool.query(
            `UPDATE orders 
             SET status = $2, updated_at = NOW() 
             WHERE order_id = $1
             RETURNING *`,
            [order_id, status]
        );

        console.log(`✅ Order ${order_id} status updated to: ${status}`);

        // สร้างข้อมูลครบถ้วนสำหรับ socket event
        const updateData = {
            order_id: parseInt(order_id),
            user_id: currentOrder.user_id,
            market_id: currentOrder.market_id,
            status: status,
            hasShop: status !== "waiting",
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            timestamp: new Date().toISOString(),
            action: 'status_updated',
            old_status: currentOrder.status,
            ...additional_data
        };

        console.log(`📡 Broadcasting status update to all parties:`, updateData);
        
        // Emit socket event ไปทุก room
        emitOrderUpdate(order_id, updateData);
        
        // เพิ่ม explicit broadcast
        const { getIO } = require("../../SocketRoutes/socketEvents");
        const io = getIO();
        
        io.to(`order:${order_id}`).emit("order:updated", updateData);
        io.to(`customer:${currentOrder.user_id}`).emit("order:updated", updateData);
        io.to(`shop:${currentOrder.market_id}`).emit("order:updated", updateData);
        if (currentOrder.rider_id) {
            io.to(`rider:${currentOrder.rider_id}`).emit("order:updated", updateData);
        }

        const responseData = {
            success: true,
            message: "Order status updated successfully",
            data: {
                order_id: parseInt(order_id),
                old_status: currentOrder.status,
                new_status: status,
                updated_at: updateResult.rows[0].updated_at,
                ...updateData
            }
        };

        res.json(responseData);
    } catch (err) {
        console.error("❌ updateOrderStatus error:", err);
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
    logAPICall('/cancel_order', 'POST', req.ip, req.body);

    if (!order_id) {
        return res.status(400).json({
            success: false,
            error: "order_id is required"
        });
    }

    try {
        const checkResult = await pool.query(
            "SELECT status, rider_id, market_id, user_id FROM orders WHERE order_id = $1",
            [order_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = checkResult.rows[0];

        const nonCancellableStatuses = ['completed', 'cancelled'];
        if (nonCancellableStatuses.includes(currentOrder.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot cancel order with status: ${currentOrder.status}`
            });
        }

        // Update order to cancelled
        await pool.query(
            `UPDATE orders 
             SET status = 'cancelled', 
                 note = COALESCE(note, '') || CASE WHEN note IS NULL OR note = '' THEN '' ELSE ' | ' END || 'CANCELLED: ' || $2,
                 updated_at = NOW()
             WHERE order_id = $1`,
            [order_id, reason || 'No reason provided']
        );

        console.log(`✅ Order ${order_id} cancelled. Reason: ${reason}`);

        // สร้างข้อมูลครบถ้วนสำหรับ socket event
        const updateData = {
            order_id: parseInt(order_id),
            user_id: currentOrder.user_id,
            market_id: currentOrder.market_id,
            status: "cancelled",
            hasShop: currentOrder.status !== "waiting",
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            cancellation_reason: reason,
            timestamp: new Date().toISOString(),
            action: 'order_cancelled',
            old_status: currentOrder.status
        };

        console.log(`📡 Broadcasting cancellation to all parties:`, updateData);

        // Emit ไปทุก room
        emitOrderUpdate(order_id, updateData);
        
        // เพิ่ม explicit broadcast
        const { getIO } = require("../../SocketRoutes/socketEvents");
        const io = getIO();
        
        io.to(`order:${order_id}`).emit("order:updated", updateData);
        io.to(`customer:${currentOrder.user_id}`).emit("order:updated", updateData);
        io.to(`shop:${currentOrder.market_id}`).emit("order:updated", updateData);
        if (currentOrder.rider_id) {
            io.to(`rider:${currentOrder.rider_id}`).emit("order:updated", updateData);
        }

        res.json({
            success: true,
            message: "Order cancelled successfully",
            data: updateData
        });
    } catch (err) {
        console.error("❌ cancelOrder error:", err);
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
        limit = 1000,
        offset = 0
    } = req.query;

    logAPICall('/orders', 'GET', req.ip, null, req.query);

    try {
        console.log(`🔍 Fetching orders with filters:`, {
            user_id,
            market_id,
            rider_id,
            status,
            limit,
            offset
        });

        let query = `
            SELECT 
                o.order_id,
                o.user_id,
                o.market_id,
                m.shop_name, 
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
                        DISTINCT jsonb_build_object(
                            'item_id', oi.item_id,
                            'food_id', oi.food_id,
                            'food_name', oi.food_name,
                            'quantity', oi.quantity,
                            'sell_price', oi.sell_price,
                            'subtotal', oi.subtotal,
                            'selected_options', oi.selected_options
                        )
                    ) FILTER (WHERE oi.item_id IS NOT NULL),
                    '[]'
                ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN markets m ON o.market_id = m.market_id
        `;

        const conditions = [];
        const values = [];
        let valueIndex = 1;

        if (user_id) {
            conditions.push(`o.user_id = $${valueIndex++}`);
            values.push(user_id);
            console.log(`🔍 Filtering by user_id: ${user_id}`);
        }

        if (market_id) {
            conditions.push(`o.market_id = $${valueIndex++}`);
            values.push(market_id);
            console.log(`🔍 Filtering by market_id: ${market_id}`);
        }

        if (rider_id) {
            conditions.push(`o.rider_id = $${valueIndex++}`);
            values.push(rider_id);
            console.log(`🔍 Filtering by rider_id: ${rider_id}`);
        }

        if (status) {
            conditions.push(`o.status = $${valueIndex++}`);
            values.push(status);
            console.log(`🔍 Filtering by status: ${status}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += `
            GROUP BY o.order_id, m.shop_name
            ORDER BY o.created_at DESC
            LIMIT $${valueIndex++} OFFSET $${valueIndex++}
        `;

        values.push(parseInt(limit), parseInt(offset));

        console.log(`📊 Executing query:`, query);
        console.log(`📊 Query values:`, values);

        const result = await pool.query(query, values);

        console.log(`✅ Found ${result.rows.length} orders`);

        const responseData = {
            success: true,
            data: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            }
        };

        console.log(`📤 Sending response with ${result.rows.length} orders`);
        res.json(responseData);

    } catch (err) {
        console.error("❌ getOrdersWithItems error:", err);
        res.status(500).json({
            success: false,
            error: "Database error",
            message: err.message
        });
    }
};

// API: ดึงสถิติออเดอร์
exports.getOrderStats = async (req, res) => {
    logAPICall('/order_stats', 'GET', req.ip, null, req.query);

    try {
        console.log(`📊 Fetching order statistics for today...`);

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

        console.log(`✅ Order statistics:`, stats);

        const responseData = {
            success: true,
            data: stats
        };

        console.log(`📤 Sending statistics response`);
        res.json(responseData);

    } catch (err) {
        console.error("❌ getOrderStats error:", err);
        res.status(500).json({
            success: false,
            error: "Database error",
            message: err.message
        });
    }
};