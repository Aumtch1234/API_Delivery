const pool = require('../../config/db');

// ✅ หมวดหมู่ทั้งหมด
exports.getAllCategories = async (req, res) => {
  try {
    // ✅ SELECT ให้ชัดเจนว่า column ไหนเป็น ID หลัก
    const result = await pool.query(`
    SELECT 
      c.id,
      c.name,
      c.cate_image_url,

      -- ✅ จำนวนเมนูอาหารในหมวดนั้น
      COUNT(DISTINCT f.food_id) AS food_count

    FROM categorys c
    LEFT JOIN foods f ON f.category_id = c.id
    LEFT JOIN food_reviews fr ON fr.food_id = f.food_id

    GROUP BY c.id, c.name, c.cate_image_url
    ORDER BY c.id ASC;
  `);

    
    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// ✅ เมนูอาหารตามหมวดหมู่
exports.getFoodsByCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
  SELECT 
    f.food_id,
    f.food_name,
    f.price,
    f.sell_price,
    f.rating,
    f.image_url,
    f.market_id,
    m.shop_name,        -- ✅ เพิ่มชื่อร้าน
    c.name AS category_name
  FROM 
    public.foods f
  JOIN 
    public.categorys c ON f.category_id = c.id
  JOIN 
    public.markets m ON f.market_id = m.market_id   -- ✅ join เพื่อดึงชื่อร้าน
  WHERE 
    f.category_id = $1
  ORDER BY 
    f.food_id ASC;
`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบเมนูอาหารในหมวดหมู่นี้',
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Foods retrieved successfully by category',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching foods by category:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
