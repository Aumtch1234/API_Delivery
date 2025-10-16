// ===================================
// controllers/Chats/CustomerChatController.js - Fixed Version
// ===================================

const pool = require('../../config/db');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/chat-images/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');

class CustomerChatController {

  // ✅ 1) รายการห้องแชทของลูกค้า
  static async getCustomerChatRooms(req, res) {
    try {
      const customerId = req.user?.user_id;
      if (!customerId)
        return res.status(401).json({ success: false, message: 'ไม่พบ user_id' });

      // ✅ อัพเดทสถานะห้องแชทเป็น unactive ถ้า order เป็น completed
      await pool.query(`
      UPDATE chat_rooms cr
      SET status = 'unactive', updated_at = NOW()
      FROM orders o
      WHERE cr.order_id = o.order_id
        AND cr.customer_id = $1
        AND o.status = 'completed'
        AND cr.status = 'active'
    `, [customerId]);

      const query = `
      SELECT 
        cr.room_id,
        cr.order_id,
        cr.customer_id,
        cr.rider_id,
        cr.status AS room_status,
        cr.created_at,
        cr.updated_at,

        -- ✅ Rider info (JOIN ผ่าน rider_profiles → users)
        u.display_name AS rider_name,
        u.photo_url AS rider_photo,
        u.phone AS rider_phone,

        -- ✅ Order info
        o.total_price,
        o.status AS order_status,
        o.address,
        ca.name AS delivery_name,
        ca.phone AS delivery_phone,
        ca.address AS delivery_address,

        -- ✅ นับ unread เฉพาะข้อความจากอีกฝั่ง
        (
          SELECT COUNT(*)
          FROM chat_messages cm
          JOIN users mu ON mu.user_id = cm.sender_id
          WHERE cm.room_id = cr.room_id
            AND mu.role != 'member'
            AND cm.is_read = false
        ) AS unread_count,

        -- ✅ ดึงข้อความล่าสุด
        (
          SELECT cm.message_text
          FROM chat_messages cm
          WHERE cm.room_id = cr.room_id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message,

        (
          SELECT cm.message_type
          FROM chat_messages cm
          WHERE cm.room_id = cr.room_id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS message_type,

        (
          SELECT cm.created_at
          FROM chat_messages cm
          WHERE cm.room_id = cr.room_id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message_time

      FROM chat_rooms cr
      LEFT JOIN orders o ON o.order_id = cr.order_id
      LEFT JOIN client_addresses ca ON ca.id = o.address_id
      LEFT JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
      LEFT JOIN users u ON u.user_id = rp.user_id
      WHERE cr.customer_id = $1 AND cr.status = 'active'
      ORDER BY COALESCE(cr.updated_at, cr.created_at) DESC
    `;

      const result = await pool.query(query, [customerId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('❌ Error getCustomerChatRooms:', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายการแชท' });
    }
  }


  // ✅ 2) ข้อความในห้อง (รองรับ after + limit)
  static async getChatMessages(req, res) {
    try {
      const { roomId } = req.params;
      const { after } = req.query;

      const userId = req.user?.user_id;
      const riderId = req.user?.rider_id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล user_id'
        });
      }

      // ตรวจสิทธิ์
      let roomCheck;
      if (userRole === 'rider' && riderId) {
        roomCheck = await pool.query(
          `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND rider_id = $2`,
          [roomId, riderId]
        );
      } else {
        roomCheck = await pool.query(
          `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND customer_id = $2`,
          [roomId, userId]
        );
      }

      if (roomCheck.rowCount === 0) {
        return res.status(403).json({
          success: false,
          message: 'คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้'
        });
      }

      // ดึงข้อความ
      const params = [roomId];
      let sql = `
      SELECT 
        cm.message_id,
        cm.room_id,
        cm.sender_id,
        u.role as sender_type,
        cm.message_text,
        cm.message_type,
        cm.image_url,
        cm.latitude,
        cm.longitude,
        cm.is_read,
        cm.created_at,
        u.display_name as sender_name,
        u.photo_url as sender_photo
      FROM chat_messages cm
      JOIN users u ON u.user_id = cm.sender_id
      WHERE cm.room_id = $1
    `;

      if (after) {
        params.push(after);
        sql += ` AND cm.created_at > $2`;
      }

      sql += ` ORDER BY cm.created_at ASC LIMIT 200`;

      const result = await pool.query(sql, params);

      // ✅ บังคับ timezone ไทยใน response
      const messages = result.rows.map((m) => ({
        ...m,
        created_at: new Date(m.created_at).toLocaleString('sv-SE', {
          timeZone: 'Asia/Bangkok',
        }),
      }));

      res.json({
        success: true,
        messages,
      });

    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อความ',
      });
    }
  }


  // ✅ 3) เข้าร่วมห้อง
  static async joinChatRoom(req, res) {
    try {
      const { roomId } = req.params;
      const customerId = req.user?.user_id;
      if (!customerId) return res.status(401).json({ success: false, message: 'ไม่พบ user_id' });

      const roomCheck = await pool.query(
        `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND customer_id = $2`,
        [roomId, customerId]
      );
      if (roomCheck.rowCount === 0)
        return res.status(404).json({ success: false, message: 'ไม่พบห้องแชท' });

      const result = await pool.query(`
        UPDATE chat_rooms 
        SET status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE room_id = $1
        RETURNING *
      `, [roomId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (e) {
      console.error('❌ joinChatRoom:', e);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
  }

  // ✅ 4) ทำเครื่องหมายว่าอ่านแล้ว (เพิ่มตรวจสิทธิ์)
  static async markMessagesAsRead(req, res) {
    try {
      const { roomId } = req.params;
      const customerId = req.user?.user_id;
      if (!customerId) return res.status(401).json({ success: false, message: 'ไม่พบ user_id' });

      const member = await pool.query(
        `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND customer_id = $2`,
        [roomId, customerId]
      );
      if (member.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ในห้องแชทนี้' });
      }

      await pool.query(
        `UPDATE chat_messages 
         SET is_read = TRUE
         WHERE room_id = $1 AND sender_id != $2`,
        [roomId, customerId]
      );

      res.json({ success: true, message: 'ทำเครื่องหมายข้อความว่าอ่านแล้ว' });
    } catch (e) {
      console.error('❌ markMessagesAsRead:', e);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
  }

  // 🔥 แก้ไข: ส่งข้อความ - ป้องกันการส่งซ้ำ + แสดงข้อความในแอปผู้ส่งทันที
  static async sendMessage(req, res) {
    try {
      const { roomId, messageText, messageType, imageUrl, latitude, longitude, client_id } = req.body;
      const customerId = req.user?.user_id;
      if (!customerId) return res.status(401).json({ success: false, message: 'ไม่พบ user_id' });

      const roomCheck = await pool.query(
        `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND customer_id = $2`,
        [roomId, customerId]
      );
      if (roomCheck.rowCount === 0)
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ในห้องนี้' });

      // Validation
      if (!roomId || !messageType) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
      }
      if (messageType === 'text' && (!messageText || messageText.trim() === '')) {
        return res.status(400).json({ success: false, message: 'กรุณาใส่ข้อความ' });
      }
      if (messageType === 'image' && !imageUrl) {
        return res.status(400).json({ success: false, message: 'กรุณาใส่ URL รูปภาพ' });
      }
      if (messageType === 'location' && (!latitude || !longitude)) {
        return res.status(400).json({ success: false, message: 'กรุณาใส่ตำแหน่งที่ตั้ง' });
      }

      // 🔥 ตรวจสอบ client_id เพื่อป้องกันการส่งซ้ำ
      if (client_id) {
        const existingMessage = await pool.query(
          `SELECT message_id FROM chat_messages 
           WHERE room_id = $1 AND sender_id = $2 AND message_text = $3 
           AND created_at > NOW() - INTERVAL '10 seconds'`,
          [roomId, customerId, messageText]
        );

        if (existingMessage.rowCount > 0) {
          console.log('🔄 Duplicate message detected, returning existing message');
          return res.json({
            success: true,
            data: { message_id: existingMessage.rows[0].message_id },
            message: 'ข้อความถูกส่งแล้ว'
          });
        }
      }

      // 🔥 แก้ไข: ใช้ sender_type = 'customer' เท่านั้น (ไม่ใช้ 'member')
      const senderType = 'customer';
      const result = await pool.query(`
        INSERT INTO chat_messages 
          (room_id, sender_id, sender_type, message_text, message_type, image_url, latitude, longitude, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING *
      `, [roomId, customerId, senderType, messageText, messageType, imageUrl, latitude, longitude]);

      await pool.query(`UPDATE chat_rooms SET updated_at = NOW() WHERE room_id = $1`, [roomId]);

      // 🔥 ดึงข้อมูล sender สำหรับ Socket emit
      const senderInfo = await pool.query(`
        SELECT display_name, photo_url FROM users WHERE user_id = $1
      `, [customerId]);

      const sender = senderInfo.rows[0] || { display_name: 'Unknown', photo_url: null };

      // 🔥 Format message สำหรับ Socket
      const messageForSocket = {
        message_id: result.rows[0].message_id,
        room_id: result.rows[0].room_id,
        sender_id: result.rows[0].sender_id,
        sender_type: result.rows[0].sender_type,
        sender_name: sender.display_name,
        sender_photo: sender.photo_url,
        message_text: result.rows[0].message_text,
        message_type: result.rows[0].message_type,
        image_url: result.rows[0].image_url,
        latitude: result.rows[0].latitude,
        longitude: result.rows[0].longitude,
        is_read: result.rows[0].is_read,
        created_at: result.rows[0].created_at
      };

      // 🔥 Emit Socket event ให้ทุกคนในห้อง (รวมผู้ส่ง)
      const io = req.app.get('socketio');
      if (io) {
        const chatNamespace = io.of('/chat');
        chatNamespace.to(`room_${roomId}`).emit('new_message', messageForSocket);
        console.log(`📡 Socket emitted: new_message to room_${roomId} (including sender)`);
      }

      res.json({ success: true, data: result.rows[0], message: 'ส่งข้อความเรียบร้อยแล้ว' });

    } catch (e) {
      console.error('❌ sendMessage:', e);
      res.status(500).json({ success: false, message: 'ส่งข้อความไม่สำเร็จ' });
    }
  }

  // ✅ 6) อัปโหลดรูปภาพ
  static uploadChatImage(req, res) {
    upload(req, res, err => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      if (!req.file) return res.status(400).json({ success: false, message: 'ไม่พบไฟล์' });

      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/chat-images/${req.file.filename}`;
      res.json({ success: true, image_url: imageUrl });
    });
  }

  // ✅ 7) จำนวนข้อความที่ยังไม่ได้อ่าน
  static async getUnreadCount(req, res) {
    try {
      const customerId = req.user?.user_id;
      if (!customerId) return res.status(401).json({ success: false, message: 'ไม่พบ user_id' });

      const result = await pool.query(`
        SELECT COUNT(*) AS unread_count
        FROM chat_messages cm
        JOIN chat_rooms cr ON cr.room_id = cm.room_id
        WHERE cr.customer_id = $1 
          AND cr.status = 'active'
          AND cm.sender_type = 'rider'
          AND cm.is_read = false
      `, [customerId]);

      res.json({ success: true, unread_count: parseInt(result.rows[0].unread_count, 10) });
    } catch (e) {
      console.error('❌ getUnreadCount:', e);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
  }
}

module.exports = CustomerChatController;