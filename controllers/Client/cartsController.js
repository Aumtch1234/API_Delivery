const pool = require('../../config/db');

// ➕ เพิ่มอาหารลง cart พร้อมเช็ค duplicate
exports.AddCarts = async (req, res) => {
  try {
    const { food_id, quantity, selected_options, note } = req.body;
    const user_id = req.user.user_id;

    // ตรวจสอบว่ามีอยู่แล้วหรือไม่ (เช็ค food_id + selected_options + note)
    const existing = await pool.query(
      `SELECT * FROM carts 
       WHERE user_id = $1 
       AND food_id = $2 
       AND selected_options::jsonb = $3::jsonb 
       AND note = $4`,
      [user_id, food_id, JSON.stringify(selected_options || []), note || '']
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: 'เมนูนี้มีอยู่ในตะกร้าแล้ว',
        cart: existing.rows[0],
      });
    }

    // ดึงข้อมูลอาหาร
    const foodResult = await pool.query(
      `SELECT food_id, sell_price FROM foods WHERE food_id = $1`,
      [food_id]
    );

    if (foodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }

    const food = foodResult.rows[0];
    let extraPrice = 0;

    // ราคาดิบ (price) = ราคาอาหารเท่านั้น
    const unitPrice = parseFloat(food.sell_price);

    // รวมตัวเลือก (extraPrice)
    if (Array.isArray(selected_options)) {
      selected_options.forEach(opt => {
        extraPrice += opt.extraPrice || 0;
      });
    }

    // ราคารวม = (ราคาดิบ + extraPrice) * quantity
    const total = (unitPrice + extraPrice) * quantity;

    const insert = await pool.query(
      `INSERT INTO carts (user_id, food_id, quantity, selected_options, note, total)
   VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        user_id,
        food_id,
        quantity,
        JSON.stringify(selected_options || []),
        note || '',
        total      // ✅ รวมตัวเลือกและจำนวน
      ]
    );


    res.json({ success: true, cart: insert.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// 📥 ดูตะกร้า (เฉพาะ user)
exports.GetCarts = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await pool.query(
      `SELECT c.*, 
      f.food_name, f.image_url, f.market_id, f.sell_price,
      m.shop_name
       FROM carts c
       JOIN foods f ON c.food_id = f.food_id
       JOIN markets m ON f.market_id = m.market_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [user_id]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS cart_count
   FROM carts
   WHERE user_id = $1`,
      [user_id]
    );


    res.json({
      success: true,
      cartCount: countResult.rows[0].cart_count,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ❌ ลบออกจาก cart
exports.RemoveCart = async (req, res) => {
  try {
    const { cart_id } = req.params;
    const user_id = req.user.user_id;

    console.log('📝 Delete request cart_id:', cart_id, 'user_id:', user_id);

    const result = await pool.query(
      `DELETE FROM carts WHERE cart_id = $1 AND user_id = $2 RETURNING *`,
      [cart_id, user_id]
    );

    console.log('📝 Deleted rows:', result.rowCount);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Cart not found or not yours' });
    }

    res.json({ success: true, message: 'ลบรายการเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ RemoveCart error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};