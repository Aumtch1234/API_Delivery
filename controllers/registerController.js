const pool = require('../config/db');
const bcrypt = require('bcrypt');
const upload = require('../utils/cloudinary'); // import multer ที่ตั้งค่าแล้ว
exports.registerUser = async (req, res) => {
  try {
    const {
      display_name,
      email,
      password,
      phone,
      birthdate,
      gender,
    } = req.body;

    if (!display_name || !email || !password) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบ email ซ้ำ
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email นี้มีผู้ใช้งานแล้ว' });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // ใช้ URL จาก Cloudinary ที่ multer-storage-cloudinary เก็บไว้ใน req.file.path
    const photo_url = req.file?.path || null;

    const result = await pool.query(
      `INSERT INTO users 
        (display_name, email, password, phone, birthdate, gender, created_at, is_verified, photo_url, providers) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, $7, $8)
       RETURNING *`,
      [
        display_name,
        email,
        hashedPassword,
        phone,
        birthdate,
        gender,
        photo_url,
        'manual',
      ],
    );

    return res.status(200).json({ message: 'ลงทะเบียนสำเร็จ', user: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};
