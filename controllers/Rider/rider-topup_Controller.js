const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../../utils/Rider/cloudinary');

/**
 * ระบบเติมเงิน GP (Game Point) สำหรับไรเดอร์
 * 
 * โครงสร้างข้อมูลในตาราง rider_topups:
 * - topup_id: รหัสการเติมเงิน (Primary Key)
 * - user_id: รหัสผู้ใช้ (Foreign Key จาก users table)
 * - amount: จำนวนเงินที่เติม (ทศนิยม 2 ตำแหน่ง)
 * - slip_url: URL รูปสลิปการโอนเงิน (จาก Cloudinary)
 * - status: สถานะ ('pending', 'approved', 'rejected')
 * - rejection_reason: เหตุผลการปฏิเสธ (หากถูกปฏิเสธ)
 * - admin_id: รหัสแอดมินที่อนุมัติ/ปฏิเสธ
 * - approved_at: วันที่อนุมัติ
 * - created_at: วันที่สร้างคำขอ
 * - updated_at: วันที่อัปเดตล่าสุด
 * 
 * การแสดงข้อมูลที่ควรมี:
 * - สำหรับไรเดอร์: topup_id, amount, status, slip_url, created_at, rejection_reason
 * - สำหรับแอดมิน: topup_id, user_id, amount, slip_url, status, created_at, admin_id, approved_at, rejection_reason
 */

// ไรเดอร์ส่งดูจำนวน GP คงเหลือ (ที่เก็บใน rider_profiles)
exports.getRiderGPBalance = async (req, res) => {
    const user_id = req.user.user_id; // ดึง user_id จาก JWT token

    try {
        const result = await pool.query(
            'SELECT rider_id, gp_balance FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้'
            });
        }

        const { rider_id, gp_balance } = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                user_id,
                rider_id,
                gp_balance
            }
        });
    } catch (error) {
        console.error('Error fetching GP balance:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล GP คงเหลือ'
        });
    }
};

// ไรเดอร์เติมเงิน (Top-up) GP
exports.riderTopUp = async (req, res) => {
    try {
        console.log('=== Topup API Called ===');
        console.log('req.user:', req.user);
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        
        const { amount, slip_url } = req.body;
        const user_id = req.user.user_id; // ดึง user_id จาก JWT token

        console.log('Extracted data:', { amount, slip_url, user_id });

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!amount) {
            console.log('Error: No amount provided');
            return res.status(400).json({
                success: false,
                error: 'กรุณากรอกจำนวนเงินที่ต้องการเติม'
            });
        }

        // ตรวจสอบจำนวนเงินที่เติม
        if (amount <= 0) {
            console.log('Error: Invalid amount:', amount);
            return res.status(400).json({
                success: false,
                error: 'จำนวนเงินที่เติมต้องมากกว่า 0'
            });
        }

        let finalSlipUrl = null;

        // ตรวจสอบการอัปโหลดสลิป (เหมือน updateRiderPhoto)
        if (req.file) {
            console.log('File upload detected, uploading to Cloudinary...');
            // อัปโหลดรูปสลิปไปยัง Cloudinary
            const uploadResult = await uploadToCloudinary(req.file.buffer, 'rider-topup-slips');
            finalSlipUrl = uploadResult.secure_url;
            console.log('Upload successful:', finalSlipUrl);
        } else if (slip_url) {
            console.log('Using provided slip_url:', slip_url);
            // รองรับการส่ง URL มาตรง ๆ (สำหรับ backward compatibility)
            finalSlipUrl = slip_url;

            // ตรวจสอบรูปแบบ URL
            try {
                new URL(finalSlipUrl);
            } catch (e) {
                console.log('Error: Invalid URL format');
                return res.status(400).json({
                    success: false,
                    error: 'รูปแบบ URL ไม่ถูกต้อง'
                });
            }

            // ตรวจสอบว่าเป็น URL ของ Cloudinary หรือไม่
            if (!finalSlipUrl.includes('cloudinary.com') && !finalSlipUrl.includes('res.cloudinary.com')) {
                console.log('Error: Not a Cloudinary URL');
                return res.status(400).json({
                    success: false,
                    error: 'กรุณาใช้ URL รูปภาพจาก Cloudinary เท่านั้น'
                });
            }
        } else {
            console.log('Error: No slip file or URL provided');
            return res.status(400).json({
                success: false,
                error: 'กรุณาอัปโหลดสลิปการโอนเงินหรือส่ง slip_url'
            });
        }

        console.log('Final slip URL:', finalSlipUrl);

        // ตรวจสอบว่าไรเดอร์มีอยู่จริงหรือไม่ (ตรวจสอบจาก token ที่มีอยู่แล้ว)
        console.log('Checking rider existence...');
        const riderCheck = await pool.query(
            'SELECT user_id FROM users WHERE user_id = $1 AND role = $2',
            [user_id, 'rider']
        );

        console.log('Rider check result:', riderCheck.rows);

        if (riderCheck.rowCount === 0) {
            console.log('Error: Rider not found or not a rider');
            return res.status(403).json({
                success: false,
                error: 'คุณไม่มีสิทธิ์เป็นไรเดอร์ในระบบ'
            });
        }

        // บันทึกคำขอเติมเงิน พร้อม rider_id
        console.log('Inserting topup record...');
        
        // ดึง rider_id จาก rider_profiles
        const riderResult = await pool.query(
            `SELECT rider_id FROM rider_profiles WHERE user_id = $1`,
            [user_id]
        );

        if (riderResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลไรเดอร์ในระบบ'
            });
        }

        const rider_id = riderResult.rows[0].rider_id;

        const result = await pool.query(
            `INSERT INTO rider_topups (user_id, rider_id, amount, slip_url, status)
             VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
            [user_id, rider_id, amount, finalSlipUrl]
        );

        console.log('Insert result:', result.rows);

        res.json({
            success: true,
            message: 'ส่งคำขอเติมเงินสำเร็จ รอการอนุมัติจากแอดมิน',
            data: {
                topup_id: result.rows[0].topup_id,
                user_id: result.rows[0].user_id,
                rider_id: result.rows[0].rider_id,
                amount: result.rows[0].amount,
                slip_url: result.rows[0].slip_url,
                status: result.rows[0].status,
                created_at: result.rows[0].created_at
            }
        });
    } catch (error) {
        console.error('=== Error in riderTopUp ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        
        // จัดการ error ของ Cloudinary (เหมือน updateRiderPhoto)
        if (error.message && error.message.includes('cloudinary')) {
            return res.status(400).json({
                success: false,
                error: 'เกิดข้อผิดพลาดในการอัปโหลดสลิป กรุณาลองใหม่อีกครั้ง'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// ดูสถานะการเติมเงิน (Top-up) GP ของไรเดอร์ตัวเอง
exports.getRiderTopUpHistory = async (req, res) => {
    const user_id = req.user.user_id; // ดึง user_id จาก JWT token

    try {
        // ดึงประวัติการเติมเงินของไรเดอร์ (มี rider_id ในตารางแล้ว)
        const result = await pool.query(
            `SELECT 
                topup_id,
                user_id,
                rider_id,
                amount,
                slip_url,
                status,
                rejection_reason,
                created_at,
                approved_at,
                updated_at
             FROM rider_topups 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [user_id]
        );

        // สรุปสถิติการเติมเงิน
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_topups,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_topups,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_topups,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_topups,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_approved_amount
             FROM rider_topups 
             WHERE user_id = $1`,
            [user_id]
        );

        res.json({
            success: true,
            data: {
                topup_history: result.rows,
                statistics: stats.rows[0]
            }
        });
    } catch (err) {
        console.error('Error in getRiderTopUpHistory:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};

// ดูสถานะการเติมเงินรายการเดียว
exports.getRiderTopUpStatus = async (req, res) => {
    const { topup_id } = req.params;
    const user_id = req.user.user_id; // ดึง user_id จาก JWT token

    try {
        const result = await pool.query(
            `SELECT 
                topup_id,
                user_id,
                rider_id,
                amount,
                slip_url,
                status,
                rejection_reason,
                created_at,
                approved_at,
                updated_at
             FROM rider_topups 
             WHERE topup_id = $1 AND user_id = $2`,
            [topup_id, user_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบรายการเติมเงินที่ระบุหรือคุณไม่มีสิทธิ์เข้าถึง'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error in getRiderTopUpStatus:', err);
        res.status(500).json({ 
            success: false, 
            error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' 
        });
    }
};