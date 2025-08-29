const pool = require('../../config/db');

exports.createFood = async (req, res) => {
  const { foodName, shopName, price } = req.body;
  const imageUrl = req.file?.path;

  if (!imageUrl) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  try {
    await pool.query(
      'INSERT INTO foods (food_name, shop_name, price, image_url) VALUES ($1, $2, $3, $4)',
      [foodName, shopName, price, imageUrl]
    );
    res.status(201).json({ message: 'เพิ่มเมนูสำเร็จ', imageUrl });
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ server' });
  }
};

exports.getFoods = async (req, res) => {
  try {
    const result = await pool.query('SELECT f.*, m.shop_name FROM foods f JOIN markets m ON f.market_id = m.market_id ORDER BY f.food_id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// controllers/foodController.js
exports.deleteFood = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM foods WHERE id = $1', [id]);
  res.status(200).json({ message: 'Deleted' });
};

exports.updateFood = async (req, res) => {
  const foodId = req.params.id;
  const { foodName, shopName, price } = req.body;

  try {
    let imageUrl;

    // ถ้ามีการอัปโหลดไฟล์รูปใหม่
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'food-menu',
      });
      imageUrl = result.secure_url;
    }

    // อัปเดตฐานข้อมูล
    const updateQuery = `
      UPDATE foods
      SET food_name = $1, shop_name = $2, price = $3${imageUrl ? ', image_url = $4' : ''}
      WHERE id = $${imageUrl ? 5 : 4}
      RETURNING *;
    `;
    const values = imageUrl
      ? [foodName, shopName, price, imageUrl, foodId]
      : [foodName, shopName, price, foodId];

    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating food:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดตเมนู' });
  }
};
