const pool = require('../../config/db');

exports.getAllFoods = async (req, res) => {
  try {
    const query = `
      SELECT
        f.food_id,
        f.food_name,
        f.price,
        f.sell_price,
        f.image_url,
        f.rating, -- optional, ถ้ามีคอลัมน์ rating ใน foods อยู่แล้ว
        m.owner_id,
        m.shop_name,
        COALESCE(AVG(r.rating), 0)::numeric(3,2) AS rating_avg,
        COUNT(r.review_id) AS review_count
      FROM foods f
      JOIN markets m ON f.market_id = m.market_id
      LEFT JOIN food_reviews r ON f.food_id = r.food_id
      GROUP BY f.food_id, m.owner_id, m.shop_name
      ORDER BY f.food_id;
    `;

    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      message: 'Foods retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.getAllFoodForMarketID = async (req, res) => {
  try {
    const { marketId } = req.params;

    const query = `
      SELECT 
        f.food_id,
        f.food_name,
        f.price,
        f.sell_price,
        f.image_url,

        -- ✅ คำนวณค่าเฉลี่ย rating ของเมนูจาก food_reviews โดยตรง
        COALESCE(AVG(fr.rating), 0)::numeric(3,2) AS food_rating,
        COUNT(fr.review_id) AS food_review_count,

        m.market_id,
        m.shop_name,
        m.shop_description,
        m.shop_logo_url,
        m.latitude,
        m.longitude,
        m.is_open,
        m.address,
        m.phone,

        -- ✅ คำนวณค่าเฉลี่ย rating ของร้านจาก market_reviews
        COALESCE(AVG(mr.rating), 0)::numeric(3,2) AS market_rating,
        COUNT(mr.review_id) AS market_review_count

      FROM foods f
      JOIN markets m ON f.market_id = m.market_id
      LEFT JOIN food_reviews fr ON f.food_id = fr.food_id
      LEFT JOIN market_reviews mr ON m.market_id = mr.market_id

      WHERE f.market_id = $1

      GROUP BY 
        f.food_id,
        m.market_id,
        m.shop_name,
        m.shop_logo_url,
        m.latitude,
        m.longitude,
        m.is_open,
        m.address,
        m.phone

      ORDER BY f.food_id;
    `;

    const result = await pool.query(query, [marketId]);

    res.status(200).json({
      success: true,
      message: 'Foods retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('❌ Error fetching foods:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};



exports.getAllMarket = async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM markets m
      WHERE m.is_admin = false
    `;
    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      message: 'Markets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.getAllADMINMarket = async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM markets m
      WHERE m.is_admin = true
    `;
    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      message: 'Markets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.getFoodFromIDForOrder = async (req, res) => {
  try {
    const { foodId } = req.params;
    let query = `
    SELECT 
        f.food_id, f.food_name, f.price, f.image_url, f.rating AS food_rating, f.options, f.sell_options, f.sell_price,
        m.market_id, m.shop_name, m.shop_logo_url, m.latitude, m.longitude, m.is_open, m.rating AS market_rating, m.address, m.phone
    FROM foods f 
    JOIN markets m ON f.market_id = m.market_id  
    WHERE 
        f.food_id = $1  
    ORDER BY 
        f.food_id;
    `;

    const result = await pool.query(query, [foodId]);

    res.status(200).json({
      success: true,
      message: 'Foods retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};


// API สำหรับดึงเมนูแนะนำ
// exports.getRecommendedFoods = async (req, res) => {
//   try {
//     const query = `
//       SELECT
//         f.food_id,
//         f.food_name,
//         f.price,
//         f.image_url,
//         f.rating,
//         m.market_name,
//         m.estimated_delivery_time
//       FROM
//         foods f
//       JOIN
//         markets m ON f.market_id = m.market_id
//       WHERE
//         f.rating >= 4.5 -- สมมติว่าเมนูแนะนำคือเมนูที่มีคะแนน 4.5 ขึ้นไป
//       ORDER BY
//         f.rating DESC
//       LIMIT 10;
//     `;
//     const result = await pool.query(query);

//     res.status(200).json({
//       success: true,
//       message: 'Recommended foods retrieved successfully',
//       data: result.rows,
//     });
//   } catch (error) {
//     console.error('Error fetching recommended foods:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message,
//     });
//   }
// };