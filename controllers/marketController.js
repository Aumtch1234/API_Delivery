const pool = require('../config/db');

exports.marketsController = async (req, res) => {
  console.log('👉 req.user:', req.user); // << เช็คว่ามี user_id จริงไหม

  const owner_id = req.user?.user_id;
  const { shop_name, shop_description } = req.body;
  const shop_logo_url = req.file?.path;

  if (!owner_id) {
    return res.status(400).json({ message: 'ไม่พบ owner_id จาก token' });
  }

  try {
    await pool.query(`UPDATE users SET is_seller = true WHERE user_id = $1`, [owner_id]);

    const result = await pool.query(
      `INSERT INTO markets (owner_id, shop_name, shop_description, shop_logo_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [owner_id, shop_name, shop_description, shop_logo_url]
    );

    res.status(200).json({ message: 'เพิ่มร้านค้าสำเร็จ', market: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

exports.getMyMarket = async (req, res) => {
  const userId = req.user?.user_id;
  try {
    const result = await pool.query('SELECT * FROM markets WHERE owner_id = $1', [userId]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'ยังไม่มีร้านค้า' });

    res.status(200).json({ message: 'ดูร้านค้าสำเร็จ', market: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};



