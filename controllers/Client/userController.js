const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

exports.getProfile = async (req, res) => {
  const { user_id } = req.user;
  const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
  res.json(userResult.rows[0]);
};

exports.getOrderHistory = async (req, res) => {
  try {
    const user_id = req.user?.user_id;
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized: user_id missing from token",
      });
    }

    const result = await pool.query(
      `
      SELECT 
        o.order_id,
        o.market_id,
        m.shop_name,
        SUM(oi.subtotal) AS subtotal,      -- ✅ รวมยอด subtotal ทั้งออเดอร์
        o.delivery_fee,
        o.status,
        o.created_at,
        o.updated_at,
        json_agg(
          json_build_object(
            'food_name', oi.food_name,
            'quantity', oi.quantity,
            'sell_price', oi.sell_price,
            'subtotal', oi.subtotal,
            'selected_options', oi.selected_options
          )
        ) AS items                         -- ✅ รายการอาหารในออเดอร์ (array)
      FROM orders o
      JOIN markets m ON o.market_id = m.market_id
      JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.user_id = $1
      AND o.status IN ('completed', 'cancelled')
      GROUP BY 
        o.order_id, m.shop_name, o.delivery_fee, o.status, o.created_at, o.updated_at
      ORDER BY o.updated_at DESC;
      `,
      [user_id]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching order history:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
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

    // จัดการรูปโปรไฟล์:
    // - ถ้าอัปโหลดใหม่ (multer + cloudinary) => ใช้ req.file.path (URL จาก CloudinaryStorage)
    // - ถ้าไม่อัปโหลดใหม่ แต่ส่ง photoUrl เดิมมา => ใช้ photoUrl
    // - ถ้าไม่มีทั้งสอง => คงค่าเดิมใน DB (ภายหลังจะดึงก่อนแล้ว fallback)
    let imageUrl = photoUrl || null;

    if (req.file?.path) {
      imageUrl = req.file.path; // Cloudinary final URL
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

    // ก่อนอัปเดต ถ้า imageUrl ยังว่าง -> ดึงค่าเดิมเพื่อไม่เซ็ตเป็น null โดยไม่ได้ตั้งใจ
    if (!imageUrl) {
      const currentPhoto = await pool.query('SELECT photo_url FROM users WHERE user_id = $1', [userId]);
      imageUrl = currentPhoto.rows[0]?.photo_url || null;
    }

    await pool.query(
      `UPDATE users 
       SET display_name = $1, phone = $2, gender = $3, birthdate = $4, 
           email = $5, photo_url = $6 
       WHERE user_id = $7`,
      [
        display_name || null,
        phone || null,
        gender !== undefined ? parseInt(gender, 10) : null,
        birthdate || null,
        finalEmail,
        imageUrl,
        userId,
      ]
    );

    res.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อย', photo_url: imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};
// ✅ addAddress Controller
exports.addAddress = async (req, res) => {
  try {
    const user_id = req.user.user_id; // ได้จาก middleware ตรวจสอบ token

    const {
      name,
      phone,
      address,
      district,
      city,
      postalCode,
      notes,
      latitude,
      longitude,
      locationText
    } = req.body;

    const result = await pool.query(
      `INSERT INTO client_addresses
       (user_id, name, phone, address, district, city, postal_code, notes, latitude, longitude, location_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [user_id, name, phone, address, district, city, postalCode, notes, latitude, longitude, locationText]
    );

    res.json({
      success: true,
      message: 'เพิ่มที่อยู่จัดส่งเรียบร้อย',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('❌ Add Address Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};

// ✅ getAddresses Controller
exports.getAddresses = async (req, res) => {
  try {
    const user_id = req.user.user_id; // ได้จาก middleware ตรวจสอบ token

    const result = await pool.query(
      `SELECT id, name, phone, address, district, city, postal_code, notes, latitude, longitude, location_text, set_address
       FROM client_addresses
       WHERE user_id = $1
       ORDER BY set_address DESC, id DESC`, // set_address = true แสดงก่อน แล้วเอาล่าสุดขึ้นก่อน
      [user_id]
    );

    res.json({
      success: true,
      addresses: result.rows
    });
  } catch (err) {
    console.error('❌ Get Addresses Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};

// 📥 ดึงที่อยู่หลัก (set_address = true) ของผู้ใช้
exports.GetDefaultAddress = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await pool.query(
      `SELECT *
       FROM client_addresses
       WHERE user_id = $1 AND set_address = true
       LIMIT 1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: [],      // ไม่มีที่อยู่หลัก
        message: '⚠️ ไม่มีที่อยู่ในระบบ',
      });
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('❌ GetDefaultAddress error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ✅ updateAddress Controller
exports.updateAddress = async (req, res) => {
  try {
    const user_id = req.user.user_id; // ได้จาก middleware ตรวจสอบ token
    const { id } = req.params; // id ของ address ที่จะแก้ไข

    const {
      name,
      phone,
      address,
      district,
      city,
      postalCode,
      notes,
      latitude,
      longitude,
      locationText
    } = req.body;

    // ตรวจสอบว่าที่อยู่นี้เป็นของ user นี้จริงหรือไม่
    const check = await pool.query(
      'SELECT * FROM client_addresses WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบที่อยู่สำหรับแก้ไข' });
    }

    // อัปเดตที่อยู่
    await pool.query(
      `UPDATE client_addresses
       SET name = $1, phone = $2, address = $3, district = $4, city = $5,
           postal_code = $6, notes = $7, latitude = $8, longitude = $9, location_text = $10
       WHERE id = $11 AND user_id = $12`,
      [name, phone, address, district, city, postalCode, notes, latitude, longitude, locationText, id, user_id]
    );

    res.json({ success: true, message: 'อัปเดตที่อยู่เรียบร้อย' });
  } catch (err) {
    console.error('❌ Update Address Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};

// DELETE /delete/address/:id
exports.deleteAddress = async (req, res) => {
  try {
    const user_id = req.user.user_id; // ได้จาก middleware ตรวจสอบ token
    const { id } = req.params;

    // ตรวจสอบว่าที่อยู่นี้เป็นของ user จริงหรือไม่
    const check = await pool.query(
      'SELECT * FROM client_addresses WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบที่อยู่สำหรับลบ' });
    }

    // ลบ address
    await pool.query(
      'DELETE FROM client_addresses WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    res.json({ success: true, message: 'ลบที่อยู่เรียบร้อย' });
  } catch (err) {
    console.error('❌ Delete Address Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};

// ✅ setMainAddress Controller
exports.setMainAddress = async (req, res) => {
  try {
    const user_id = req.user.user_id; // ได้จาก middleware
    const { id } = req.params; // id ของ address ที่จะตั้งเป็นหลัก

    // ตรวจสอบว่าที่อยู่นี้เป็นของ user จริงไหม
    const check = await pool.query(
      'SELECT * FROM client_addresses WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบที่อยู่สำหรับตั้งค่า' });
    }

    // รีเซ็ต set_address = false ของที่อยู่ทั้งหมดของ user
    await pool.query(
      'UPDATE client_addresses SET set_address = false WHERE user_id = $1',
      [user_id]
    );

    // ตั้ง address ที่เลือกเป็น true
    await pool.query(
      'UPDATE client_addresses SET set_address = true WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    res.json({ success: true, message: 'ตั้งที่อยู่หลักเรียบร้อย' });
  } catch (err) {
    console.error('❌ Set Main Address Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
};
