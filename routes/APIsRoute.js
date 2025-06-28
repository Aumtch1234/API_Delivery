const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');
const registerController = require('../controllers/registerController');
const { googleLogin } = require('../controllers/authController');
const authenticateJWT = require('../middleware/auth');
const { getProfile } = require('../controllers/userController');

//Login and Register Routes
router.post('/google-login', googleLogin);
router.post('/login', loginController.loginUser);
router.post('/register', registerController.registerUser);

// Protected Routes
router.get('/profile', authenticateJWT, getProfile);

module.exports = router;
