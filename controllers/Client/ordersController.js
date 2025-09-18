const pool = require('../../config/db');

exports.PostOrders = async (req, res) => {
  const { basket, address, deliveryType, paymentMethod, note, distances, deliveryFees, totalPrices } = req.body;
  const user_id = req.user.user_id;

  try {
    // แยก basket ตามร้าน
    const basketsByMarket = {};
    basket.forEach(item => {
      const marketId = item.market_id.toString(); // Ensure string key
      if (!basketsByMarket[marketId]) basketsByMarket[marketId] = [];
      basketsByMarket[marketId].push(item);
    });

    const orders = [];

    // Process each market separately
    for (const marketId of Object.keys(basketsByMarket)) {
      const items = basketsByMarket[marketId];

      // Get data for this specific market
      const distance = distances[marketId] || 0;
      const deliveryFee = deliveryFees[marketId] || 0;
      const totalPrice = totalPrices[marketId] || 0;

      // Insert order for this market
      const orderInsert = await pool.query(
        `INSERT INTO orders 
        (user_id, market_id, address, delivery_type, payment_method, note, distance_km, delivery_fee, total_price, items, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING order_id`,
        [
          user_id,
          parseInt(marketId), // Convert back to integer for database
          address || null,
          deliveryType || 'แบบ/วางไว้จุดที่ระบุ',
          paymentMethod || 'เงินสด',
          note || '',
          parseFloat(distance),
          parseFloat(deliveryFee),
          parseFloat(totalPrice),
          JSON.stringify(items),
          'pending' // Default status
        ]
      );

      const order_id = orderInsert.rows[0].order_id;

      // Delete used cart items for this market
      const cartIds = items.map(item => item.cart_id).filter(id => id); // Filter out null/undefined
      if (cartIds.length > 0) {
        await pool.query(
          `DELETE FROM carts WHERE cart_id = ANY($1::int[])`,
          [cartIds]
        );
      }

      // Add order info to response
      orders.push({ 
        order_id, 
        market_id: parseInt(marketId),
        total_price: parseFloat(totalPrice),
        delivery_fee: parseFloat(deliveryFee),
        distance_km: parseFloat(distance),
        items_count: items.length
      });
    }

    // Log successful order creation
    console.log(`✅ Created ${orders.length} orders for user ${user_id}`);
    orders.forEach(order => {
      console.log(`   Order ${order.order_id}: Market ${order.market_id}, ${order.items_count} items, ฿${order.total_price}`);
    });

    res.json({ 
      success: true, 
      orders,
      message: `สร้างออเดอร์สำเร็จ ${orders.length} ร้าน`
    });

  } catch (error) {
    console.error('❌ Error creating orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาดในการสร้างออเดอร์',
      details: error.message 
    });
  }
};