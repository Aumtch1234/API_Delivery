const pool = require('../../config/db');

// สร้างห้องแชทจาก order_id (เรียกตอน order ถูก assig rider แล้ว)
// POST /chat/rooms/create
async function createChatRoom (req, res) {
    const { order_id } = req.body;
    try {
        // ดึง owner & rider ของออเดอร์
        const orderRes = await pool.query(
            `SELECT order_id, user_id AS customer_id, rider_id
             FROM orders WHERE order_id = $1`,
             [order_id]
        );
        if (orderRes.rowCount === 0) return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์นี้ (Order not found)' });
        const { customer_id, rider_id } = orderRes.rows[0];
        if (!rider_id) return res.status(400).json({ success: false, message: 'ออเดอร์นี้ยังไม่มีไรเดอร์ (Order has no rider yet)' });

        // สร้างห้องแชท chat room (กันซ้ำด้วย UNIQUE(order_id))
        const upsert = await pool.query(
            `INSERT INTO chat_rooms(order_id, customer_id, rider_id)
             VALUES ($1,$2,$3)
             ON CONFLICT (order_id) DO UPDATE SET updated_at = now()
             RETURNING *`,
             [order_id, customer_id, rider_id]
        );
        res.json({ success: true, chatRoom: upsert.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ (Server error)' });
    }
};

// ดึงข้อความในห้องแชท (chat room) ตาม order_id (pagination แบบ after)
// GET /chat/rooms/:roomId/messages
async function getChatMessages (req, res) {
    const { roomId } = req.params;
    const { after } = req.query; // ISO string
    try {
        const params = [roomId];
        let sql = `
            SELECT m.*, u.display_name, u.photo_url
            FROM chat_messages m
            JOIN users u ON u.user_id = m.sender_id
            WHERE m.room_id = $1
        `;
        if (after) {
            params.push(after);
            sql += ` AND m.created_at > $2 `;
        }
        sql += ` ORDER BY m.created_at ASC LIMIT 200`; // จำกัดดึงสูงสุด 200 ข้อความ
        const rs = await pool.query(sql, params); // ดึงข้อความ
        res.json({ success: true, messages: rs.rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ (Server error)' });
    }
};

// mark as read messages in a chat room
// PATCH /chat/rooms/:roomId/mark-as-read
async function markMessagesAsRead (req, res) {
    const { roomId } = req.params;
    const userId = req.user.user_id; // ได้จาก middleware ตรวจสอบ token
    try {
        // ตรวจว่าเป็นสมาชิกในห้องแชทนี้หรือไม่
        const member = await pool.query(
            `SELECT 1
             FROM chat_rooms cr
             LEFT JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
             WHERE cr.room_id = $1 AND (cr.customer_id = $2 OR rp.user_id = $2)`,
             [roomId, userId]
        );
        if (member.rowCount === 0) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ในห้องแชทนี้ (Forbidden)' });
        }
        await pool.query(
            `UPDATE chat_messages SET is_read = TRUE
             WHERE room_id = $1 AND sender_id <> $2`,
             [roomId, userId]
        );
        res.json({ success: true, message: 'ทำเครื่องหมายข้อความว่าอ่านแล้ว (Marked as read)' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ (Server error)' });
    }
};

module.exports = { createChatRoom, getChatMessages, markMessagesAsRead };