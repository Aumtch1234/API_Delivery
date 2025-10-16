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

  if (!user_id)
    return res.status(401).json({ error: 'Invalid token payload (no user_id)' });
  if (!order_id || !rating)
    return res
      .status(400)
      .json({ error: 'order_id and rating are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ 1. Insert หรือ Update รีวิวร้าน
    const upsertSql = `
      INSERT INTO public.market_reviews (order_id, user_id, market_id, rating, comment)
      SELECT $1, $2, o.market_id, $3, NULLIF($4, '') 
      FROM public.orders o WHERE o.order_id = $1
      ON CONFLICT (order_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = now()
      RETURNING review_id, order_id, user_id, market_id, rating, comment, created_at, updated_at
    `;
    const upsert = await client.query(upsertSql, [order_id, user_id, rating, comment ?? null]);

    const marketId = upsert.rows[0].market_id;

    // ✅ 2. อัปเดต orders ให้รู้ว่ารีวิวร้านแล้ว
    await client.query(
      `UPDATE public.orders 
       SET is_market_reviewed = TRUE, updated_at = now()
       WHERE order_id = $1`,
      [order_id]
    );

    // ✅ 3. ดึง market summary ใหม่
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
      is_market_reviewed: true, // ✅ เพิ่มไว้ใน response ด้วย
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      error: 'Cannot upsert market review',
      detail: err.message,
    });
  } finally {
    client.release();
  }
};

// ================ Rider Reviews =================
exports.upsertRiderReview = async (req, res) => {
  const { user_id } = req.user || {};
  const { order_id, rating, comment } = req.body || {};
  if (!user_id)
    return res.status(401).json({ error: 'Invalid token payload (no user_id)' });
  if (!order_id || !rating)
    return res
      .status(400)
      .json({ error: 'order_id and rating are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ 1. Insert หรือ Update รีวิวไรเดอร์
    const upsertSql = `
      INSERT INTO public.rider_reviews (order_id, user_id, rider_id, rating, comment)
      SELECT $1, $2, o.rider_id, $3, NULLIF($4, '') 
      FROM public.orders o WHERE o.order_id = $1
      ON CONFLICT (order_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = now()
      RETURNING review_id, order_id, user_id, rider_id, rating, comment, created_at, updated_at
    `;
    const upsert = await client.query(upsertSql, [order_id, user_id, rating, comment ?? null]);

    const riderId = upsert.rows[0].rider_id;

    // ✅ 2. อัปเดต orders ให้รู้ว่ารีวิวไรเดอร์แล้ว
    await client.query(
      `UPDATE public.orders 
       SET is_rider_reviewed = TRUE, updated_at = now()
       WHERE order_id = $1`,
      [order_id]
    );

    // ✅ 3. ดึงข้อมูลสรุปไรเดอร์ใหม่
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
      is_rider_reviewed: true, // ✅ เพิ่มไว้ใน response ด้วย
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      error: 'Cannot upsert rider review',
      detail: err.message,
    });
  } finally {
    client.release();
  }
};


// ================ List Reviews Market =================
exports.listMarketReviews = async (req, res) => {
  const { user_id } = req.user || {};
  if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });

  // ใช้ marketId จาก middleware ที่ดึงจาก token
  const marketId = req.marketId;
  const { limit, offset } = parsePage(req);

  const sql = `
    SELECT o.order_id, r.review_id, r.rating, r.comment, r.created_at,
           u.display_name AS reviewer_name, u.photo_url AS reviewer_photo, r.user_id
    FROM public.market_reviews r
    JOIN public.users u ON u.user_id = r.user_id
    JOIN public.orders o ON o.order_id = r.order_id AND o.market_id = r.market_id
    WHERE r.market_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  // ดึงสรุปของ market เพิ่มการดึงรีวิวแต่ละดาว 1-5 มีกี่รีวิว
  let summary;
  try {
    summary = await pool.query(
      `SELECT m.market_id, m.shop_name, m.rating AS rating_avg, m.reviews_count,
              COUNT(*) FILTER (WHERE r.rating = 5) AS rating_5,
              COUNT(*) FILTER (WHERE r.rating = 4) AS rating_4,
              COUNT(*) FILTER (WHERE r.rating = 3) AS rating_3,
              COUNT(*) FILTER (WHERE r.rating = 2) AS rating_2,
              COUNT(*) FILTER (WHERE r.rating = 1) AS rating_1
             FROM public.markets m
              LEFT JOIN public.market_reviews r ON r.market_id = m.market_id
              WHERE m.market_id = $1
              GROUP BY m.market_id, m.shop_name, m.rating, m.reviews_count`,
      [marketId]
    );
  } catch (err) {
    return res.status(400).json({ error: 'Cannot fetch market summary', detail: err.message });
  }

  try {
    const { rows } = await pool.query(sql, [marketId, limit, offset]);
    return res.json({
      ok: true,
      market_summary: summary.rows[0],
      items: rows,
      paging: { limit, offset },
      authenticated_user: user_id
    });
  } catch (err) {
    return res.status(400).json({ error: 'Cannot list market reviews', detail: err.message });
  }
};

// ================ List Reviews Rider =================
exports.listRiderReviews = async (req, res) => {
  const { user_id } = req.user || {};
  if (!user_id) return res.status(401).json({ error: 'Invalid token payload (no user_id)' });

  // ใช้ riderId จาก middleware ที่ดึงจาก token
  const riderId = req.riderId;
  const { limit, offset } = parsePage(req);

  const sql = `
    SELECT o.order_id, r.review_id, r.rating, r.comment, r.created_at,
           u.display_name AS reviewer_name, u.photo_url AS reviewer_photo, r.user_id
    FROM public.rider_reviews r
    JOIN public.users u ON u.user_id = r.user_id
    JOIN public.orders o ON o.order_id = r.order_id AND o.rider_id = r.rider_id
    WHERE r.rider_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  // ดึงสรุปของ rider เพิ่มการดึงรีวิวแต่ละดาว 1-5 มีกี่รีวิว
  let summary;
  try {
    summary = await pool.query(
      `SELECT rp.rider_id, u.display_name AS rider_name, rp.rating AS rating_avg, rp.reviews_count,
              COUNT(*) FILTER (WHERE r.rating = 5) AS rating_5,
              COUNT(*) FILTER (WHERE r.rating = 4) AS rating_4,
              COUNT(*) FILTER (WHERE r.rating = 3) AS rating_3,
              COUNT(*) FILTER (WHERE r.rating = 2) AS rating_2,
              COUNT(*) FILTER (WHERE r.rating = 1) AS rating_1
             FROM public.rider_profiles rp
              JOIN public.users u ON u.user_id = rp.user_id
              LEFT JOIN public.rider_reviews r ON r.rider_id = rp.rider_id
              WHERE rp.rider_id = $1
              GROUP BY rp.rider_id, u.display_name, rp.rating, rp.reviews_count`,
      [riderId]
    );
  } catch (err) {
    return res.status(400).json({ error: 'Cannot fetch rider summary', detail: err.message });
  }

  try {
    const { rows } = await pool.query(sql, [riderId, limit, offset]);
    return res.json({
      ok: true,
      rider_summary: summary.rows[0],
      items: rows,
      paging: { limit, offset },
      authenticated_user: user_id
    });
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

exports.getAllMarketReviews = async (req, res) => {
  const marketId = parseInt(req.params.marketId, 10);
  if (isNaN(marketId)) {
    return res.status(400).json({ error: 'Invalid or missing marketId' });
  }

  const { limit, offset } = parsePage(req);

  try {
    // 📌 ดึงรายการรีวิวทั้งหมดของร้าน
    const { rows: reviews } = await pool.query(`
      SELECT 
        r.review_id, 
        r.rating, 
        r.comment, 
        r.created_at,
        u.display_name AS reviewer_name, 
        u.photo_url AS reviewer_photo
      FROM public.market_reviews r
      JOIN public.users u ON u.user_id = r.user_id
      WHERE r.market_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [marketId, limit, offset]);

    // 📌 ดึงข้อมูลร้าน + สรุปรีวิว + จำนวนรีวิวแต่ละดาว
    const { rows: summaryRows } = await pool.query(`
      SELECT 
        m.market_id,
        m.owner_id,
        m.shop_name,
        m.shop_description,
        m.shop_logo_url,
        m.created_at,
        m.latitude,
        m.longitude,
        m.open_time,
        m.close_time,
        m.is_open,
        m.is_manual_override,
        m.override_until,
        m.rating AS rating_avg,
        m.address,
        m.phone,
        m.approve,
        m.admin_id,
        m.is_admin,
        m.reviews_count,
        COUNT(*) FILTER (WHERE r.rating = 5) AS rating_5,
        COUNT(*) FILTER (WHERE r.rating = 4) AS rating_4,
        COUNT(*) FILTER (WHERE r.rating = 3) AS rating_3,
        COUNT(*) FILTER (WHERE r.rating = 2) AS rating_2,
        COUNT(*) FILTER (WHERE r.rating = 1) AS rating_1
      FROM public.markets m
      LEFT JOIN public.market_reviews r ON r.market_id = m.market_id
      WHERE m.market_id = $1
      GROUP BY 
        m.market_id, m.owner_id, m.shop_name, m.shop_description, m.shop_logo_url, m.created_at,
        m.latitude, m.longitude, m.open_time, m.close_time, m.is_open, m.is_manual_override, 
        m.override_until, m.rating, m.address, m.phone, m.approve, m.admin_id, m.is_admin, m.reviews_count
    `, [marketId]);

    return res.json({
      ok: true,
      market: summaryRows[0] || null, // ✅ ตอนนี้จะเป็น object market พร้อมข้อมูลครบ
      reviews: reviews,
      paging: { limit, offset }
    });

  } catch (err) {
    console.error('❌ getAllMarketReviews error:', err);
    return res.status(400).json({ error: 'Cannot fetch reviews', detail: err.message });
  }
};
// ================ Food Reviews =================
exports.upsertFoodReviews = async (req, res) => {
  const { user_id } = req.user || {};
  const { order_id, reviews } = req.body;

  if (!user_id) return res.status(401).json({ error: "Invalid token" });
  if (!order_id || !Array.isArray(reviews)) {
    return res
      .status(400)
      .json({ error: "order_id and reviews[] are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const r of reviews) {
      const { order_item_id, food_id, rating, comment } = r;

      // ✅ ตรวจสอบข้อมูลขั้นต่ำ
      if (!order_item_id || !food_id || !rating) {
        throw new Error(
          `Missing required field in review: ${JSON.stringify(r)}`
        );
      }

      // ✅ ดึง market_id จาก order_items
      const { rows: orderRows } = await client.query(
        `
        SELECT o.market_id 
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.order_id
        WHERE oi.item_id = $1 AND o.order_id = $2
        `,
        [order_item_id, order_id]
      );

      if (orderRows.length === 0) {
        throw new Error(
          `Order item ${order_item_id} not found or not linked to order ${order_id}`
        );
      }

      const market_id = orderRows[0].market_id;

      // ✅ Insert or Update review ใน food_reviews
      await client.query(
        `
        INSERT INTO public.food_reviews (
          order_id, order_item_id, user_id, market_id, food_id, rating, comment, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW()
        )
        ON CONFLICT (order_item_id, user_id)
        DO UPDATE SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = NOW();
        `,
        [
          order_id,
          order_item_id,
          user_id,
          market_id,
          food_id,
          rating,
          comment || null,
        ]
      );

      // ✅ อัปเดตสถานะใน order_items ว่าถูกรีวิวแล้ว
      await client.query(
        `
        UPDATE public.order_items
        SET is_reviewed = TRUE
        WHERE item_id = $1;
        `,
        [order_item_id]
      );


      // ✅ อัปเดตค่าเฉลี่ย rating ของเมนูนี้ในตาราง foods
      await client.query(
        `
        UPDATE public.foods
        SET rating = sub.avg_rating
        FROM (
          SELECT food_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating
          FROM public.food_reviews
          WHERE food_id = $1
          GROUP BY food_id
        ) AS sub
        WHERE foods.food_id = sub.food_id;
        `,
        [food_id]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, message: "Food reviews saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ upsertFoodReviews error:", err);
    return res.status(400).json({
      error: "Cannot save reviews",
      detail: err.message,
    });
  } finally {
    client.release();
  }
};

// ================ List Reviews Food =================
exports.listFoodReviews = async (req, res) => {
  const foodId = parseInt(req.params.foodId);
  if (isNaN(foodId)) return res.status(400).json({ error: 'Invalid or missing foodId' });

  const { limit, offset } = parsePage(req);

  const sql = `
    SELECT r.review_id, r.rating, r.comment, r.created_at, r.updated_at,
           u.display_name AS reviewer_name, u.photo_url AS reviewer_photo, r.user_id
    FROM public.food_reviews r
    JOIN public.users u ON u.user_id = r.user_id
    WHERE r.food_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  // 📊 ดึงสรุปรีวิวของอาหาร
  let summary;
  try {
    summary = await pool.query(
      `SELECT f.food_id, f.food_name,
              ROUND(AVG(r.rating)::numeric, 2) AS rating_avg,
              COUNT(r.*) AS reviews_count,
              COUNT(*) FILTER (WHERE r.rating = 5) AS rating_5,
              COUNT(*) FILTER (WHERE r.rating = 4) AS rating_4,
              COUNT(*) FILTER (WHERE r.rating = 3) AS rating_3,
              COUNT(*) FILTER (WHERE r.rating = 2) AS rating_2,
              COUNT(*) FILTER (WHERE r.rating = 1) AS rating_1
       FROM public.foods f
       LEFT JOIN public.food_reviews r ON r.food_id = f.food_id
       WHERE f.food_id = $1
       GROUP BY f.food_id, f.food_name`,
      [foodId]
    );
  } catch (err) {
    return res.status(400).json({ error: 'Cannot fetch food summary', detail: err.message });
  }

  try {
    const { rows } = await pool.query(sql, [foodId, limit, offset]);
    return res.json({
      ok: true,
      food_summary: summary.rows[0],
      items: rows,
      paging: { limit, offset },
    });
  } catch (err) {
    return res.status(400).json({ error: 'Cannot list food reviews', detail: err.message });
  }
};
