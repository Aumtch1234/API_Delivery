const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

function authenticateCustomer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // ✅ อนุญาตทั้ง member และ seller ที่สั่งอาหาร
    if (req.user.role !== 'member' && !req.user.is_seller) {
      return res.status(403).json({ message: 'Only customers can access this endpoint' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}


module.exports = authenticateCustomer;
