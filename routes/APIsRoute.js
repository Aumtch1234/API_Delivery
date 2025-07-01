const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../utils/cloudinary'); // <-- path อาจต้องปรับ
const upload = multer({ storage });

const loginController = require('../controllers/loginController');
const registerController = require('../controllers/registerController');
const { googleLogin } = require('../controllers/authController');
const authenticateJWT = require('../middleware/auth');
const { getProfile } = require('../controllers/userController');
const { marketsController, getMyMarket } = require('../controllers/marketController');
const { refreshToken } = require('../controllers/refreshTokenController');


//Login and Register Routes
router.post('/google-login', googleLogin);
router.post('/login', loginController.loginUser);
router.post('/register', registerController.registerUser);

//refreshTokenAPI
router.post('/refresh-token', authenticateJWT, refreshToken);

// Protected Routes
router.get('/profile', authenticateJWT, getProfile);

//Market  getMyMarket
router.post('/market/add', authenticateJWT, upload.single('shop_logo'), marketsController);
router.get('/my-market', authenticateJWT, getMyMarket);



module.exports = router;
