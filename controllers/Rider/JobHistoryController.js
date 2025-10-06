const pool = require('../../config/db');

/**
 * ระบบประวัติงานสำหรับไรเดอร์ รายได้ และ gp ที่หักรวมอยู่ในไฟล์นี้
 * 
 * ฟังก์ชันต่าง ๆ:
 * - getJobHistory: ดูประวัติงานที่เสร็จแล้ว (completed, cancelled)
 * - getActiveOrders: ดูรายการออเดอร์ที่กำลังทำอยู่
 * - getAllOrdersAssigned: ดูออเดอร์ทั้งหมดที่ไรเดอร์รับมา
 * - getOrderStatistics: ดูสถิติการทำงาน
 */

// ดูประวัติการทำงานของไรเดอร์ทั้งหมด (เสร็จแล้ว)
exports.getJobHistory = async (req, res) => {
    const user_id = req.user.user_id; // ดึง user_id จาก JWT token (เหมือน rider-topup)
    
    try {
        console.log(`🔍 Fetching job history for user_id: ${user_id}`);
        
        // ดึง rider_id จาก rider_profiles ก่อน
        const riderResult = await pool.query(
            'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        // ดึงประวัติออเดอร์ที่เสร็จแล้ว
        const result = await pool.query(
            `SELECT 
                o.order_id,
                o.user_id as customer_id,
                o.market_id,
                o.rider_id,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                u.display_name,
                u.phone as customer_phone
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.rider_id = $1 AND o.status IN ('completed', 'cancelled')
            ORDER BY o.created_at DESC`, 
            [rider_id]
        );

        console.log(`📋 Job history for rider ${rider_id}: ${result.rows.length} orders found`);

        // สรุปสถิติ
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as total_earnings_noBonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as total_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance
            FROM orders 
            WHERE rider_id = $1 AND status IN ('completed', 'cancelled')`,
            [rider_id]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: {
                rider_id: rider_id,
                user_id: user_id,
                job_history: result.rows,
                statistics: stats.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching job history:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};


// ดูประวัติการทำงานของไรเดอร์วันนี้ (เสร็จแล้ว)
// exports.getTodayJobHistory = async (req, res) => {
//     const user_id = req.user.user_id;
    
//     try {
//         console.log(`📅 Fetching today's job history for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // ดึงออเดอร์วันนี้ที่เสร็จแล้ว
//         const result = await pool.query(
//             `SELECT 
//                 o.order_id,
//                 o.user_id as customer_id,
//                 o.market_id,
//                 o.rider_id,
//                 o.payment_method,
//                 o.note,
//                 o.distance_km,
//                 o.delivery_fee,
//                 o.bonus,
//                 o.total_price,
//                 o.status,
//                 o.shop_status,
//                 o.rider_required_gp,
//                 o.created_at,
//                 o.updated_at,
//                 m.shop_name,
//                 m.address as shop_address,
//                 u.display_name,
//                 u.phone as customer_phone
//             FROM orders o
//             LEFT JOIN markets m ON o.market_id = m.market_id
//             LEFT JOIN users u ON o.user_id = u.user_id
//             WHERE o.rider_id = $1 
//                 AND o.status IN ('completed', 'cancelled')
//                 AND DATE(o.created_at) = CURRENT_DATE
//             ORDER BY o.created_at DESC`, 
//             [rider_id]
//         );

//         // สรุปสถิติวันนี้
//         const stats = await pool.query(
//             `SELECT 
//                 COUNT(*) as total_jobs_today,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_today,
//                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_today,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as today_earnings_noBonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as today_bonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_today,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_today 
//             FROM orders 
//             WHERE rider_id = $1 
//                 AND status IN ('completed', 'cancelled')
//                 AND DATE(created_at) = CURRENT_DATE`,
//             [rider_id]
//         );

//         console.log(`📋 Today's job history for rider ${rider_id}: ${result.rows.length} orders found`);

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 today_jobs: result.rows,
//                 today_statistics: stats.rows[0]
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching today job history:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };

// ดูประวัติการทำงานของไรเดอร์เดือนนี้ (เสร็จแล้ว)
// exports.getThisMonthJobHistory = async (req, res) => {
//     const user_id = req.user.user_id;
    
//     try {
//         console.log(`📅 Fetching this month's job history for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // ดึงออเดอร์เดือนนี้ที่เสร็จแล้ว
//         const result = await pool.query(
//             `SELECT 
//                 o.order_id,
//                 o.user_id as customer_id,
//                 o.market_id,
//                 o.rider_id,
//                 o.payment_method,
//                 o.note,
//                 o.distance_km,
//                 o.delivery_fee,
//                 o.bonus,
//                 o.total_price,
//                 o.status,
//                 o.shop_status,
//                 o.rider_required_gp,
//                 o.created_at,
//                 o.updated_at,
//                 m.shop_name,
//                 m.address as shop_address,
//                 u.display_name,
//                 u.phone as customer_phone
//             FROM orders o
//             LEFT JOIN markets m ON o.market_id = m.market_id
//             LEFT JOIN users u ON o.user_id = u.user_id
//             WHERE o.rider_id = $1 
//                 AND o.status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', CURRENT_DATE)
//             ORDER BY o.created_at DESC`, 
//             [rider_id]
//         );

//         // สรุปสถิติเดือนนี้
//         const stats = await pool.query(
//             `SELECT 
//                 COUNT(*) as total_jobs_this_month,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_this_month,
//                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_this_month,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as month_earnings_noBonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as month_bonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_month,
//                 COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_month
//             FROM orders 
//             WHERE rider_id = $1 
//                 AND status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
//             [rider_id]
//         );

//         // สรุปสถิติรายวันในเดือนนี้
//         const dailyStats = await pool.query(
//             `SELECT 
//                 DATE(created_at) as date,
//                 COUNT(*) as orders_count,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings
//             FROM orders 
//             WHERE rider_id = $1 
//                 AND status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
//             GROUP BY DATE(created_at)
//             ORDER BY DATE(created_at) DESC`,
//             [rider_id]
//         );

//         console.log(`📋 This month's job history for rider ${rider_id}: ${result.rows.length} orders found`);

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             month: new Date().toISOString().slice(0, 7), // YYYY-MM
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 month_jobs: result.rows,
//                 month_statistics: stats.rows[0],
//                 daily_breakdown: dailyStats.rows
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching this month job history:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };

// ดูประวัติการทำงานของไรเดอร์ปีนี้ (เสร็จแล้ว)
// exports.getThisYearJobHistory = async (req, res) => {
//     const user_id = req.user.user_id;
    
//     try {
//         console.log(`📅 Fetching this year's job history for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // ดึงออเดอร์ปีนี้ที่เสร็จแล้ว
//         const result = await pool.query(
//             `SELECT 
//                 o.order_id,
//                 o.user_id as customer_id,
//                 o.market_id,
//                 o.rider_id,
//                 o.payment_method,
//                 o.note,
//                 o.distance_km,
//                 o.delivery_fee,
//                 o.bonus,
//                 o.total_price,
//                 o.status,
//                 o.shop_status,
//                 o.rider_required_gp,
//                 o.created_at,
//                 o.updated_at,
//                 m.shop_name,
//                 m.address as shop_address,
//                 u.display_name,
//                 u.phone as customer_phone
//             FROM orders o
//             LEFT JOIN markets m ON o.market_id = m.market_id
//             LEFT JOIN users u ON o.user_id = u.user_id
//             WHERE o.rider_id = $1 
//                 AND o.status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('year', o.created_at) = DATE_TRUNC('year', CURRENT_DATE)
//             ORDER BY o.created_at DESC`, 
//             [rider_id]
//         );

//         // สรุปสถิติปีนี้
//         const stats = await pool.query(
//             `SELECT 
//                 COUNT(*) as total_jobs_this_year,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_this_year,
//                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_this_year,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as year_earnings_noBonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as year_bonus,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_year,
//                 COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee ELSE NULL END), 0) as avg_earnings_per_job,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_year,
//                 COALESCE(AVG(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE NULL END), 0) as avg_distance_per_job
//             FROM orders 
//             WHERE rider_id = $1 
//                 AND status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)`,
//             [rider_id]
//         );

//         // สรุปสถิติรายเดือนในปีนี้
//         const monthlyStats = await pool.query(
//             `SELECT 
//                 DATE_TRUNC('month', created_at) as month,
//                 COUNT(*) as orders_count,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as monthly_earnings
//             FROM orders 
//             WHERE rider_id = $1 
//                 AND status IN ('completed', 'cancelled')
//                 AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
//             GROUP BY DATE_TRUNC('month', created_at)
//             ORDER BY DATE_TRUNC('month', created_at) DESC`,
//             [rider_id]
//         );

//         console.log(`📋 This year's job history for rider ${rider_id}: ${result.rows.length} orders found`);

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             year: new Date().getFullYear(),
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 year_jobs: result.rows,
//                 year_statistics: stats.rows[0],
//                 monthly_breakdown: monthlyStats.rows
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching this year job history:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };


// ดูรายการออเดอร์ที่กำลังทำอยู่
// exports.getActiveOrders = async (req, res) => {
//     const user_id = req.user.user_id;
    
//     try {
//         console.log(`🔍 Fetching active orders for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // ดึงออเดอร์ที่กำลังทำอยู่
//         const result = await pool.query(
//             `SELECT 
//                 o.order_id,
//                 o.user_id as customer_id,
//                 o.market_id,
//                 o.rider_id,
//                 o.address,
//                 o.delivery_type,
//                 o.payment_method,
//                 o.note,
//                 o.distance_km,
//                 o.delivery_fee,
//                 o.total_price,
//                 o.status,
//                 o.shop_status,
//                 o.rider_required_gp,
//                 o.created_at,
//                 o.updated_at,
//                 m.shop_name,
//                 m.address as shop_address,
//                 m.latitude as shop_latitude,
//                 m.longitude as shop_longitude,
//                 u.display_name,
//                 u.phone as customer_phone,
//                 ca.latitude as customer_latitude,
//                 ca.longitude as customer_longitude
//             FROM orders o
//             LEFT JOIN markets m ON o.market_id = m.market_id
//             LEFT JOIN users u ON o.user_id = u.user_id
//             LEFT JOIN client_addresses ca ON o.address_id = ca.id
//             WHERE o.rider_id = $1 AND o.status NOT IN ('completed', 'cancelled')
//             ORDER BY o.created_at ASC`, 
//             [rider_id]
//         );

//         console.log(`🚚 Active orders for rider ${rider_id}: ${result.rows.length} orders found`);

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 active_orders: result.rows
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching active orders:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };

// ดูออเดอร์ทั้งหมดที่ไรเดอร์รับมา (ทุกสถานะ)
// exports.getAllOrdersAssigned = async (req, res) => {
//     const user_id = req.user.user_id;
//     const { limit = 50, offset = 0, status } = req.query;
    
//     try {
//         console.log(`🔍 Fetching all assigned orders for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // สร้าง WHERE condition
//         let whereCondition = 'WHERE o.rider_id = $1';
//         const queryParams = [rider_id];
        
//         if (status) {
//             whereCondition += ' AND o.status = $2';
//             queryParams.push(status);
//         }

//         // ดึงออเดอร์ทั้งหมด
//         const result = await pool.query(
//             `SELECT 
//                 o.order_id,
//                 o.user_id as customer_id,
//                 o.market_id,
//                 o.rider_id,
//                 o.address,
//                 o.delivery_type,
//                 o.payment_method,
//                 o.note,
//                 o.distance_km,
//                 o.delivery_fee,
//                 o.total_price,
//                 o.status,
//                 o.shop_status,
//                 o.rider_required_gp,
//                 o.created_at,
//                 o.updated_at,
//                 m.shop_name,
//                 m.address as shop_address,
//                 u.display_name,
//                 u.phone as customer_phone
//             FROM orders o
//             LEFT JOIN markets m ON o.market_id = m.market_id
//             LEFT JOIN users u ON o.user_id = u.user_id
//             ${whereCondition}
//             ORDER BY o.created_at DESC
//             LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`, 
//             [...queryParams, parseInt(limit), parseInt(offset)]
//         );

//         console.log(`📦 All assigned orders for rider ${rider_id}: ${result.rows.length} orders found`);

//         // สรุปสถิติทั้งหมด
//         const stats = await pool.query(
//             `SELECT 
//                 COUNT(*) as total_assigned,
//                 COUNT(CASE WHEN status = 'rider_assigned' THEN 1 END) as assigned_orders,
//                 COUNT(CASE WHEN status = 'going_to_shop' THEN 1 END) as going_to_shop,
//                 COUNT(CASE WHEN status = 'arrived_at_shop' THEN 1 END) as arrived_at_shop,
//                 COUNT(CASE WHEN status = 'picked_up' THEN 1 END) as picked_up,
//                 COUNT(CASE WHEN status = 'delivering' THEN 1 END) as delivering,
//                 COUNT(CASE WHEN status = 'arrived_at_customer' THEN 1 END) as arrived_at_customer,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
//                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as total_earnings
//             FROM orders 
//             WHERE rider_id = $1`,
//             [rider_id]
//         );

//         return res.status(200).json({
//             success: true,
//             count: result.rows.length,
//             pagination: {
//                 limit: parseInt(limit),
//                 offset: parseInt(offset),
//                 total: parseInt(stats.rows[0].total_assigned)
//             },
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 all_orders: result.rows,
//                 statistics: stats.rows[0]
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching all assigned orders:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };

// ดูสถิติการทำงานของไรเดอร์
// exports.getOrderStatistics = async (req, res) => {
//     const user_id = req.user.user_id;
    
//     try {
//         console.log(`📊 Fetching order statistics for user_id: ${user_id}`);
        
//         // ดึง rider_id จาก rider_profiles
//         const riderResult = await pool.query(
//             'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
//             [user_id]
//         );

//         if (riderResult.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
//             });
//         }

//         const rider_id = riderResult.rows[0].rider_id;

//         // สรุปสถิติรายวัน (7 วันล่าสุด)
//         const dailyStats = await pool.query(
//             `SELECT 
//                 DATE(created_at) as date,
//                 COUNT(*) as orders_count,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings
//             FROM orders 
//             WHERE rider_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
//             GROUP BY DATE(created_at)
//             ORDER BY DATE(created_at) DESC`,
//             [rider_id]
//         );

//         // สรุปสถิติรายเดือน (6 เดือนล่าสุด)
//         const monthlyStats = await pool.query(
//             `SELECT 
//                 DATE_TRUNC('month', created_at) as month,
//                 COUNT(*) as orders_count,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as monthly_earnings
//             FROM orders 
//             WHERE rider_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 months'
//             GROUP BY DATE_TRUNC('month', created_at)
//             ORDER BY DATE_TRUNC('month', created_at) DESC`,
//             [rider_id]
//         );

//         // สรุปสถิติทั้งหมด
//         const overallStats = await pool.query(
//             `SELECT 
//                 COUNT(*) as total_orders,
//                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_completed,
//                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as total_cancelled,
//                 COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as total_earnings,
//                 COALESCE(AVG(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE NULL END), 0) as avg_distance,
//                 COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee ELSE NULL END), 0) as avg_earnings_per_order
//             FROM orders 
//             WHERE rider_id = $1`,
//             [rider_id]
//         );

//         return res.status(200).json({
//             success: true,
//             data: {
//                 rider_id: rider_id,
//                 user_id: user_id,
//                 daily_statistics: dailyStats.rows,
//                 monthly_statistics: monthlyStats.rows,
//                 overall_statistics: overallStats.rows[0]
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching order statistics:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
//         });
//     }
// };

// ดูประวัติการทำงานของไรเดอร์ในวันที่เลือก
exports.getJobHistoryByDate = async (req, res) => {
    const user_id = req.user.user_id;
    const { date } = req.query; // รับวันที่จาก query parameter (format: YYYY-MM-DD)
    
    try {
        console.log(`📅 Fetching job history for user_id: ${user_id}, date: ${date}`);
        
        // ตรวจสอบรูปแบบวันที่
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุวันที่ (format: YYYY-MM-DD)',
                example: '?date=2025-10-05'
            });
        }

        // ตรวจสอบรูปแบบวันที่ว่าถูกต้องหรือไม่
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้รูปแบบ YYYY-MM-DD',
                example: '?date=2025-10-05'
            });
        }

        // ตรวจสอบว่าวันที่เป็นวันที่ที่ถูกต้องหรือไม่
        const inputDate = new Date(date);
        if (isNaN(inputDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'วันที่ไม่ถูกต้อง',
                example: '?date=2025-10-05'
            });
        }

        // ดึง rider_id จาก rider_profiles
        const riderResult = await pool.query(
            'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        // ดึงออเดอร์ในวันที่เลือกที่เสร็จแล้ว
        const result = await pool.query(
            `SELECT 
                o.order_id,
                o.user_id as customer_id,
                o.market_id,
                o.rider_id,
                o.address,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                u.display_name,
                u.phone as customer_phone
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE(o.created_at) = $2
            ORDER BY o.created_at DESC`, 
            [rider_id, date]
        );

        // สรุปสถิติของวันที่เลือก
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_selected_date,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_selected_date,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_selected_date,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as selected_date_earnings_noBonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as selected_date_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_selected_date,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_selected_date,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as total_gp_deducted_selected_date,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job_selected_date
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) = $2`,
            [rider_id, date]
        );

        // เปรียบเทียบกับวันก่อนหน้า
        const previousDate = new Date(inputDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split('T')[0];

        const previousStats = await pool.query(
            `SELECT 
                COUNT(*) as previous_day_jobs,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as previous_day_earnings
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) = $2`,
            [rider_id, previousDateStr]
        );

        console.log(`📋 Job history for rider ${rider_id} on ${date}: ${result.rows.length} orders found`);

        // คำนวณการเปรียบเทียบ
        const currentEarnings = parseFloat(stats.rows[0].total_earnings_selected_date) || 0;
        const previousEarnings = parseFloat(previousStats.rows[0].previous_day_earnings) || 0;
        const earningsChange = currentEarnings - previousEarnings;
        const earningsChangePercent = previousEarnings > 0 ? ((earningsChange / previousEarnings) * 100) : 0;

        const currentJobs = parseInt(stats.rows[0].total_jobs_selected_date) || 0;
        const previousJobs = parseInt(previousStats.rows[0].previous_day_jobs) || 0;
        const jobsChange = currentJobs - previousJobs;

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            selected_date: date,
            data: {
                rider_id: rider_id,
                user_id: user_id,
                selected_date_jobs: result.rows,
                selected_date_statistics: stats.rows[0],
                comparison_with_previous_day: {
                    previous_date: previousDateStr,
                    earnings_change: earningsChange.toFixed(2),
                    earnings_change_percent: earningsChangePercent.toFixed(2),
                    jobs_change: jobsChange,
                    previous_day_earnings: previousStats.rows[0].previous_day_earnings,
                    previous_day_jobs: previousStats.rows[0].previous_day_jobs
                }
            }
        });
    } catch (error) {
        console.error('Error fetching job history by date:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูประวัติการทำงานของไรเดอร์ในเดือนที่เลือก
exports.getJobHistoryByMonth = async (req, res) => {
    const user_id = req.user.user_id;
    const { month, year } = req.query; // รับเดือนและปีจาก query parameter (format: month=10&year=2025)

    try {
        console.log(`📅 Fetching job history for user_id: ${user_id}, month: ${month}, year: ${year}`);

        // ตรวจสอบพารามิเตอร์
        if (!month || !year) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุเดือนและปีที่ต้องการดูประวัติการทำงาน',
                example: '?month=10&year=2025'
            });
        }

        // ตรวจสอบรูปแบบเดือนและปี
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                error: 'เดือนต้องอยู่ระหว่าง 1-12',
                example: '?month=10&year=2025'
            });
        }

        if (yearNum < 2020 || yearNum > new Date().getFullYear() + 1) {
            return res.status(400).json({
                success: false,
                error: 'ปีไม่ถูกต้อง',
                example: '?month=10&year=2025'
            });
        }

        // ดึง rider_id จาก rider_profiles
        const riderResult = await pool.query(
            'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        // สร้างวันที่เริ่มต้นและสิ้นสุดของเดือน
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0]; // วันสุดท้ายของเดือน

        // ดึงออเดอร์ในเดือนที่เลือกที่เสร็จแล้ว
        const result = await pool.query(
            `SELECT 
                o.order_id,
                o.user_id as customer_id,
                o.market_id,
                o.rider_id,
                o.address,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                u.display_name,
                u.phone as customer_phone
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE(o.created_at) >= $2
                AND DATE(o.created_at) <= $3
            ORDER BY o.created_at DESC`, 
            [rider_id, startDate, endDate]
        );

        // สรุปสถิติของเดือนที่เลือก
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_selected_month,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_selected_month,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_selected_month,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as selected_month_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as selected_month_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_selected_month,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_selected_month,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as total_gp_deducted_selected_month,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job_selected_month
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3`,
            [rider_id, startDate, endDate]
        );

        // สรุปสถิติรายวันในเดือนที่เลือก
        const dailyBreakdown = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as daily_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as daily_total_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as daily_gp_deducted
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC`,
            [rider_id, startDate, endDate]
        );

        // เปรียบเทียบกับเดือนก่อนหน้า
        const previousMonth = monthNum === 1 ? 12 : monthNum - 1;
        const previousYear = monthNum === 1 ? yearNum - 1 : yearNum;
        const previousStartDate = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
        const previousEndDate = new Date(previousYear, previousMonth, 0).toISOString().split('T')[0];

        const previousStats = await pool.query(
            `SELECT 
                COUNT(*) as previous_month_jobs,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as previous_month_earnings
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3`,
            [rider_id, previousStartDate, previousEndDate]
        );

        console.log(`📋 Job history for rider ${rider_id} in ${month}/${year}: ${result.rows.length} orders found`);

        // คำนวณการเปรียบเทียบ
        const currentEarnings = parseFloat(stats.rows[0].total_earnings_selected_month) || 0;
        const previousEarnings = parseFloat(previousStats.rows[0].previous_month_earnings) || 0;
        const earningsChange = currentEarnings - previousEarnings;
        const earningsChangePercent = previousEarnings > 0 ? ((earningsChange / previousEarnings) * 100) : 0;

        const currentJobs = parseInt(stats.rows[0].total_jobs_selected_month) || 0;
        const previousJobs = parseInt(previousStats.rows[0].previous_month_jobs) || 0;
        const jobsChange = currentJobs - previousJobs;

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            selected_month: {
                month: monthNum,
                year: yearNum,
                month_name: new Date(yearNum, monthNum - 1).toLocaleString('th-TH', { month: 'long' }),
                start_date: startDate,
                end_date: endDate
            },
            data: {
                rider_id: rider_id,
                user_id: user_id,
                selected_month_jobs: result.rows,
                selected_month_statistics: stats.rows[0],
                daily_breakdown: dailyBreakdown.rows,
                comparison_with_previous_month: {
                    previous_month: previousMonth,
                    previous_year: previousYear,
                    earnings_change: earningsChange.toFixed(2),
                    earnings_change_percent: earningsChangePercent.toFixed(2),
                    jobs_change: jobsChange,
                    previous_month_earnings: previousStats.rows[0].previous_month_earnings,
                    previous_month_jobs: previousStats.rows[0].previous_month_jobs
                }
            }
        });
    } catch (error) {
        console.error('Error fetching job history by month:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูประวัติการทำงานของไรเดอร์ในปีที่เลือก
exports.getJobHistoryByYear = async (req, res) => {
    const user_id = req.user.user_id;
    const { year } = req.query; // รับปีจาก query parameter (format: year=2025)

    try {
        console.log(`📅 Fetching job history for user_id: ${user_id}, year: ${year}`);

        // ตรวจสอบพารามิเตอร์
        if (!year) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุปีที่ต้องการดูประวัติการทำงาน',
                example: '?year=2025'
            });
        }

        // ตรวจสอบรูปแบบปี
        const yearNum = parseInt(year);
        
        if (yearNum < 2020 || yearNum > new Date().getFullYear() + 1) {
            return res.status(400).json({
                success: false,
                error: 'ปีไม่ถูกต้อง',
                example: '?year=2025'
            });
        }

        // ดึง rider_id จาก rider_profiles
        const riderResult = await pool.query(
            'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        // สร้างวันที่เริ่มต้นและสิ้นสุดของปี
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // ดึงออเดอร์ในปีที่เลือกที่เสร็จแล้ว
        const result = await pool.query(
            `SELECT 
                o.order_id,
                o.user_id as customer_id,
                o.market_id,
                o.rider_id,
                o.address,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                u.display_name,
                u.phone as customer_phone
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE(o.created_at) >= $2
                AND DATE(o.created_at) <= $3
            ORDER BY o.created_at DESC`, 
            [rider_id, startDate, endDate]
        );

        // สรุปสถิติของปีที่เลือก
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_selected_year,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_selected_year,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_selected_year,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as selected_year_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as selected_year_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_selected_year,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_selected_year,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as total_gp_deducted_selected_year,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job_selected_year,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE NULL END), 0) as avg_distance_per_job_selected_year
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3`,
            [rider_id, startDate, endDate]
        );

        // สรุปสถิติรายเดือนในปีที่เลือก
        const monthlyBreakdown = await pool.query(
            `SELECT 
                EXTRACT(MONTH FROM created_at) as month,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as monthly_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as monthly_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as monthly_total_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as monthly_gp_deducted
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3
            GROUP BY EXTRACT(MONTH FROM created_at)
            ORDER BY EXTRACT(MONTH FROM created_at) ASC`,
            [rider_id, startDate, endDate]
        );

        // เปรียบเทียบกับปีก่อนหน้า
        const previousYear = yearNum - 1;
        const previousStartDate = `${previousYear}-01-01`;
        const previousEndDate = `${previousYear}-12-31`;

        const previousStats = await pool.query(
            `SELECT 
                COUNT(*) as previous_year_jobs,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as previous_year_earnings
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3`,
            [rider_id, previousStartDate, previousEndDate]
        );

        console.log(`📋 Job history for rider ${rider_id} in year ${year}: ${result.rows.length} orders found`);

        // คำนวณการเปรียบเทียบ
        const currentEarnings = parseFloat(stats.rows[0].total_earnings_selected_year) || 0;
        const previousEarnings = parseFloat(previousStats.rows[0].previous_year_earnings) || 0;
        const earningsChange = currentEarnings - previousEarnings;
        const earningsChangePercent = previousEarnings > 0 ? ((earningsChange / previousEarnings) * 100) : 0;

        const currentJobs = parseInt(stats.rows[0].total_jobs_selected_year) || 0;
        const previousJobs = parseInt(previousStats.rows[0].previous_year_jobs) || 0;
        const jobsChange = currentJobs - previousJobs;

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            selected_year: {
                year: yearNum,
                start_date: startDate,
                end_date: endDate
            },
            data: {
                rider_id: rider_id,
                user_id: user_id,
                selected_year_jobs: result.rows,
                selected_year_statistics: stats.rows[0],
                monthly_breakdown: monthlyBreakdown.rows,
                comparison_with_previous_year: {
                    previous_year: previousYear,
                    earnings_change: earningsChange.toFixed(2),
                    earnings_change_percent: earningsChangePercent.toFixed(2),
                    jobs_change: jobsChange,
                    previous_year_earnings: previousStats.rows[0].previous_year_earnings,
                    previous_year_jobs: previousStats.rows[0].previous_year_jobs
                }
            }
        });
    } catch (error) {
        console.error('Error fetching job history by year:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};


// ดูประวัติการทำงานของไรเดอร์ในช่วงวันที่ (date range)
exports.getJobHistoryByDateRange = async (req, res) => {
    const user_id = req.user.user_id;
    const { start_date, end_date } = req.query; // รับช่วงวันที่จาก query parameter
    
    try {
        console.log(`📅 Fetching job history for user_id: ${user_id}, date range: ${start_date} to ${end_date}`);
        
        // ตรวจสอบพารามิเตอร์
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด',
                example: '?start_date=2025-10-01&end_date=2025-10-05'
            });
        }

        // ตรวจสอบรูปแบบวันที่
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
            return res.status(400).json({
                success: false,
                error: 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้รูปแบบ YYYY-MM-DD',
                example: '?start_date=2025-10-01&end_date=2025-10-05'
            });
        }

        // ตรวจสอบว่าวันที่เริ่มต้นไม่เกินวันที่สิ้นสุด
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        
        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'
            });
        }

        // ตรวจสอบช่วงวันที่ไม่เกิน 31 วัน
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 31) {
            return res.status(400).json({
                success: false,
                error: 'ช่วงวันที่ต้องไม่เกิน 31 วัน'
            });
        }

        // ดึง rider_id จาก rider_profiles
        const riderResult = await pool.query(
            'SELECT rider_id FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        // ดึงออเดอร์ในช่วงวันที่เลือก
        const result = await pool.query(
            `SELECT 
                o.order_id,
                o.user_id as customer_id,
                o.market_id,
                o.rider_id,
                o.address,
                o.delivery_type,
                o.payment_method,
                o.note,
                o.distance_km,
                o.delivery_fee,
                o.bonus,
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                u.display_name,
                u.phone as customer_phone
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE(o.created_at) >= $2
                AND DATE(o.created_at) <= $3
            ORDER BY o.created_at DESC`, 
            [rider_id, start_date, end_date]
        );

        // สรุปสถิติรวมของช่วงวันที่เลือก
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_date_range,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_date_range,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_date_range,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as date_range_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as date_range_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_date_range,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_date_range,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as total_gp_deducted_date_range,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job_date_range
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3`,
            [rider_id, start_date, end_date]
        );

        // สรุปสถิติรายวันในช่วงที่เลือก
        const dailyBreakdown = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings_no_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as daily_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as daily_total_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN rider_required_gp ELSE 0 END), 0) as daily_gp_deducted
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) >= $2
                AND DATE(created_at) <= $3
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC`,
            [rider_id, start_date, end_date]
        );

        console.log(`📋 Job history for rider ${rider_id} from ${start_date} to ${end_date}: ${result.rows.length} orders found`);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            date_range: {
                start_date: start_date,
                end_date: end_date,
                days_count: daysDiff + 1
            },
            data: {
                rider_id: rider_id,
                user_id: user_id,
                date_range_jobs: result.rows,
                date_range_statistics: stats.rows[0],
                daily_breakdown: dailyBreakdown.rows
            }
        });
    } catch (error) {
        console.error('Error fetching job history by date range:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

