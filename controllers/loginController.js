const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt');
const SECRET = process.env.JWT_SECRET; // 👉 ควรเก็บใน .env
const pool = require('../config/db'); 

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  console.log('📥 Login attempt:', email); // ✅ log email ที่รับเข้ามา

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      console.warn('⚠️ ไม่พบผู้ใช้ในระบบ:', email);
      return res.status(400).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const user = result.rows[0];
    console.log('✅ พบผู้ใช้:', user);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('❌ รหัสผ่านไม่ตรง:', email);
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const tokenPayload = {
      user_id: user.user_id,
      google_id: null,
      display_name: user.display_name,
      email: user.email,
      password: user.password,
      birthdate: user.birthdate,
      gender: user.gender,
      phone: user.phone,
      created_at: user.created_at,
      is_verified: user.is_verified,
      photo_url: user.photo_url,
      providers: user.providers,
      is_seller: user.is_seller
    };

    console.log('🔐 สร้าง Token ด้วยข้อมูล:', tokenPayload);

    const token = jwt.sign(tokenPayload, SECRET, { expiresIn: '7d' });

    console.log('🎟️ Token ที่สร้าง:', token);

    res.status(200).json({
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        user_id: user.user_id,
        display_name: user.display_name,
        email: user.email,
        google_id: null,
        photo_url: user.photo_url,
        birthdate: user.birthdate,
        gender: user.gender,
        phone: user.phone,
        created_at: user.created_at,
        is_seller: user.is_seller,
      },
    });
  } catch (err) {
    console.error('❗ เกิดข้อผิดพลาดในการ Login:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};

