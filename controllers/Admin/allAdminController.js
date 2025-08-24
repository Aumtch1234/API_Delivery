// controllers/allAdminController.js (หรือไฟล์ controller ที่เหมาะสม)

const pool = require('../../config/db');

exports.verifyAdmin = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['user', 'admin', 'm_admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    await pool.query('UPDATE admins SET role = $1 WHERE id = $2', [role, id]);
    res.json({ message: 'Admin updated successfully' });
  } catch (err) {
    console.error('Error updating admin role:', err);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.getPendingAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role FROM admins ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending admins:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getAllAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT *, username, role FROM admins ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all admins:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
