const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { id_token } = req.body;
  console.log('📥 Google login with token:', id_token.substring(0, 20) + '...'); // แสดงบางส่วน

  try {
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log('✅ Google payload:', payload);

    const { sub: google_id, name: display_name, email, picture: photo_url } = payload;

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      console.log('🆕 สร้างผู้ใช้ใหม่จาก Google:', email);
      await pool.query(
        `INSERT INTO users (google_id, display_name, email, photo_url, is_verified, providers)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [google_id, display_name, email, photo_url, true, 'google']
      );
      userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    }

    const user = userResult.rows[0];
    console.log('✅ ผู้ใช้ที่ login ผ่าน Google:', user);

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    console.log('🎟️ Token ที่สร้าง:', token);

    res.json({ token, user });
  } catch (err) {
    console.error('❌ Google login error:', err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};


exports.updateVerify = async (req, res) => {

  try {
    const userId = req.user.user_id;
    const { display_name, phone, gender, birthdate } = req.body;
    const file = req.file;

    // photo_url อาจมาจากไฟล์ใหม่ หรือ URL เดิมจาก body
    let photo_url = req.body.photo_url;

    if (file) {
      photo_url = file.path || file.location || '';
      // file.path สำหรับ local multer storage
      // file.location ถ้าใช้ multer-storage-cloudinary
      console.log('File photo_url resolved to:', photo_url);
    }

    if (!display_name || !phone || gender == null || !birthdate || !photo_url) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const query = `
      UPDATE users SET 
        display_name = $1,
        phone = $2,
        gender = $3,
        birthdate = $4,
        photo_url = $5,
        is_verified = false
      WHERE user_id = $6
      RETURNING *;
    `;

    const values = [display_name, phone, gender, birthdate, photo_url, userId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }

    res.json({ success: true, user: result.rows[0], message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Update verify error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดจากระบบ' });
  }
};