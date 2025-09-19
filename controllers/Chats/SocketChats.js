// Attach chat handlers to existing io instance (avoid creating a second Server)
const pool = require('../../config/db');

function attachChatHandlers(io) {
  // Namespace (optional). If you want to keep root, replace with: const nsp = io;
  const nsp = io.of('/chat');

  // Simple auth via query userId (replace with proper auth/JWT later)
  nsp.use((socket, next) => {
    const userId = parseInt(socket.handshake.query.userId, 10);
    if (!userId) return next(new Error('Authentication error'));
    socket.userId = userId;
    next();
  });

  nsp.on('connection', (socket) => {
    // เข้าห้องสนทนา
    socket.on('join', async ({ roomId }) => {
      try {
        if (!roomId) return;
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
        console.error('[chat] join error', e);
      }
    });

    // ส่งข้อความ
    socket.on('message:send', async ({ roomId, text, type, imageUrl, latitude, longitude }) => {
      try {
        if (!roomId) return;
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

        const sender_type = uid === customer_id ? 'customer' : 'rider';
        const ins = await pool.query(
          `INSERT INTO chat_messages
              (room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude)
            VALUES ($1,$2,$3,$4,COALESCE($5,'text'),$6,$7,$8)
            RETURNING *`,
          [roomId, uid, sender_type, text || null, type, imageUrl || null, latitude || null, longitude || null]
        );

        const message = ins.rows[0];
        nsp.to(`room:${roomId}`).emit('message:new', message);
      } catch (e) {
        console.error('[chat] message send error', e);
      }
    });
  });
}

module.exports = attachChatHandlers;