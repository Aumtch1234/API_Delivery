// controllers/register.controller.js
const pool = require('../config/db'); // ใช้ pg.Pool จากไฟล์ db.js ที่คุณต้องสร้างไว้
const bcrypt = require('bcrypt');

exports.registerUser = async (req, res) => {
  const { display_name, email, password, phone, birthdate, gender, photo_url } = req.body;

  try {
    // ตรวจสอบว่าผู้ใช้นี้มีอยู่แล้วหรือไม่
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email นี้มีผู้ใช้งานแล้ว' });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // เพิ่มผู้ใช้ใหม่
    const result = await pool.query(
      `INSERT INTO users 
      (display_name, email, password, phone, birthdate, gender, created_at, is_verified, photo_url, providers) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, $7, $8) 
      RETURNING *`,
      [display_name, email, hashedPassword, phone, birthdate, gender, photo_url, 'manual']
    );

    res.status(200).json({ message: 'ลงทะเบียนสำเร็จ', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};
