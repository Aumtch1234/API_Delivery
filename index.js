// index.js  (single-file server + socket.io)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');           // ⬅️ เพิ่ม
const pool = require('./config/db');
const cron = require('node-cron');

// routes
const ClientRoutes = require('./routes/Client/ClientAPIsRoute');
const AdminRoutes = require('./routes/Admin/AdminAPIsRoute');
const RiderRoutes = require('./routes/Rider/RiderAPIsRoute');
const ChatRoutes   = require('./routes/Chats/ChatsAPIsRoute');    // ⬅️ เพิ่ม

// socket
const socketInit   = require('./controllers/Chats/SocketChats');  // ⬅️ เพิ่ม


const app = express();
app.use(cors());
app.use(express.json());

// mount routes
app.use('/client', ClientRoutes);
app.use('/admin', AdminRoutes);
app.use('/rider', RiderRoutes);
app.use('/chat',   ChatRoutes);     // ⬅️ เพิ่ม

// cron job ทุก 1 นาที ตรวจสอบเวลาเปิด/ปิดร้าน
cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();

    const result = await pool.query(
      'SELECT market_id, open_time, close_time, is_open, is_manual_override, override_until FROM markets'
    );

    for (const market of result.rows) {
      if (!market.open_time || !market.close_time) {
        console.log(`[Cron] ร้าน ${market.market_id} ไม่มีเวลาเปิด/ปิด`);
        continue;
      }

      let skipUpdate = false;

      // ตรวจสอบ override manual
      if (market.is_manual_override) {
        if (market.override_until && now > new Date(market.override_until)) {
          await pool.query(
            'UPDATE markets SET is_manual_override = false, override_until = NULL WHERE market_id = $1',
            [market.market_id]
          );
          console.log(`[Cron] ยกเลิก override ร้าน ${market.market_id} (หมดเวลา)`);
        } else {
          skipUpdate = true;
          console.log(`[Cron] ร้าน ${market.market_id} override อยู่ ข้าม`);
        }
      }

      if (!skipUpdate) {
        // แปลงเวลาเปิด/ปิดจาก string "HH:mm" เป็น Date
        const [openHour, openMinute] = market.open_time.split(':').map(Number);
        const [closeHour, closeMinute] = market.close_time.split(':').map(Number);

        const openDate = new Date(now);
        openDate.setHours(openHour, openMinute, 0, 0);

        const closeDate = new Date(now);
        closeDate.setHours(closeHour, closeMinute, 0, 0);

        let shouldOpen = false;

        if (closeDate <= openDate) {
          // ข้ามคืน
          if (now >= openDate || now <= closeDate) {
            shouldOpen = true;
          }
        } else {
          if (now >= openDate && now <= closeDate) {
            shouldOpen = true;
          }
        }

        if (market.is_open !== shouldOpen) {
          await pool.query('UPDATE markets SET is_open = $1 WHERE market_id = $2', [
            shouldOpen,
            market.market_id,
          ]);
          console.log(`[Cron] ร้าน ${market.market_id} อัปเดต is_open เป็น ${shouldOpen}`);
        }
      }
    }

    console.log(`[Cron] ✅ จบรอบเวลา: ${now.toISOString()}\n`);
  } catch (error) {
    console.error(`[Cron] ❌ เกิดข้อผิดพลาด:`, error);
  }
});

// ====== start HTTP + Socket.IO ======
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

const server = http.createServer(app);   // ⬅️ ใช้ server แทน app.listen
socketInit(server);                      // ⬅️ ผูก Socket.IO แค่ครั้งเดียวที่นี่

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Email user:', process.env.EMAIL_FROM);
  console.log('Email pass length:', process.env.EMAIL_PASS?.length);
});

// ====== start HTTP server แบบเดิม (ไม่ใช้ socket.io) ======
// app.listen(PORT, HOST, () => {
//   console.log(`Server running on http://${HOST}:${PORT}`);
//   console.log('Email user:', process.env.EMAIL_FROM);
//   console.log('Email pass length:', process.env.EMAIL_PASS?.length);
// });
