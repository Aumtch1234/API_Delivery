const multer = require("multer");
const path = require('path');
const fs = require('fs');
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


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/delivery_photos';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `delivery_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}${ext}`;
        cb(null, filename);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const extname = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowed.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('ไฟล์ต้องเป็น jpeg, jpg, png หรือ webp เท่านั้น'));
    },
});


// API: ไรเดอร์รับงาน (เพิ่มการตรวจสอบงานที่ยังไม่เสร็จ)
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

        // ✅ 1. ตรวจว่ารับงานได้เฉพาะออเดอร์ที่พร้อม
        if (!['waiting', 'confirmed', 'accepted', 'preparing', 'ready_for_pickup'].includes(currentOrder.status)) {
            console.log(`❌ Order ${order_id} status not eligible for rider assignment: ${currentOrder.status}`);
            return res.status(400).json({
                success: false,
                error: "Order not ready for rider assignment",
                current_status: currentOrder.status
            });
        }

        // ✅ 2. ตรวจว่าออเดอร์นี้มีไรเดอร์อยู่แล้วหรือยัง
        if (currentOrder.rider_id !== null) {
            console.log(`❌ Order ${order_id} already has rider: ${currentOrder.rider_id}`);
            return res.status(400).json({
                success: false,
                error: "Order already has a rider",
                current_rider_id: currentOrder.rider_id
            });
        }

        // ✅ 3. ตรวจว่าไรเดอร์มีงานที่ยังไม่เสร็จอยู่หรือไม่
        console.log(`🔍 Checking if rider ${rider_id} has any active orders...`);
        const activeCheck = await pool.query(
            `SELECT order_id, status 
             FROM orders 
             WHERE rider_id = $1 
             AND status IN (
                 'rider_assigned', 
                 'going_to_shop', 
                 'arrived_at_shop', 
                 'picked_up', 
                 'delivering', 
                 'arrived_at_customer'
             )`,
            [rider_id]
        );

        if (activeCheck.rows.length > 0) {
            console.log(`🚫 Rider ${rider_id} already has an active job: order ${activeCheck.rows[0].order_id} (${activeCheck.rows[0].status})`);
            return res.status(400).json({
                success: false,
                error: "Rider already has an active order",
                active_order: {
                    order_id: activeCheck.rows[0].order_id,
                    status: activeCheck.rows[0].status
                },
                hint: "กรุณาทำงานปัจจุบันให้เสร็จก่อน (completed หรือ cancelled)"
            });
        }

        console.log(`✅ Rider ${rider_id} has no active orders. Proceeding with assignment...`);
        console.log(`🔄 Assigning rider ${rider_id} to order ${order_id}...`);

        // ประกาศตัวแปรนอก transaction block
        let currentCredit, requiredCredit, newBalance, updateResult;

        // ⭐ ตรวจสอบเครดิตและหักเครดิตในการทำธุรกรรม
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // ดึงข้อมูลเครดิตของไรเดอร์และค่าใช้จ่ายของออเดอร์
            const riderCreditResult = await client.query(
                'SELECT gp_balance FROM rider_profiles WHERE rider_id = $1',
                [rider_id]
            );

            const orderCostResult = await client.query(
                'SELECT rider_required_gp FROM orders WHERE order_id = $1',
                [order_id]
            );

            if (riderCreditResult.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log(`❌ Rider profile not found: ${rider_id}`);
                return res.status(404).json({
                    success: false,
                    error: "Rider profile not found"
                });
            }

            if (orderCostResult.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log(`❌ Order cost data not found: ${order_id}`);
                return res.status(404).json({
                    success: false,
                    error: "Order cost data not found"
                });
            }

            currentCredit = parseFloat(riderCreditResult.rows[0].gp_balance || 0);
            requiredCredit = parseFloat(orderCostResult.rows[0].rider_required_gp || 0);
            newBalance = currentCredit - requiredCredit;

            console.log(`💳 Credit check - Current: ${currentCredit}, Required: ${requiredCredit}, New Balance: ${newBalance}`);

            // ตรวจสอบว่าเครดิตเพียงพอหรือไม่
            if (newBalance < 0) {
                await client.query('ROLLBACK');
                console.log(`❌ Insufficient credit for rider ${rider_id}. Required: ${requiredCredit}, Available: ${currentCredit}`);
                return res.status(400).json({
                    success: false,
                    error: "Insufficient credit",
                    required_credit: requiredCredit,
                    available_credit: currentCredit,
                    shortage: Math.abs(newBalance)
                });
            }

            // อัปเดทออเดอร์
            updateResult = await client.query(
                `UPDATE orders 
                 SET status = 'rider_assigned', 
                     rider_id = $2, 
                     updated_at = NOW()
                 WHERE order_id = $1
                 RETURNING *`,
                [order_id, rider_id]
            );

            // หักเครดิตจากไรเดอร์
            const creditUpdateResult = await client.query(
                'UPDATE rider_profiles SET gp_balance = $1 WHERE rider_id = $2 RETURNING gp_balance',
                [newBalance, rider_id]
            );

            if (updateResult.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log(`❌ Failed to assign rider to order ${order_id}`);
                return res.status(500).json({
                    success: false,
                    error: "Failed to update order"
                });
            }

            if (creditUpdateResult.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log(`❌ Failed to update rider credit for rider ${rider_id}`);
                return res.status(500).json({
                    success: false,
                    error: "Failed to update rider credit"
                });
            }

            await client.query('COMMIT');
            console.log(`✅ Rider ${rider_id} accepted order ${order_id}. Credit deducted: ${requiredCredit}, New balance: ${newBalance}`);

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
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
            timestamp: new Date().toISOString(),
            credit_info: {
                credit_deducted: requiredCredit,
                new_balance: newBalance
            }
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
                assigned_at: updateResult.rows[0].updated_at,
                credit_transaction: {
                    previous_balance: currentCredit,
                    credit_deducted: requiredCredit,
                    new_balance: newBalance
                }
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
    const photoFile = req.file; // จาก multer middleware

    console.log(`🔄 Update request - order_id: ${order_id}, status: ${status}, has_photo: ${!!photoFile}`);

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

    // ⭐ ตรวจสอบว่าต้องมีรูปภาพสำหรับสถานะ completed
    if (status === 'completed' && !photoFile) {
        return res.status(400).json({
            success: false,
            error: "Delivery photo is required for completed status",
            hint: "กรุณาถ่ายรูปหลักฐานการส่งของก่อนทำเครื่องหมายว่าเสร็จสิ้น"
        });
    }

    try {
        console.log(`🔄 Updating order ${order_id} status to ${status}`);

        // Get current order data
        const currentResult = await pool.query(
            `SELECT o.*, m.owner_id as market_owner_id 
             FROM orders o 
             LEFT JOIN markets m ON o.market_id = m.market_id 
             WHERE o.order_id = $1`,
            [order_id]
        );

        if (currentResult.rows.length === 0) {
            // ลบไฟล์ถ้าอัพโหลดแล้วแต่ไม่เจอออเดอร์
            if (photoFile) {
                await fs.unlink(photoFile.path).catch(err =>
                    console.error('Error deleting uploaded file:', err)
                );
            }
            return res.status(404).json({
                success: false,
                error: "Order not found"
            });
        }

        const currentOrder = currentResult.rows[0];
        console.log(`📋 Updating order ${order_id}: ${currentOrder.status} -> ${status}`);

        // ⭐ เพิ่มเงื่อนไขตรวจสอบสำหรับไรเดอร์
        const riderStatuses = ['going_to_shop', 'arrived_at_shop', 'picked_up', 'delivering', 'arrived_at_customer'];

        if (riderStatuses.includes(status)) {
            if (!currentOrder.rider_id) {
                if (photoFile) await fs.unlink(photoFile.path).catch(err => console.error(err));
                return res.status(400).json({
                    success: false,
                    error: "Order has no assigned rider",
                    current_status: currentOrder.status
                });
            }

            // เช็คเงื่อนไข: ร้านต้อง confirm ก่อน going_to_shop
            if (status === 'going_to_shop') {
                const isAdminShop = currentOrder.market_owner_id === null;
                const needsConfirmation = !isAdminShop;

                if (needsConfirmation && currentOrder.status === 'rider_assigned') {
                    if (photoFile) await fs.unlink(photoFile.path).catch(err => console.error(err));
                    return res.status(409).json({
                        success: false,
                        error: "Shop must confirm order before rider can go to shop",
                        current_status: currentOrder.status,
                        shop_type: isAdminShop ? "admin_shop" : "regular_shop",
                        hint: "รอร้านยืนยันออเดอร์ก่อน"
                    });
                }
            }

            // กฎ: ห้าม picked_up ถ้าร้านยังไม่ ready_for_pickup
            if (status === 'picked_up') {
                const isAdminShop = currentOrder.market_owner_id === null;

                if (!isAdminShop && currentOrder.shop_status !== 'ready_for_pickup') {
                    if (photoFile) await fs.unlink(photoFile.path).catch(err => console.error(err));
                    return res.status(409).json({
                        success: false,
                        error: "Shop is not ready for pickup yet",
                        shop_status: currentOrder.shop_status || null,
                        shop_type: "regular_shop",
                        hint: "รอร้านทำอาหารให้เสร็จ"
                    });
                }
            }

            // ตรวจสอบ status progression
            const statusProgression = [
                'rider_assigned', 'going_to_shop', 'arrived_at_shop',
                'picked_up', 'delivering', 'arrived_at_customer', 'completed'
            ];

            const currentIndex = statusProgression.indexOf(currentOrder.status);
            const newIndex = statusProgression.indexOf(status);

            if (currentIndex !== -1 && newIndex !== -1 && newIndex <= currentIndex) {
                if (photoFile) await fs.unlink(photoFile.path).catch(err => console.error(err));
                return res.status(400).json({
                    success: false,
                    error: "Invalid status progression",
                    current_status: currentOrder.status,
                    requested_status: status,
                    hint: "สถานะต้องเดินหน้าตามลำดับ"
                });
            }
        }

        // ⭐ สร้าง Full Photo URL ก่อนถ้ามีไฟล์
        let fullPhotoURL = null;
        if (photoFile) {
            const photoPath = `/uploads/delivery_photos/${photoFile.filename}`;
            fullPhotoURL = `${req.protocol}://${req.get('host')}${photoPath}`;
            console.log(`📸 Photo uploaded: ${fullPhotoURL}`);
        }

        // ⭐ Prepare update data with full photo URL (ไม่ใช่ relative path)
        const updateData = {
            status: status,
            delivery_photo: fullPhotoURL // บันทึก full URL แทน relative path
        };

        // ⭐ Build dynamic update query
        const updateFields = Object.keys(updateData)
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ');

        const updateValues = Object.keys(updateData).map(key => updateData[key]);

        // Update order status with full photo URL
        const updateResult = await pool.query(
            `UPDATE orders 
             SET ${updateFields}, updated_at = NOW()
             WHERE order_id = $1
             RETURNING *`,
            [order_id, ...updateValues]
        );

        // ⭐ ถ้าเป็น completed ให้คืนเครดิตให้ไรเดอร์
        if (status === 'completed' && currentOrder.rider_id) {
            try {
                const creditResult = await pool.query(
                    `UPDATE rider_profiles 
                     SET gp_balance = gp_balance + $1 
                     WHERE rider_id = $2
                     RETURNING gp_balance`,
                    [currentOrder.rider_required_gp, currentOrder.rider_id]
                );

                if (creditResult.rows.length > 0) {
                    console.log(`💰 Refunded ${currentOrder.rider_required_gp} GP to rider ${currentOrder.rider_id}`);
                    console.log(`💳 New balance: ${creditResult.rows[0].gp_balance}`);
                }
            } catch (creditError) {
                console.error('❌ Failed to refund credit:', creditError);
                // ไม่ fail ทั้ง transaction แต่ log error
            }
        }

        // Send socket event
        const socketData = {
            order_id: parseInt(order_id),
            user_id: currentOrder.user_id,
            market_id: currentOrder.market_id,
            status: status,
            shop_status: updateResult.rows[0].shop_status,
            hasShop: true,
            hasRider: currentOrder.rider_id !== null,
            rider_id: currentOrder.rider_id,
            market_owner_id: currentOrder.market_owner_id,
            shop_type: currentOrder.market_owner_id === null ? "admin_shop" : "regular_shop",
            delivery_photo: fullPhotoURL, // ✅ ใช้ full URL
            timestamp: new Date().toISOString(),
            action: 'status_updated',
            old_status: currentOrder.status,
            ...additional_data
        };

        console.log(`📡 Emitting status update:`, socketData);
        emitOrderUpdate(order_id, socketData);

        const responseData = {
            success: true,
            message: "Order status updated successfully",
            data: {
                order_id: parseInt(order_id),
                old_status: currentOrder.status,
                new_status: status,
                shop_status: updateResult.rows[0].shop_status,
                shop_type: currentOrder.market_owner_id === null ? "admin_shop" : "regular_shop",
                delivery_photo: fullPhotoURL, // ✅ Full URL ในตอบกลับ
                photo_url: fullPhotoURL, // ✅ Full URL ในตอบกลับ
                updated_at: updateResult.rows[0].updated_at,
                credit_refunded: status === 'completed' ? currentOrder.rider_required_gp : null,
                ...socketData
            }
        };

        console.log(`✅ Status updated successfully with${photoFile ? '' : 'out'} photo`);
        res.json(responseData);

    } catch (err) {
        console.error("❌ updateOrderStatus error:", err);

        // ลบไฟล์ที่อัพโหลดถ้ามี error
        if (photoFile) {
            await fs.unlink(photoFile.path).catch(unlinkErr =>
                console.error('Error deleting file after error:', unlinkErr)
            );
        }

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
                m.owner_id as market_owner_id,
                o.rider_id,
                o.address,
                o.address_id,  
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.original_total_price,
                o.rider_required_gp,
                o.status,
                o.shop_status,
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
                            'selected_options', oi.selected_options,
                            'additional_notes', oi.additional_notes
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
            // conditions.push(`(o.rider_id = $${valueIndex++} OR (o.status IN ('confirmed', 'accepted', 'preparing', 'ready_for_pickup') AND o.rider_id IS NULL))`);
            conditions.push(`(o.rider_id = $${valueIndex++} OR (o.status IN ('awaiting','confirmed', 'accepted', 'preparing', 'ready_for_pickup') AND o.rider_id IS NULL))`);
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
                    m.market_id, m.shop_name, m.owner_id, m.latitude, m.longitude, m.address, m.phone,
                    ca.id, ca.name, ca.phone, ca.address, ca.district, ca.city, ca.postal_code, ca.notes, ca.latitude, ca.longitude, ca.location_text
            ORDER BY 
                CASE 
                    WHEN o.rider_id IS NULL AND o.status IN ('waiting', 'confirmed', 'accepted', 'preparing', 'ready_for_pickup') THEN 0
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
            shop_type: order.market_owner_id === null ? 'admin_shop' : 'regular_shop',
            can_go_to_shop: order.status === 'rider_assigned' ?
                (order.market_owner_id === null || order.status === 'confirmed') : true
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
                delivery_fee: order.delivery_fee
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

exports.uploadDeliveryPhoto = upload.single('photo');