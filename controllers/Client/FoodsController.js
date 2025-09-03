const pool = require('../../config/db');

exports.getAllFoods = async (req, res) => {
  try {
    const query = `
      SELECT
        f.food_id,
        f.food_name,
        f.price,
        f.image_url,
        f.rating,
        m.shop_name
        FROM
        foods f 
        JOIN
        markets m ON f.market_id = m.market_id 
        ORDER BY
        f.food_id;
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
    const { marketId } = req.params; // <-- เปลี่ยนจาก query เป็น params
    let query = `
      SELECT f.food_id, f.food_name, f.price, f.image_url, f.rating as food_rating, 
      m.market_id, m.shop_name, m.shop_logo_url, m.latitude, m.longitude, m.is_open, m.rating as market_rating, m.address, m.phone
      FROM foods f 
      JOIN markets m ON f.market_id = m.market_id
      WHERE f.market_id = $1
      ORDER BY f.food_id
    `;

    const result = await pool.query(query, [marketId]);

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

exports.getAllMarket = async (req, res) => {
  try {
    const query = `
      SELECT * FROM markets m 
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
exports.getFoodFromIDForOrder = async (req, res) => {
  try {
    const { foodId } = req.params;
    let query = `
    SELECT 
        f.food_id, f.food_name, f.price, f.image_url, f.rating AS food_rating, f.options,
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