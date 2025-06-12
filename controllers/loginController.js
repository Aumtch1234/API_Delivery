const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt');
const SECRET = process.env.JWT_SECRET; // 👉 ควรเก็บใน .env
const pool = require('../config/db'); 

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // ✅ สร้าง JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        google_id: null,
        photo_url: user.photo_url,
      },
      SECRET,
      { expiresIn: '7d' }
    );

    // ✅ ส่ง token กลับ
    res.status(200).json({
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        id: user.user_id,
        display_name: user.display_name,
        email: user.email,
        google_id: null,
        photo_url: user.photo_url,
        birthdate: user.birthdate,
        gender: user.gender,
        phone: user.phone,
        created_at: user.created_at,

      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};
