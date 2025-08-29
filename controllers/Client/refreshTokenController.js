// Node.js Express example

const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const SECRET = process.env.JWT_SECRET;

exports.refreshToken = async (req, res) => {
  const userId = req.user.user_id ; // ตรวจสอบว่ามี key ไหนถูกต้องจาก middleware
  console.log('🧩 User ID from token:', userId);
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }

    const user = result.rows[0];
    const tokenPayload = {
      user_id: user.user_id,
      google_id: null,
      display_name: user.display_name,
      email: user.email,
      birthdate: user.birthdate,
      gender: user.gender,
      phone: user.phone,
      created_at: user.created_at,
      is_verified: user.is_verified,
      photo_url: user.photo_url,
      providers: user.providers,
      is_seller: user.is_seller
      // ใส่ข้อมูลอื่น ๆ ที่ต้องการใน token ได้
    };

    const token = jwt.sign(tokenPayload, SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};
