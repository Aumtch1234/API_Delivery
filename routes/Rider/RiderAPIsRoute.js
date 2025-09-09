const express = require('express');
const multer = require('multer');
const router = express.Router();

// Import controllers
const { 
    registerRider, 
    submitIdentityVerification, 
    checkApprovalStatus 
} = require('../../controllers/Rider/registerController');

const {
    loginRider,
    refreshToken,
    getProfile
} = require('../../controllers/Rider/authController');

// Import middleware
const {
    verifyRiderToken,
    verifyApprovedRider,
    verifyOwnership,
    checkNotSubmitted
} = require('../../middleware/Rider/auth');

// กำหนดค่า multer สำหรับอัปโหลดไฟล์
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 6 // รูปโปรไฟล์ + เอกสาร 5 รูป
    },
    fileFilter: (req, file, cb) => {
        // อนุญาตเฉพาะไฟล์รูปภาพ
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ'), false);
        }
    }
});

// กำหนดฟิลด์สำหรับอัปโหลดหลายรูป
const uploadFields = upload.fields([
    { name: 'profile_photo', maxCount: 1 },      // รูปโปรไฟล์
    { name: 'id_card_selfie', maxCount: 1 },     // รูปถ่ายคู่บัตรประชาชน
    { name: 'id_card_photo', maxCount: 1 },      // รูปถ่ายบัตรประชาชน
    { name: 'driving_license_photo', maxCount: 1 }, // รูปใบขับขี่
    { name: 'vehicle_photo', maxCount: 1 },      // รูปถ่ายรถ
    { name: 'vehicle_registration_photo', maxCount: 1 } // รูปคู่มือทะเบียนรถ
]);

// Auth Routes (ไม่ต้องการ authentication)
// POST /rider/login - เข้าสู่ระบบ
router.post('/login', loginRider);

// POST /rider/refresh-token - รีเฟรช token
router.post('/refresh-token', refreshToken);

// Registration Routes (ไม่ต้องการ authentication)
// POST /rider/register - สมัครสมาชิกไรเดอร์ (ขั้นตอนที่ 1)
router.post('/register', upload.single('profile_photo'), registerRider);

// POST /rider/identity-verification - ยืนยันตัวตน (ขั้นตอนที่ 2)
// ใช้ middleware เพื่อป้องกันการส่งซ้ำ
router.post('/identity-verification', 
    verifyRiderToken, 
    checkNotSubmitted, 
    uploadFields, 
    submitIdentityVerification
);

// Protected Routes (ต้องการ authentication)
// GET /rider/profile - ดูข้อมูลโปรไฟล์ของตัวเอง
router.get('/profile', verifyRiderToken, getProfile);

// GET /rider/approval-status/:user_id - ตรวจสอบสถานะการอนุมัติ
// ใช้ middleware เพื่อให้ดูได้เฉพาะข้อมูลของตัวเอง
router.get('/approval-status/:user_id', 
    verifyRiderToken, 
    verifyOwnership, 
    checkApprovalStatus
);

// Routes สำหรับ rider ที่ได้รับการอนุมัติแล้ว
// (เตรียมไว้สำหรับฟีเจอร์อนาคต เช่น รับงาน, อัปเดตสถานะ, ฯลฯ)

// GET /rider/approved-only-test - ทดสอบ route ที่ต้องการ rider ที่อนุมัติแล้ว
router.get('/approved-only-test', 
    verifyRiderToken, 
    verifyApprovedRider, 
    (req, res) => {
        res.json({
            message: 'คุณเป็นไรเดอร์ที่ได้รับการอนุมัติแล้ว',
            user: req.user
        });
    }
);

// Middleware สำหรับจัดการ error ของ multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)' 
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                error: 'จำนวนไฟล์เกินที่กำหนด' 
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                error: 'ชื่อฟิลด์ไฟล์ไม่ถูกต้อง' 
            });
        }
    }
    
    if (error.message === 'กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ') {
        return res.status(400).json({ error: error.message });
    }
    
    next(error);
});

module.exports = router;
