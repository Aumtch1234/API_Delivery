const pool = require('../../config/db');

// ดูรายการไรเดอร์ที่รอการอนุมัติ
exports.getPendingRiders = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT 
                rp.rider_id,
                rp.user_id,
                u.display_name,
                u.email,
                u.phone,
                u.photo_url,
                u.created_at as user_created_at,
                rp.id_card_number,
                rp.driving_license_number,
                rp.vehicle_type,
                rp.vehicle_brand_model,
                rp.vehicle_color,
                rp.approval_status,
                rp.created_at as submitted_at,
                ra.province,
                ra.district,
                ra.subdistrict
            FROM rider_profiles rp
            JOIN users u ON rp.user_id = u.user_id
            LEFT JOIN rider_addresses ra ON u.user_id = ra.user_id AND ra.is_default = true
            WHERE rp.approval_status = 'pending'
            ORDER BY rp.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // นับจำนวนทั้งหมด
        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM rider_profiles rp
            WHERE rp.approval_status = 'pending'
        `);

        const totalRecords = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            riders: result.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_records: totalRecords,
                has_next: page < totalPages,
                has_prev: page > 1
            }
        });

    } catch (error) {
        console.error('Get pending riders error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ดูรายละเอียดไรเดอร์
exports.getRiderDetails = async (req, res) => {
    try {
        const { rider_id } = req.params;

        const result = await pool.query(`
            SELECT 
                rp.*,
                u.display_name,
                u.email,
                u.phone,
                u.birthdate,
                u.gender,
                u.photo_url,
                u.created_at as user_created_at,
                ra.house_number,
                ra.street,
                ra.subdistrict,
                ra.district,
                ra.province,
                ra.postal_code,
                a.username as approved_by_admin
            FROM rider_profiles rp
            JOIN users u ON rp.user_id = u.user_id
            LEFT JOIN rider_addresses ra ON u.user_id = ra.user_id AND ra.is_default = true
            LEFT JOIN admins a ON rp.approved_by = a.id
            WHERE rp.rider_id = $1
        `, [rider_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลไรเดอร์' });
        }

        const rider = result.rows[0];
        res.json({
            rider_info: {
                rider_id: rider.rider_id,
                user_id: rider.user_id,
                display_name: rider.display_name,
                email: rider.email,
                phone: rider.phone,
                birthdate: rider.birthdate,
                gender: rider.gender,
                photo_url: rider.photo_url,
                registered_at: rider.user_created_at
            },
            identity_documents: {
                id_card_number: rider.id_card_number,
                id_card_photo_url: rider.id_card_photo_url,
                id_card_selfie_url: rider.id_card_selfie_url,
                driving_license_number: rider.driving_license_number,
                driving_license_photo_url: rider.driving_license_photo_url
            },
            vehicle_info: {
                vehicle_type: rider.vehicle_type,
                vehicle_brand_model: rider.vehicle_brand_model,
                vehicle_color: rider.vehicle_color,
                vehicle_registration_number: rider.vehicle_registration_number,
                vehicle_registration_province: rider.vehicle_registration_province,
                vehicle_photo_url: rider.vehicle_photo_url,
                vehicle_registration_photo_url: rider.vehicle_registration_photo_url
            },
            address: {
                house_number: rider.house_number,
                street: rider.street,
                subdistrict: rider.subdistrict,
                district: rider.district,
                province: rider.province,
                postal_code: rider.postal_code
            },
            approval_info: {
                status: rider.approval_status,
                submitted_at: rider.created_at,
                approved_at: rider.approved_at,
                approved_by: rider.approved_by_admin,
                rejection_reason: rider.rejection_reason
            }
        });

    } catch (error) {
        console.error('Get rider details error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// อนุมัติไรเดอร์
exports.approveRider = async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { rider_id } = req.params;
        // ดึง admin_id จาก JWT token ที่ผ่าน middleware มา
        const admin_id = req.user.id;

        if (!admin_id) {
            return res.status(401).json({ 
                error: 'ไม่พบข้อมูล admin จาก token',
                debug: req.user // เพิ่มเพื่อ debug
            });
        }

        // ตรวจสอบว่าไรเดอร์มีอยู่และสถานะเป็น pending
        const riderCheck = await client.query(
            'SELECT * FROM rider_profiles WHERE rider_id = $1 AND approval_status = $2',
            [rider_id, 'pending']
        );

        if (riderCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: 'ไม่พบไรเดอร์หรือสถานะไม่ใช่ pending' 
            });
        }

        // อัปเดตสถานะเป็น approved และเพิ่มเครดิตเริ่มต้น 100.00 บาท
        await client.query(`
            UPDATE rider_profiles 
            SET approval_status = 'approved',
                approved_by = $1,
                approved_at = CURRENT_TIMESTAMP,
                gp_balance = 100.00,
                updated_at = CURRENT_TIMESTAMP
            WHERE rider_id = $2
        `, [admin_id, rider_id]);

        // อัปเดตสถานะผู้ใช้เป็น verified
        await client.query(`
            UPDATE users 
            SET is_verified = true
            WHERE user_id = (
                SELECT user_id FROM rider_profiles WHERE rider_id = $1
            )
        `, [rider_id]);

        await client.query('COMMIT');

        res.json({ 
            message: 'อนุมัติไรเดอร์สำเร็จ และได้รับเครดิตเริ่มต้น 100.00 บาท',
            rider_id: rider_id,
            status: 'approved',
            initial_credit: 100.00
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Approve rider error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอนุมัติ' });
    } finally {
        client.release();
    }
};

// ปฏิเสธไรเดอร์
exports.rejectRider = async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { rider_id } = req.params;
        const { reason } = req.body;

        // ดึง admin_id จาก JWT token ที่ผ่าน middleware มา
        const admin_id = req.user.id;

        if (!admin_id) {
            return res.status(401).json({ 
                error: 'ไม่พบข้อมูล admin จาก token',
                debug: req.user // เพิ่มเพื่อ debug
            });
        }

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ error: 'กรุณาระบุเหตุผลในการปฏิเสธ' });
        }

        // ตรวจสอบว่าไรเดอร์มีอยู่และสถานะเป็น pending
        const riderCheck = await client.query(
            'SELECT * FROM rider_profiles WHERE rider_id = $1 AND approval_status = $2',
            [rider_id, 'pending']
        );

        if (riderCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: 'ไม่พบไรเดอร์หรือสถานะไม่ใช่ pending' 
            });
        }

        // อัปเดตสถานะเป็น rejected
        await client.query(`
            UPDATE rider_profiles 
            SET approval_status = 'rejected',
                approved_by = $1,
                approved_at = CURRENT_TIMESTAMP,
                rejection_reason = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE rider_id = $3
        `, [admin_id, reason, rider_id]);

        await client.query('COMMIT');

        res.json({ 
            message: 'ปฏิเสธไรเดอร์สำเร็จ',
            rider_id: rider_id,
            status: 'rejected',
            reason: reason
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reject rider error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธ' });
    } finally {
        client.release();
    }
};

// ดูรายการไรเดอร์ทั้งหมด (approved, rejected)
exports.getAllRiders = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status = 'all',
            search = ''
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let queryParams = [limit, offset];
        let paramIndex = 3;

        // กรองตามสถานะ
        if (status !== 'all') {
            whereClause += ` AND rp.approval_status = $${paramIndex}`;
            queryParams.splice(-2, 0, status);
            paramIndex++;
        }

        // ค้นหาตามชื่อหรืออีเมล
        if (search) {
            whereClause += ` AND (u.display_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            queryParams.splice(-2, 0, `%${search}%`);
            paramIndex++;
        }

        const result = await pool.query(`
            SELECT 
                rp.rider_id,
                rp.user_id,
                u.display_name,
                u.email,
                u.phone,
                u.photo_url,
                rp.vehicle_type,
                rp.vehicle_brand_model,
                rp.vehicle_color,
                rp.approval_status,
                rp.created_at as submitted_at,
                rp.approved_at,
                ra.province,
                ra.district,
                a.username as approved_by_admin
            FROM rider_profiles rp
            JOIN users u ON rp.user_id = u.user_id
            LEFT JOIN rider_addresses ra ON u.user_id = ra.user_id AND ra.is_default = true
            LEFT JOIN admins a ON rp.approved_by = a.id
            ${whereClause}
            ORDER BY rp.created_at DESC
            LIMIT $1 OFFSET $2
        `, queryParams);

        // นับจำนวนทั้งหมด
        const countParams = queryParams.slice(2); // ตัดพารามิเตอร์ limit และ offset ออก
        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM rider_profiles rp
            JOIN users u ON rp.user_id = u.user_id
            ${whereClause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) - 2}`)}
        `, countParams);

        const totalRecords = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            riders: result.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_records: totalRecords,
                has_next: page < totalPages,
                has_prev: page > 1
            },
            filters: {
                status,
                search
            }
        });

    } catch (error) {
        console.error('Get all riders error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};
