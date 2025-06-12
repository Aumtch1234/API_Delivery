const pool = require('../config/db');

exports.getProfile = async (req, res) => {
  const { user_id } = req.user;
  const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
  res.json(userResult.rows[0]);
};
