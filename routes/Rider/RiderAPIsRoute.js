// routes/Rider/RiderAPIsRoute.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/* =========================================================
 *  Controllers
 * =======================================================*/
const {
  registerRider,
  submitIdentityVerification,
  checkApprovalStatus,
} = require('../../controllers/Rider/registerController');

const {
  loginRider,
  loginRiderWithGoogle,
  refreshToken,
  getProfile,
} = require('../../controllers/Rider/authController');

const {
  updateRiderPhone,
  updateRiderPromptPay,
  updateRiderGender,
  updateRiderBirthdate,
  updateRiderPhoto,
  reportShopClosed,
  getShopClosedReports,
} = require('../../controllers/Rider/update-dataController');

const {
  getRiderGPBalance,
  riderTopUp,
  getRiderTopUpHistory,
  getRiderTopUpStatus,
} = require('../../controllers/Rider/rider-topup_Controller');

const {
  getJobHistory,
  getJobHistoryByDate,
  getJobHistoryByDateRange,
  getJobHistoryByMonth,
  getJobHistoryByYear,
} = require('../../controllers/Rider/JobHistoryController');

/* =========================================================
 *  Middlewares
 * =======================================================*/
const {
  verifyRiderToken,
  verifyApprovedRider,
  verifyOwnership,
  checkNotSubmitted,
} = require('../../middleware/Rider/auth');

/* =========================================================
 *  Paths & Upload Dirs
 *  (เดินขึ้น 2 ระดับจาก routes/Rider → Api_Delivery)
 * =======================================================*/
const ROOT_DIR = path.join(__dirname, '..', '..');                 // /Api_Delivery
const UPLOADS_ROOT = path.join(ROOT_DIR, 'uploads');               // /Api_Delivery/uploads
const SHOP_CLOSED_DIR = path.join(UPLOADS_ROOT, 'shop_closed');    // /Api_Delivery/uploads/shop_closed

// สร้างโฟลเดอร์ถ้ายังไม่มี
[UPLOADS_ROOT, SHOP_CLOSED_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* =========================================================
 *  Multer Configs
 * =======================================================*/
// 1) สำหรับงานทั่วไป (เมมโมรี่) – ใช้กับ register/identity/topup
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }, // 10MB / รวม 6 ไฟล์
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ'), false),
});

// ฟิลด์หลายรูปสำหรับ identity verification
const uploadIdentityFields = uploadMemory.fields([
  { name: 'profile_photo', maxCount: 1 },
  { name: 'id_card_selfie', maxCount: 1 },
  { name: 'id_card_photo', maxCount: 1 },
  { name: 'driving_license_photo', maxCount: 1 },
  { name: 'vehicle_photo', maxCount: 1 },
  { name: 'vehicle_registration_photo', maxCount: 1 },
]);

// 2) สำหรับ “แจ้งร้านปิด” (ดิสก์) – เก็บไฟล์ลง host
const storageShopClosed = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SHOP_CLOSED_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `shopclosed_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const uploadShopClosed = multer({
  storage: storageShopClosed,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB/ไฟล์
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ')),
});

/* =========================================================
 *  Auth (ไม่ต้องใช้ token)
 * =======================================================*/
router.post('/login', loginRider);
router.post('/google-login', loginRiderWithGoogle);
router.post('/refresh-token', refreshToken);

/* =========================================================
 *  Registration (ไม่ต้องใช้ token)
 * =======================================================*/
router.post('/register', uploadMemory.single('profile_photo'), registerRider);

/* =========================================================
 *  Identity Verification (ต้องใช้ token)
 * =======================================================*/
router.post(
  '/identity-verification',
  verifyRiderToken,
  checkNotSubmitted,
  uploadIdentityFields,
  submitIdentityVerification
);

/* =========================================================
 *  Protected: Profile & Approval
 * =======================================================*/
router.get('/profile', verifyRiderToken, getProfile);
router.get('/approval-status', verifyRiderToken, checkApprovalStatus);

/* =========================================================
 *  Protected: Update Data
 * =======================================================*/
router.put('/update-phone', verifyRiderToken, updateRiderPhone);
router.put('/update-promptpay', verifyRiderToken, updateRiderPromptPay);
router.put('/update-gender', verifyRiderToken, updateRiderGender);
router.put('/update-birthdate', verifyRiderToken, updateRiderBirthdate);
router.put('/update-photo', verifyRiderToken, uploadMemory.single('photo'), updateRiderPhoto);

/* =========================================================
 *  Protected: Top-up
 * =======================================================*/
router.get('/gp-balance', verifyRiderToken, getRiderGPBalance);
router.post('/topup', verifyRiderToken, uploadMemory.single('slip'), riderTopUp);
router.get('/topup-history', verifyRiderToken, getRiderTopUpHistory);
router.get('/topup/:topup_id/status', verifyRiderToken, getRiderTopUpStatus);

/* =========================================================
 *  Protected: Job History
 * =======================================================*/
router.get('/job-history/all', verifyRiderToken, getJobHistory);
router.get('/job-history/bydate', verifyRiderToken, getJobHistoryByDate);
router.get('/job-history/bydate-range', verifyRiderToken, getJobHistoryByDateRange);
router.get('/job-history/by-month', verifyRiderToken, getJobHistoryByMonth);
router.get('/job-history/by-year', verifyRiderToken, getJobHistoryByYear);

// ทดสอบเฉพาะไรเดอร์ที่อนุมัติแล้ว
router.get('/approved-only-test', verifyRiderToken, verifyApprovedRider, (req, res) => {
  res.json({ message: 'คุณเป็นไรเดอร์ที่ได้รับการอนุมัติแล้ว', user: req.user });
});

/* =========================================================
 *  Protected: Shop Closed (อัปโหลดลง host)
 * =======================================================*/
router.post(
  '/shop-closed',
  verifyRiderToken,
  uploadShopClosed.array('images', 3), // ❗️ฟิลด์ชื่อ "images"
  reportShopClosed
);
router.get('/shop-closed', verifyRiderToken, getShopClosedReports);

/* =========================================================
 *  Multer Error Handler (เฉพาะของไฟล์นี้)
 * =======================================================*/
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB หรือ 5MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'จำนวนไฟล์เกินที่กำหนด' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'ชื่อฟิลด์ไฟล์ไม่ถูกต้อง' });
    }
  }
  if (error?.message === 'กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ') {
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
