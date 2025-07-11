const pool = require('../config/db');

exports.marketsController = async (req, res) => {
  const owner_id = req.user?.user_id;
  const { shop_name, shop_description, open_time, close_time } = req.body;
  const shop_logo_url = req.file?.path;

  if (!owner_id) {
    return res.status(400).json({ message: 'ไม่พบ owner_id จาก token' });
  }

  if (!shop_name || !shop_description || !shop_logo_url || !open_time || !close_time) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    await pool.query(
      `UPDATE users SET is_seller = true WHERE user_id = $1`,
      [owner_id]
    );

    console.log('📥 Received from frontend:', {
      owner_id,
      shop_name,
      shop_description,
      shop_logo_url,
      open_time,
      close_time
    });

    const result = await pool.query(
      `INSERT INTO markets (owner_id, shop_name, shop_description, shop_logo_url, open_time, close_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [owner_id, shop_name, shop_description, shop_logo_url, open_time, close_time]
    );

    res.status(200).json({
      message: 'เพิ่มร้านค้าสำเร็จ',
      market: result.rows[0],
    });

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดขณะเพิ่มร้านค้า:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: error.message });
  }
};



exports.getMyMarket = async (req, res) => {
  const userId = req.user?.user_id;
  try {
    const result = await pool.query('SELECT * FROM markets WHERE owner_id = $1', [userId]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'ยังไม่มีร้านค้า' });

    res.status(200).json({ message: 'ดูร้านค้าสำเร็จ', market: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

exports.addFood = async (req, res) => {
  console.log("👉 [addFood] req.user:", req.user); // ต้องมี user_id
  console.log('👉 addFood request body:', req.body);
  console.log('👉 addFood request file:', req.file);
  console.log('👉 user from token:', req.user);

  const userId = req.user?.user_id;
  const { food_name, price, options } = req.body;

  try {
    const marketResult = await pool.query(
      'SELECT market_id FROM markets WHERE owner_id = $1',
      [userId]
    );

    if (marketResult.rows.length === 0) {
      console.log('❌ ไม่พบร้านของผู้ใช้:', userId);
      return res.status(404).json({ message: 'ไม่พบร้านของผู้ใช้' });
    }

    const marketId = marketResult.rows[0].market_id;

    const image = req.file?.path;

    console.log('marketId:', marketId, 'image:', image);

    const result = await pool.query(
      `INSERT INTO foods (market_id, food_name, price, image_url, options)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [marketId, food_name, price, image, options]
    );

    console.log('เพิ่มเมนูสำเร็จ:', result.rows[0]);

    res.status(200).json({ message: 'เพิ่มเมนูสำเร็จ', food: result.rows[0] });
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการเพิ่มเมนู:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มเมนู' });
  }
};

exports.getMyFoods = async (req, res) => {
  const userId = req.user?.user_id;

  try {
    const marketResult = await pool.query(
      'SELECT market_id FROM markets WHERE owner_id = $1',
      [userId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านของผู้ใช้' });
    }

    const marketId = marketResult.rows[0].market_id;

    const foodsResult = await pool.query(
      'SELECT * FROM foods WHERE market_id = $1',
      [marketId]
    );

    // ✅ ตรวจสอบ options ถ้าเป็น null ให้ใส่เป็น '[]'
    const foods = foodsResult.rows.map((food) => {
      return {
        ...food,
        options: JSON.stringify(food.options ?? []), // แปลงให้เป็น string เสมอ
      };
    });

    // ✅ log เพื่อดูว่า options ถูกส่งกลับจริงไหม
    // console.log('📦 เมนูที่โหลดมา:', foods);
    console.log('📦 เมนูที่โหลดมา:', JSON.stringify(foods, null, 2));

    res.status(200).json({ foods });
  } catch (err) {
    console.error('❌ ดึงเมนูล้มเหลว:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงเมนู' });
  }
};

exports.addFood = async (req, res) => {
  const userId = req.user?.user_id;
  const { food_name, price, options } = req.body;

  try {
    const marketResult = await pool.query(
      'SELECT market_id FROM markets WHERE owner_id = $1',
      [userId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านของผู้ใช้' });
    }

    const marketId = marketResult.rows[0].market_id;
    const image = req.file?.path;

    // options ควรเป็น JSON string (frontend ต้องแปลงก่อนส่ง)
    const optionsJson = options ? JSON.stringify(JSON.parse(options)) : null;

    const result = await pool.query(
      `INSERT INTO foods (market_id, food_name, price, image_url, options)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [marketId, food_name, price, image, optionsJson]
    );

    res.status(200).json({ message: 'เพิ่มเมนูสำเร็จ', food: result.rows[0] });
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการเพิ่มเมนู:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มเมนู' });
  }
};

exports.updateFood = async (req, res) => {
  const userId = req.user?.user_id;
  const foodId = req.params.id;
  const { food_name, price, options } = req.body;
  const image = req.file?.path;

  console.log('🟢 updateFood called');
  console.log('User ID:', userId);
  console.log('Food ID:', foodId);
  console.log('Request body:', req.body);
  console.log('Image path:', image);

  try {
    // ตรวจสอบร้านของ user
    const marketResult = await pool.query(
      'SELECT market_id FROM markets WHERE owner_id = $1',
      [userId]
    );
    console.log('Market check result:', marketResult.rows);

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านค้าของคุณ' });
    }

    const marketId = marketResult.rows[0].market_id;

    // ตรวจสอบว่าเมนูนี้เป็นของร้านผู้ใช้
    const foodCheck = await pool.query(
      'SELECT * FROM foods WHERE food_id = $1 AND market_id = $2',
      [foodId, marketId]
    );
    console.log('Food ownership check:', foodCheck.rows);

    if (foodCheck.rows.length === 0) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขเมนูนี้' });
    }

    // แปลง options
    const optionsJson = options ? JSON.stringify(JSON.parse(options)) : null;
    console.log('Parsed options JSON:', optionsJson);

    // สร้าง query dynamic ตามว่ามีรูปภาพไหม และ options
    let updateQuery = 'UPDATE foods SET food_name = $1, price = $2';
    const params = [food_name, price];
    let paramIndex = 3;

    if (image) {
      updateQuery += `, image_url = $${paramIndex}`;
      params.push(image);
      paramIndex++;
    }
    if (optionsJson) {
      updateQuery += `, options = $${paramIndex}`;
      params.push(optionsJson);
      paramIndex++;
    }

    updateQuery += ` WHERE food_id = $${paramIndex} RETURNING *`;
    params.push(foodId);

    console.log('Update Query:', updateQuery);
    console.log('Query Params:', params);

    const result = await pool.query(updateQuery, params);
    console.log('Update result:', result.rows[0]);

    res.status(200).json({ message: 'อัปเดตเมนูสำเร็จ', food: result.rows[0] });
  } catch (err) {
    console.error('❌ อัปเดตเมนูผิดพลาด:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตเมนู' });
  }
};
