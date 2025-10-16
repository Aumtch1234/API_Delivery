const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../../utils/Rider/cloudinary');

// สมัครสมาชิกไรเดอร์ (ขั้นตอนที่ 1)
exports.registerRider = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            display_name,
            email,
            password,
            phone,
            birthdate,
            gender,
            address,
            province,
            amphure,
            tambon
        } = req.body;

        // เช็คกรอกข้อมูลให้ครบถ้วน
        if (!display_name || !email || !password || !phone || !birthdate || !gender) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // เช็คอีเมลซ้ำ ของ role ที่เป็น rider
        const existingUser = await client.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'rider']);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        // แฮชพาสเวิร์ด
        const hashedPassword = await bcrypt.hash(password, 10);

        // อัปโหลดรูปโปรไฟล์ (ถ้ามี)
        let photoUrl = null;
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file.buffer, 'rider-profiles');
            photoUrl = uploadResult.secure_url;
        }

        // บันทึกข้อมูลผู้ใช้ใหม่ในตาราง users
        const userResult = await client.query(
            `INSERT INTO users (display_name, email, password, phone, birthdate, gender, photo_url, role, is_verified) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'rider', false) 
             RETURNING user_id`,
            [display_name, email, hashedPassword, phone, birthdate, gender, photoUrl]
        );

        const userId = userResult.rows[0].user_id;

        // บันทึกที่อยู่ของไรเดอร์ (ถ้ามี)
        if (address && province && amphure && tambon) {
            await client.query(
                `INSERT INTO rider_addresses (user_id, house_number, subdistrict, district, province, is_default) 
                 VALUES ($1, $2, $3, $4, $5, true)`,
                [userId, address, tambon, amphure, province]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'ลงทะเบียนสำเร็จ ขั้นตอนต่อไปกรุณายืนยันตัวตน',
            user_id: userId,
            next_step: 'identity_verification'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
    } finally {
        client.release();
    }
};

exports.DeleteRider = async (req, res) => {
  const user_id = req.user?.user_id;

  console.log('🧩 [DeleteRider] เริ่มทำงาน...');
  console.log('🔑 Token user_id จาก req.user:', user_id);

  if (!user_id) {
    console.log('❌ ไม่พบ user_id ใน token');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: ไม่พบ user_id ใน token',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ ตรวจสอบว่าผู้ใช้นี้มีอยู่จริงใน users หรือไม่
    const check = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [user_id]
    );

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log('⚠️ ไม่พบผู้ใช้ในตาราง users:', user_id);
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้ในระบบ',
      });
    }

    console.log('✅ พบผู้ใช้ใน users, กำลังลบ...');

    // ✅ ลบผู้ใช้ — ถ้ามี FK จะ cascade ลบข้อมูลที่เกี่ยวข้องทั้งหมด
    await client.query('DELETE FROM users WHERE user_id = $1', [user_id]);

    await client.query('COMMIT');
    console.log('✅ ลบผู้ใช้และข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว (user_id:', user_id, ')');

    return res.status(200).json({
      success: true,
      message: `ลบบัญชีผู้ใช้ (ID: ${user_id}) สำเร็จ`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('💥 เกิดข้อผิดพลาดในการลบบัญชี:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ใช้',
      error: err.message,
    });
  } finally {
    client.release();
    console.log('🔚 [DeleteRider] จบการทำงาน\n');
  }
};


// ยืนยันตัวตนไรเดอร์ (ขั้นตอนที่ 2)
exports.submitIdentityVerification = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            id_card_number,
            driving_license_number,
            vehicle_type = 'motorcycle',
            vehicle_brand_model,
            vehicle_color,
            vehicle_registration_number,
            vehicle_registration_province
        } = req.body;

        // ใช้ user_id จาก middleware แทนที่จะเอาจาก body
        const user_id = req.user.user_id;

        // เช็คว่ามี profile เก่าที่ถูก reject หรือไม่
        const existingProfile = await client.query(
            'SELECT rider_id, approval_status FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        let isResubmission = false;
        let existingRiderId = null;

        if (existingProfile.rows.length > 0) {
            const currentStatus = existingProfile.rows[0].approval_status;
            existingRiderId = existingProfile.rows[0].rider_id;

            if (currentStatus === 'rejected') {
                // อนุญาตให้ส่งใหม่ - จะ UPDATE ข้อมูลเดิมแทนการลบและสร้างใหม่
                isResubmission = true;
            } else if (currentStatus === 'pending') {
                return res.status(400).json({
                    error: 'คุณได้ส่งข้อมูลยืนยันตัวตนแล้ว กรุณารอการอนุมัติ'
                });
            } else if (currentStatus === 'approved') {
                return res.status(400).json({
                    error: 'บัญชีของคุณได้รับการอนุมัติแล้ว'
                });
            }
        }

        // เช็คข้อมูลที่จำเป็น
        if (!id_card_number || !driving_license_number || !vehicle_brand_model || !vehicle_color || !vehicle_registration_number || !vehicle_registration_province) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // เช็คเลขบัตรประชาชนซ้ำ (ยกเว้นของตัวเองในกรณี resubmission)
        let duplicateIdCardQuery = 'SELECT * FROM rider_profiles WHERE id_card_number = $1';
        let duplicateIdCardParams = [id_card_number];

        if (isResubmission) {
            duplicateIdCardQuery += ' AND user_id != $2';
            duplicateIdCardParams.push(user_id);
        }

        const duplicateIdCard = await client.query(duplicateIdCardQuery, duplicateIdCardParams);

        if (duplicateIdCard.rows.length > 0) {
            return res.status(400).json({ error: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว' });
        }

        // เช็คเลขใบขับขี่ซ้ำ (ยกเว้นของตัวเองในกรณี resubmission)
        let duplicateLicenseQuery = 'SELECT * FROM rider_profiles WHERE driving_license_number = $1';
        let duplicateLicenseParams = [driving_license_number];

        if (isResubmission) {
            duplicateLicenseQuery += ' AND user_id != $2';
            duplicateLicenseParams.push(user_id);
        }

        const duplicateLicense = await client.query(duplicateLicenseQuery, duplicateLicenseParams);

        if (duplicateLicense.rows.length > 0) {
            return res.status(400).json({ error: 'เลขใบขับขี่นี้ถูกใช้งานแล้ว' });
        }

        // เช็คทะเบียนรถซ้ำ (ยกเว้นของตัวเองในกรณี resubmission)
        let duplicateRegistrationQuery = 'SELECT * FROM rider_profiles WHERE vehicle_registration_number = $1 AND vehicle_registration_province = $2';
        let duplicateRegistrationParams = [vehicle_registration_number, vehicle_registration_province];

        if (isResubmission) {
            duplicateRegistrationQuery += ' AND user_id != $3';
            duplicateRegistrationParams.push(user_id);
        }

        const duplicateRegistration = await client.query(duplicateRegistrationQuery, duplicateRegistrationParams);

        if (duplicateRegistration.rows.length > 0) {
            return res.status(400).json({ error: 'ทะเบียนรถนี้ถูกใช้งานแล้ว' });
        }

        // อัปโหลดรูปภาพต่างๆ
        const uploadPromises = [];
        const imageFields = [
            'id_card_selfie',     // รูปถ่ายคู่บัตรประชาชน
            'id_card_photo',      // รูปถ่ายบัตรประชาชน  
            'driving_license_photo', // รูปใบขับขี่
            'vehicle_photo',      // รูปถ่ายรถ
            'vehicle_registration_photo' // รูปคู่มือทะเบียนรถ
        ];

        const uploadedUrls = {};

        for (const field of imageFields) {
            if (req.files && req.files[field] && req.files[field][0]) {
                const uploadResult = await uploadToCloudinary(
                    req.files[field][0].buffer,
                    'rider-documents'
                );
                uploadedUrls[`${field}_url`] = uploadResult.secure_url;
            } else {
                return res.status(400).json({
                    error: `กรุณาอัปโหลด${field.replace('_', ' ')}`
                });
            }
        }

        // บันทึกข้อมูลยืนยันตัวตน
        let resultRiderId;

        if (isResubmission) {
            // UPDATE ข้อมูลเดิมเพื่อให้ rider_id คงเดิม
            await client.query(
                `UPDATE rider_profiles SET
                    id_card_number = $1,
                    id_card_photo_url = $2,
                    id_card_selfie_url = $3,
                    driving_license_number = $4,
                    driving_license_photo_url = $5,
                    vehicle_type = $6,
                    vehicle_brand_model = $7,
                    vehicle_color = $8,
                    vehicle_registration_number = $9,
                    vehicle_registration_province = $10,
                    vehicle_photo_url = $11,
                    vehicle_registration_photo_url = $12,
                    approval_status = 'pending',
                    approved_by = NULL,
                    approved_at = NULL,
                    rejection_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $13`,
                [
                    id_card_number,
                    uploadedUrls.id_card_photo_url,
                    uploadedUrls.id_card_selfie_url,
                    driving_license_number,
                    uploadedUrls.driving_license_photo_url,
                    vehicle_type,
                    vehicle_brand_model,
                    vehicle_color,
                    vehicle_registration_number,
                    vehicle_registration_province,
                    uploadedUrls.vehicle_photo_url,
                    uploadedUrls.vehicle_registration_photo_url,
                    user_id
                ]
            );
            resultRiderId = existingRiderId;
        } else {
            // INSERT ข้อมูลใหม่
            const insertResult = await client.query(
                `INSERT INTO rider_profiles (
                    user_id, id_card_number, id_card_photo_url, id_card_selfie_url,
                    driving_license_number, driving_license_photo_url,
                    vehicle_type, vehicle_brand_model, vehicle_color,
                    vehicle_registration_number, vehicle_registration_province,
                    vehicle_photo_url, vehicle_registration_photo_url,
                    approval_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
                RETURNING rider_id`,
                [
                    user_id,
                    id_card_number,
                    uploadedUrls.id_card_photo_url,
                    uploadedUrls.id_card_selfie_url,
                    driving_license_number,
                    uploadedUrls.driving_license_photo_url,
                    vehicle_type,
                    vehicle_brand_model,
                    vehicle_color,
                    vehicle_registration_number,
                    vehicle_registration_province,
                    uploadedUrls.vehicle_photo_url,
                    uploadedUrls.vehicle_registration_photo_url
                ]
            );
            resultRiderId = insertResult.rows[0].rider_id;
        }

        await client.query('COMMIT');

        const responseMessage = isResubmission
            ? 'ส่งข้อมูลยืนยันตัวตนใหม่สำเร็จ รอการอนุมัติจากแอดมิน'
            : 'ส่งข้อมูลยืนยันตัวตนสำเร็จ รอการอนุมัติจากแอดมิน';

        res.status(201).json({
            message: responseMessage,
            rider_id: resultRiderId,
            status: 'pending_approval',
            is_resubmission: isResubmission
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Identity verification error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งข้อมูลยืนยันตัวตน' });
    } finally {
        client.release();
    }
};

exports.getRiderPromtPay = async (req, res) => {
    const user_id = req.user.user_id; // ดึง user_id จาก JWT token

    try {
        const result = await pool.query(
            'SELECT rider_id, gp_balance, promptpay FROM rider_profiles WHERE user_id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้'
            });
        }

        const { rider_id, gp_balance, promptpay } = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                user_id,
                rider_id,
                gp_balance,
                promptpay
            }
        });
    } catch (error) {
        console.error('Error fetching promptpay:', error);
        return res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล promptpay'
        });
    }
};

// ตรวจสอบสถานะการอนุมัติ
exports.checkApprovalStatus = async (req, res) => {
    try {
        // ใช้ user_id จาก middleware แทนที่จะเอาจาก params
        const user_id = req.user.user_id;

        const result = await pool.query(`
            SELECT 
                rp.approval_status,
                rp.approved_at,
                rp.rejection_reason,
                rp.created_at,
                u.display_name,
                u.email
            FROM rider_profiles rp
            JOIN users u ON rp.user_id = u.user_id
            WHERE rp.user_id = $1
        `, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'ไม่พบข้อมูลการยืนยันตัวตน',
                can_submit: true // สามารถส่งเอกสารได้
            });
        }

        const profile = result.rows[0];
        const canResubmit = profile.approval_status === 'rejected';

        res.json({
            status: profile.approval_status,
            submitted_at: profile.created_at,
            approved_at: profile.approved_at,
            rejection_reason: profile.rejection_reason,
            can_resubmit: canResubmit, // สำหรับแอปตรวจสอบว่าให้ส่งใหม่ได้ไหม
            rider_info: {
                name: profile.display_name,
                email: profile.email
            }
        });

    } catch (error) {
        console.error('Check approval status error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ' });
    }
};
