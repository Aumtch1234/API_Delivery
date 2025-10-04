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
exports.getTodayJobHistory = async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        console.log(`📅 Fetching today's job history for user_id: ${user_id}`);
        
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

        // ดึงออเดอร์วันนี้ที่เสร็จแล้ว
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
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE(o.created_at) = CURRENT_DATE
            ORDER BY o.created_at DESC`, 
            [rider_id]
        );

        // สรุปสถิติวันนี้
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_today,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_today,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_today,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as today_earnings_noBonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as today_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_today,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_today 
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE(created_at) = CURRENT_DATE`,
            [rider_id]
        );

        console.log(`📋 Today's job history for rider ${rider_id}: ${result.rows.length} orders found`);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            data: {
                rider_id: rider_id,
                user_id: user_id,
                today_jobs: result.rows,
                today_statistics: stats.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching today job history:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูประวัติการทำงานของไรเดอร์เดือนนี้ (เสร็จแล้ว)
exports.getThisMonthJobHistory = async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        console.log(`📅 Fetching this month's job history for user_id: ${user_id}`);
        
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

        // ดึงออเดอร์เดือนนี้ที่เสร็จแล้ว
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
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', CURRENT_DATE)
            ORDER BY o.created_at DESC`, 
            [rider_id]
        );

        // สรุปสถิติเดือนนี้
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_this_month,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_this_month,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_this_month,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as month_earnings_noBonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as month_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_month,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE NULL END), 0) as avg_earnings_per_job,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_month
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
            [rider_id]
        );

        // สรุปสถิติรายวันในเดือนนี้
        const dailyStats = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC`,
            [rider_id]
        );

        console.log(`📋 This month's job history for rider ${rider_id}: ${result.rows.length} orders found`);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            month: new Date().toISOString().slice(0, 7), // YYYY-MM
            data: {
                rider_id: rider_id,
                user_id: user_id,
                month_jobs: result.rows,
                month_statistics: stats.rows[0],
                daily_breakdown: dailyStats.rows
            }
        });
    } catch (error) {
        console.error('Error fetching this month job history:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูประวัติการทำงานของไรเดอร์ปีนี้ (เสร็จแล้ว)
exports.getThisYearJobHistory = async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        console.log(`📅 Fetching this year's job history for user_id: ${user_id}`);
        
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

        // ดึงออเดอร์ปีนี้ที่เสร็จแล้ว
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
            WHERE o.rider_id = $1 
                AND o.status IN ('completed', 'cancelled')
                AND DATE_TRUNC('year', o.created_at) = DATE_TRUNC('year', CURRENT_DATE)
            ORDER BY o.created_at DESC`, 
            [rider_id]
        );

        // สรุปสถิติปีนี้
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_jobs_this_year,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_this_year,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs_this_year,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as year_earnings_noBonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN bonus ELSE 0 END), 0) as year_bonus,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee + bonus ELSE 0 END), 0) as total_earnings_year,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee ELSE NULL END), 0) as avg_earnings_per_job,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE 0 END), 0) as total_distance_year,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE NULL END), 0) as avg_distance_per_job
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)`,
            [rider_id]
        );

        // สรุปสถิติรายเดือนในปีนี้
        const monthlyStats = await pool.query(
            `SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as monthly_earnings
            FROM orders 
            WHERE rider_id = $1 
                AND status IN ('completed', 'cancelled')
                AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) DESC`,
            [rider_id]
        );

        console.log(`📋 This year's job history for rider ${rider_id}: ${result.rows.length} orders found`);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            year: new Date().getFullYear(),
            data: {
                rider_id: rider_id,
                user_id: user_id,
                year_jobs: result.rows,
                year_statistics: stats.rows[0],
                monthly_breakdown: monthlyStats.rows
            }
        });
    } catch (error) {
        console.error('Error fetching this year job history:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};


// ดูรายการออเดอร์ที่กำลังทำอยู่
exports.getActiveOrders = async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        console.log(`🔍 Fetching active orders for user_id: ${user_id}`);
        
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

        // ดึงออเดอร์ที่กำลังทำอยู่
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
                o.total_price,
                o.status,
                o.shop_status,
                o.rider_required_gp,
                o.created_at,
                o.updated_at,
                m.shop_name,
                m.address as shop_address,
                m.latitude as shop_latitude,
                m.longitude as shop_longitude,
                u.display_name,
                u.phone as customer_phone,
                ca.latitude as customer_latitude,
                ca.longitude as customer_longitude
            FROM orders o
            LEFT JOIN markets m ON o.market_id = m.market_id
            LEFT JOIN users u ON o.user_id = u.user_id
            LEFT JOIN client_addresses ca ON o.address_id = ca.id
            WHERE o.rider_id = $1 AND o.status NOT IN ('completed', 'cancelled')
            ORDER BY o.created_at ASC`, 
            [rider_id]
        );

        console.log(`🚚 Active orders for rider ${rider_id}: ${result.rows.length} orders found`);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: {
                rider_id: rider_id,
                user_id: user_id,
                active_orders: result.rows
            }
        });
    } catch (error) {
        console.error('Error fetching active orders:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูออเดอร์ทั้งหมดที่ไรเดอร์รับมา (ทุกสถานะ)
exports.getAllOrdersAssigned = async (req, res) => {
    const user_id = req.user.user_id;
    const { limit = 50, offset = 0, status } = req.query;
    
    try {
        console.log(`🔍 Fetching all assigned orders for user_id: ${user_id}`);
        
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

        // สร้าง WHERE condition
        let whereCondition = 'WHERE o.rider_id = $1';
        const queryParams = [rider_id];
        
        if (status) {
            whereCondition += ' AND o.status = $2';
            queryParams.push(status);
        }

        // ดึงออเดอร์ทั้งหมด
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
            ${whereCondition}
            ORDER BY o.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`, 
            [...queryParams, parseInt(limit), parseInt(offset)]
        );

        console.log(`📦 All assigned orders for rider ${rider_id}: ${result.rows.length} orders found`);

        // สรุปสถิติทั้งหมด
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_assigned,
                COUNT(CASE WHEN status = 'rider_assigned' THEN 1 END) as assigned_orders,
                COUNT(CASE WHEN status = 'going_to_shop' THEN 1 END) as going_to_shop,
                COUNT(CASE WHEN status = 'arrived_at_shop' THEN 1 END) as arrived_at_shop,
                COUNT(CASE WHEN status = 'picked_up' THEN 1 END) as picked_up,
                COUNT(CASE WHEN status = 'delivering' THEN 1 END) as delivering,
                COUNT(CASE WHEN status = 'arrived_at_customer' THEN 1 END) as arrived_at_customer,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as total_earnings
            FROM orders 
            WHERE rider_id = $1`,
            [rider_id]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: parseInt(stats.rows[0].total_assigned)
            },
            data: {
                rider_id: rider_id,
                user_id: user_id,
                all_orders: result.rows,
                statistics: stats.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching all assigned orders:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

// ดูสถิติการทำงานของไรเดอร์
exports.getOrderStatistics = async (req, res) => {
    const user_id = req.user.user_id;
    
    try {
        console.log(`📊 Fetching order statistics for user_id: ${user_id}`);
        
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

        // สรุปสถิติรายวัน (7 วันล่าสุด)
        const dailyStats = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as daily_earnings
            FROM orders 
            WHERE rider_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) DESC`,
            [rider_id]
        );

        // สรุปสถิติรายเดือน (6 เดือนล่าสุด)
        const monthlyStats = await pool.query(
            `SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as orders_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as monthly_earnings
            FROM orders 
            WHERE rider_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) DESC`,
            [rider_id]
        );

        // สรุปสถิติทั้งหมด
        const overallStats = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_completed,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as total_cancelled,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN delivery_fee ELSE 0 END), 0) as total_earnings,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN CAST(distance_km as DECIMAL) ELSE NULL END), 0) as avg_distance,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN delivery_fee ELSE NULL END), 0) as avg_earnings_per_order
            FROM orders 
            WHERE rider_id = $1`,
            [rider_id]
        );

        return res.status(200).json({
            success: true,
            data: {
                rider_id: rider_id,
                user_id: user_id,
                daily_statistics: dailyStats.rows,
                monthly_statistics: monthlyStats.rows,
                overall_statistics: overallStats.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching order statistics:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
        });
    }
};

