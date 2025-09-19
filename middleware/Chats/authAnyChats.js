const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

// Middleware ตรวจสอบ token (สำหรับ user ทุก role)
async function verifyTokenAny(req, res, next) {
  try {
    const h = req.header('Authorization');
    if (!h) return res.status(401).json({ error: 'Missing Authorization' });
    const token = h.startsWith('Bearer ') ? h.slice(7) : h;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const u = await pool.query('SELECT user_id, role FROM users WHERE user_id = $1', [decoded.user_id]);
    if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
    req.user = u.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid/Expired token' });
  }
}

module.exports = { verifyTokenAny };