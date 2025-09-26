
// ===================================
// middlewares/Chats/verifyRiderAuth.js
// ===================================

const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

async function verifyRiderAuth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded token:', decoded);

    // รองรับทั้ง rider_id และ user_id ใน token
    const riderId = decoded.rider_id;
    const userId = decoded.user_id;

    if (!riderId && !userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // กรณีมี rider_id ใน token (Rider login)
    if (riderId) {
      const riderQuery = await pool.query(
        `SELECT r.rider_id, r.user_id, u.email, u.display_name, u.role
         FROM rider_profiles r
         JOIN users u ON u.user_id = r.user_id
         WHERE r.rider_id = $1`,
        [riderId]
      );

      if (riderQuery.rowCount === 0) {
        return res.status(401).json({ success: false, message: 'Rider not found' });
      }

      req.user = riderQuery.rows[0]; // มีทั้ง rider_id และ user_id
    } 
    // กรณีมี user_id ใน token (Customer login หรือ General user)
    else if (userId) {
      const userQuery = await pool.query(
        `SELECT u.user_id, u.email, u.display_name, u.role,
                r.rider_id
         FROM users u
         LEFT JOIN rider_profiles r ON r.user_id = u.user_id
         WHERE u.user_id = $1`,
        [userId]
      );

      if (userQuery.rowCount === 0) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      req.user = userQuery.rows[0]; // มี user_id และ rider_id (ถ้าเป็น rider)
    }

    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = verifyRiderAuth;