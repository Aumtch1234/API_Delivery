const pool = require("../../config/db");

/* ✅ รวมยอด GP ทั้งหมด (เฉพาะที่มี rider_id != NULL) */
const getGpRiderRequired = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(rider_required_gp), 0) AS total_gp,
        COUNT(*) AS total_orders
      FROM orders
      WHERE rider_required_gp > 0
        AND rider_id IS NOT NULL;
    `);
    res.json({ success: true, message: "รวมยอด GP ทั้งหมด", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ GP วันนี้ (เฉพาะออเดอร์ที่มี rider_id) */
const getGpToday = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND rider_required_gp > 0
        AND rider_id IS NOT NULL;
    `);
    res.json({ success: true, message: "ยอด GP วันนี้", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ GP สัปดาห์นี้ (เฉพาะออเดอร์ที่มี rider_id) */
const getGpThisWeek = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE)
        AND rider_required_gp > 0
        AND rider_id IS NOT NULL;
    `);
    res.json({ success: true, message: "ยอด GP สัปดาห์นี้", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ GP เดือนนี้ (เฉพาะออเดอร์ที่มี rider_id) */
const getGpThisMonth = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND rider_required_gp > 0
        AND rider_id IS NOT NULL;
    `);
    res.json({ success: true, message: "ยอด GP เดือนนี้", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ GP ปีนี้ (เฉพาะออเดอร์ที่มี rider_id) */
const getGpThisYear = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
        AND rider_required_gp > 0
        AND rider_id IS NOT NULL;
    `);
    res.json({ success: true, message: "ยอด GP ปีนี้", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ กราฟ GP รายอาทิตย์ย้อนหลัง 7 วัน (แสดงครบทุกวันแม้ไม่มีข้อมูล) */
const getGpRiderRequiredWeekly = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '6 days'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS date
      )
      SELECT 
        TO_CHAR(d.date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(o.rider_required_gp), 0) AS total_gp
      FROM days d
      LEFT JOIN orders o
        ON DATE(o.created_at) = d.date
        AND o.rider_required_gp > 0
        AND o.rider_id IS NOT NULL
      GROUP BY d.date
      ORDER BY d.date ASC;
    `);

    res.json({
      success: true,
      data: {
        labels: result.rows.map(r =>
          new Date(r.date).toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
          })
        ),
        values: result.rows.map(r => parseFloat(r.total_gp)),
      },
    });
  } catch (error) {
    console.error("❌ Weekly GP Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ กราฟ GP รายเดือนย้อนหลัง 6 เดือน (เฉพาะออเดอร์ที่มี rider_id) */
const getGpRiderRequiredByMonth = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE rider_required_gp > 0
        AND rider_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC;
    `);

    res.json({
      success: true,
      data: {
        labels: result.rows.map(r => {
          const [year, month] = r.month.split("-");
          return `${month}/${year}`;
        }),
        values: result.rows.map(r => parseFloat(r.total_gp)),
      },
    });
  } catch (error) {
    console.error("❌ Monthly GP Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ✅ กราฟ GP รายปี (12 เดือนย้อนหลัง, เฉพาะออเดอร์ที่มี rider_id) */
const getGpRiderRequiredYearly = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(rider_required_gp), 0) AS total_gp
      FROM orders
      WHERE rider_required_gp > 0
        AND rider_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `);

    res.json({
      success: true,
      data: {
        labels: result.rows.map(r => {
          const [year, month] = r.month.split("-");
          return `${month}/${year}`;
        }),
        values: result.rows.map(r => parseFloat(r.total_gp)),
      },
    });
  } catch (error) {
    console.error("❌ Yearly GP Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getGpRiderRequired,
  getGpToday,
  getGpThisWeek,
  getGpThisMonth,
  getGpThisYear,
  getGpRiderRequiredWeekly,
  getGpRiderRequiredByMonth,
  getGpRiderRequiredYearly,
};
