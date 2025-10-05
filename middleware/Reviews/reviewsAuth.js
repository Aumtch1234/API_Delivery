// middleware/Reviews/reviewsAuth.js
const pool = require('../../config/db');

// Middleware สำหรับ Market Owner - ดึง marketId จาก token
const getMarketFromToken = async (req, res, next) => {
  try {
    const { user_id } = req.user || {};
    if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });

    // ดึง marketId ที่ user เป็นเจ้าของ
    const marketQuery = `
      SELECT market_id, shop_name
      FROM public.markets
      WHERE owner_id = $1 AND approve = true
      LIMIT 1
    `;
    
    const result = await pool.query(marketQuery, [user_id]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User is not a market owner or market is not approved' });
    }

    // เพิ่ม marketId เข้าไปใน req object
    req.marketId = result.rows[0].market_id;
    req.marketInfo = result.rows[0];
    
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Cannot verify market ownership', detail: err.message });
  }
};

// Middleware สำหรับ Rider - ดึง riderId จาก token
const getRiderFromToken = async (req, res, next) => {
  try {
    const { user_id } = req.user || {};
    if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });

    // ดึง riderId ที่ user เป็นเจ้าของ
    const riderQuery = `
      SELECT rp.rider_id, u.display_name AS rider_name
      FROM public.rider_profiles rp
      JOIN public.users u ON u.user_id = rp.user_id
      WHERE rp.user_id = $1 AND rp.approval_status = 'approved'
      LIMIT 1
    `;
    
    const result = await pool.query(riderQuery, [user_id]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User is not a rider or rider profile is not approved' });
    }

    // เพิ่ม riderId เข้าไปใน req object
    req.riderId = result.rows[0].rider_id;
    req.riderInfo = result.rows[0];
    
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Cannot verify rider profile', detail: err.message });
  }
};

module.exports = {
  getMarketFromToken,
  getRiderFromToken
};