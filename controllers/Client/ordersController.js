const pool = require('../../config/db');
const { getIO } = require("../../SocketRoutes/Events/socketEvents"); // ✅ import ฟังก์ชันดึง io instance

exports.PostOrders = async (req, res) => {
  const { basket, address_id, address, deliveryType, paymentMethod, note, distances, deliveryFees, totalPrices } = req.body;
  const user_id = req.user.user_id;

  const client = await pool.connect();

  try {
    const basketsByMarket = {};
    basket.forEach(item => {
      const marketId = item.market_id.toString();
      if (!basketsByMarket[marketId]) basketsByMarket[marketId] = [];
      basketsByMarket[marketId].push(item);
    });

    const orders = [];
    await client.query("BEGIN");

    for (const marketId of Object.keys(basketsByMarket)) {
      const items = basketsByMarket[marketId];

      const distance = distances[marketId] || 0;
      const deliveryFee = deliveryFees[marketId] || 0;
      const totalPrice = totalPrices[marketId] || 0;

      // ✅ Insert order
      const orderInsert = await client.query(
        `INSERT INTO orders 
          (user_id, market_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, status, created_at, updated_at, address_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW(),$11)
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
          'waiting',
          address_id
        ]
      );

      const order = orderInsert.rows[0];

      // ✅ Insert order_items
      const insertItemQuery = `
        INSERT INTO order_items
          (order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `;
      for (const item of items) {
        await client.query(insertItemQuery, [
          order.order_id,
          item.food_id,
          item.food_name,
          item.quantity,
          item.sell_price,
          item.quantity * item.sell_price,
          JSON.stringify(item.selected_options || []),
        ]);
      }

      // ✅ ลบ cart
      const cartIds = items.map(i => i.cart_id).filter(id => id);
      if (cartIds.length > 0) {
        await client.query(`DELETE FROM carts WHERE cart_id = ANY($1::int[])`, [cartIds]);
      }

      // ✅ push to response
      orders.push({
        order_id: order.order_id,
        market_id: parseInt(marketId),
        total_price: parseFloat(totalPrice),
        delivery_fee: parseFloat(deliveryFee),
        distance_km: parseFloat(distance),
        items_count: items.length
      });

      // ✅ ส่ง socket event ทันที
      const io = getIO();
      if (io) {
        const newOrderData = {
          order_id: order.order_id,
          user_id,
          market_id: parseInt(marketId),
          status: 'waiting',
          address,
          total_price: parseFloat(totalPrice),
          delivery_fee: parseFloat(deliveryFee),
          distance_km: parseFloat(distance),
          timestamp: new Date().toISOString()
        };
        console.log("📡 Emitting new_order_notification:", newOrderData);
        io.emit("new_order_notification", newOrderData);
        io.to(`market:${marketId}`).emit("new_order_notification", newOrderData); // ✅ ยิงเฉพาะร้านด้วยก็ได้
      }
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

// ✅ ดึงออเดอร์ทั้งหมดของลูกค้า
exports.getOrdersByCustomer = async (req, res) => {
  const customerId = req.user.user_id; // ได้จาก token auth

  try {
    const ordersRes = await pool.query(
      `SELECT 
        o.order_id,
        o.user_id,
        o.market_id,
        o.rider_id,
        o.address,
        o.delivery_type,
        o.payment_method,
        o.note,
        o.distance_km,
        o.delivery_fee,
        o.total_price,
        o.status,
        o.created_at,
        o.updated_at,
        m.shop_name AS market_name
       FROM orders o
       LEFT JOIN markets m ON o.market_id = m.market_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [customerId]
    );

    // ✅ loop order_id ไปดึง items
    const orders = [];
    for (const order of ordersRes.rows) {
      const itemsRes = await pool.query(
        `SELECT item_id, food_id, food_name, quantity, sell_price, subtotal, selected_options
         FROM order_items
         WHERE order_id = $1`,
        [order.order_id]
      );

      orders.push({
        ...order,
        items: itemsRes.rows.map(i => ({
          ...i,
          selected_options: i.selected_options || []
        }))
      });
    }

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error("❌ Error fetching customer orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer orders",
      error: error.message
    });
  }
};