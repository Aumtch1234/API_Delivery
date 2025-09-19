const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

function socketInit(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket']
  });

  // (เดโม) auth ด้วย query ?userId= (แนะนำให้เปลี่ยนเป็น JWT ใน production)
  io.use((socket, next) => {
    const userId = parseInt(socket.handshake.query.userId, 10);
    if (!userId) return next(new Error('Authentication error'));
    socket.userId = userId;
    next();
  });
  // เมื่อมีการเชื่อมต่อใหม่
  io.on('connection', (socket) => {
    socket.on('join', async ({ roomId }) => {
      try {
        const rs = await pool.query(
          `SELECT cr.customer_id, rp.user_id AS rider_user_id
           FROM chat_rooms cr
           JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
           WHERE cr.room_id = $1`,
          [roomId]
        );
        if (rs.rowCount === 0) return;

        const { customer_id, rider_user_id } = rs.rows[0];
        const uid = socket.userId;
        if (uid !== customer_id && uid !== rider_user_id) return; // ไม่ใช่สมาชิก

        const roomKey = `room:${roomId}`;
        socket.join(roomKey);
        socket.emit('joined', { roomId });
      } catch (e) {
        console.error(e);
      }
    });
    // รับข้อความใหม่จาก client
    socket.on('message:send', async ({ roomId, text, type, imageUrl, latitude, longitude }) => {
      try {
        const uid = socket.userId;
        const rs = await pool.query(
          `SELECT cr.customer_id, rp.user_id AS rider_user_id
           FROM chat_rooms cr
           JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
           WHERE cr.room_id = $1`,
          [roomId]
        );
        if (rs.rowCount === 0) return;
        const { customer_id, rider_user_id } = rs.rows[0];
        if (uid !== customer_id && uid !== rider_user_id) return;
        // ตรวจสอบประเภทผู้ส่ง
        const sender_type = uid === customer_id ? 'customer' : 'rider';
        // บันทึกข้อความลงฐานข้อมูล
        const ins = await pool.query(
          `INSERT INTO chat_messages
            (room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude)
           VALUES ($1,$2,$3,$4,COALESCE($5,'text'),$6,$7,$8)
           RETURNING *`,
          [roomId, uid, sender_type, text || null, type, imageUrl || null, latitude || null, longitude || null]
        );

        const message = ins.rows[0];
        io.to(`room:${roomId}`).emit('message:new', message);

        // TODO: ส่ง FCM ให้ฝั่งตรงข้ามถ้า offline
      } catch (e) {
        console.error(e);
      }
    });
  });

  return io;
}

module.exports = socketInit;