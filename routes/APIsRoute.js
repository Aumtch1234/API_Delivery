const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../utils/cloudinary'); // <-- path อาจต้องปรับ
const upload = multer({ storage });

const loginController = require('../controllers/loginController');
const registerController = require('../controllers/registerController');
const { googleLogin, updateVerify } = require('../controllers/authController');
const authenticateJWT = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/userController');
const { marketsController, getMyMarket, addFood, getMyFoods, updateFood, updateMarketStatus, updateManualOverride, updateMarketController, deleteFood } = require('../controllers/marketController');
const { refreshToken } = require('../controllers/refreshTokenController');
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { getAllFoods, getAllMarket } = require('../controllers/FoodsController');



//Login and Register Routes
router.post('/google-login', googleLogin);
router.post('/login', loginController.loginUser);
router.post('/register', upload.single('Profile'), registerController.registerUser);
router.post('/update-verify', authenticateJWT, upload.single('Profile'), updateVerify);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

//User Profile Routes
router.put('/update-profile', authenticateJWT, upload.single('Profile'), updateProfile);


//refreshTokenAPI
router.post('/refresh-token', authenticateJWT, refreshToken);

// Protected Routes
router.get('/profile', authenticateJWT, getProfile);

//Market  getMyMarket
router.post('/market/add', authenticateJWT, upload.single('shop_logo'), marketsController);
router.put('/markets/:id', upload.single('shop_logo'), updateMarketController);
router.get('/my-market', authenticateJWT, getMyMarket);
router.patch('/my-market/override/:id', authenticateJWT, updateManualOverride);
router.patch('/my-market/status/:id', authenticateJWT, updateMarketStatus);

//food in owner market
router.post('/food/add', authenticateJWT, upload.single('image'), addFood);
router.get('/my-foods', authenticateJWT, getMyFoods);
router.delete("/food/delete/:food_id", authenticateJWT, deleteFood);
router.put('/food/update/:id', authenticateJWT, upload.single('image'), updateFood);

//Main Market Food 
router.get('/foods', getAllFoods);
router.get('/markets', getAllMarket);

module.exports = router;
