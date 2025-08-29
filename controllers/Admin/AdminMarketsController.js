const pool = require('../../config/db');

exports.verifyMarket = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // 'approved' หรือ 'rejected'

  let approveValue;
  if (role === 'approved') approveValue = true;
  else if (role === 'rejected') approveValue = false;
  else return res.status(400).json({ message: 'Invalid role' });

  try {
    const query = `UPDATE markets SET approve = $1 WHERE market_id = $2 RETURNING *`;
    console.log('Running query verifyMarket:', query, 'Params:', [approveValue, id]);

    const result = await pool.query(query, [approveValue, id]);
    console.log('Updated row:', result.rows[0]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in verifyMarket:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getAllMarkets = async (req, res) => {
  try {
    const query = `
      SELECT m.*, u.display_name AS owner_name
      FROM markets m
      JOIN users u ON m.owner_id = u.user_id
      ORDER BY m.created_at DESC
    `;
    console.log('Running query getAllMarkets:', query);

    const result = await pool.query(query);
    console.log('Result rows:', result.rows);

    res.json(result.rows);
  } catch (err) {
    console.error('Error in getAllMarkets:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
