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
    loginRiderWithGoogle,
    refreshToken,
    getProfile
} = require('../../controllers/Rider/authController');

const {
    updateRiderPhone,
    updateRiderPromptPay,
    updateRiderGender,
    updateRiderBirthdate,
    updateRiderPhoto
} = require('../../controllers/Rider/update-dataController');

const {
    getRiderGPBalance,
    riderTopUp,
    getRiderTopUpHistory,
    getRiderTopUpStatus
} = require('../../controllers/Rider/rider-topup_Controller');

const { 
    getJobHistory,
    getTodayJobHistory,
    getThisMonthJobHistory,
    getThisYearJobHistory
} = require('../../controllers/Rider/JobHistoryController');

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

// POST /rider/google-login - เข้าสู่ระบบด้วย Google
router.post('/google-login', loginRiderWithGoogle);

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

// GET /rider/approval-status - ตรวจสอบสถานะการอนุมัติ
router.get('/approval-status', verifyRiderToken, checkApprovalStatus);

// Update Data Routes (ต้องการ authentication)
// PUT /rider/update-phone - อัพเดตเบอร์โทรศัพท์
router.put('/update-phone', verifyRiderToken, updateRiderPhone);

// PUT /rider/update-promptpay - อัพเดตหมายเลข PromptPay
router.put('/update-promptpay', verifyRiderToken, updateRiderPromptPay);

// PUT /rider/update-gender - อัพเดตเพศ
router.put('/update-gender', verifyRiderToken, updateRiderGender);

// PUT /rider/update-birthdate - อัพเดตวันเกิด
router.put('/update-birthdate', verifyRiderToken, updateRiderBirthdate);

// PUT /rider/update-photo - อัพเดตรูปโปรไฟล์
router.put('/update-photo', verifyRiderToken, upload.single('photo'), updateRiderPhoto);


// Top-up Routes (ต้องการ authentication)
// GET /rider/gp-balance - ดูยอด GP คงเหลือ
router.get('/gp-balance', verifyRiderToken, getRiderGPBalance);

// POST /rider/topup - เติมเงิน GP
router.post('/topup', verifyRiderToken, upload.single('slip'), riderTopUp);

// GET /rider/topup-history - ดูประวัติการเติมเงิน
router.get('/topup-history', verifyRiderToken, getRiderTopUpHistory);

// GET /rider/topup/:topup_id/status - ดูสถานะการเติมเงินรายการเดียว
router.get('/topup/:topup_id/status', verifyRiderToken, getRiderTopUpStatus);


// Job History Routes (ต้องการ authentication)
// GET /rider/job-history/all - ดูประวัติการทำงานของไรเดอร์ทั้งหมด
router.get('/job-history/all', verifyRiderToken, getJobHistory);

// GET /rider/job-history/today - ดูประวัติการทำงานของไรเดอร์วันนี้
router.get('/job-history/today', verifyRiderToken, getTodayJobHistory);

// GET /rider/job-history/this-month - ดูประวัติการทำงานของไรเดอร์เดือนนี้
router.get('/job-history/this-month', verifyRiderToken, getThisMonthJobHistory);

// GET /rider/job-history/this-year - ดูประวัติการทำงานของไรเดอร์ปีนี้
router.get('/job-history/this-year', verifyRiderToken, getThisYearJobHistory);

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
