require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cron = require('node-cron');
const pool = require('./config/db');

const ClientRoutes = require('./routes/Client/ClientAPIsRoute');
const AdminRoutes = require('./routes/Admin/AdminAPIsRoute');
const RiderRoutes = require('./routes/Rider/RiderAPIsRoute');
const SocketRoutes = require('./SocketRoutes/SocketRoutes')

const app = express();
app.use(cors());
app.use(express.json());

// HTTP Routes
app.use('/client', ClientRoutes);
app.use('/admin', AdminRoutes);
app.use('/rider', RiderRoutes);
app.use('/socket', SocketRoutes);

// HTTP + Socket.IO
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ให้ io เข้าถึงใน controller
app.set('io', io);

// โหลด event จากไฟล์แยก
const { initSocket } = require("./SocketRoutes/socketEvents");
initSocket(io);   // ✅ ต้องเรียกตรงนี้

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

// Listen
const PORT = process.env.PORT || 4000;
const HOST = '192.168.1.129';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
