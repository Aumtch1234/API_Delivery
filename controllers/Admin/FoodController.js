const pool = require('../../config/db');

exports.postFood = async (req, res) => {
  const user = req.user;
  const adminId = user?.admin_id || user?.user_id; // รองรับทั้ง admin และ user
  let { food_name, price, options, market_id, category_id } = req.body; // ✅ ดึง market_id มาด้วย
  const imageUrl = req.file?.path;

  if (!user?.admin_id) {
    return res.status(403).json({ message: "เฉพาะแอดมินเท่านั้นที่สามารถเพิ่มเมนูได้" });
  }

  if (!market_id) {
    return res.status(400).json({ message: "market_id is required" });
  }

  if (!imageUrl) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  try {
    // ✅ parse options
    if (!options) {
      options = [];
    } else if (typeof options === "string") {
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

    const basePrice = Number(price) || 0;

    // ✅ แอดมินบวก 20%
    const sellPrice = Math.ceil(basePrice * 1.2);

    // ✅ options บวก 20%
    const sellOptions = options.map((option) => {
      const optPriceNum = Number(option.extraPrice || option.price) || 0;
      const optionPrice = Math.ceil(optPriceNum * 1.2);
      return { ...option, extraPrice: optionPrice };
    });

    // ✅ category_id parse ด้วย
    let categoryIds = [];
    if (category_id) {
      try {
        categoryIds = typeof category_id === "string" ? JSON.parse(category_id) : category_id;
      } catch (e) {
        categoryIds = [];
      }
    }

    // ✅ บันทึกลงฐานข้อมูล
    await pool.query(
      `INSERT INTO foods 
      (market_id, food_name, price, sell_price, image_url, options, sell_options, category_id, created_by_admin_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        market_id,
        food_name,
        basePrice,
        sellPrice,
        imageUrl,
        JSON.stringify(options),
        JSON.stringify(sellOptions),
        JSON.stringify(categoryIds),
        adminId,
      ]
    );

    res.status(200).json({
      message: "เพิ่มเมนูสำเร็จ (+20%)",
      data: {
        food_name,
        basePrice,
        sellPrice,
        imageUrl,
        options,
        sell_options: sellOptions,
        created_by: adminId,
      },
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่ server" });
  }
};

exports.IsManualMarket = async (req, res) => {
  // ✅ แก้ไข: ใช้ req.params.id แทน req.params.marketId เพราะ route ใช้ :id
  const { id: marketId } = req.params;
  const { is_manual_override } = req.body;

  try {
    // ตรวจสอบว่ามี marketId
    if (!marketId) {
      return res.status(400).json({
        success: false,
        message: "ไม่พบ Market ID"
      });
    }

    // ตรวจสอบว่ามีค่า is_manual_override
    if (typeof is_manual_override !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ is_manual_override เป็น boolean"
      });
    }

    // ตรวจสอบว่าร้านค้ามีอยู่จริง
    const checkMarket = await pool.query(
      'SELECT market_id, shop_name, is_manual_override FROM markets WHERE market_id = $1',
      [marketId]
    );

    if (checkMarket.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบร้านค้านี้"
      });
    }

    // อัปเดตโหมด manual override
    const updateQuery = `
      UPDATE markets 
      SET is_manual_override = $1,
          override_until = CASE 
            WHEN $1 = true THEN NULL 
            ELSE override_until 
          END
      WHERE market_id = $2
      RETURNING market_id, shop_name, is_open, is_manual_override, override_until
    `;

    const result = await pool.query(updateQuery, [is_manual_override, marketId]);

    // ถ้าเปลี่ยนเป็นโหมดอัตโนมัติ ให้คำนวณสถานะเปิด-ปิดตามเวลา
    if (!is_manual_override) {
      const market = result.rows[0];
      const marketDetails = await pool.query(
        'SELECT open_time, close_time FROM markets WHERE market_id = $1',
        [marketId]
      );

      if (marketDetails.rows.length > 0) {
        const { open_time, close_time } = marketDetails.rows[0];
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM

        let shouldBeOpen;

        // จัดการกรณีร้านเปิดข้ามวัน (เช่น 18:00 - 05:00)
        if (open_time > close_time) {
          shouldBeOpen = currentTime >= open_time || currentTime < close_time;
        } else {
          shouldBeOpen = currentTime >= open_time && currentTime < close_time;
        }

        // อัปเดตสถานะเปิด-ปิดตามเวลาจริง
        await pool.query(
          'UPDATE markets SET is_open = $1 WHERE market_id = $2',
          [shouldBeOpen, marketId]
        );

        result.rows[0].is_open = shouldBeOpen;
      }
    }

    return res.status(200).json({
      success: true,
      message: is_manual_override
        ? "เปลี่ยนเป็นโหมดปรับเองสำเร็จ"
        : "เปลี่ยนเป็นโหมดอัตโนมัติสำเร็จ",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error toggling manual override:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการเปลี่ยนโหมด",
      error: error.message
    });
  }
};

// ✅ Toggle การแสดงเมนู
exports.toggleFoodVisibility = async (req, res) => {
  const { food_id } = req.params;
  const { is_visible } = req.body;

  try {
    // ตรวจสอบ input
    if (typeof is_visible !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุค่า is_visible เป็น true หรือ false"
      });
    }

    // ตรวจสอบว่าเมนูมีอยู่จริงไหม
    const check = await pool.query("SELECT food_name FROM foods WHERE food_id = $1", [food_id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบเมนูอาหารนี้" });
    }

    // อัปเดตสถานะ
    const result = await pool.query(
      `UPDATE foods 
       SET is_visible = $1
       WHERE food_id = $2 
       RETURNING food_id, food_name, is_visible`,
      [is_visible, food_id]
    );

    return res.status(200).json({
      success: true,
      message: is_visible ? "✅ แสดงเมนูในระบบแล้ว" : "🚫 ซ่อนเมนูเรียบร้อย",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("❌ toggleFoodVisibility error:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการเปลี่ยนสถานะเมนู",
      error: error.message
    });
  }
};


// ฟังก์ชันเสริม: อัปเดตสถานะเปิด-ปิดร้านเมื่ออยู่ในโหมด Manual
exports.ToggleStoreStatus = async (req, res) => {
  const { id: marketId } = req.params;

  const { is_open } = req.body;

  try {
    if (!marketId) {
      return res.status(400).json({
        success: false,
        message: "ไม่พบ Market ID"
      });
    }

    if (typeof is_open !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ is_open เป็น boolean"
      });
    }

    // ตรวจสอบว่าร้านอยู่ในโหมด Manual หรือไม่
    const checkMarket = await pool.query(
      'SELECT is_manual_override FROM markets WHERE market_id = $1',
      [marketId]
    );

    if (checkMarket.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบร้านค้านี้"
      });
    }

    if (!checkMarket.rows[0].is_manual_override) {
      return res.status(403).json({
        success: false,
        message: "ไม่สามารถเปิด/ปิดร้านได้ เนื่องจากอยู่ในโหมดอัตโนมัติ กรุณาเปลี่ยนเป็นโหมดปรับเองก่อน"
      });
    }

    // อัปเดตสถานะเปิด-ปิด
    const result = await pool.query(
      `UPDATE markets 
       SET is_open = $1
       WHERE market_id = $2
       RETURNING market_id, shop_name, is_open, is_manual_override`,
      [is_open, marketId]
    );

    return res.status(200).json({
      success: true,
      message: is_open ? "เปิดร้านสำเร็จ" : "ปิดร้านสำเร็จ",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error toggling store status:", error);
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการเปิด/ปิดร้าน",
      error: error.message
    });
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
     SELECT
      m.market_id, 
      m.shop_name, 
      m.shop_description AS description,
      m.shop_logo_url, 
      m.address, 
      m.phone, 
      m.open_time, 
      m.close_time,
      m.latitude, 
      m.longitude,
      m.is_open, 
      m.is_manual_override, 
      m.override_until,
      f.food_id, 
      f.food_name, 
      f.price, 
      f.sell_price, 
      f.image_url,
      COALESCE(AVG(r.rating), 0) AS rating,  -- ✅ ใช้ค่าเฉลี่ยแทน f.rating
      f.options, 
      f.sell_options, 
      f.category_id,
      f.is_visible,
      c.name AS category_name,
      c.cate_image_url AS category_image_url
    FROM markets m
    LEFT JOIN foods f ON f.market_id = m.market_id
    LEFT JOIN categorys c ON c.id = f.category_id
    LEFT JOIN food_reviews r ON r.food_id = f.food_id  -- ✅ join รีวิว
    WHERE m.market_id = $1
    GROUP BY 
      m.market_id, m.shop_name, m.shop_description, m.shop_logo_url, m.address,
      m.phone, m.open_time, m.close_time, m.latitude, m.longitude,
      m.is_open, m.is_manual_override, m.override_until,
      f.food_id, f.food_name, f.price, f.sell_price, f.image_url,
      f.options, f.sell_options, f.category_id, c.name, c.cate_image_url
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

  else if (!imageFile) {
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

exports.updateMarket = async (req, res) => {
  const marketId = req.params.id;
  const {
    shop_name,
    shop_description,
    open_time,
    close_time,
    address,
    phone,
    latitude,
    longitude,
  } = req.body;

  try {
    // ตรวจสอบสิทธิ์
    const isAdmin =
      req.user?.is_admin === true ||
      ['admin', 'm_admin'].includes(req.user?.role);
    const adminId = req.user?.admin_id;

    if (!adminId || !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Only admin can update market" });
    }

    // ดึงข้อมูลเดิม
    const current = await pool.query(
      `SELECT * FROM markets WHERE market_id = $1`,
      [marketId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบร้านค้านี้" });
    }

    const old = current.rows[0];

    // เตรียมข้อมูลที่จะอัปเดต
    const sets = [];
    const vals = [];
    const push = (sql, val) => { sets.push(sql); vals.push(val); };

    if (shop_name !== undefined) push(`shop_name = $${vals.length + 1}`, shop_name);
    if (shop_description !== undefined) push(`shop_description = $${vals.length + 1}`, shop_description);
    if (open_time !== undefined) push(`open_time = $${vals.length + 1}`, open_time);
    if (close_time !== undefined) push(`close_time = $${vals.length + 1}`, close_time);
    if (address !== undefined) push(`address = $${vals.length + 1}`, address);
    if (phone !== undefined) push(`phone = $${vals.length + 1}`, phone);
    if (latitude !== undefined) push(`latitude = $${vals.length + 1}`, parseFloat(latitude));
    if (longitude !== undefined) push(`longitude = $${vals.length + 1}`, parseFloat(longitude));

    // อัปโหลดรูปใหม่ถ้ามี
    if (req.file?.path) {
      push(`shop_logo_url = $${vals.length + 1}`, req.file.path);
    }

    if (sets.length === 0) {
      return res.status(400).json({ message: "ไม่มีข้อมูลที่ต้องการอัปเดต" });
    }

    const sql = `UPDATE markets SET ${sets.join(", ")} WHERE market_id = $${vals.length + 1} RETURNING *;`;
    vals.push(marketId);

    const result = await pool.query(sql, vals);

    return res.status(200).json({
      message: "อัปเดตร้านค้าสำเร็จ",
      market: result.rows[0],
    });

  } catch (err) {
    console.error("Error updating market:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateFood = async (req, res) => {
  const user = req.user;
  if (!user?.admin_id) {
    return res.status(403).json({ message: "เฉพาะแอดมินเท่านั้นที่สามารถแก้ไขเมนูได้" });
  }

  const foodId = req.params.id;
  let { food_name, price, options, category_id, market_id } = req.body;
  const imageUrl = req.file?.path || null;

  try {
    // 1) ของเดิม
    const cur = await pool.query(
      `SELECT food_id, market_id, food_name, price, sell_price, image_url, options, sell_options, category_id
       FROM foods WHERE food_id = $1`,
      [foodId]
    );
    if (cur.rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบเมนูนี้" });
    }
    const old = cur.rows[0];

    // 2) เตรียมค่าที่จะอัปเดต
    // 2.1 price / sell_price
    let basePrice = (price !== undefined && price !== null && price !== "") ? Number(price) : Number(old.price);
    if (!Number.isFinite(basePrice) || basePrice < 0) basePrice = Number(old.price);
    const sellPrice = Math.ceil(basePrice * 1.2);

    // 2.2 options / sell_options
    if (options === undefined || options === null || options === "") {
      options = old.options;
    }
    try {
      if (typeof options === "string") options = JSON.parse(options);
    } catch { options = []; }
    if (!Array.isArray(options)) options = [];
    const sellOptions = options.map((o) => {
      const optPriceNum = Number(o.extraPrice ?? o.price) || 0;
      return { ...o, extraPrice: Math.ceil(optPriceNum * 1.2) };
    });

    // 2.3 category_id -> ต้องเป็น integer เดี่ยว (รองรับรับมาหลายรูปแบบ)
    let newCategoryId = old.category_id; // default = ของเดิม
    if (category_id !== undefined) {
      let raw = category_id;

      // รับเป็นสตริงที่อาจเป็นตัวเลข หรือ JSON array ("[5]" / "[]")
      if (typeof raw === "string") {
        const t = raw.trim();
        if (t.startsWith("[")) {
          try {
            const arr = JSON.parse(t);
            raw = Array.isArray(arr) ? (arr[0] ?? null) : t; // [] -> null
          } catch {
            // ไม่ใช่ JSON array ก็ปล่อยให้ไป parse ตัวเลขด้านล่าง
          }
        }
      }
      // รับเป็น array จริง ๆ
      if (Array.isArray(raw)) {
        raw = raw[0] ?? null; // เอาตัวแรก ถ้า [] ให้เป็น null
      }

      if (raw === null || raw === "" || raw === undefined) {
        // เลือกได้ 2 ทาง: ตั้งเป็น null หรือข้ามไม่อัปเดต
        // ถ้าอยาก 'ล้าง' หมวดหมู่ให้ใช้บรรทัดนี้:
        // newCategoryId = null;
        // ถ้าไม่อยากล้าง ให้ "ข้ามการอัปเดต":
        newCategoryId = old.category_id;
      } else {
        const cid = Number(raw);
        if (!Number.isInteger(cid)) {
          return res.status(400).json({ message: "category_id ต้องเป็นจำนวนเต็ม" });
        }
        newCategoryId = cid;
      }
    }

    // 2.4 market_id -> บังคับเป็นตัวเลขถ้าส่งมา
    let newMarketId = undefined;
    if (market_id !== undefined) {
      const mid = Number(market_id);
      if (!Number.isInteger(mid) || mid <= 0) {
        return res.status(400).json({ message: "market_id ต้องเป็นจำนวนเต็มบวก" });
      }
      newMarketId = mid;
    }

    // 3) Build UPDATE
    const sets = [];
    const vals = [];
    const push = (sql, val) => { sets.push(sql); vals.push(val); };

    if (food_name !== undefined) push(`food_name = $${vals.length + 1}`, food_name);
    if (price !== undefined) {
      push(`price = $${vals.length + 1}`, basePrice);
      push(`sell_price = $${vals.length + 1}`, sellPrice);
    }
    if (options !== undefined) {
      push(`options = $${vals.length + 1}`, JSON.stringify(options));
      push(`sell_options = $${vals.length + 1}`, JSON.stringify(sellOptions));
    }
    if (category_id !== undefined) {
      // ❗ ส่งเป็น integer/NULL ตรง ๆ ไม่ stringify
      push(`category_id = $${vals.length + 1}`, newCategoryId);
    }
    if (imageUrl) {
      push(`image_url = $${vals.length + 1}`, imageUrl);
    }
    if (newMarketId !== undefined) {
      push(`market_id = $${vals.length + 1}`, newMarketId);
    }

    if (sets.length === 0) {
      return res.status(400).json({ message: "ไม่มีฟิลด์ที่ต้องการอัปเดต" });
    }

    const sql = `UPDATE foods SET ${sets.join(", ")} WHERE food_id = $${vals.length + 1} RETURNING *;`;
    vals.push(foodId);

    const result = await pool.query(sql, vals);
    return res.status(200).json({ message: "อัปเดตเมนูสำเร็จ", food: result.rows[0] });
  } catch (err) {
    console.error("Error updating food:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่ server" });
  }
};

// ให้ใช้ food_id ให้สอดคล้องกับที่ SELECT ใช้อยู่
exports.deleteFood = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM foods WHERE food_id = $1', [id]);
  res.status(200).json({ message: 'Deleted' });
};