// index.js  (single-file server + socket.io)
require('dotenv').config();
const express = require('express');
const path = require("path");
const cors = require('cors');
const cron = require('node-cron');
const http = require('http');           // ⬅️ เพิ่ม
const pool = require('./config/db');


// routes
const ClientRoutes = require('./routes/Client/ClientAPIsRoute');
const AdminRoutes = require('./routes/Admin/AdminAPIsRoute');
const RiderRoutes = require('./routes/Rider/RiderAPIsRoute');

const DashboardSaleRoutes = require('./routes/Analytics_Dashboard/Market/DashboardAPIsRoute'); // ⬅️ เพิ่ม
const ReviewsRoutes = require('./routes/Reviews/ReviewsAPIsRoute'); // ⬅️ เพิ่ม


const SocketRoutes = require('./SocketRoutes/SocketRoutes');
const RiderSocketRoutes = require('./SocketRoutes/RiderSocketRoutes');
const RiderChatRoutes = require('./SocketRoutes/Chats/RiderChatRoutes');
const CustomerChatRoutes = require('./SocketRoutes/Chats/CustomerChatRoutes');

// socket
// Socket handlers (ใช้ io เดียวกัน)
const { initSocket } = require('./SocketRoutes/Events/socketEvents');   // ฟังก์ชันรับ io (order / status updates)


const app = express();
app.use(cors());
app.use(express.json());

// HTTP Routes
// mount routes
app.use('/client', ClientRoutes);
app.use('/admin', AdminRoutes);
app.use('/rider', RiderRoutes);
app.use('/socket', SocketRoutes);
app.use('/riders/socket', RiderSocketRoutes);
app.use('/chat/rider', RiderChatRoutes);
app.use('/chat/customer', CustomerChatRoutes);
app.use('/dashboard/sales', DashboardSaleRoutes); 
app.use('/reviews', ReviewsRoutes);
app.use("/uploads/chat-images", express.static(path.join(__dirname, "uploads/chat-images")));




// HTTP + Socket.IO
const server = http.createServer(app);  // ⬅️ ใช้ server แทน app.listen

// สร้าง Socket.IO แค่ครั้งเดียว แล้วแชร์ให้ทุกโมดูล
const { Server } = require("socket.io");
const attachChatHandlers = require('./SocketRoutes/Events/ChatEvents');
const io = new Server(server, {
  cors: { origin: "*", methods: ['GET','POST','PUT','DELETE'] }
});

// ให้ io เข้าถึงใน controller เผื่อ controller ฝั่ง HTTP ต้องการ emit ผ่าน req.app.get('io'
app.set('io', io);

// --- ผูก event ของ "ทั้งสอง" โมดูลเข้ากับ io เดียวกัน ---
initSocket(io);          // order / rider / shop events
attachChatHandlers(io);

// Cron job ทุก 1 นาที
cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();
    const result = await pool.query(
      'SELECT market_id, open_time, close_time, is_open, is_manual_override, override_until FROM markets'
    );

    for (const market of result.rows) {
      if (!market.open_time || !market.close_time) continue;

      let skipUpdate = false;

      if (market.is_manual_override) {
        if (market.override_until && now > new Date(market.override_until)) {
          await pool.query(
            'UPDATE markets SET is_manual_override = false, override_until = NULL WHERE market_id = $1',
            [market.market_id]
          );
        } else {
          skipUpdate = true;
        }
      }

      if (!skipUpdate) {
        const [openHour, openMinute] = market.open_time.split(':').map(Number);
        const [closeHour, closeMinute] = market.close_time.split(':').map(Number);

        const openDate = new Date(now); openDate.setHours(openHour, openMinute, 0, 0);
        const closeDate = new Date(now); closeDate.setHours(closeHour, closeMinute, 0, 0);

        let shouldOpen = false;
        if (closeDate <= openDate) {
          if (now >= openDate || now <= closeDate) shouldOpen = true;
        } else {
          if (now >= openDate && now <= closeDate) shouldOpen = true;
        }

        if (market.is_open !== shouldOpen) {
          await pool.query('UPDATE markets SET is_open = $1 WHERE market_id = $2', [
            shouldOpen,
            market.market_id,
          ]);
        }
      }
    }
  } catch (error) {
    console.error("Cron error:", error);
  }
});

// ====== start HTTP + Socket.IO ======
// Listen
const PORT = process.env.PORT || 4000;

const HOST = '0.0.0.0';



server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Email user:', process.env.EMAIL_FROM);
  console.log('Email pass length:', process.env.EMAIL_PASS?.length);
});
