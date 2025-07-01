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
