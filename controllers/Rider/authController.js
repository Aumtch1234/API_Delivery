const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// เข้าสู่ระบบสำหรับไรเดอร์
exports.loginRider = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'กรุณากรอกอีเมลและรหัสผ่าน' 
            });
        }

        // ค้นหาผู้ใช้ในฐานข้อมูล
        const userResult = await pool.query(
            'SELECT user_id, email, password, display_name, role, is_verified FROM users WHERE email = $1 AND role = $2',
            [email, 'rider']
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' 
            });
        }

        const user = userResult.rows[0];

        // ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' 
            });
        }

        // ตรวจสอบสถานะการยืนยันตัวตน
        const riderProfileResult = await pool.query(
            'SELECT approval_status, created_at as submitted_at FROM rider_profiles WHERE user_id = $1',
            [user.user_id]
        );

        let riderStatus = {
            has_submitted: false,
            approval_status: null,
            submitted_at: null
        };

        if (riderProfileResult.rows.length > 0) {
            const profile = riderProfileResult.rows[0];
            riderStatus = {
                has_submitted: true,
                approval_status: profile.approval_status,
                submitted_at: profile.submitted_at
            };
        }

        // สร้าง JWT token
        const token = jwt.sign(
            { 
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // token หมดอายุใน 7 วัน
        );

        // ส่งผลลัพธ์
        res.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            token: token,
            user: {
                user_id: user.user_id,
                email: user.email,
                display_name: user.display_name,
                role: user.role,
                is_verified: user.is_verified
            },
            rider_status: riderStatus
        });

    } catch (error) {
        console.error('Rider login error:', error);
        res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' 
        });
    }
};

// Login โดย Google
exports.loginRiderWithGoogle = async (req, res) => {
    const { tokenId } = req.body;
    console.log('📥 Google login attempt with tokenId:', tokenId.substring(0, 20) + '...'); // แสดงบางส่วน
    
    try {
        // ตรวจสอบ token กับ Google
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        // ตรวจสอบความถูกต้องของ token
        const payload = ticket.getPayload();
        console.log('✅ Google payload:', payload);
        const { sub: google_id, name: display_name, email, picture: photo_url } = payload;

        // ค้นหาผู้ใช้ในฐานข้อมูล
        let userRiderResult = await pool.query(
            'SELECT user_id, email, display_name, role, is_verified, google_id FROM users WHERE email = $1 AND role = $2',
            [email, 'rider']
        );

        let user;
        
        if (userRiderResult.rows.length === 0) {
            // ไม่พบผู้ใช้ - สร้างใหม่
            console.log('🆕 สร้างไรเดอร์ใหม่จาก Google:', email);
            const insertResult = await pool.query(
                `INSERT INTO users (google_id, display_name, email, photo_url, role, is_verified, providers)
                 VALUES ($1, $2, $3, $4, 'rider', false, 'google')
                 RETURNING user_id, email, display_name, role, is_verified, google_id`,
                [google_id, display_name, email, photo_url]
            );
            user = insertResult.rows[0];
        } else {
            // พบผู้ใช้แล้ว - อัปเดต google_id ถ้าจำเป็น
            user = userRiderResult.rows[0];
            
            if (!user.google_id) {
                await pool.query(
                    'UPDATE users SET google_id = $1, photo_url = $2, providers = $3 WHERE user_id = $4',
                    [google_id, photo_url, 'google', user.user_id]
                );
            }
        }

        // ตรวจสอบสถานะการยืนยันตัวตนของไรเดอร์
        const riderProfileResult = await pool.query(
            'SELECT approval_status, created_at as submitted_at FROM rider_profiles WHERE user_id = $1',
            [user.user_id]
        );

        let riderStatus = {
            has_submitted: false,
            approval_status: null,
            submitted_at: null
        };

        if (riderProfileResult.rows.length > 0) {
            const profile = riderProfileResult.rows[0];
            riderStatus = {
                has_submitted: true,
                approval_status: profile.approval_status,
                submitted_at: profile.submitted_at
            };
        }

        // สร้าง JWT token
        const token = jwt.sign(
            { 
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ ไรเดอร์ที่ login ผ่าน Google:', user);

        // ส่งผลลัพธ์
        res.json({
            message: 'เข้าสู่ระบบด้วย Google สำเร็จ',
            token: token,
            user: {
                user_id: user.user_id,
                email: user.email,
                display_name: user.display_name,
                role: user.role,
                is_verified: user.is_verified
            },
            rider_status: riderStatus
        });

    } catch (error) {
        console.error('❌ Rider Google login error:', error);
        if (error.message.includes('audience')) {
            return res.status(401).json({ 
                error: 'Google token ไม่ถูกต้อง - audience mismatch' 
            });
        }
        res.status(401).json({ 
            error: 'Google token ไม่ถูกต้องหรือหมดอายุ email ถูกใช้งานแล้ว' 
        });
    }
};

// รีเฟรช token
exports.refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ 
                error: 'กรุณาส่ง refresh token' 
            });
        }

        // ตรวจสอบ refresh token
        const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

        // ตรวจสอบว่าผู้ใช้ยังมีอยู่ในระบบ
        const userResult = await pool.query(
            'SELECT user_id, email, role FROM users WHERE user_id = $1 AND role = $2',
            [decoded.user_id, 'rider']
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'ไม่พบข้อมูลผู้ใช้' 
            });
        }

        const user = userResult.rows[0];

        // สร้าง access token ใหม่
        const newToken = jwt.sign(
            { 
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'รีเฟรช token สำเร็จ',
            token: newToken
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Refresh token ไม่ถูกต้องหรือหมดอายุ' 
            });
        }

        console.error('Refresh token error:', error);
        res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการรีเฟรช token' 
        });
    }
};

// ดูข้อมูลโปรไฟล์ของตัวเอง
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        // ดึงข้อมูลผู้ใช้และข้อมูลไรเดอร์
        const result = await pool.query(`
            SELECT 
                u.user_id,
                u.display_name,
                u.email,
                u.phone,
                rp.promptpay,
                u.birthdate,
                u.gender,
                u.photo_url,
                u.created_at,
                u.is_verified,
                rp.approval_status,
                rp.vehicle_type,
                rp.vehicle_brand_model,
                rp.vehicle_color,
                rp.vehicle_registration_number,
                rp.vehicle_registration_province,
                rp.created_at as submitted_at,
                rp.approved_at,
                rp.rejection_reason,
                ra.house_number,
                ra.street,
                ra.subdistrict,
                ra.district,
                ra.province,
                ra.postal_code
            FROM users u
            LEFT JOIN rider_profiles rp ON u.user_id = rp.user_id
            LEFT JOIN rider_addresses ra ON u.user_id = ra.user_id AND ra.is_default = true
            WHERE u.user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'ไม่พบข้อมูลผู้ใช้' 
            });
        }

        const profile = result.rows[0];

        res.json({
            user_info: {
                user_id: profile.user_id,
                display_name: profile.display_name,
                email: profile.email,
                phone: profile.phone,
                promptpay: profile.promptpay,
                birthdate: profile.birthdate,
                gender: profile.gender,
                photo_url: profile.photo_url,
                created_at: profile.created_at,
                is_verified: profile.is_verified
            },
            rider_status: {
                has_submitted: !!profile.approval_status,
                approval_status: profile.approval_status,
                submitted_at: profile.submitted_at,
                approved_at: profile.approved_at,
                rejection_reason: profile.rejection_reason
            },
            vehicle_info: profile.approval_status ? {
                vehicle_type: profile.vehicle_type,
                vehicle_brand_model: profile.vehicle_brand_model,
                vehicle_color: profile.vehicle_color,
                vehicle_registration_number: profile.vehicle_registration_number,
                vehicle_registration_province: profile.vehicle_registration_province
            } : null,
            address: profile.house_number ? {
                house_number: profile.house_number,
                street: profile.street,
                subdistrict: profile.subdistrict,
                district: profile.district,
                province: profile.province,
                postal_code: profile.postal_code
            } : null
        });

    } catch (error) {
        console.error('Get rider profile error:', error);
        res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' 
        });
    }
};
