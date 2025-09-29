const pool = require('../../../config/db');

/**
 * Helper: สถานะที่นับเป็น “ขายสำเร็จ”
 * ปรับได้ตามธุรกิจ (เช่น delivered, completed)
 */
const SUCCESS_STATES = ['delivered', 'completed'];

exports.getDailySummary = async (req, res) => {
  try {
    const { date, market_id } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    // ถ้าต้องการยืดหยุ่นสถานะ ส่ง ?states=completed,delivered ได้
    const states = (req.query.states ? String(req.query.states).split(',') : SUCCESS_STATES);

    // 1) เลือกออเดอร์ของวันนั้น (ตามโซนเวลาเอเชีย/กทม) และกรองร้านถ้ามี
    const filteredOrdersSql = `
      WITH filtered_orders AS (
        SELECT
          o.order_id,
          o.market_id,
          o.payment_method,
          (o.created_at AT TIME ZONE 'Asia/Bangkok') AS created_local
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') = $1
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      )
      SELECT COUNT(*)::int AS total_orders,
             COALESCE(SUM(oi.subtotal),0)::numeric(12,2) AS total_revenue,
             COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) AS original_total_revenue
      FROM filtered_orders fo
      LEFT JOIN order_items oi ON fo.order_id = oi.order_id;
    `;

    const [{ rows: [summaryRow] }] = await Promise.all([
      pool.query(filteredOrdersSql, [date, market_id ?? null, states])
    ]);

    // 2) เมนูขายได้กี่ชิ้น (join order_items)
    const menuSql = `
      WITH filtered_orders AS (
        SELECT o.order_id
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') = $1
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      )
      SELECT oi.food_name, COALESCE(SUM(oi.quantity),0)::int AS qty
      FROM order_items oi
      JOIN filtered_orders fo ON fo.order_id = oi.order_id
      GROUP BY oi.food_name
      ORDER BY qty DESC, oi.food_name ASC;
    `;
    const { rows: menuItems } = await pool.query(menuSql, [date, market_id ?? null, states]);

    // 3) ชั่วโมงพีค (ออเดอร์เยอะสุด)
    const peakSql = `
      WITH filtered_orders AS (
        SELECT (o.created_at AT TIME ZONE 'Asia/Bangkok') AS created_local
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') = $1
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      )
      SELECT EXTRACT(HOUR FROM created_local)::int AS hour,
             COUNT(*)::int AS orders
      FROM filtered_orders
      GROUP BY hour
      ORDER BY orders DESC, hour ASC
      LIMIT 1;
    `;
    const { rows: [peakRow] } = await pool.query(peakSql, [date, market_id ?? null, states]);

    // 4) วิธีชำระเงิน
    const pmSql = `
      WITH filtered_orders AS (
        SELECT payment_method, total_price
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') = $1
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      )
      SELECT COALESCE(payment_method, 'unknown') AS method,
             COALESCE(SUM(total_price),0)::numeric(12,2) AS amount
      FROM filtered_orders
      GROUP BY COALESCE(payment_method, 'unknown')
      ORDER BY amount DESC;
    `;
    const { rows: paymentMethods } = await pool.query(pmSql, [date, market_id ?? null, states]);

    // 5) ยอดขายต่อชั่วโมง (เพื่อใช้กราฟ/ฮีทแมพ)
    const hourlySql = `
      WITH filtered_orders AS (
        SELECT o.order_id, (o.created_at AT TIME ZONE 'Asia/Bangkok') AS created_local
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Bangkok') = $1
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      )
      SELECT EXTRACT(HOUR FROM fo.created_local)::int AS hour,
             COUNT(DISTINCT fo.order_id)::int AS orders,
             COALESCE(SUM(oi.subtotal),0)::numeric(12,2) AS revenue,
             COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) AS original_revenue
      FROM filtered_orders fo
      LEFT JOIN order_items oi ON fo.order_id = oi.order_id
      GROUP BY hour
      ORDER BY hour ASC;
    `;
    const { rows: hourly } = await pool.query(hourlySql, [date, market_id ?? null, states]);

    // 6) AOV (Average Order Value)
    const aov = Number(summaryRow.total_orders || 0) > 0
      ? Number(summaryRow.total_revenue) / Number(summaryRow.total_orders)
      : 0;
    const originalAov = Number(summaryRow.total_orders || 0) > 0
      ? Number(summaryRow.original_total_revenue) / Number(summaryRow.total_orders)
      : 0;

    res.json({
      date,
      market_id: market_id ? Number(market_id) : null,
      total_revenue: summaryRow.total_revenue,
      original_total_revenue: summaryRow.original_total_revenue,
      total_orders: summaryRow.total_orders,
      menu_items_sold: menuItems.reduce((acc, x) => (acc[x.food_name] = x.qty, acc), {}),
      peak_hour: peakRow ? { hour: peakRow.hour, orders: peakRow.orders } : null,
      payment_methods: paymentMethods.reduce((acc, x) => (acc[x.method] = x.amount, acc), {}),
      hourly_sales: hourly, // สำหรับกราฟเสริม
      avg_order_value: Number(aov.toFixed(2)),
      original_avg_order_value: Number(originalAov.toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
};

exports.getMonthlySummary = async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const market_id = req.query.market_id ? Number(req.query.market_id) : null;
    const states = (req.query.states ? String(req.query.states).split(',') : SUCCESS_STATES);

    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

    // กำหนดวันแรก/วันสุดท้ายของเดือน (Local TZ)
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    // ใช้ date_trunc + (start + 1 month)
    const sql = `
  WITH params AS (
    SELECT
      ($1::date) AS start_date,
      (date_trunc('month', $1::date) + INTERVAL '1 month')::date AS next_month
  ),
  filtered_orders AS (
    SELECT
      o.order_id,
      (o.created_at AT TIME ZONE 'Asia/Bangkok')::date AS d
    FROM orders o, params p
    WHERE (o.created_at AT TIME ZONE 'Asia/Bangkok')::date >= p.start_date
      AND (o.created_at AT TIME ZONE 'Asia/Bangkok')::date < p.next_month
      AND ($2::int IS NULL OR o.market_id = $2)
      AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
  ),
  calendar AS (
    SELECT generate_series(
      (SELECT start_date FROM params),
      (SELECT next_month FROM params) - INTERVAL '1 day',
      INTERVAL '1 day'
    )::date AS d
  )
  SELECT
    (SELECT COALESCE(SUM(oi.subtotal),0)::numeric(12,2) FROM filtered_orders fo LEFT JOIN order_items oi ON fo.order_id = oi.order_id) AS total_monthly_revenue,
    (SELECT COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) FROM filtered_orders fo LEFT JOIN order_items oi ON fo.order_id = oi.order_id) AS original_total_monthly_revenue,
    (SELECT COUNT(DISTINCT fo.order_id)::int FROM filtered_orders fo) AS total_monthly_orders,
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.d)
      FROM (
        SELECT 
          c.d,
          COALESCE(COUNT(DISTINCT f.order_id), 0)::int AS orders,
          COALESCE(SUM(oi.subtotal), 0)::numeric(12,2) AS revenue,
          COALESCE(SUM(oi.original_subtotal), 0)::numeric(12,2) AS original_revenue
        FROM calendar c
        LEFT JOIN filtered_orders f ON f.d = c.d
        LEFT JOIN order_items oi ON f.order_id = oi.order_id
        GROUP BY c.d
        ORDER BY c.d
      ) AS t
    ) AS daily_sales_data
`;

    const { rows: [row] } = await pool.query(sql, [start, market_id ?? null, states]);

    res.json({
      month,
      year,
      market_id,
      total_monthly_revenue: row.total_monthly_revenue,
      original_total_monthly_revenue: row.original_total_monthly_revenue,
      total_monthly_orders: row.total_monthly_orders,
      daily_sales_data: row.daily_sales_data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
};


exports.getYearlySummary = async (req, res) => {
  try {
    const year = Number(req.query.year);
    const market_id = req.query.market_id ? Number(req.query.market_id) : null;
    const states = (req.query.states ? String(req.query.states).split(',') : SUCCESS_STATES);
    if (!year) return res.status(400).json({ error: 'year is required (e.g. 2025)' });

    const start = `${year}-01-01`;

    const sql = `
      WITH params AS (
        SELECT
          ($1::date) AS start_date,
          (date_trunc('year', $1::date) + INTERVAL '1 year')::date AS next_year
      ),
      filtered_orders AS (
        SELECT
          o.order_id,
          o.payment_method,
          (o.created_at AT TIME ZONE 'Asia/Bangkok') AS created_local
        FROM orders o, params p
        WHERE (o.created_at AT TIME ZONE 'Asia/Bangkok')::date >= p.start_date
          AND (o.created_at AT TIME ZONE 'Asia/Bangkok')::date < p.next_year
          AND ($2::int IS NULL OR o.market_id = $2)
          AND (array_length($3::text[],1) IS NULL OR o.status = ANY($3::text[]))
      ),
      month_cal AS (
        SELECT generate_series(
          (SELECT start_date FROM params),
          (SELECT next_year FROM params) - INTERVAL '1 month',
          INTERVAL '1 month'
        )::date AS month_start
      ),
      monthly AS (
        SELECT
          EXTRACT(MONTH FROM mc.month_start)::int AS month,
          COALESCE(COUNT(DISTINCT fo.order_id),0)::int AS orders,
          COALESCE(SUM(oi.subtotal),0)::numeric(12,2) AS revenue,
          COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) AS original_revenue
        FROM month_cal mc
        LEFT JOIN filtered_orders fo
          ON date_trunc('month', fo.created_local)::date = mc.month_start
        LEFT JOIN order_items oi ON fo.order_id = oi.order_id
        GROUP BY mc.month_start
        ORDER BY mc.month_start
      ),
      pm AS (
        SELECT COALESCE(fo.payment_method, 'unknown') AS method,
               COALESCE(SUM(oi.subtotal),0)::numeric(12,2) AS amount,
               COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) AS original_amount
        FROM filtered_orders fo
        LEFT JOIN order_items oi ON fo.order_id = oi.order_id
        GROUP BY COALESCE(fo.payment_method, 'unknown')
      ),
      top_items AS (
        SELECT oi.food_name, COALESCE(SUM(oi.quantity),0)::int AS qty
        FROM order_items oi
        JOIN filtered_orders fo ON fo.order_id = oi.order_id
        GROUP BY oi.food_name
        ORDER BY qty DESC, oi.food_name ASC
        LIMIT 20
      )
      SELECT
        (SELECT COALESCE(SUM(oi.subtotal),0)::numeric(12,2) FROM filtered_orders fo LEFT JOIN order_items oi ON fo.order_id = oi.order_id) AS total_yearly_revenue,
        (SELECT COALESCE(SUM(oi.original_subtotal),0)::numeric(12,2) FROM filtered_orders fo LEFT JOIN order_items oi ON fo.order_id = oi.order_id) AS original_total_yearly_revenue,
        (SELECT COUNT(DISTINCT fo.order_id)::int FROM filtered_orders fo) AS total_yearly_orders,
        (SELECT json_agg(row_to_json(m) ORDER BY m.month) FROM monthly m) AS monthly_sales_data,
        (SELECT json_object_agg(method, amount) FROM pm) AS payment_methods,
        (SELECT json_object_agg(method, original_amount) FROM pm) AS original_payment_methods,
        (SELECT json_agg(row_to_json(t)) FROM top_items t) AS top_items
    `;
    const { rows: [row] } = await pool.query(sql, [start, market_id ?? null, states]);

    const totalOrders = Number(row.total_yearly_orders || 0);
    const totalRevenue = Number(row.total_yearly_revenue || 0);
    const originalTotalRevenue = Number(row.original_total_yearly_revenue || 0);
    const aov = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
    const originalAov = totalOrders > 0 ? Number((originalTotalRevenue / totalOrders).toFixed(2)) : 0;

    res.json({
      year,
      market_id,
      total_yearly_revenue: row.total_yearly_revenue,
      original_total_yearly_revenue: row.original_total_yearly_revenue,
      total_yearly_orders: row.total_yearly_orders,
      monthly_sales_data: row.monthly_sales_data ?? [],
      payment_methods: row.payment_methods ?? {},
      original_payment_methods: row.original_payment_methods ?? {},
      top_items: row.top_items ?? [],
      avg_order_value: aov,
      original_avg_order_value: originalAov
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
};
