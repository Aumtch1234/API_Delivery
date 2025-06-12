const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController');

// POST /api/register
router.post('/login', loginController.loginUser);

module.exports = router;
