const bcrypt = require('bcrypt');
const pool = require('../../config/db');
const jwt = require('jsonwebtoken')

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const userQuery = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);

  if (userQuery.rows.length === 0)
    return res.status(404).json({ message: 'ไม่พบชื่อผู้ใช้นี้ !!' });

  const user = userQuery.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch)
    return res.status(403).json({ message: 'รหัสผ่านหรือ username ไม่ถูกต้อง' });

  const token = jwt.sign(
    {
      id: user.id,           // 👈 เพิ่ม id ของ admin
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '6h' }
  );

  res.json({ token });
};

exports.addAdmin = async (req, res) => {
  const { username: newAdmin, password } = req.body;

  try {
    // 🔍 ตรวจว่ามี user นี้แล้วหรือยัง
    const check = await pool.query('SELECT * FROM admins WHERE username = $1', [newAdmin]);
    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'มีแล้ว' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admins (username, password) VALUES ($1, $2)',
      [newAdmin, hashed]
    );

    res.status(201).json({ message: 'Admin created (not verified)' });

  } catch (err) {
    console.error('Add admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.configAdmin = async (req, res) => {
  const { username: newAdmin, password } = req.body;

  try {
    // 🔍 ตรวจว่ามี user นี้แล้วหรือยัง
    const check = await pool.query('SELECT * FROM admins WHERE username = $1', [newAdmin]);
    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'มีแล้ว' });
    };

    if(!password || password.length < 6) {
      return res.status(400).json({ message: 'Password ของคุณน้อยกว่า 6 ตัว' });
    };

    if (!newAdmin || newAdmin.length < 3) {
      return res.status(400).json({ message: 'Username ของคุณน้อยกว่า 3 ตัว' });

    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
      [newAdmin, hashed, 'm_admin'] // 👈 กำหนด role เป็น m_admin
    );

    res.status(201).json({ message: 'Admin created (not verified)' });

  } catch (err) {
    console.error('Add admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// controllers/adminController.js
exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin', 'm_admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  await pool.query('UPDATE admins SET role = $1 WHERE id = $2', [role, id]);
  res.json({ message: 'Role updated' });
};

