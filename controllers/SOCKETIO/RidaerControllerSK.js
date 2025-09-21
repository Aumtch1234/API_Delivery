const pool = require("../../config/db");
const { emitOrderUpdate } = require("../../SocketRoutes/socketEvents");
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

// ฟังก์ชันสำหรับคำนวณระยะทางและเวลาผ่าน Google Maps API
async function calculateDistanceMatrix(origins, destinations) {
    try {
        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
        
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn('⚠️ GOOGLE_MAPS_API_KEY not found in .env, falling back to Haversine calculation');
            return null;
        }

        const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
        const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
        
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&units=metric&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
        
        console.log('🗺️ Calling Google Maps Distance Matrix API');
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.status === 'OK') {
            return response.data;
        } else {
            console.warn('⚠️ Google Maps API error:', response.data.status);
            return null;
        }
    } catch (error) {
        console.warn('⚠️ Google Maps API call failed:', error.message);
        return null;
    }
}

// ฟังก์ชันสำรองสำหรับคำนวณระยะทางแบب Haversine
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีของโลกในหน่วยกิโลเมตร
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 100) / 100; // ปัดเศษ 2 ตำแหน่ง
}

exports.getOrdersWithItems = async (req, res) => {
    const {
        user_id,
        market_id,
        rider_id,
        status,
        limit = 1000,
        offset = 0,
        rider_latitude,  // ตำแหน่งปัจจุบันของไรเดอร์
        rider_longitude  // ตำแหน่งปัจจุบันของไรเดอร์
    } = req.query;

    logAPICall('/orders', 'GET', req.ip, null, req.query);

    try {
        console.log(`🔍 Fetching orders with filters:`, {
            user_id,
            market_id,
            rider_id,
            status,
            limit,
            offset,
            rider_position: rider_latitude && rider_longitude ? 
                `${rider_latitude}, ${rider_longitude}` : 'not provided'
        });

        // Query หลักโดยไม่คำนวณระยะทางใน SQL
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

        // เพิ่มเงื่อนไขสำหรับไรเดอร์
        if (rider_id) {
            const riderCondition = `(o.rider_id = $${valueIndex} OR (o.status = 'confirmed' AND o.rider_id IS NULL))`;
            conditions.push(riderCondition);
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
                    WHEN o.rider_id IS NULL AND o.status = 'confirmed' THEN 0
                    ELSE 1 
                END,
                o.created_at DESC
            LIMIT $${valueIndex++} OFFSET $${valueIndex++}
        `;

        values.push(parseInt(limit), parseInt(offset));

        console.log(`📊 Executing query`);
        const result = await pool.query(query, values);
        console.log(`✅ Found ${result.rows.length} orders`);

        // คำนวณระยะทางด้วย Google Maps API (ถ้ามีตำแหน่งไรเดอร์)
        let enhancedData = result.rows;
        
        if (rider_latitude && rider_longitude && result.rows.length > 0) {
            console.log('🗺️ Calculating distances with Google Maps API');
            
            // เตรียมข้อมูลสำหรับ Google Maps API
            const riderPos = { 
                lat: parseFloat(rider_latitude), 
                lng: parseFloat(rider_longitude) 
            };
            
            // รวบรวม unique locations
            const marketLocations = new Map();
            const customerLocations = new Map();
            
            result.rows.forEach(order => {
                if (order.market_location?.latitude && order.market_location?.longitude) {
                    const key = `${order.market_location.latitude},${order.market_location.longitude}`;
                    marketLocations.set(key, {
                        lat: parseFloat(order.market_location.latitude),
                        lng: parseFloat(order.market_location.longitude),
                        market_id: order.market_location.market_id
                    });
                }
                
                if (order.customer_location?.latitude && order.customer_location?.longitude) {
                    const key = `${order.customer_location.latitude},${order.customer_location.longitude}`;
                    customerLocations.set(key, {
                        lat: parseFloat(order.customer_location.latitude),
                        lng: parseFloat(order.customer_location.longitude),
                        address_id: order.customer_location.address_id
                    });
                }
            });

            const allDestinations = [...marketLocations.values(), ...customerLocations.values()];
            
            // เรียก Google Maps API
            let distanceData = null;
            if (allDestinations.length > 0) {
                distanceData = await calculateDistanceMatrix([riderPos], allDestinations);
            }

            // ประมวลผลข้อมูลระยะทาง
            enhancedData = result.rows.map((order, index) => {
                let distance_to_market_km = null;
                let distance_to_customer_km = null;
                let duration_to_market_minutes = null;
                let duration_to_customer_minutes = null;
                let market_to_customer_km = null;
                let market_to_customer_minutes = null;

                if (distanceData && distanceData.status === 'OK') {
                    const elements = distanceData.rows[0].elements;
                    
                    // หาตำแหน่งใน destinations array
                    const marketKey = order.market_location ? 
                        `${order.market_location.latitude},${order.market_location.longitude}` : null;
                    const customerKey = order.customer_location ? 
                        `${order.customer_location.latitude},${order.customer_location.longitude}` : null;
                    
                    if (marketKey) {
                        const marketIndex = [...marketLocations.keys()].indexOf(marketKey);
                        if (marketIndex >= 0 && elements[marketIndex]?.status === 'OK') {
                            distance_to_market_km = Math.round((elements[marketIndex].distance.value / 1000) * 100) / 100;
                            duration_to_market_minutes = Math.round(elements[marketIndex].duration.value / 60);
                        }
                    }
                    
                    if (customerKey) {
                        const customerIndex = [...marketLocations.keys()].length + [...customerLocations.keys()].indexOf(customerKey);
                        if (customerIndex >= 0 && elements[customerIndex]?.status === 'OK') {
                            distance_to_customer_km = Math.round((elements[customerIndex].distance.value / 1000) * 100) / 100;
                            duration_to_customer_minutes = Math.round(elements[customerIndex].duration.value / 60);
                        }
                    }

                    // คำนวณระยะทางจากร้านไปลูกค้า
                    if (order.market_location?.latitude && order.customer_location?.latitude) {
                        market_to_customer_km = calculateHaversineDistance(
                            parseFloat(order.market_location.latitude),
                            parseFloat(order.market_location.longitude),
                            parseFloat(order.customer_location.latitude),
                            parseFloat(order.customer_location.longitude)
                        );
                        market_to_customer_minutes = Math.round(market_to_customer_km * 2.5); // ประมาณ 2.5 นาที/กม.
                    }
                } else {
                    // ใช้การคำนวณ Haversine เป็นทางเลือก
                    if (order.market_location?.latitude && order.market_location?.longitude) {
                        distance_to_market_km = calculateHaversineDistance(
                            parseFloat(rider_latitude),
                            parseFloat(rider_longitude),
                            parseFloat(order.market_location.latitude),
                            parseFloat(order.market_location.longitude)
                        );
                        duration_to_market_minutes = Math.round(distance_to_market_km * 3); // ประมาณ 3 นาที/กม.
                    }
                    
                    if (order.customer_location?.latitude && order.customer_location?.longitude) {
                        distance_to_customer_km = calculateHaversineDistance(
                            parseFloat(rider_latitude),
                            parseFloat(rider_longitude),
                            parseFloat(order.customer_location.latitude),
                            parseFloat(order.customer_location.longitude)
                        );
                        duration_to_customer_minutes = Math.round(distance_to_customer_km * 3);
                    }

                    if (order.market_location?.latitude && order.customer_location?.latitude) {
                        market_to_customer_km = calculateHaversineDistance(
                            parseFloat(order.market_location.latitude),
                            parseFloat(order.market_location.longitude),
                            parseFloat(order.customer_location.latitude),
                            parseFloat(order.customer_location.longitude)
                        );
                        market_to_customer_minutes = Math.round(market_to_customer_km * 3);
                    }
                }

                return {
                    ...order,
                    // เพิ่มตำแหน่งไรเดอร์ปัจจุบัน
                    rider_current_location: {
                        latitude: parseFloat(rider_latitude),
                        longitude: parseFloat(rider_longitude),
                        timestamp: new Date().toISOString()
                    },
                    // ข้อมูลระยะทางและเวลา
                    distance_info: {
                        rider_to_market_km: distance_to_market_km,
                        rider_to_customer_km: distance_to_customer_km,
                        market_to_customer_km: market_to_customer_km,
                        duration_to_market_minutes: duration_to_market_minutes,
                        duration_to_customer_minutes: duration_to_customer_minutes,
                        market_to_customer_minutes: market_to_customer_minutes,
                        calculation_method: distanceData ? 'google_maps' : 'haversine',
                        total_delivery_time_minutes: duration_to_market_minutes && market_to_customer_minutes ? 
                            duration_to_market_minutes + market_to_customer_minutes : null
                    },
                    // สรุปข้อมูลสำหรับไรเดอร์
                    delivery_summary: {
                        total_distance_km: distance_to_market_km && market_to_customer_km ? 
                            Math.round((distance_to_market_km + market_to_customer_km) * 100) / 100 : null,
                        estimated_total_time_minutes: duration_to_market_minutes && market_to_customer_minutes ? 
                            duration_to_market_minutes + market_to_customer_minutes : null,
                        is_available_for_pickup: order.rider_id === null && order.status === 'confirmed',
                        is_assigned_to_rider: order.rider_id !== null,
                        priority_score: distance_to_market_km ? Math.round(100 / distance_to_market_km) : 0 // คะแนนความสำคัญ (ยิ่งใกล้ยิ่งสูง)
                    }
                };
            });

            // เรียงลำดับใหม่ตามระยะทาง
            enhancedData.sort((a, b) => {
                // ออเดอร์ใหม่ขึ้นก่อน
                if (a.delivery_summary.is_available_for_pickup !== b.delivery_summary.is_available_for_pickup) {
                    return b.delivery_summary.is_available_for_pickup - a.delivery_summary.is_available_for_pickup;
                }
                // แล้วเรียงตามระยะทาง
                if (a.distance_info.rider_to_market_km && b.distance_info.rider_to_market_km) {
                    return a.distance_info.rider_to_market_km - b.distance_info.rider_to_market_km;
                }
                return 0;
            });

            console.log(`✅ Enhanced ${enhancedData.length} orders with distance calculations`);
        }

        const responseData = {
            success: true,
            data: enhancedData,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            },
            rider_info: rider_latitude && rider_longitude ? {
                current_position: {
                    latitude: parseFloat(rider_latitude),
                    longitude: parseFloat(rider_longitude),
                    timestamp: new Date().toISOString()
                },
                location_provided: true,
                google_maps_enabled: !!process.env.GOOGLE_MAPS_API_KEY
            } : {
                location_provided: false,
                note: "ส่งพารามิเตอร์ rider_latitude และ rider_longitude เพื่อคำนวณระยะทางและเวลา",
                google_maps_enabled: !!process.env.GOOGLE_MAPS_API_KEY
            }
        };

        console.log(`📤 Sending response with ${enhancedData.length} orders`);
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