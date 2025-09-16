// SocketRoutes/socketEvents.js - Updated for actual database schema
const pool = require("../config/db");

let ioInstance; // เก็บ instance ของ io

module.exports = function (io) {
  ioInstance = io; // เก็บ io instance ไว้ใช้ในฟังก์ชันอื่น

  io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);

    // User registration
    socket.on("register_user", (data) => {
      const { userId } = data;
      socket.userId = userId;
      console.log(`👤 User ${userId} registered with socket ${socket.id}`);
    });

    // ให้ลูกค้าเข้าร่วม room ของออร์เดอร์
    socket.on("customer:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`👤 Customer ${socket.id} joined room ${roomName}`);

      // ส่งสถานะปัจจุบันให้ลูกค้าทันที
      getCurrentOrderStatus(orderId, socket);
    });

    // ร้านค้าเข้าร่วม room ของออร์เดอร์
    socket.on("shop:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`🏪 Shop ${socket.id} joined room ${roomName}`);

      // ส่งสถานะปัจจุบันให้ร้านค้าทันที
      getCurrentOrderStatus(orderId, socket);
    });

    // ไรเดอร์เข้าร่วม room ของออร์เดอร์
    socket.on("rider:watchOrder", (orderId) => {
      const roomName = `order:${orderId}`;
      socket.join(roomName);
      socket.currentOrderRoom = roomName;
      console.log(`🏍️ Rider ${socket.id} joined room ${roomName}`);

      // ส่งสถานะปัจจุบันให้ไรเดอร์ทันที
      getCurrentOrderStatus(orderId, socket);
    });

    // ร้านค้ารับออเดอร์ (ผ่าน socket)
    socket.on("shop:acceptOrder", async (data) => {
      try {
        const { order_id, market_id } = data;

        if (!order_id) {
          socket.emit("error", { message: "order_id is required" });
          return;
        }

        console.log(`🏪 Market ${market_id} attempting to accept order ${order_id}`);

        // ตรวจสอบสถานะปัจจุบัน
        const checkResult = await pool.query(
          "SELECT status, market_id FROM orders WHERE order_id = $1",
          [order_id]
        );

        if (checkResult.rows.length === 0) {
          socket.emit("error", { message: "Order not found" });
          return;
        }

        const currentOrder = checkResult.rows[0];

        // เปลี่ยนจาก 'pending' เป็น 'waiting' ตามตารางจริง
        if (currentOrder.status !== 'waiting') {
          socket.emit("error", { message: "Order already accepted" });
          return;
        }

        // ตรวจสอบว่าเป็นร้านเดียวกันหรือไม่
        if (market_id && currentOrder.market_id !== market_id) {
          socket.emit("error", { message: "This order belongs to another market" });
          return;
        }

        // อัปเดตสถานะ
        await pool.query(
          "UPDATE orders SET status = 'accepted', updated_at = NOW() WHERE order_id = $1",
          [order_id]
        );

        console.log(`✅ Market ${currentOrder.market_id} accepted order ${order_id}`);

        // ส่ง update ไปยังทุกคนในห้อง
        const updateData = {
          order_id: parseInt(order_id),
          status: "accepted",
          hasShop: true,
          hasRider: false,
          market_id: currentOrder.market_id,
          timestamp: new Date().toISOString()
        };

        emitOrderUpdate(order_id, updateData);

        // ส่งการยืนยันกลับให้ร้านค้า
        socket.emit("shop:orderAccepted", {
          success: true,
          order_id: parseInt(order_id),
          message: "Order accepted successfully"
        });

      } catch (error) {
        console.error("Error accepting order:", error);
        socket.emit("error", {
          message: "Failed to accept order",
          error: error.message
        });
      }
    });

    // ไรเดอร์รับงาน (ผ่าน socket)
    socket.on("rider:acceptOrder", async (data) => {
      try {
        const { order_id, rider_id } = data;

        if (!order_id || !rider_id) {
          socket.emit("error", { message: "order_id and rider_id are required" });
          return;
        }

        console.log(`🏍️ Rider ${rider_id} attempting to accept order ${order_id}`);

        // ตรวจสอบสถานะปัจจุบัน
        const checkResult = await pool.query(
          "SELECT status, rider_id, market_id FROM orders WHERE order_id = $1",
          [order_id]
        );

        if (checkResult.rows.length === 0) {
          socket.emit("error", { message: "Order not found" });
          return;
        }

        const currentOrder = checkResult.rows[0];

        if (currentOrder.status === 'waiting') {
          socket.emit("error", { message: "Order not yet accepted by shop" });
          return;
        }

        if (currentOrder.rider_id !== null) {
          socket.emit("error", { message: "Order already has a rider" });
          return;
        }

        // อัปเดตสถานะ - เปลี่ยนเป็น 'delivering' ตามตารางจริง
        await pool.query(
          "UPDATE orders SET status = 'delivering', rider_id = $2, updated_at = NOW() WHERE order_id = $1",
          [order_id, rider_id]
        );

        console.log(`✅ Rider ${rider_id} accepted order ${order_id}`);

        // ส่ง update ไปยังทุกคนในห้อง
        const updateData = {
          order_id: parseInt(order_id),
          status: "delivering",
          hasShop: true,
          hasRider: true,
          rider_id: parseInt(rider_id),
          market_id: currentOrder.market_id,
          timestamp: new Date().toISOString()
        };

        emitOrderUpdate(order_id, updateData);

        // ส่งการยืนยันกลับให้ไรเดอร์
        socket.emit("rider:orderAccepted", {
          success: true,
          order_id: parseInt(order_id),
          message: "Order assigned successfully"
        });

      } catch (error) {
        console.error("Error assigning rider:", error);
        socket.emit("error", {
          message: "Failed to assign rider",
          error: error.message
        });
      }
    });

    // Handle new order creation
    socket.on("new_order", async (orderData) => {
      try {
        console.log("📦 New order received:", orderData);

        // Broadcast to shops and riders
        socket.broadcast.emit("new_order_notification", {
          ...orderData,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error("Error handling new order:", error);
        socket.emit("error", {
          message: "Failed to process new order",
          error: error.message
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`🔴 User disconnected: ${socket.id}, reason: ${reason}`);

      if (socket.currentOrderRoom) {
        socket.leave(socket.currentOrderRoom);
        console.log(`👋 Left room: ${socket.currentOrderRoom}`);
      }
    });

    // Error handling
    socket.on("error", (error) => {
      console.error("🚫 Socket error:", error);
    });
  });

  // Handle server shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Server shutting down...');
    if (ioInstance) {
      ioInstance.close();
    }
    process.exit();
  });
};

// ฟังก์ชันดึงสถานะปัจจุบันของออเดอร์ - อัปเดตให้ตรงกับตารางจริง
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

      // ส่งสถานะปัจจุบันให้ socket ที่ขอ
      socket.emit("order:updated", statusData);
      console.log(`📤 Sent current status to ${socket.id}:`, statusData);
    } else {
      socket.emit("error", { message: "Order not found" });
    }
  } catch (error) {
    console.error("Error getting current order status:", error);
    socket.emit("error", {
      message: "Failed to process new order",
      error: error.message
    });
  }
};

