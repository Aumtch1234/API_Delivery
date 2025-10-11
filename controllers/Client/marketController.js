const pool = require('../../config/db');

exports.marketsController = async (req, res) => {
  const owner_id = req.user?.user_id;
  const { shop_name, shop_description, open_time, close_time, address, phone, latitude, longitude } = req.body;
  const shop_logo_url = req.file?.path;

  if (!owner_id) {
    return res.status(400).json({ message: 'ไม่พบ owner_id จาก token' });
  }

  if (!shop_name || !shop_description || !shop_logo_url || !open_time || !close_time || !address || !phone) {
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
      close_time,
      address,
      phone,
      latitude,
      longitude
    });

    const result = await pool.query(
      `INSERT INTO markets (owner_id, shop_name, shop_description, shop_logo_url, open_time, close_time, address, phone, latitude, longitude)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
   RETURNING *`,
      [owner_id, shop_name, shop_description, shop_logo_url, open_time, close_time, address, phone, latitude, longitude]
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

exports.updateMarketController = async (req, res) => {
  const { id } = req.params;
  const {
    shop_name,
    shop_description,
    open_time,
    close_time,
    address,
    phone,
    latitude,
    longitude
  } = req.body;

  const shop_logo_url = req.file?.path;

  if (!shop_name || !shop_description || !open_time || !close_time) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const result = await pool.query(
      `UPDATE markets
       SET shop_name = $1,
           shop_description = $2,
           open_time = $3,
           close_time = $4,
           address = $5,
           phone = $6,
           latitude = $7,
           longitude = $8,
           shop_logo_url = COALESCE($9, shop_logo_url) -- ✅ อัปเดตเฉพาะถ้าส่งรูปมา
       WHERE market_id = $10
       RETURNING *`,
      [
        shop_name,
        shop_description,
        open_time,
        close_time,
        address,
        phone,
        latitude,
        longitude,
        shop_logo_url, // ถ้าไม่ส่งรูปมาจะไม่เปลี่ยน
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านค้านี้' });
    }

    res.status(200).json({
      message: 'อัปเดตร้านค้าสำเร็จ',
      market: result.rows[0],
    });

  } catch (error) {
    console.error('❌ Error updating market:', error);
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
  const userId = req.user?.user_id;
  // const { food_name, price, options } = req.body;
  let { food_name, price, options } = req.body;

  try {
    // หา market ของ user
    const marketResult = await pool.query(
      'SELECT market_id, owner_id FROM markets WHERE owner_id = $1',
      [userId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านของผู้ใช้' });
    }

    const market = marketResult.rows[0];
    const marketId = market.market_id;
    const image = req.file?.path;

    // ✅ ตรวจสอบและ normalize options
    if (!options) {
      options = [];
    } else if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (err) {
        console.warn("⚠️ options JSON.parse failed:", err);
        options = [];
      }
    }
    if (!Array.isArray(options)) {
      options = [];
    }
    // ✅ คำนวณราคาขาย
    const sellPrice = market.owner_id
      ? Math.ceil(price * 1.15) // +15% แล้วปัดขึ้น
      : Math.ceil(price * 1.20); // +20% แล้วปัดขึ้น

    // ✅ คำนวณราคา options +15% ของสมาชิก หรือ +20% ของแอดมิน ถ้ามี
    const sellOptions = options.map(option => {
      const optPriceNum = Number(option.extraPrice || option.price) || 0;
      const optionPrice = market.owner_id
        ? Math.ceil(optPriceNum * 1.15)
        : Math.ceil(optPriceNum * 1.20);
      return { ...option, extraPrice: optionPrice };
    });

    const result = await pool.query(
      `INSERT INTO foods (market_id, food_name, price, sell_price, image_url, options, sell_options)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [marketId, food_name, price, sellPrice, image, JSON.stringify(options), JSON.stringify(sellOptions)]
    );

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

    // ✅ JOIN กับ categorys table เพื่อดึง category_name
    const foodsResult = await pool.query(
      `SELECT 
        f.food_id,
        f.market_id,
        f.food_name,
        f.price,
        f.sell_price,
        f.image_url,
        f.options,
        f.sell_options,
        f.rating,
        f.created_at,
        f.created_by_admin_id,
        f.category_id,
        c.name as category_name,
        c.cate_image_url
       FROM foods f
       LEFT JOIN categorys c ON f.category_id = c.id
       WHERE f.market_id = $1
       ORDER BY f.created_at DESC`,
      [marketId]
    );

    // ✅ ตรวจสอบ options ถ้าเป็น null ให้ใส่เป็น '[]'
    const foods = foodsResult.rows.map((food) => {
      return {
        ...food,
        options: food.options ? JSON.stringify(food.options) : '[]',
        sell_options: food.sell_options ? food.sell_options : [],
      };
    });

    console.log('📦 เมนูที่โหลดมา (with category):', JSON.stringify(foods, null, 2));

    res.status(200).json({ foods });
  } catch (err) {
    console.error('❌ ดึงเมนูล้มเหลว:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงเมนู' });
  }
};

exports.addFood = async (req, res) => {
  const userId = req.user?.user_id;
  let { food_name, price, options, category_id } = req.body; // ✅ เพิ่ม category_id

  try {
    // หา market ของ user
    const marketResult = await pool.query(
      'SELECT market_id, owner_id FROM markets WHERE owner_id = $1',
      [userId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านของผู้ใช้' });
    }

    const market = marketResult.rows[0];
    const marketId = market.market_id;
    const image = req.file?.path;

    // ✅ ตรวจสอบและ normalize options
    if (!options) {
      options = [];
    } else if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (err) {
        console.warn("⚠️ options JSON.parse failed:", err);
        options = [];
      }
    }
    if (!Array.isArray(options)) {
      options = [];
    }

    // ✅ คำนวณราคาขาย
    const sellPrice = market.owner_id
      ? Math.ceil(price * 1.15) // +15% แล้วปัดขึ้น
      : Math.ceil(price * 1.20); // +20% แล้วปัดขึ้น

    // ✅ คำนวณราคา options +15% ของสมาชิก หรือ +20% ของแอดมิน ถ้ามี
    const sellOptions = options.map(option => {
      const optPriceNum = Number(option.extraPrice || option.price) || 0;
      const optionPrice = market.owner_id
        ? Math.ceil(optPriceNum * 1.15)
        : Math.ceil(optPriceNum * 1.20);
      return { ...option, extraPrice: optionPrice };
    });

    // ✅ เพิ่ม category_id ในการ INSERT
    const result = await pool.query(
      `INSERT INTO foods (market_id, food_name, price, sell_price, image_url, options, sell_options, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [marketId, food_name, price, sellPrice, image, JSON.stringify(options), JSON.stringify(sellOptions), category_id]
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
  let { food_name, price, options, category_id } = req.body; // ✅ เพิ่ม category_id
  const image = req.file?.path;

  console.log('🟢 updateFood called');
  console.log('User ID:', userId);
  console.log('Food ID:', foodId);
  console.log('Request body:', req.body);
  console.log('Category ID:', category_id); // ✅ เพิ่ม log
  console.log('Image path:', image);

  try {
    // ตรวจสอบร้านของ user
    const marketResult = await pool.query(
      'SELECT market_id, owner_id FROM markets WHERE owner_id = $1',
      [userId]
    );
    console.log('Market check result:', marketResult.rows);

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบร้านค้าของคุณ' });
    }

    const market = marketResult.rows[0];
    const marketId = market.market_id;

    // ตรวจสอบว่าเมนูนี้เป็นของร้านผู้ใช้
    const foodCheck = await pool.query(
      'SELECT * FROM foods WHERE food_id = $1 AND market_id = $2',
      [foodId, marketId]
    );
    console.log('Food ownership check:', foodCheck.rows);

    if (foodCheck.rows.length === 0) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขเมนูนี้' });
    }

    // ✅ คำนวณ sell_price ใหม่
    const sellPrice = market.owner_id
      ? Math.ceil(price * 1.15) // +15% แล้วปัดขึ้น
      : Math.ceil(price * 1.20); // +20% แล้วปัดขึ้น
    console.log('Calculated sell_price:', sellPrice);

    // ✅ ตรวจสอบและแปลง options
    let parsedOptions = [];
    let sellOptions = [];
    if (options) {
      if (typeof options === 'string') {
        try {
          parsedOptions = JSON.parse(options);
        } catch (err) {
          console.warn("⚠️ options JSON.parse failed:", err);
          parsedOptions = [];
        }
      } else if (Array.isArray(options)) {
        parsedOptions = options;
      }
      // คำนวณ sell_options ใหม่
      sellOptions = parsedOptions.map(option => {
        const optPriceNum = Number(option.extraPrice || option.price) || 0;
        const optionPrice = market.owner_id
          ? Math.ceil(optPriceNum * 1.15)
          : Math.ceil(optPriceNum * 1.20);
        return { ...option, extraPrice: optionPrice };
      });
    }
    console.log('Parsed options:', parsedOptions);
    console.log('Calculated sell_options:', sellOptions);

    // ✅ สร้าง query dynamic
    let updateQuery = 'UPDATE foods SET food_name = $1, price = $2, sell_price = $3';
    const params = [food_name, price, sellPrice];
    let paramIndex = 4;

    // ✅ เพิ่ม category_id ถ้ามีการส่งมา
    if (category_id !== undefined && category_id !== null) {
      updateQuery += `, category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (image) {
      updateQuery += `, image_url = $${paramIndex}`;
      params.push(image);
      paramIndex++;
    }

    // เพิ่ม options และ sell_options ถ้ามี
    if (options) {
      updateQuery += `, options = $${paramIndex}`;
      params.push(JSON.stringify(parsedOptions));
      paramIndex++;

      updateQuery += `, sell_options = $${paramIndex}`;
      params.push(JSON.stringify(sellOptions));
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

exports.updateManualOverride = async (req, res) => {
  const userId = req.user?.user_id; // ต้องมี middleware authenticateJWT กำหนด req.user
  const marketId = req.params.id;
  const { is_manual_override, is_open } = req.body;

  if (typeof is_manual_override !== 'boolean') {
    return res.status(400).json({ message: 'is_manual_override ต้องเป็น Boolean' });
  }
  if (typeof is_open !== 'boolean') {
    return res.status(400).json({ message: 'is_open ต้องเป็น Boolean' });
  }

  try {
    // ตรวจสอบเจ้าของร้าน
    const marketCheck = await pool.query(
      'SELECT * FROM markets WHERE market_id = $1 AND owner_id = $2',
      [marketId, userId]
    );

    if (marketCheck.rows.length === 0) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์แก้ไขร้านค้านี้' });
    }

    // อัปเดตค่า is_manual_override และ is_open
    await pool.query(
      `UPDATE markets SET is_manual_override = $1, is_open = $2 WHERE market_id = $3`,
      [is_manual_override, is_open, marketId]
    );

    res.status(200).json({ message: 'อัปเดต manual override สำเร็จ', is_manual_override, is_open });
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน updateManualOverride:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};

exports.updateMarketStatus = async (req, res) => {
  const userId = req.user?.user_id;
  const marketId = req.params.id;
  const { is_open, override_minutes } = req.body;

  if (typeof is_open !== 'boolean') {
    return res.status(400).json({ message: 'is_open ต้องเป็น Boolean (true/false)' });
  }

  try {
    // ตรวจสอบเจ้าของร้าน
    const marketCheck = await pool.query(
      'SELECT * FROM markets WHERE market_id = $1 AND owner_id = $2',
      [marketId, userId]
    );

    if (marketCheck.rows.length === 0) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์แก้ไขร้านค้านี้' });
    }

    const currentMarket = marketCheck.rows[0];

    let override_until = currentMarket.override_until;
    let is_manual_override = currentMarket.is_manual_override;

    if (override_minutes && typeof override_minutes === 'number' && override_minutes > 0) {
      // กำหนดเวลาหมดอายุ override ใหม่
      override_until = new Date(Date.now() + override_minutes * 60 * 1000);
      is_manual_override = true;
    }

    // ถ้า override_minutes ไม่ได้ส่งมา หรือ <=0 จะไม่เปลี่ยน override status และ override_until

    await pool.query(
      `UPDATE markets 
       SET is_open = $1, 
           is_manual_override = $2, 
           override_until = $3 
       WHERE market_id = $4`,
      [is_open, is_manual_override, override_until, marketId]
    );

    res.status(200).json({ message: 'อัปเดตสถานะร้านสำเร็จ', is_open, is_manual_override, override_until });
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' });
  }
};

exports.deleteFood = async (req, res) => {
  const { food_id } = req.params;
  const user_id = req.user.user_id; // จาก JWT

  try {
    // หา market_id ของ user ก่อน
    const marketResult = await pool.query(
      "SELECT market_id FROM markets WHERE owner_id = $1",
      [user_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: "Market not found for this user" });
    }

    const market_id = marketResult.rows[0].market_id;

    // เช็คว่าอาหารนี้อยู่ใน market_id ของ user ไหม
    const foodResult = await pool.query(
      "SELECT * FROM foods WHERE food_id = $1 AND market_id = $2",
      [food_id, market_id]
    );

    if (foodResult.rows.length === 0) {
      return res.status(403).json({ message: "You do not have permission to delete this food" });
    }

    // ลบอาหาร
    await pool.query("DELETE FROM foods WHERE food_id = $1", [food_id]);

    res.json({ message: "Food deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};