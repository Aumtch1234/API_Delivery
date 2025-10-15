const pool = require('../../config/db');

exports.verifyAdmin = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // ✅ ตรวจ role ที่อนุญาต
  if (!role || !['user', 'admin', 'm_admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    // ✅ ดึง role ปัจจุบันของ admin คนนี้ก่อน
    const current = await pool.query('SELECT role FROM admins WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const currentRole = current.rows[0].role;

    // ✅ ถ้ากำลังจะลดจาก m_admin → role อื่น ต้องเช็กก่อนว่าเหลือ m_admin คนอื่นไหม
    if (currentRole === 'm_admin' && role !== 'm_admin') {
      const countRes = await pool.query(
        'SELECT COUNT(*) AS count FROM admins WHERE role = $1',
        ['m_admin']
      );
      const mAdminCount = parseInt(countRes.rows[0].count, 10);

      if (mAdminCount <= 1) {
        // ❌ ห้ามลด role คนสุดท้าย
        return res.status(400).json({
          message: 'ไม่สามารถลดสิทธิ์ได้ ต้องมี Master Admin อย่างน้อย 1 คนในระบบ',
        });
      }
    }

    // ✅ อัปเดต role ได้ตามปกติ
    await pool.query('UPDATE admins SET role = $1 WHERE id = $2', [role, id]);

    res.json({ message: 'อัปเดตบทบาทผู้ดูแลระบบสำเร็จ' });
  } catch (err) {
    console.error('❌ Error updating admin role:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};

exports.getPendingAdmins = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, role 
      FROM admins
      ORDER BY 
        CASE 
          WHEN role = 'm_admin' THEN 1
          WHEN role = 'admin' THEN 2
          WHEN role = 'user' THEN 3
          ELSE 4
        END,
        id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all admins:', err);
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
