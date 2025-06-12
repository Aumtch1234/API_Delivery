const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/auth');
const { getProfile } = require('../controllers/userController');

router.get('/profile', authenticateJWT, getProfile);

module.exports = router;
