const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

// Middleware สำหรับตรวจสอบ JWT token ของ rider
const verifyRiderToken = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'ไม่พบ Authorization header กรุณาเข้าสู่ระบบ' 
            });
        }

        // ตรวจสอบรูปแบบ Bearer token
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({ 
                error: 'ไม่พบ token กรุณาเข้าสู่ระบบ' 
            });
        }

        // ตรวจสอบ token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded.user_id) {
            return res.status(401).json({ 
                error: 'Token ไม่ถูกต้อง' 
            });
        }

        // ตรวจสอบว่าผู้ใช้ยังมีอยู่ในระบบและเป็น rider
        const userResult = await pool.query(
            'SELECT user_id, email, role, is_verified FROM users WHERE user_id = $1 AND role = $2',
            [decoded.user_id, 'rider']
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                error: 'ไม่พบข้อมูลผู้ใช้หรือไม่ใช่ไรเดอร์' 
            });
        }

        // เก็บข้อมูลผู้ใช้ใน req เพื่อใช้ใน route
        req.user = userResult.rows[0];
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Token ไม่ถูกต้อง' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' 
            });
        }
        
        console.error('Verify rider token error:', error);
        return res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' 
        });
    }
};

// Middleware สำหรับตรวจสอบว่า rider ได้รับการอนุมัติแล้ว
const verifyApprovedRider = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'กรุณาเข้าสู่ระบบก่อน' 
            });
        }

        // ตรวจสอบสถานะการอนุมัติของ rider
        const riderResult = await pool.query(
            'SELECT approval_status FROM rider_profiles WHERE user_id = $1',
            [req.user.user_id]
        );

        if (riderResult.rows.length === 0) {
            return res.status(403).json({ 
                error: 'คุณยังไม่ได้ส่งข้อมูลยืนยันตัวตน กรุณายืนยันตัวตนก่อน' 
            });
        }

        const approvalStatus = riderResult.rows[0].approval_status;

        if (approvalStatus === 'pending') {
            return res.status(403).json({ 
                error: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ' 
            });
        }

        if (approvalStatus === 'rejected') {
            return res.status(403).json({ 
                error: 'บัญชีของคุณถูกปฏิเสธ กรุณาส่งข้อมูลยืนยันตัวตนใหม่' 
            });
        }

        if (approvalStatus !== 'approved') {
            return res.status(403).json({ 
                error: 'สถานะบัญชีไม่ถูกต้อง' 
            });
        }

        // เก็บสถานะอนุมัติใน req
        req.user.approval_status = approvalStatus;
        next();

    } catch (error) {
        console.error('Verify approved rider error:', error);
        return res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ' 
        });
    }
};

// Middleware สำหรับตรวจสอบว่าเป็นเจ้าของข้อมูล
const verifyOwnership = (req, res, next) => {
    try {
        const { user_id } = req.params;
        
        if (!req.user) {
            return res.status(401).json({ 
                error: 'กรุณาเข้าสู่ระบบก่อน' 
            });
        }

        // ตรวจสอบว่าเป็นเจ้าของข้อมูลหรือไม่
        if (parseInt(user_id) !== req.user.user_id) {
            return res.status(403).json({ 
                error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' 
            });
        }

        next();

    } catch (error) {
        console.error('Verify ownership error:', error);
        return res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' 
        });
    }
};

// Middleware สำหรับตรวจสอบว่า rider ยังไม่ได้ส่งข้อมูลยืนยันตัวตน (ป้องกันการส่งซ้ำ)
const checkNotSubmitted = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'กรุณาเข้าสู่ระบบก่อน' 
            });
        }

        // ตรวจสอบว่าเคยส่งข้อมูลยืนยันตัวตนแล้วหรือไม่
        const existingProfile = await pool.query(
            'SELECT rider_id, approval_status FROM rider_profiles WHERE user_id = $1',
            [req.user.user_id]
        );

        if (existingProfile.rows.length > 0) {
            const status = existingProfile.rows[0].approval_status;
            
            if (status === 'approved') {
                return res.status(400).json({ 
                    error: 'บัญชีของคุณได้รับการอนุมัติแล้ว' 
                });
            }
            
            if (status === 'pending') {
                return res.status(400).json({ 
                    error: 'คุณได้ส่งข้อมูลยืนยันตัวตนแล้ว กรุณารอการอนุมัติ' 
                });
            }
            
            if (status === 'rejected') {
                // อนุญาตให้ส่งใหม่ได้ถ้าถูกปฏิเสธ
                console.log(`User ${req.user.user_id} is resubmitting after rejection`);
                return next();
            }
        }

        next();

    } catch (error) {
        console.error('Check not submitted error:', error);
        return res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบ' 
        });
    }
};

module.exports = {
    verifyRiderToken,
    verifyApprovedRider,
    verifyOwnership,
    checkNotSubmitted
};
