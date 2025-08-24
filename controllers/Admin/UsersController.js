const pool = require('../../config/db');

exports.getUsersGroupedByProvider = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users ORDER BY providers, created_at DESC'
    );

    const grouped = result.rows.reduce((acc, user) => {
      const provider = user.providers || 'unknown';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(user);
      return acc;
    }, {});

    res.json(grouped);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
