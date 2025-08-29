const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../../config/db');

const router = express.Router();

// กำหนด path เก็บไฟล์
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/upload-profile', upload.single('photo'), async (req, res) => {
  const userId = req.body.user_id;
  const filePath = req.file.filename;

  await pool.query(`UPDATE users SET photo_url = $1 WHERE user_id = $2`, [filePath, userId]);

  res.json({ message: 'Uploaded', file: filePath });
});

module.exports = router;
