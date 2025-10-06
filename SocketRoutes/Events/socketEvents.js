// SocketRoutes/socketEvents.js - แก้ไขให้ส่ง event ครบทุกฝ่าย
const pool = require("../../config/db");

let ioInstance;

// ฟังก์ชันส่ง event อัปเดตออเดอร์ไปยังทุกฝ่ายที่เกี่ยวข้อง
async function emitOrderUpdate(orderId, data) {
  if (!ioInstance) {
    console.error("❌ Socket.io instance not initialized");
    return;
  }

  try {
    // ดึงข้อมูลออเดอร์เพื่อหา user_id, market_id, rider_id
    const result = await pool.query(
      "SELECT user_id, market_id, rider_id FROM orders WHERE order_id = $1",
      [orderId]
    );

    if (result.rows.length === 0) {
      console.error(`❌ Order ${orderId} not found for socket update`);
      return;
    }

    const { user_id, market_id, rider_id } = result.rows[0];

    console.log(`📡 Broadcasting order update to all relevant parties:`, {
      orderId,
      user_id,
      market_id,
      rider_id,
      data
    });

    // ส่งไปยัง order-specific room
    const orderRoom = `order:${orderId}`;
    ioInstance.to(orderRoom).emit("order:updated", data);
    console.log(`   ↳ Sent to order room: ${orderRoom}`);

    // ส่งไปยัง customer room
    if (user_id) {
      const customerRoom = `customer:${user_id}`;
      ioInstance.to(customerRoom).emit("order:updated", data);
      console.log(`   ↳ Sent to customer room: ${customerRoom}`);
    }

    // ส่งไปยัง shop room
    if (market_id) {
      const shopRoom = `shop:${market_id}`;
      ioInstance.to(shopRoom).emit("order:updated", data);
      console.log(`   ↳ Sent to shop room: ${shopRoom}`);
    }

    // ส่งไปยัง rider room (ถ้ามี rider)
    if (rider_id) {
      const riderRoom = `rider:${rider_id}`;
      ioInstance.to(riderRoom).emit("order:updated", data);
      console.log(`   ↳ Sent to rider room: ${riderRoom}`);
    }

    // ⭐ เพิ่ม: ถ้าออเดอร์เป็น confirmed/preparing/ready_for_pickup และยังไม่มีไรเดอร์
    // ส่งไปยัง ALL riders เพื่อแจ้งว่ามีออเดอร์ใหม่พร้อมรับ
    const availableStatuses = ['confirmed', 'accepted', 'preparing', 'ready_for_pickup'];
    if (!rider_id && availableStatuses.includes(data.status)) {
      // ส่งไปทุก connected riders
      ioInstance.emit("new_order_available", {
        ...data,
        message: "New order available for pickup",
        order_id: parseInt(orderId)
      });
      console.log(`   ↳ 🎯 Broadcasted new available order to ALL riders`);
      
      // เพิ่ม: ส่งเฉพาะไปยัง riders ที่ online (ถ้ามี rider room list)
      const connectedSockets = await ioInstance.fetchSockets();
      let riderNotificationCount = 0;
      
      for (const socket of connectedSockets) {
        if (socket.riderId) { // ถ้า socket นี้เป็นของ rider
          socket.emit("new_order_notification", {
            ...data,
            message: "New order available for you to accept",
            order_id: parseInt(orderId),
            notification_type: "new_order_available"
          });
          riderNotificationCount++;
        }
      }
      
      console.log(`   ↳ 🏍️ Notified ${riderNotificationCount} online riders about new available order`);
    }

    console.log(`✅ Order update broadcasted successfully for order ${orderId}`);

  } catch (error) {
    console.error(`❌ Error broadcasting order update for order ${orderId}:`, error);
  }
}

function emitNewOrderToRiders(orderData) {
  if (!ioInstance) {
    console.error("❌ Socket.io instance not initialized");
    return;
  }

  console.log(`📡 Emitting new order notification to all riders:`, orderData);
  
  // ส่งไปทุก riders
  ioInstance.emit("new_order_available", {
    ...orderData,
    message: "New order available for pickup",
    notification_type: "new_order_available"
  });
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io instance not initialized");
  }
  return ioInstance;
}

function emitNewOrderToCustomer(userId, orderData) {
  if (!ioInstance) return;
  const roomName = `customer:${userId}`;
  ioInstance.to(roomName).emit("customer:newOrder", orderData);
  console.log(`📡 Emitted new order to customer room ${roomName}:`, orderData);
}

// ฟังก์ชันส่ง notification ไปยัง shop เมื่อมีออเดอร์ใหม่
function emitNewOrderToShop(marketId, orderData) {
  if (!ioInstance) return;
  const roomName = `shop:${marketId}`;
  ioInstance.to(roomName).emit("new_order_notification", orderData);
  console.log(`📡 Emitted new order notification to shop room ${roomName}:`, orderData);
}

// ฟังก์ชันดึงสถานะปัจจุบันของออเดอร์
async function getCurrentOrderStatus(orderId, socket) {
  try {
    const result = await pool.query(
      `SELECT 
        order_id,
        user_id,
        market_id,
        rider_id,
        address,
        delivery_type,
        payment_method,
        note,
        distance_km,
        delivery_fee,
        total_price,
        status, 
        shop_status,
        created_at,
        updated_at
      FROM orders 
      WHERE order_id = $1`,
      [orderId]
    );

    if (result.rows.length > 0) {
      const order = result.rows[0];
      const statusData = {
        order_id: parseInt(orderId),
        user_id: order.user_id,
        market_id: order.market_id,
        status: order.status,
        shop_status: order.shop_status,
        hasShop: order.status !== "waiting",
        hasRider: order.rider_id !== null,
        rider_id: order.rider_id,
        address: order.address,
        delivery_type: order.delivery_type,
        payment_method: order.payment_method,
        note: order.note,
        distance_km: order.distance_km,
        delivery_fee: order.delivery_fee,
        total_price: order.total_price,
        timestamps: {
          created_at: order.created_at,
          updated_at: order.updated_at
        }
      };

      socket.emit("order:updated", statusData);
      console.log(`📤 Sent current status to ${socket.id}:`, statusData);
    } else {
      socket.emit("error", { message: "Order not found" });
    }
  } catch (error) {
    console.error("Error getting current order status:", error);
    socket.emit("error", {
      message: "Failed to get order status",
      error: error.message
    });
  }
}

function initSocket(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // User registration - ปรับปรุงให้รองรับ rider
    socket.on("register_user", (data) => {
      const { userId, marketId, riderId, userType } = data;
      
      if (userId) {
        socket.userId = userId;
        socket.join(`customer:${userId}`);
        console.log(`👤 Customer ${userId} registered and joined room customer:${userId}`);
      }
      
      if (marketId) {
        socket.marketId = marketId;
        socket.join(`shop:${marketId}`);
        console.log(`🏪 Shop ${marketId} registered and joined room shop:${marketId}`);
      }
      
      if (riderId) {
        socket.riderId = riderId;
        socket.join(`rider:${riderId}`);
        console.log(`🏍️ Rider ${riderId} registered and joined room rider:${riderId}`);
        
        // ⭐ เพิ่ม: Auto-join global riders room สำหรับรับแจ้งเตือนออเดอร์ใหม่
        socket.join('all_riders');
        console.log(`🏍️ Rider ${riderId} joined global riders room`);
      }

      socket.userType = userType || 'customer';
    });

    // Generic room joining
    socket.on("join_room", (data) => {
      const { room } = data;
      if (room) {
        socket.join(room);
        console.log(`📍 Socket ${socket.id} joined room: ${room}`);
      }
    });

    // Specific order watching
    socket.on("customer:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`👤 Customer ${socket.id} watching order ${orderId}`);
      getCurrentOrderStatus(orderId, socket);
    });

    socket.on("shop:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`🏪 Shop ${socket.id} watching order ${orderId}`);
      getCurrentOrderStatus(orderId, socket);
    });

    socket.on("rider:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`🏍️ Rider ${socket.id} watching order ${orderId}`);
      getCurrentOrderStatus(orderId, socket);
    });

    // ⭐ เพิ่ม: Rider request available orders
    socket.on("rider:requestAvailableOrders", () => {
      if (socket.riderId) {
        console.log(`🏍️ Rider ${socket.riderId} requesting available orders`);
        // ส่งกลับไปว่าให้ refresh data
        socket.emit("rider:refreshOrders", {
          message: "Please refresh your orders list",
          timestamp: new Date().toISOString()
        });
      }
    });

    // Heartbeat for connection checking
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
      if (socket.userId) {
        console.log(`   ↳ Customer ${socket.userId} disconnected`);
      }
      if (socket.marketId) {
        console.log(`   ↳ Shop ${socket.marketId} disconnected`);
      }
      if (socket.riderId) {
        console.log(`   ↳ Rider ${socket.riderId} disconnected`);
      }
    });
  });

  process.on("SIGINT", () => {
    console.log("🛑 Server shutting down...");
    if (ioInstance) {
      ioInstance.close();
    }
    process.exit();
  });
}

module.exports = {
  initSocket,
  emitOrderUpdate,
  getIO,
  emitNewOrderToCustomer,
  emitNewOrderToShop,
  emitNewOrderToRiders // เพิ่มฟังก์ชันใหม่
};