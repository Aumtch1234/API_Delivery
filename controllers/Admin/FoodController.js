const pool = require('../../config/db');

exports.createFood = async (req, res) => {
  const { foodName, price, options } = req.body;
  const imageUrl = req.file?.path;

  if (!imageUrl) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  try {
    let parsedOptions = null;
    if (options) {
      try {
        // parse ถ้ามาเป็น string
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
      } catch (e) {
        return res.status(400).json({ message: 'Invalid options format' });
      }
    }

    await pool.query(
      'INSERT INTO foods (food_name, price, image_url, options) VALUES ($1, $2, $3, $4)',
      [foodName, price, imageUrl, parsedOptions ? JSON.stringify(parsedOptions) : null]
    );

    res.status(200).json({ message: 'เพิ่มเมนูสำเร็จ', imageUrl });
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ server' });
  }
};

exports.getMarkets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, a.username 
       FROM markets m
       LEFT JOIN admins a ON m.admin_id = a.id
       WHERE m.is_admin = TRUE
       ORDER BY m.market_id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching markets:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM categorys ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getFoodsByMarketId = async (req, res) => {
  const marketId = req.params.id;

  try {
    const query = `
     SELECT m.market_id, m.shop_name, m.shop_description AS description,
       m.shop_logo_url, m.address, m.phone, m.open_time, m.close_time, m.latitude, m.longitude,
       f.food_id, f.food_name, f.price, f.image_url, f.rating
    FROM markets m
    LEFT JOIN foods f ON f.market_id = m.market_id
    WHERE m.market_id = $1
    ORDER BY f.food_id DESC;

    `;
    const result = await pool.query(query, [marketId]);

    res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error("Error fetching foods for market:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  const { category_name } = req.body;
  const imageFile = req.file; // ได้จาก multer + cloudinary storage

  if (!category_name) {
    return res.status(400).json({ message: "กรุณาใส่ชื่อหมวดหมู่ !" });
  }

  else if(!imageFile) {
    return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพ !" });
  }

  try {
    // ✅ 1. ตรวจสอบชื่อซ้ำ
    const checkQuery = `SELECT * FROM categorys WHERE name = $1`;
    const checkResult = await pool.query(checkQuery, [category_name]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ message: "ชื่อหมวดหมู่นี้มีอยู่แล้ว" });
    }

    // ✅ 2. ได้ URL จาก Cloudinary
    let imageUrl = null;
    if (imageFile) {
      imageUrl = imageFile.path; // path จะเป็น URL ของรูปที่อัปโหลดขึ้น Cloudinary แล้ว
    }

    // ✅ 3. เพิ่มข้อมูลใหม่ลงใน DB
    const insertQuery = `
      INSERT INTO categorys (name, cate_image_url)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query(insertQuery, [category_name, imageUrl]);

    return res.status(201).json({
      message: "เพิ่มหมวดหมู่สำเร็จ",
      category: result.rows[0],
    });
  } catch (err) {
    console.error("Error creating category:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createMarket = async (req, res) => {
  const {
    shop_name,
    shop_description,
    open_time,
    close_time,
    address,
    phone,
    latitude,
    longitude,
    // ❌ อย่าดึง shop_logo_url จาก body เมื่อใช้ Cloudinary
  } = req.body;

  try {
    // ✅ ตรวจสิทธิ์จาก JWT
    const isAdmin =
      req.user?.is_admin === true ||
      ['admin', 'm_admin'].includes(req.user?.role);
    const adminId = req.user?.admin_id;

    if (!adminId || !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Only admin can add market" });
    }

    // ✅ รูปจาก Cloudinary (secure_url)
    const shop_logo_url = req.file?.path || null;

    const query = `
      INSERT INTO markets
        (shop_name, shop_description, shop_logo_url, open_time, close_time,
         address, phone, latitude, longitude, admin_id, is_admin)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
      RETURNING *;
    `;

    const values = [
      shop_name,
      shop_description || null,
      shop_logo_url,
      open_time || null,
      close_time || null,
      address || null,
      phone || null,
      latitude,
      longitude,
      adminId,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      message: "เพิ่มร้านอาหารสำเร็จ",
      market: result.rows[0],
      admin_id: adminId,
    });

  } catch (err) {
    console.error("Error creating market:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


// controllers/foodController.js
exports.deleteFood = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM foods WHERE id = $1', [id]);
  res.status(200).json({ message: 'Deleted' });
};

exports.updateFood = async (req, res) => {
  const foodId = req.params.id;
  const { foodName, shopName, price } = req.body;

  try {
    let imageUrl;

    // ถ้ามีการอัปโหลดไฟล์รูปใหม่
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'food-menu',
      });
      imageUrl = result.secure_url;
    }

    // อัปเดตฐานข้อมูล
    const updateQuery = `
      UPDATE foods
      SET food_name = $1, shop_name = $2, price = $3${imageUrl ? ', image_url = $4' : ''}
      WHERE id = $${imageUrl ? 5 : 4}
      RETURNING *;
    `;
    const values = imageUrl
      ? [foodName, shopName, price, imageUrl, foodId]
      : [foodName, shopName, price, foodId];

    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating food:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดตเมนู' });
  }
};
