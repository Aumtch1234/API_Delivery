const pool = require("../../config/db");
const { emitOrderUpdate } = require("../../SocketRoutes/Events/socketEvents");
const axios = require('axios');

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

        // Allow assignment for confirmed orders
        if (!['confirmed', 'accepted', 'preparing', 'ready_for_pickup'].includes(currentOrder.status)) {
            console.log(`❌ Order ${order_id} status not eligible for rider assignment: ${currentOrder.status}`);
            return res.status(400).json({
                success: false,
                error: "Order not ready for rider assignment",
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
             SET status = 'rider_assigned', 
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
            status: "rider_assigned",
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
                status: "rider_assigned",
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

// API: อัพเดทสถานะออเดอร์
exports.updateOrderStatus = async (req, res) => {
    const { order_id, status, additional_data = {} } = req.body;
    logAPICall('/update_order_status', 'PUT', req.ip, req.body);

    if (!order_id || !status) {
        return res.status(400).json({
            success: false,
            error: "order_id and status are required"
        });
    }

    // Valid status transitions
    const validStatuses = [
        'waiting',
        'confirmed',
        'accepted',
        'rider_assigned',
        'going_to_shop',
        'arrived_at_shop',
        'picked_up',
        'delivering',
        'arrived_at_customer',
        'completed',
        'cancelled'
    ];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: "Invalid status",
            valid_statuses: validStatuses
        });
    }

    try {
        console.log(`🔄 Updating order ${order_id} status to ${status}`);

        // Get current order data
        const currentResult = await pool.query(
            "SELECT * FROM orders WHERE order_id = $1",
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
             SET status = $2, 
                 updated_at = NOW()
             WHERE order_id = $1
             RETURNING *`,
            [order_id, status]
        );

        // Calculate earnings if completed
        let riderEarning = null;
        if (status === 'completed' && currentOrder.delivery_fee) {
            riderEarning = calculateRiderEarning(currentOrder.delivery_fee);

            // Update rider's balance
            if (currentOrder.rider_id) {
                await pool.query(
                    `UPDATE rider_profiles 
                     SET gp_balance = COALESCE(gp_balance, 0) + $2
                     WHERE rider_id = $1`,
                    [currentOrder.rider_id, riderEarning]
                );
                console.log(`💰 Added ฿${riderEarning} to rider ${currentOrder.rider_id} balance`);
            }
        }

        // Send socket event
        const updateData = {
            order_id: parseInt(order_id),
            status: status,
            hasShop: true,
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            market_id: currentOrder.market_id,
            rider_earning: riderEarning,
            timestamp: new Date().toISOString(),
            ...additional_data
        };

        console.log(`📡 Emitting status update:`, updateData);
        emitOrderUpdate(order_id, updateData);

        const responseData = {
            success: true,
            message: "Order status updated successfully",
            data: {
                order_id: parseInt(order_id),
                old_status: currentOrder.status,
                new_status: status,
                rider_earning: riderEarning,
                updated_at: updateResult.rows[0].updated_at
            }
        };

        console.log(`📤 Status update response:`, JSON.stringify(responseData, null, 2));
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

        // Query หลัก
        let query = `
            SELECT
                o.order_id,
                o.user_id,
                o.market_id,
                m.shop_name,
                o.rider_id,
                o.address,
                o.address_id,  
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.total_price,
                o.status,
                o.created_at,
                o.updated_at,
                
                -- ข้อมูลตำแหน่งร้านค้า
                jsonb_build_object(
                    'market_id', m.market_id,
                    'shop_name', m.shop_name,
                    'latitude', m.latitude,
                    'longitude', m.longitude,
                    'address', m.address,
                    'phone', m.phone
                ) as market_location,
                
                -- ข้อมูลตำแหน่งลูกค้า (join ด้วย address_id)
                jsonb_build_object(
                    'address_id', ca.id,
                    'name', ca.name,
                    'phone', ca.phone,
                    'address_name', ca.address,
                    'district', ca.district,
                    'city', ca.city,
                    'postal_code', ca.postal_code,
                    'notes', ca.notes,
                    'latitude', ca.latitude,
                    'longitude', ca.longitude,
                    'location_text', ca.location_text
                ) as customer_location,
                
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'item_id', oi.item_id,
                            'food_id', oi.food_id,
                            'food_name', oi.food_name,
                            'quantity', oi.quantity,
                            'base_price', f.price,
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
            LEFT JOIN foods f ON f.food_id = oi.food_id
            LEFT JOIN client_addresses ca ON ca.id = o.address_id
        `;
// เพิ่ม join ตาราง foods ดึง price ในfoods
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
            // แสดงออเดอร์ของ rider หรือออเดอร์ที่ยังไม่มีใครรับ
            conditions.push(`(o.rider_id = $${valueIndex++} OR (o.status IN ('confirmed', 'accepted', 'preparing', 'ready_for_pickup') AND o.rider_id IS NULL))`);
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
            GROUP BY o.order_id, o.address_id,
                    m.market_id, m.shop_name, m.latitude, m.longitude, m.address, m.phone,
                    ca.id, ca.name, ca.phone, ca.address, ca.district, ca.city, ca.postal_code, ca.notes, ca.latitude, ca.longitude, ca.location_text
            ORDER BY 
                CASE 
                    WHEN o.rider_id IS NULL AND o.status IN ('confirmed', 'accepted', 'preparing', 'ready_for_pickup') THEN 0
                    ELSE 1 
                END,
                o.created_at DESC
            LIMIT $${valueIndex++} OFFSET $${valueIndex++}
        `;

        values.push(parseInt(limit), parseInt(offset));

        console.log(`📊 Executing query`);
        const result = await pool.query(query, values);
        console.log(`✅ Found ${result.rows.length} orders`);

        // ใช้ delivery_fee ที่เก็บจาก DB โดยตรง
        const enhancedData = result.rows.map(order => ({
            ...order,
            delivery_fee: order.delivery_fee,
            rider_earning: null
        }));

        const responseData = {
            success: true,
            data: enhancedData,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error("❌ getOrdersWithItems error:", err);
        res.status(500).json({
            success: false,
            error: "Database error",
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// API: ดึงข้อมูลออเดอร์เฉพาะ
exports.getOrderById = async (orderId) => {
    try {
        const query = `
            SELECT
                o.order_id,
                o.user_id,
                o.market_id,
                m.shop_name,
                o.rider_id,
                o.address,
                o.address_id,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.total_price,
                o.status,
                o.created_at,
                o.updated_at,
                
                jsonb_build_object(
                    'market_id', m.market_id,
                    'shop_name', m.shop_name,
                    'latitude', m.latitude,
                    'longitude', m.longitude,
                    'address', m.address,
                    'phone', m.phone
                ) as market_location,
                
                jsonb_build_object(
                    'address_id', ca.id,
                    'name', ca.name,
                    'phone', ca.phone,
                    'address_name', ca.address,
                    'district', ca.district,
                    'city', ca.city,
                    'postal_code', ca.postal_code,
                    'notes', ca.notes,
                    'latitude', ca.latitude,
                    'longitude', ca.longitude,
                    'location_text', ca.location_text
                ) as customer_location,
                
                CASE 
                    WHEN o.rider_id IS NOT NULL THEN
                        jsonb_build_object(
                            'rider_id', rp.rider_id,
                            'user_id', rp.user_id,
                            'vehicle_type', rp.vehicle_type,
                            'vehicle_brand_model', rp.vehicle_brand_model,
                            'vehicle_color', rp.vehicle_color,
                            'rating', rp.rating,
                            'reviews_count', rp.reviews_count,
                            'phone', u.phone,
                            'name', u.first_name || ' ' || u.last_name
                        )
                    ELSE NULL
                END as rider_info,
                
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
            LEFT JOIN client_addresses ca ON ca.id = o.address_id
            LEFT JOIN rider_profiles rp ON o.rider_id = rp.rider_id
            LEFT JOIN users u ON rp.user_id = u.user_id
            WHERE o.order_id = $1
            GROUP BY o.order_id, o.address_id,
                    m.market_id, m.shop_name, m.latitude, m.longitude, m.address, m.phone,
                    ca.id, ca.name, ca.phone, ca.address, ca.district, ca.city, ca.postal_code, ca.notes, ca.latitude, ca.longitude, ca.location_text,
                    rp.rider_id, rp.user_id, rp.vehicle_type, rp.vehicle_brand_model, rp.vehicle_color, rp.rating, rp.reviews_count,
                    u.phone, u.first_name, u.last_name
        `;

        const result = await pool.query(query, [orderId]);

        if (result.rows.length === 0) {
            return {
                success: false,
                error: "Order not found"
            };
        }

        const order = result.rows[0];

        return {
            success: true,
            data: {
                ...order,
                delivery_fee: order.delivery_fee,
                rider_earning: null
            }
        };
    } catch (error) {
        console.error('❌ getOrderById error:', error);
        return {
            success: false,
            error: "Database error",
            message: error.message
        };
    }
};
