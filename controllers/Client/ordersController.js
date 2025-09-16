const pool = require('../../config/db');

exports.PostOrders = async (req, res) => {
  const { basket, address, deliveryType, paymentMethod, note, distances, deliveryFees, totalPrices } = req.body;
  const user_id = req.user.user_id;

  const client = await pool.connect();

  try {
    // แยก basket ตามร้าน
    const basketsByMarket = {};
    basket.forEach(item => {
      const marketId = item.market_id.toString();
      if (!basketsByMarket[marketId]) basketsByMarket[marketId] = [];
      basketsByMarket[marketId].push(item);
    });

    const orders = [];

    await client.query("BEGIN");

    // Process each market separately
    for (const marketId of Object.keys(basketsByMarket)) {
      const items = basketsByMarket[marketId];

      const distance = distances[marketId] || 0;
      const deliveryFee = deliveryFees[marketId] || 0;
      const totalPrice = totalPrices[marketId] || 0;

      // ✅ Insert order
      const orderInsert = await client.query(
        `INSERT INTO orders 
          (user_id, market_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
         RETURNING *`,
        [
          user_id,
          parseInt(marketId),
          address || null,
          deliveryType || 'แบบ/วางไว้จุดที่ระบุ',
          paymentMethod || 'เงินสด',
          note || '',
          parseFloat(distance),
          parseFloat(deliveryFee),
          parseFloat(totalPrice),
          'pending'
        ]
      );

      const order = orderInsert.rows[0];

      // ✅ Insert order_items + selected_options
      const insertItemQuery = `
  INSERT INTO order_items
    (order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options)
  VALUES ($1,$2,$3,$4,$5,$6,$7)
  RETURNING *;
`;

      for (const item of items) {
        await client.query(insertItemQuery, [
          order.order_id,
          item.food_id,
          item.food_name,
          item.quantity,
          item.sell_price,
          item.quantity * item.sell_price,
          JSON.stringify(item.selected_options || []), // ✅ เก็บ options
        ]);
      }


      // ✅ ลบ cart ของ market นี้
      const cartIds = items.map(i => i.cart_id).filter(id => id);
      if (cartIds.length > 0) {
        await client.query(`DELETE FROM carts WHERE cart_id = ANY($1::int[])`, [cartIds]);
      }

      orders.push({
        order_id: order.order_id,
        market_id: parseInt(marketId),
        total_price: parseFloat(totalPrice),
        delivery_fee: parseFloat(deliveryFee),
        distance_km: parseFloat(distance),
        items_count: items.length
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      orders,
      message: `สร้างออเดอร์สำเร็จ ${orders.length} ร้าน`
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error('❌ Error creating orders:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการสร้างออเดอร์',
      details: error.message
    });
  } finally {
    client.release();
  }
};

// GET /orders/:order_id
exports.getOrderStatus = async (req, res) => {
  const order_id = parseInt(req.params.order_id);

  try {
    const orderRes = await pool.query(
      `SELECT order_id, market_id, status, total_price, delivery_fee, distance_km
       FROM orders
       WHERE order_id = $1`,
      [order_id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const itemsRes = await pool.query(
      `SELECT item_id, food_id, food_name, quantity, sell_price, subtotal, selected_options
       FROM order_items
       WHERE order_id = $1`,
      [order_id]
    );

    res.json({
      success: true,
      order: {
        ...orderRes.rows[0],
        items: itemsRes.rows
      }
    });
  } catch (error) {
    console.error('❌ Error fetching order status:', error);
    res.status(500).json({ success: false, message: 'Error fetching order status' });
  }
};
