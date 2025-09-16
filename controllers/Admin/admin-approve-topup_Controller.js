const pool = require('../../config/db');

/**
 * ระบบจัดการการเติมเงิน GP สำหรับแอดมิน
 * 
 * ข้อมูลที่ควรแสดงสำหรับแอดมิน:
 * - topup_id: รหัสการเติมเงิน
 * - user_id: รหัสผู้ใช้
 * - rider_info: ข้อมูลไรเดอร์ (ชื่อ, เบอร์โทร, อีเมล)
 * - amount: จำนวนเงินที่เติม
 * - slip_url: รูปสลิปการโอนเงิน
 * - status: สถานะ (pending, approved, rejected)
 * - rejection_reason: เหตุผลการปฏิเสธ
 * - admin_id: รหัสแอดมินที่ดำเนินการ
 * - created_at: วันที่สร้างคำขอ
 * - approved_at: วันที่อนุมัติ/ปฏิเสธ
 * - updated_at: วันที่อัปเดตล่าสุด
 */

// ดึงข้อมูลการเติมเงิน (Top-up) GP ทั้งหมด
exports.adminGetAllRiderTopUps = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.user_id,
                rt.rider_id,
                rt.amount,
                rt.slip_url,
                rt.status,
                rt.rejection_reason,
                rt.admin_id,
                rt.created_at,
                rt.approved_at,
                rt.updated_at,
                u.display_name as rider_username,
                u.email as rider_email,
                u.phone as rider_phone,
                rp.id_card_number,
                rp.vehicle_registration_number
            FROM rider_topups rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            ORDER BY rt.created_at DESC
        `);

        res.json({
            success: true,
            message: 'ดึงข้อมูลการเติมเงินทั้งหมดสำเร็จ',
            data: {
                topups: result.rows,
                total_count: result.rowCount
            }
        });
    } catch (err) {
        console.error('Error in adminGetAllRiderTopUps:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// ดึงข้อมูลการเติมเงิน (Top-up) GP ที่รอการอนุมัติ
exports.adminGetPendingRiderTopUps = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.user_id,
                rt.rider_id,
                rt.amount,
                rt.slip_url,
                rt.status,
                rt.created_at,
                u.display_name as rider_username,
                u.email as rider_email,
                u.phone as rider_phone,
                rp.id_card_number,
                rp.vehicle_registration_number
            FROM rider_topups rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            WHERE rt.status = 'pending'
            ORDER BY rt.created_at ASC
        `);

        res.json({
            success: true,
            message: 'ดึงข้อมูลการเติมเงินที่รอการอนุมัติสำเร็จ',
            data: {
                pending_topups: result.rows,
                pending_count: result.rowCount
            }
        });
    } catch (err) {
        console.error('Error in adminGetPendingRiderTopUps:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// ดึงข้อมูลการเติมเงิน (Top-up) GP ที่อนุมัติแล้ว
exports.adminGetApprovedRiderTopUps = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.user_id,
                rt.rider_id,
                rt.amount,
                rt.slip_url,
                rt.status,
                rt.admin_id,
                rt.approved_at,
                rt.created_at,
                u.display_name as rider_username,
                u.email as rider_email,
                u.phone as rider_phone,
                rp.id_card_number,
                rp.vehicle_registration_number,
                admin.username as admin_username
            FROM rider_topups rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            LEFT JOIN admins admin ON rt.admin_id = admin.id
            WHERE rt.status = 'approved'
            ORDER BY rt.approved_at DESC
        `);

        res.json({
            success: true,
            message: 'ดึงข้อมูลการเติมเงินที่อนุมัติแล้วสำเร็จ',
            data: {
                approved_topups: result.rows,
                approved_count: result.rowCount
            }
        });
    } catch (err) {
        console.error('Error in adminGetApprovedRiderTopUps:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// ดึงข้อมูลการเติมเงิน (Top-up) GP ที่ถูกปฏิเสธ
exports.adminGetRejectedRiderTopUps = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.user_id,
                rt.rider_id,
                rt.amount,
                rt.slip_url,
                rt.status,
                rt.rejection_reason,
                rt.admin_id,
                rt.updated_at,
                rt.created_at,
                u.display_name as rider_username,
                u.email as rider_email,
                u.phone as rider_phone,
                rp.id_card_number,
                rp.vehicle_registration_number,
                admin.username as admin_username
            FROM rider_topups rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            LEFT JOIN admins admin ON rt.admin_id = admin.id
            WHERE rt.status = 'rejected'
            ORDER BY rt.updated_at DESC
        `);

        res.json({
            success: true,
            message: 'ดึงข้อมูลการเติมเงินที่ถูกปฏิเสธสำเร็จ',
            data: {
                rejected_topups: result.rows,
                rejected_count: result.rowCount
            }
        });
    } catch (err) {
        console.error('Error in adminGetRejectedRiderTopUps:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// แอดมินอนุมัติการเติมเงิน (Top-up) GP ของไรเดอร์
exports.adminApproveRiderTopUp = async (req, res) => {
    const { topup_id } = req.params;
    
    // Debug logs
    console.log('=== Admin Approve TopUp Debug ===');
    console.log('req.body:', req.body);
    console.log('req.params:', req.params);
    console.log('req.user:', req.user);
    
    // ตรวจสอบว่า req.body มีค่าหรือไม่
    if (!req.body) {
        return res.status(400).json({ 
            success: false, 
            error: 'ไม่พบข้อมูลในการร้องขอ กรุณาส่ง JSON body พร้อม status และ rejection_reason (หากจำเป็น)' 
        });
    }

    const { status, rejection_reason } = req.body;
    const admin_id = req.user.id; // ดึง admin_id จาก JWT token

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!status) {
        return res.status(400).json({ 
            success: false, 
            error: 'กรุณาระบุสถานะ (status) ในการร้องขอ' 
        });
    }

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ 
            success: false, 
            error: 'สถานะไม่ถูกต้อง (ต้องเป็น approved หรือ rejected)' 
        });
    }

    if (status === 'rejected' && !rejection_reason) {
        return res.status(400).json({ 
            success: false, 
            error: 'กรุณาระบุเหตุผลการปฏิเสธ' 
        });
    }

    try {
        await pool.query('BEGIN');

        // ตรวจสอบว่าคำขอเติมเงินมีอยู่และสถานะเป็น pending
        const checkTopup = await pool.query(
            'SELECT * FROM rider_topups WHERE topup_id = $1',
            [topup_id]
        );

        if (checkTopup.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                error: 'ไม่พบการเติมเงินที่ระบุ' 
            });
        }

        const topup = checkTopup.rows[0];

        if (topup.status !== 'pending') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                error: `การเติมเงินนี้ถูกดำเนินการแล้ว (สถานะปัจจุบัน: ${topup.status})` 
            });
        }

        // อัปเดตสถานะใน rider_topups
        const updateResult = await pool.query(
            `UPDATE rider_topups
             SET status = $1, admin_id = $2, rejection_reason = $3,
                 approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
                 updated_at = NOW()
             WHERE topup_id = $4
             RETURNING *`,
            [status, admin_id, rejection_reason || null, topup_id]
        );

        const updatedTopup = updateResult.rows[0];

        // ถ้าอนุมัติ → อัปเดต gp_balance ของ rider
        if (status === 'approved') {
            const balanceUpdate = await pool.query(
                `UPDATE rider_profiles
                 SET gp_balance = gp_balance + $1
                 WHERE user_id = $2
                 RETURNING gp_balance`,
                [topup.amount, topup.user_id]
            );

            if (balanceUpdate.rowCount === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({ 
                    success: false, 
                    error: 'ไม่พบข้อมูลไรเดอร์ในระบบ' 
                });
            }

            updatedTopup.new_balance = balanceUpdate.rows[0].gp_balance;
        }

        await pool.query('COMMIT');

        res.json({ 
            success: true, 
            message: `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}การเติมเงินสำเร็จ`, 
            data: {
                topup_id: updatedTopup.topup_id,
                user_id: updatedTopup.user_id,
                rider_id: updatedTopup.rider_id,
                amount: updatedTopup.amount,
                status: updatedTopup.status,
                admin_id: updatedTopup.admin_id,
                rejection_reason: updatedTopup.rejection_reason,
                approved_at: updatedTopup.approved_at,
                updated_at: updatedTopup.updated_at,
                ...(status === 'approved' && { new_balance: updatedTopup.new_balance })
            }
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error in adminApproveRiderTopUp:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// เพิ่มฟังก์ชันสำหรับดูสถิติการเติมเงินสำหรับแอดมิน
exports.adminGetTopUpStatistics = async (_req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_topups,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_approved_amount,
                COALESCE(AVG(CASE WHEN status = 'approved' THEN amount ELSE NULL END), 0) as avg_approved_amount,
                COUNT(DISTINCT rider_id) as unique_riders
            FROM rider_topups
        `);

        const recentActivity = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.rider_id,
                rt.amount,
                rt.status,
                rt.created_at,
                rt.updated_at,
                u.display_name as rider_username
            FROM rider_topups rt
            LEFT JOIN users u ON rt.user_id = u.user_id
            LEFT JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            ORDER BY rt.updated_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            message: 'ดึงสถิติการเติมเงินสำเร็จ',
            data: {
                statistics: stats.rows[0],
                recent_activity: recentActivity.rows
            }
        });
    } catch (err) {
        console.error('Error in adminGetTopUpStatistics:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};