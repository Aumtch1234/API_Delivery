// controllers/Reviews/reviewsController.js
const pool = require('../../config/db');

// ใช้ฟังก์ชันช่วยแปลงแทน
function getUserIdFromToken(req) {
  const u = req.user || {};
  // รองรับหลายรูปแบบ payload: { user_id } หรือ { id } หรือ { sub }
  return Number(u.user_id ?? u.id ?? u.sub ?? NaN);
}

// helper แปลง query param
function parsePage(req) {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  return { limit, offset };
}

// ================ Market Reviews =================
exports.upsertMarketReview = async (req, res) => {
  const { user_id } = req.user || {};
  const { order_id, rating, comment } = req.body || {};

  if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });
  if (!order_id || !rating) return res.status(400).json({ error: 'order_id and rating are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ทำ INSERT โดยดึง market_id จาก orders (จะพึ่ง trigger ตรวจสิทธิ์และสถานะ delivered)
    const upsertSql = `
      INSERT INTO public.market_reviews (order_id, user_id, market_id, rating, comment)
      SELECT $1, $2, o.market_id, $3, NULLIF($4, '') FROM public.orders o WHERE o.order_id = $1
      ON CONFLICT (order_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = now()
      RETURNING review_id, order_id, user_id, market_id, rating, comment, created_at, updated_at
    `;
    const upsert = await client.query(upsertSql, [order_id, user_id, rating, comment ?? null]);

    // ดึงสรุปใหม่ของ market (trigger ได้อัปเดตให้แล้ว)
    const marketId = upsert.rows[0].market_id;
    const agg = await client.query(
      `SELECT market_id, shop_name, rating AS rating_avg, reviews_count
       FROM public.markets WHERE market_id = $1`,
      [marketId]
    );

    await client.query('COMMIT');
    return res.json({
      ok: true,
      review: upsert.rows[0],
      market_summary: agg.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // ข้อความจาก trigger/constraint จะโยนออกมา เช่น ไม่ใช่เจ้าของออเดอร์/ยังไม่ delivered/dup etc.
    return res.status(400).json({ error: 'Cannot upsert market review', detail: err.message });
  } finally {
    client.release();
  }
};

// ================ Rider Reviews =================
exports.upsertRiderReview = async (req, res) => {
  const { user_id } = req.user || {};
  const { order_id, rating, comment } = req.body || {};
  if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });
  if (!order_id || !rating) return res.status(400).json({ error: 'order_id and rating are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ดึง rider_id จาก orders แล้ว upsert
    const upsertSql = `
      INSERT INTO public.rider_reviews (order_id, user_id, rider_id, rating, comment)
      SELECT $1, $2, o.rider_id, $3, NULLIF($4, '') FROM public.orders o WHERE o.order_id = $1
      ON CONFLICT (order_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = now()
      RETURNING review_id, order_id, user_id, rider_id, rating, comment, created_at, updated_at
    `;
    const upsert = await client.query(upsertSql, [order_id, user_id, rating, comment ?? null]);

    const riderId = upsert.rows[0].rider_id;
    const agg = await client.query(
      `SELECT rp.rider_id, rp.rating AS rating_avg, rp.reviews_count, u.display_name AS rider_name
       FROM public.rider_profiles rp
       JOIN public.users u ON u.user_id = rp.user_id
       WHERE rp.rider_id = $1`,
      [riderId]
    );

    await client.query('COMMIT');
    return res.json({
      ok: true,
      review: upsert.rows[0],
      rider_summary: agg.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: 'Cannot upsert rider review', detail: err.message });
  } finally {
    client.release();
  }
};

// ================ List Reviews Market =================
exports.listMarketReviews = async (req, res) => {
  const marketId = parseInt(req.params.marketId, 10);
  const { limit, offset } = parsePage(req);

  const sql = `
    SELECT r.review_id, r.rating, r.comment, r.created_at,
           u.display_name AS reviewer_name, u.photo_url AS reviewer_photo, r.user_id
    FROM public.market_reviews r
    JOIN public.users u ON u.user_id = r.user_id
    WHERE r.market_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

    // ดึงสรุปของ market
    let summary;
    try {
        summary = await pool.query(
            `SELECT market_id, shop_name, rating AS rating_avg, reviews_count
             FROM public.markets WHERE market_id = $1`,
            [marketId]
        );
    } catch (err) {
        return res.status(400).json({ error: 'Cannot fetch market summary', detail: err.message });
    }

  try {
    const { rows } = await pool.query(sql, [marketId, limit, offset]);
    return res.json({ ok: true, market_summary: summary.rows[0], items: rows, paging: { limit, offset } });
  } catch (err) {
    return res.status(400).json({ error: 'Cannot list market reviews', detail: err.message });
  }
};

// ================ List Reviews Rider =================
exports.listRiderReviews = async (req, res) => {
  const riderId = parseInt(req.params.riderId, 10);
  const { limit, offset } = parsePage(req);

  const sql = `
    SELECT r.review_id, r.rating, r.comment, r.created_at,
           u.display_name AS reviewer_name, u.photo_url AS reviewer_photo, r.user_id
    FROM public.rider_reviews r
    JOIN public.users u ON u.user_id = r.user_id
    WHERE r.rider_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

    // ดึงสรุปของ rider
    let summary;
    try {
        summary = await pool.query(
            `SELECT rp.rider_id, u.display_name AS rider_name, rp.rating AS rating_avg, rp.reviews_count
             FROM public.rider_profiles rp
             JOIN public.users u ON u.user_id = rp.user_id
             WHERE rp.rider_id = $1`,
            [riderId]
        );
    } catch (err) {
        return res.status(400).json({ error: 'Cannot fetch rider summary', detail: err.message });
    }

  try {
    const { rows } = await pool.query(sql, [riderId, limit, offset]);
    return res.json({ ok: true, rider_summary: summary.rows[0], items: rows, paging: { limit, offset } });
  } catch (err) {
    return res.status(400).json({ error: 'Cannot list rider reviews', detail: err.message });
  }
};

// ================ Get Reviews by Order for User =================
// เช็คว่ารีวิวออเดอร์นี้ไปแล้วหรือยัง (ตาม user ใน token):
exports.getOrderReviewsByUser = async (req, res) => {
  const { user_id } = req.user || {};
  if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });
  
  const orderId = parseInt(req.params.orderId, 10);

  const sql = `
    SELECT 'market' AS type, review_id, rating, comment, created_at, updated_at
    FROM public.market_reviews
    WHERE order_id = $1 AND user_id = $2
    UNION ALL
    SELECT 'rider' AS type, review_id, rating, comment, created_at, updated_at
    FROM public.rider_reviews
    WHERE order_id = $1 AND user_id = $2
  `;

  try {
    const { rows } = await pool.query(sql, [orderId, user_id]);
    return res.json({ ok: true, items: rows });
  } catch (err) {
    return res.status(400).json({ error: 'Cannot fetch order reviews', detail: err.message });
  }
};
