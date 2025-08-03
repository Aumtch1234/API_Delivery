const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.getProfile = async (req, res) => {
  const { user_id } = req.user;
  const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
  res.json(userResult.rows[0]);
};

exports.updateProfile = async (req, res) => {
  try {
    // ตรวจสอบ token
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    // req.body จะถูก parse จาก multer
    const {
      display_name,
      phone,
      gender,
      birthdate,
      email,
      photoUrl, // อาจส่งมาเพื่อใช้ถ้าไม่อัปโหลดรูปใหม่
    } = req.body;

    let imageUrl = photoUrl;

    if (req.file) {
      // upload รูปจริงไป Cloudinary หรือเก็บ path
      imageUrl = await uploadToCloud(req.file);
    }

    const userRes = await pool.query(
      'SELECT email, is_verified FROM users WHERE user_id = $1',
      [userId]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    }

    const user = userRes.rows[0];

    const finalEmail = user.is_verified ? user.email : email;

    await pool.query(
      `UPDATE users 
       SET display_name = $1, phone = $2, gender = $3, birthdate = $4, 
           email = $5, photo_url = $6 
       WHERE user_id = $7`,
      [
        display_name,
        phone,
        parseInt(gender, 10), // แปลงเป็น int เพราะ DB เก็บเป็น integer
        birthdate,
        finalEmail,
        imageUrl,
        userId,
      ]
    );

    res.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};
