const pool = require('../../config/db');
const { getIO } = require("../../SocketRoutes/Events/socketEvents"); // ✅ import ฟังก์ชันดึง io instance

// ✅ ตรวจสอบสถานะร้านค้าก่อนสั่งซื้อ - เวอร์ชันสมบูรณ์
// ✅ ตรวจสอบสถานะร้านค้าก่อนสั่งซื้อ - ตรงตามโครงสร้างตาราง markets
exports.checkStoresStatus = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { cart_ids } = req.body;

    console.log('🔍 Check Stores Request:', {
      user_id,
      cart_ids,
      timestamp: new Date().toISOString()
    });

    if (!cart_ids || cart_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาเลือกสินค้าที่ต้องการสั่งซื้อ'
      });
    }

    // ✅ JOIN: carts → foods → markets (ใช้ชื่อฟิลด์ที่ถูกต้อง)
    const cartQuery = await pool.query(
      `SELECT DISTINCT 
         m.market_id,
         m.shop_name,
         m.is_open,
         m.open_time,
         m.close_time,
         m.is_manual_override,
         m.override_until
       FROM carts c
       JOIN foods f ON c.food_id = f.food_id
       JOIN markets m ON f.market_id = m.market_id
       WHERE c.cart_id = ANY($1) AND c.user_id = $2
       ORDER BY m.shop_name`,
      [cart_ids, user_id]
    );

    console.log('📊 Found markets:', cartQuery.rows);

    if (cartQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    // ตรวจสอบสถานะร้านค้า
    const closedStores = [];
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    console.log('⏰ Current time:', currentTimeString);

    for (const store of cartQuery.rows) {
      console.log(`🏪 Checking store: ${store.shop_name}`, {
        is_open: store.is_open,
        open_time: store.open_time,
        close_time: store.close_time,
        is_manual_override: store.is_manual_override,
        override_until: store.override_until
      });

      // ✅ ตรวจสอบ manual override ก่อน
      if (store.is_manual_override && store.override_until) {
        const overrideUntil = new Date(store.override_until);
        if (currentTime < overrideUntil) {
          // ยังอยู่ในช่วง override
          if (!store.is_open) {
            closedStores.push({
              market_id: store.market_id,
              market_name: store.shop_name || 'ไม่ระบุชื่อร้าน',
              reason: 'ร้านปิดให้บริการชั่วคราว (ตั้งค่าโดยเจ้าของร้าน)',
              opening_time: store.open_time,
              closing_time: store.close_time
            });
            console.log(`❌ Store ${store.shop_name} is manually closed until ${overrideUntil}`);
            continue;
          }
        }
      }

      // ✅ ตรวจสอบสถานะร้าน
      if (!store.is_open) {
        closedStores.push({
          market_id: store.market_id,
          market_name: store.shop_name || 'ไม่ระบุชื่อร้าน',
          reason: 'ร้านปิดให้บริการชั่วคราว',
          opening_time: store.open_time,
          closing_time: store.close_time
        });
        console.log(`❌ Store ${store.shop_name} is closed`);
        continue;
      }

      // ✅ ตรวจสอบเวลาทำการ (open_time และ close_time เป็น TEXT)
      if (store.open_time && store.close_time) {
        const openTime = store.open_time;
        const closeTime = store.close_time;

        let isOutsideHours = false;

        // กรณีร้านเปิดข้ามวัน (เช่น 22:00 - 02:00)
        if (openTime > closeTime) {
          // ถ้าเวลาปัจจุบันอยู่ระหว่าง closeTime ถึง openTime = นอกเวลาทำการ
          if (currentTimeString > closeTime && currentTimeString < openTime) {
            isOutsideHours = true;
          }
        } else {
          // กรณีปกติ (เช่น 08:00 - 20:00)
          if (currentTimeString < openTime || currentTimeString > closeTime) {
            isOutsideHours = true;
          }
        }

        if (isOutsideHours) {
          closedStores.push({
            market_id: store.market_id,
            market_name: store.shop_name || 'ไม่ระบุชื่อร้าน',
            reason: 'นอกเวลาทำการ',
            opening_time: openTime,
            closing_time: closeTime
          });
          console.log(`⏰ Store ${store.shop_name} outside hours (${openTime} - ${closeTime})`);
        } else {
          console.log(`✅ Store ${store.shop_name} is open (${openTime} - ${closeTime})`);
        }
      } else {
        console.log(`✅ Store ${store.shop_name} is open (no time restrictions)`);
      }
    }

    // ส่ง response
    if (closedStores.length > 0) {
      console.log('❌ Some stores are closed:', closedStores);
      return res.status(400).json({
        success: false,
        message: 'มีร้านค้าที่ปิดทำการ',
        closed_stores: closedStores,
        error_type: 'STORE_CLOSED'
      });
    }

    console.log('✅ All stores are open');
    res.json({
      success: true,
      message: 'ร้านค้าทั้งหมดเปิดทำการ',
      stores: cartQuery.rows.map(store => ({
        market_id: store.market_id,
        market_name: store.shop_name,
        is_open: store.is_open,
        opening_time: store.open_time,
        closing_time: store.close_time
      }))
    });

  } catch (err) {
    console.error('❌ Check Stores Status Error:', err);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.PostOrders = async (req, res) => {
  const {
    basket,
    address_id,
    address,
    deliveryType,
    paymentMethod,
    note,
    distances = {},
    deliveryFees = {},
    totalPrices = {},
    // originalTotalPrices = {}, // ไม่ใช้ค่าจาก client จะคำนวณเองฝั่งเซิร์ฟเวอร์
    // rider_required_gp,        // ❗ อย่ายุ่งกับ gp — ส่งต่อค่าเดิม
    bonus
  } = req.body;

  const user_id = req.user?.user_id;
  const client = await pool.connect();

  // ---------- Helpers ----------
  const parseMaybeJSON = (val, fallback) => {
    if (val == null) return fallback;
    if (Array.isArray(val) || typeof val === 'object') return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val || 'null') ?? fallback; }
      catch { return fallback; }
    }
    return fallback;
  };

  const toNum = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const normKey = (o) => String((o?.label ?? o?.name ?? o?.value ?? '')).trim().toLowerCase();

  const money = (n) => Number(toNum(n, 0).toFixed(2)); // ปัดเศษทศนิยม 2 ตำแหน่ง

  try {
    if (!Array.isArray(basket) || basket.length === 0) {
      return res.status(400).json({ success: false, error: 'ตะกร้าสินค้าว่างเปล่าหรือรูปแบบไม่ถูกต้อง' });
    }
    if (!user_id) {
      return res.status(401).json({ success: false, error: 'ไม่พบผู้ใช้จากโทเค็น' });
    }

    // แยก basket ตาม market_id
    const basketsByMarket = {};
    for (const it of basket) {
      const mk = String(it.market_id);
      if (!basketsByMarket[mk]) basketsByMarket[mk] = [];
      basketsByMarket[mk].push(it);
    }

    const orders = [];
    await client.query('BEGIN');

    // loop ต่อร้าน
    for (const [marketId, items] of Object.entries(basketsByMarket)) {
      const distance    = toNum(distances[marketId], 0);
      const deliveryFee = money(deliveryFees[marketId]);
      const totalPrice  = money(totalPrices[marketId]);

      // 1) สร้าง order (ตั้ง original_total_price = 0 ก่อน เดี๋ยวค่อยอัปเดต)
      const orderInsert = await client.query(
        `INSERT INTO orders 
          (user_id, market_id, address, delivery_type, payment_method, note,
          distance_km, delivery_fee, total_price, original_total_price, status,
          created_at, updated_at, address_id, rider_required_gp, bonus)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW(),$12,$13,$14)
        RETURNING *`,
        [
          user_id,
          Number(marketId),
          address || null,
          deliveryType || 'แบบ/วางไว้จุดที่ระบุ',
          paymentMethod || 'เงินสด',
          note || '',
          money(distance),
          deliveryFee,
          totalPrice,
          0,                 // ค่าต้นทุนรวม เดี๋ยวคำนวณจากรายการสินค้า
          'waiting',
          address_id ?? null,
          // rider_required_gp, // ❗ ไม่แตะต้องค่า gp
          0,    // rider_required_gp เริ่มที่ 0
          0               // ✅ bonus เริ่ม 0 (ไม่อ่านจาก client)
        ]
      );
      const order = orderInsert.rows[0];

      // 2) เตรียม insert order_items
      const insertItemSQL = `
        INSERT INTO order_items
          (order_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options, additional_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `;

      let calculatedOriginalTotal = 0; //รวมต้นทุนของออเดอร์นี้
      let calculatedSellTotal     = 0; // ✅ รวมยอดขาย(รวม option) ทั้งออเดอร์

      // 3) loop สินค้าแต่ละชิ้น
      for (const item of items) {
        // ดึงข้อมูล note จาก carts ก่อน (ถ้ามี cart_id)
        let cartNote = '';
        if (item.cart_id) {
          const cartRes = await client.query(
            'SELECT note FROM carts WHERE cart_id = $1',
            [item.cart_id]
          );
          if (cartRes.rows.length > 0) {
            cartNote = cartRes.rows[0].note || '';
          }
        }

        // ดึงต้นทุนจาก foods
        const foodRes = await client.query(
          'SELECT price, options FROM foods WHERE food_id = $1',
          [item.food_id]
        );
        if (foodRes.rows.length === 0) {
          throw new Error(`Food with ID ${item.food_id} not found`);
        }

        const food = foodRes.rows[0];
        const baseOriginalPrice = toNum(food.price, 0); // ต้นทุนฐาน/หน่วย

        // ===== ต้นทุนฝั่ง options (อ้างอิงจาก foods.options) =====
        const foodsOptionsArr = parseMaybeJSON(food.options, []);
        const costMap = new Map(
          foodsOptionsArr.map(o => [normKey(o), toNum(o?.extraPrice, 0)])
        );

        // ===== ตัวเลือกที่ลูกค้าเลือก (ราคาขาย) =====
        const selectedOptionsArr = parseMaybeJSON(item.selected_options, []);

        // รวม "ต้นทุน" ของ option ที่เลือก + สร้าง original_options (เก็บเฉพาะที่เลือก)
        let originalOptionsTotal = 0;
        const originalOptionsPicked = [];
        for (const s of selectedOptionsArr) {
          const key = normKey(s);
          if (!key) continue;
          if (costMap.has(key)) {
            const cost = costMap.get(key);
            originalOptionsTotal += cost;
            originalOptionsPicked.push({
              label: s?.label ?? s?.name ?? s?.value,
              extraPrice: cost
            });
          } else {
            console.warn('⚠️ No matching cost option for:', s, 'all options:', foodsOptionsArr);
          }
        }

        // ===== ยอดขายฝั่งลูกค้า (ใช้ราคาขายของตัวเลือกจาก selected_options.extraPrice) =====
        const qty = toNum(item.quantity, 0);
        const sellPriceBase = toNum(item.sell_price, 0);               // ราคาขายฐาน/หน่วย (ไม่รวม option)
        const sellOptionsTotal = selectedOptionsArr
          .reduce((sum, s) => sum + toNum(s?.extraPrice, 0), 0);       // รวมราคาขายของ option ที่เลือก
        const sellUnitWithOptions = sellPriceBase + sellOptionsTotal;  // ราคาขาย/หน่วย รวม option
        const sellSubtotal = money(sellUnitWithOptions * qty);                // ✅ ใช้เก็บลงคอลัมน์ subtotal

        // ===== ฝั่งต้นทุนรวมทั้งบรรทัด =====
        const unitOriginalCost = baseOriginalPrice + originalOptionsTotal;
        const originalSubtotal = money(unitOriginalCost * qty);

        // รวมต้นทุนของออเดอร์
        calculatedSellTotal     += sellSubtotal;      // ✅ สะสมยอดขาย
        calculatedOriginalTotal += originalSubtotal;  // (เดิมมีอยู่แล้ว)

        // INSERT รายการ
        await client.query(insertItemSQL, [
          order.order_id,
          item.food_id,
          item.food_name,
          qty,
          money(sellPriceBase),                        // sell_price = ฐาน/หน่วย (ไม่รวม option)
          sellSubtotal,                         // ✅ subtotal = (sell_price + sum(option.extraPrice)) * qty
          JSON.stringify(selectedOptionsArr ?? []), // เก็บราคาขายของ option ที่เลือกใน selected_options
          money(baseOriginalPrice),                    // original_price = ฐานต้นทุน/หน่วย (ไม่รวม option)
          originalSubtotal,                     // original_subtotal = รวมต้นทุนทั้งบรรทัด
          JSON.stringify(originalOptionsPicked), // original_options (เฉพาะที่เลือก + ต้นทุน)
          cartNote || item.additional_notes || ''  // ใช้ note จาก carts หรือ additional_notes จาก client
        ]);
      }

      // 4) คำนวณ GP และ BONUS ตามต้นทุนรวม
      const baseCostOriginalTotal  = money(calculatedOriginalTotal);           // ต้นทุนรวมทั้งออเดอร์
      const grossSell = money(calculatedSellTotal);              // Σ(subtotal) = ยอดขายรวมทั้งออเดอร์ (รวม option แล้ว)
      const riderGP = Math.max(0, money(calculatedSellTotal - calculatedOriginalTotal)); // ✅ GP ที่ยังไม่หักโบัส ต่อออเดอร์ = ยอดราคาขาย - ต้นทุน และต้องไม่ติดลบ

      // 4.1) คำนวณ BONUS
      let bonusAmount = 0;
      if (grossSell >= 150 && grossSell < 200) {
        bonusAmount = 5;
      } else if (grossSell >= 200 && grossSell < 250) {
        bonusAmount = 10;
      } else if (grossSell >= 250) {
        bonusAmount = 15;
      }
      const GPAfterBonus = Math.max(0, riderGP - bonusAmount); // หักโบนัสออกจาก GP ได้ แต่ต้องไม่ติดลบ

      // 5) อัปเดตต้นทุนรวมทั้งออเดอร์
      await client.query(
        `UPDATE orders
          SET original_total_price = $1,
            rider_required_gp    = $2,
            bonus                = $3,
            updated_at           = NOW()
          WHERE order_id = $4`,
        [ baseCostOriginalTotal, GPAfterBonus, money(bonusAmount), order.order_id ]
      );

      // 6) ลบตะกร้า
      const cartIds = items.map(i => i.cart_id).filter(Boolean);
      if (cartIds.length > 0) {
        await client.query(
          'DELETE FROM carts WHERE cart_id = ANY($1::int[])',
          [cartIds]
        );
      }

      // 7) เตรียมข้อมูลตอบกลับ และยิง socket
      const payload = {
        order_id: order.order_id,
        market_id: Number(marketId),
        total_price: money(totalPrice),
        original_total_price: baseCostOriginalTotal,
        delivery_fee: money(deliveryFee),
        distance_km: money(distance),
        items_count: items.length,
        rider_required_gp: GPAfterBonus,  // ← ใส่ให้ฝั่งแอปเห็นค่า GP ที่หักโบนัสแล้ว หรือไม่ใส่ก็ได้
        bonus: money(bonusAmount),         // ← ใส่ให้ฝั่งแอปเห็นโบนัสที่ได้จากออเดอร์นี้ (ถ้ามี) หรือไม่ใส่ก็ได้
      };
      orders.push(payload);

      // 8) ยิง socket แจ้งร้านค้าทราบว่ามีออเดอร์ใหม่
      const io = getIO?.();
      if (io) {
        const newOrderData = {
          order_id: order.order_id,
          user_id,
          market_id: Number(marketId),
          status: 'waiting',
          address,
          total_price: money(totalPrice),
          delivery_fee: money(deliveryFee),
          distance_km: money(distance),
          original_total_price: baseCostOriginalTotal,
          rider_required_gp: GPAfterBonus,
          bonus: money(bonusAmount),
          timestamp: new Date().toISOString()
        };
        console.log('📡 Emitting new_order_notification:', newOrderData);
        io.emit('new_order_notification', newOrderData);
        io.to(`market:${marketId}`).emit('new_order_notification', newOrderData);
      }
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      orders,
      message: `สร้างออเดอร์สำเร็จ ${orders.length} ร้าน`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating orders:', error);
    return res.status(500).json({
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
      `SELECT order_id, market_id, status, total_price, original_total_price, delivery_fee, distance_km
       FROM orders
       WHERE order_id = $1`,
      [order_id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const itemsRes = await pool.query(
      `SELECT item_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options, additional_notes
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
        o.original_total_price,
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
        `SELECT item_id, food_id, food_name, quantity, sell_price, subtotal, selected_options, original_price, original_subtotal, original_options, additional_notes
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

// 🔥 API ใหม่: ดึงข้อมูลร้านค้าเพื่อเช็คว่าร้านไหนเป็นร้านแอดมิน (owner_id = null = 20% GP)
exports.getMarketsInfo = async (req, res) => {
  const { market_ids } = req.body;
  
  console.log(`🔍 Getting markets info for: ${market_ids?.join(', ')}`);

  if (!market_ids || !Array.isArray(market_ids) || market_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "market_ids array is required"
    });
  }

  try {
    // สร้าง placeholder สำหรับ IN clause
    const placeholders = market_ids.map((_, index) => `$${index + 1}`).join(', ');
    
    const result = await pool.query(
      `SELECT 
        market_id,
        owner_id,
        shop_name,
        shop_description
      FROM markets 
      WHERE market_id IN (${placeholders})`,
      market_ids
    );

    console.log(`✅ Found ${result.rows.length} markets`);
    
    // Log ข้อมูลร้านแต่ละร้าน
    result.rows.forEach(market => {
      const isAdmin = market.owner_id === null;
      console.log(`📊 Market ${market.market_id} (${market.shop_name}): ${isAdmin ? 'ADMIN SHOP (20% GP)' : `USER SHOP (15% GP, owner: ${market.owner_id})`}`);
    });

    res.json({
      success: true,
      data: result.rows,
      message: `Retrieved info for ${result.rows.length} markets`
    });

  } catch (error) {
    console.error("❌ getMarketsInfo error:", error);
    res.status(500).json({
      success: false,
      error: "Database error",
      message: error.message
    });
  }
};