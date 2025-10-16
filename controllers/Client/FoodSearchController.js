const pool = require('../../config/db'); // ✅ ใช้ require แทน import

const searchFoodsAndCategories = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: "กรุณาระบุคำค้นหา (q)" });
    }

    const query = `
    SELECT 
      f.food_id,
      f.food_name,
      f.price,
      f.sell_price,
      COALESCE(AVG(fr.rating), 0)::numeric(3,2) AS rating_avg,  -- ✅ ค่าเฉลี่ยจาก food_reviews
      f.image_url,
      m.shop_name,
      m.owner_id,
      m.is_admin,
      m.approve,
      c.name AS category_name
    FROM foods f
    JOIN markets m ON f.market_id = m.market_id
    JOIN categorys c ON f.category_id = c.id
    LEFT JOIN food_reviews fr ON f.food_id = fr.food_id   -- ✅ join รีวิวอาหาร

    WHERE 
      (f.food_name ILIKE $1 
      OR c.name ILIKE $1 
      OR m.shop_name ILIKE $1)
      AND f.is_visible = TRUE     -- ✅ แสดงเฉพาะเมนูที่เปิดให้เห็น

    GROUP BY 
      f.food_id, f.food_name, f.price, f.sell_price, f.image_url,
      m.shop_name, m.owner_id, m.is_admin, m.approve, c.name

    ORDER BY 
      CASE 
        WHEN m.owner_id IS NOT NULL THEN 1  -- ✅ ร้านสมาชิกมาก่อน
        ELSE 2                              -- ✅ ร้าน admin ทีหลัง
      END,
      rating_avg DESC;  -- ✅ เรียงตามค่าเฉลี่ยเรตติ้ง
  `;


    const result = await pool.query(query, [`%${q}%`]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error in searchFoodsAndCategories:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


module.exports = { searchFoodsAndCategories };
