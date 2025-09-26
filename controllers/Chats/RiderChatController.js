// controllers/Chats/RiderChatController.js
const pool = require('../../config/db');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/chat-images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

class RiderChatController {

  // Get all chat rooms for a specific rider
  static async getRiderChatRooms(req, res) {
    try {
      const riderId = req.user?.rider_id; // ใช้จาก token

      if (!riderId) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล rider_id'
        });
      }

      const query = `
        SELECT 
          cr.room_id,
          cr.order_id,
          cr.customer_id,
          cr.rider_id,
          cr.status as room_status,
          cr.created_at,
          cr.updated_at,
          u.display_name as member_name,
          u.photo_url as member_photo,
          u.phone as member_phone,
          o.total_price,
          o.status as order_status,
          o.address,
          ca.name as delivery_name,
          ca.phone as delivery_phone,
          ca.address as delivery_address,
          (
            SELECT COUNT(*) 
            FROM chat_messages cm 
            JOIN users mu ON mu.user_id = cm.sender_id
            WHERE cm.room_id = cr.room_id 
            AND mu.role != 'rider'
            AND cm.is_read = false
          ) as unread_count,
          (
            SELECT cm.message_text
            FROM chat_messages cm
            WHERE cm.room_id = cr.room_id
            ORDER BY cm.created_at DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT cm.message_type
            FROM chat_messages cm
            WHERE cm.room_id = cr.room_id
            ORDER BY cm.created_at DESC
            LIMIT 1
          ) as message_type,
          (
            SELECT cm.created_at
            FROM chat_messages cm
            WHERE cm.room_id = cr.room_id
            ORDER BY cm.created_at DESC
            LIMIT 1
          ) as last_message_time
        FROM chat_rooms cr
        JOIN users u ON u.user_id = cr.customer_id
        LEFT JOIN orders o ON o.order_id = cr.order_id
        LEFT JOIN client_addresses ca ON ca.id = o.address_id
        WHERE cr.rider_id = $1 AND cr.status = 'active'
        ORDER BY 
          CASE WHEN cr.updated_at IS NOT NULL THEN cr.updated_at ELSE cr.created_at END DESC
      `;

      const result = await pool.query(query, [riderId]);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error('Error getting rider chat rooms:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงรายการแชท'
      });
    }
  }

  // Get messages with pagination using 'after' parameter
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

      // ตรวจสิทธิ์ - สำหรับ rider เท่านั้น
      let roomCheck;

      if (userRole === 'rider' && riderId) {
        roomCheck = await pool.query(
          `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND rider_id = $2`,
          [roomId, riderId]
        );
      } else {
        // สำหรับ customer (จะทำในไฟล์อื่น)
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

      // Build query with 'after' pagination
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

      res.json({
        success: true,
        messages: result.rows
      });

    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อความ'
      });
    }
  }

  // Create chat room using order_id
  static async createChatRoom(req, res) {
    try {
      const { order_id } = req.body;

      // ดึง owner & rider ของออเดอร์
      const orderRes = await pool.query(
        `SELECT order_id, user_id AS customer_id, rider_id
         FROM orders WHERE order_id = $1`,
        [order_id]
      );

      if (orderRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบออเดอร์นี้'
        });
      }

      const { customer_id, rider_id } = orderRes.rows[0];

      if (!rider_id) {
        return res.status(400).json({
          success: false,
          message: 'ออเดอร์นี้ยังไม่มีไรเดอร์'
        });
      }

      // สร้างห้องแชท (กันซ้ำด้วย UNIQUE(order_id))
      const upsert = await pool.query(
        `INSERT INTO chat_rooms(order_id, customer_id, rider_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (order_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [order_id, customer_id, rider_id]
      );

      res.json({
        success: true,
        chatRoom: upsert.rows[0]
      });

    } catch (error) {
      console.error('Error creating chat room:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
      });
    }
  }

  // Join/Accept existing chat room
  static async joinChatRoom(req, res) {
    try {
      const { roomId } = req.params;
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
          `SELECT cr.*, o.status as order_status
           FROM chat_rooms cr
           LEFT JOIN orders o ON o.order_id = cr.order_id
           WHERE cr.room_id = $1 AND cr.rider_id = $2`,
          [roomId, riderId]
        );
      } else {
        roomCheck = await pool.query(
          `SELECT cr.*, o.status as order_status
           FROM chat_rooms cr
           LEFT JOIN orders o ON o.order_id = cr.order_id
           WHERE cr.room_id = $1 AND cr.customer_id = $2`,
          [roomId, userId]
        );
      }

      if (roomCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบห้องแชทหรือคุณไม่มีสิทธิ์เข้าถึง'
        });
      }

      // Update room status to active
      const query = `
        UPDATE chat_rooms 
        SET status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE room_id = $1
        RETURNING *
      `;

      const result = await pool.query(query, [roomId]);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'เข้าร่วมห้องแชทเรียบร้อยแล้ว'
      });

    } catch (error) {
      console.error('Error joining chat room:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการเข้าร่วมห้องแชท'
      });
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(req, res) {
    try {
      const { roomId } = req.params;
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
      let member;

      if (userRole === 'rider' && riderId) {
        member = await pool.query(
          `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND rider_id = $2`,
          [roomId, riderId]
        );
      } else {
        member = await pool.query(
          `SELECT 1 FROM chat_rooms WHERE room_id = $1 AND customer_id = $2`,
          [roomId, userId]
        );
      }

      if (member.rowCount === 0) {
        return res.status(403).json({
          success: false,
          message: 'คุณไม่มีสิทธิ์ในห้องแชทนี้'
        });
      }

      // Mark messages as read (exclude current user's messages)
      await pool.query(
        `UPDATE chat_messages SET is_read = TRUE
         WHERE room_id = $1 AND sender_id != $2`,
        [roomId, userId]
      );

      res.json({
        success: true,
        message: 'ทำเครื่องหมายข้อความว่าอ่านแล้ว'
      });

    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์'
      });
    }
  }

  // Update room status
  static async updateRoomStatus(req, res) {
    try {
      const { roomId } = req.params;
      const { status } = req.body;
      const userId = req.user?.user_id;
      const riderId = req.user?.rider_id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล user_id'
        });
      }

      // Verify valid status
      const validStatuses = ['active', 'closed', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'สถานะไม่ถูกต้อง'
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

      const result = await pool.query(`
        UPDATE chat_rooms 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = $2
        RETURNING *
      `, [status, roomId]);

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error updating room status:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดทสถานะห้อง'
      });
    }
  }

  // Get unread message count for rider
  static async getUnreadCount(req, res) {
    try {
      const riderId = req.user?.rider_id; // ใช้จาก token

      if (!riderId) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล rider_id'
        });
      }

      const query = `
        SELECT COUNT(*) as unread_count
        FROM chat_messages cm
        JOIN chat_rooms cr ON cr.room_id = cm.room_id
        JOIN users u ON u.user_id = cm.sender_id
        WHERE cr.rider_id = $1 
        AND u.role != 'rider'
        AND cm.is_read = false
        AND cr.status = 'active'
      `;

      const result = await pool.query(query, [riderId]);

      res.json({
        success: true,
        unread_count: parseInt(result.rows[0].unread_count)
      });

    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงจำนวนข้อความที่ยังไม่ได้อ่าน'
      });
    }
  }

  // Get active chat rooms assigned to rider
  static async getActiveRooms(req, res) {
    try {
      const riderId = req.user?.rider_id; // ใช้จาก token

      if (!riderId) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล rider_id'
        });
      }

      const query = `
        SELECT 
          cr.room_id,
          cr.order_id,
          cr.customer_id,
          cr.status as room_status,
          cr.created_at,
          cr.updated_at,
          u.display_name as member_name,
          u.photo_url as member_photo,
          u.phone as member_phone,
          o.total_price,
          o.status as order_status,
          o.address,
          ca.name as delivery_name,
          ca.phone as delivery_phone,
          ca.address as delivery_address,
          (
            SELECT COUNT(*) 
            FROM chat_messages cm 
            JOIN users mu ON mu.user_id = cm.sender_id
            WHERE cm.room_id = cr.room_id 
            AND mu.role != 'rider'
            AND cm.is_read = false
          ) as unread_count
        FROM chat_rooms cr
        JOIN users u ON u.user_id = cr.customer_id
        LEFT JOIN orders o ON o.order_id = cr.order_id
        LEFT JOIN client_addresses ca ON ca.id = o.address_id
        WHERE cr.rider_id = $1 AND cr.status = 'active'
        ORDER BY cr.updated_at DESC
      `;

      const result = await pool.query(query, [riderId]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rowCount
      });

    } catch (error) {
      console.error('Error getting active rooms:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงห้องแชทที่ใช้งาน'
      });
    }
  }

  // Auto-create chat room when order has both user_id and rider_id
  static async autoCreateChatRoom(orderId) {
    try {
      const orderQuery = await pool.query(`
        SELECT order_id, user_id, rider_id 
        FROM orders 
        WHERE order_id = $1 AND user_id IS NOT NULL AND rider_id IS NOT NULL
      `, [orderId]);

      if (orderQuery.rowCount === 0) {
        return { success: false, message: 'Order not ready for chat room creation' };
      }

      const order = orderQuery.rows[0];

      const existingRoom = await pool.query(`
        SELECT room_id FROM chat_rooms WHERE order_id = $1
      `, [orderId]);

      if (existingRoom.rowCount > 0) {
        return { success: true, room_id: existingRoom.rows[0].room_id, message: 'Room already exists' };
      }

      const result = await pool.query(`
        INSERT INTO chat_rooms (order_id, customer_id, rider_id, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING room_id
      `, [orderId, order.user_id, order.rider_id]);

      return { success: true, room_id: result.rows[0].room_id, message: 'Chat room created successfully' };

    } catch (error) {
      console.error('Error auto-creating chat room:', error);
      return { success: false, message: 'Failed to create chat room' };
    }
  }

  // Send message - สำหรับ rider
  static async sendMessage(req, res) {
    try {
      console.log('📩 [sendMessage] API called');
      console.log('📥 Body:', req.body);
      const { roomId, messageText, messageType, imageUrl, latitude, longitude } = req.body;
      const userId = req.user?.user_id;
      const riderId = req.user?.rider_id;
      const userRole = req.user?.role;

      console.log('👤 userId:', userId, '🚴 riderId:', riderId, '🧑‍💻 role:', userRole);

      if (!userId) {
        console.warn('❌ ไม่พบข้อมูล user_id ใน token');
        return res.status(401).json({
          success: false,
          message: 'ไม่พบข้อมูล user'
        });
      }

      // ดึงข้อมูลผู้ใช้จาก users table
      const userQuery = await pool.query(`
        SELECT role, display_name, photo_url FROM users WHERE user_id = $1
      `, [userId]);

      console.log('🔎 userQuery result:', userQuery.rows[0]);

      if (userQuery.rowCount === 0) {
        console.warn('❌ ไม่พบข้อมูลผู้ใช้ในฐานข้อมูล');
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลผู้ใช้'
        });
      }

      console.log('🔎 ตรวจสอบสิทธิ์ห้องแชท roomId:', roomId, 'riderId:', riderId);

      // ตรวจสิทธิ์ในห้องแชท - สำหรับ rider เท่านั้น
      let roomCheck;

      if (userRole === 'rider' && riderId) {
        // สำหรับ rider ใช้ rider_id ตรงๆ
        roomCheck = await pool.query(`
          SELECT 
            cr.room_id,
            cr.order_id,
            cr.customer_id,
            cr.rider_id,
            cu.display_name AS customer_name
          FROM chat_rooms cr
          LEFT JOIN users cu ON cu.user_id = cr.customer_id         
          WHERE cr.room_id = $1 AND cr.rider_id = $2
        `, [roomId, riderId]);
      } else {
        // สำหรับ customer (จะทำในไฟล์อื่น)
        roomCheck = await pool.query(`
          SELECT 
            cr.room_id,
            cr.order_id,
            cr.customer_id,
            cr.rider_id
          FROM chat_rooms cr
          WHERE cr.room_id = $1 AND cr.customer_id = $2
        `, [roomId, userId]);
      }

      console.log('📦 roomCheck result:', roomCheck.rows[0]);

      if (roomCheck.rowCount === 0) {
        console.warn('🚫 ผู้ใช้ไม่มีสิทธิ์เข้าถึงห้องแชทนี้');
        return res.status(403).json({
          success: false,
          message: 'คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้'
        });
      }

      // ตรวจสอบฟิลด์ที่จำเป็น
      if (!roomId || !messageType) {
        console.warn('⚠️ ข้อมูลไม่ครบถ้วน:', { roomId, messageType });
        return res.status(400).json({
          success: false,
          message: 'ข้อมูลไม่ครบถ้วน'
        });
      }

      // ตรวจสอบเนื้อหาข้อความ
      if (messageType === 'text' && (!messageText || messageText.trim() === '')) {
        console.warn('⚠️ ไม่มีข้อความ text');
        return res.status(400).json({ success: false, message: 'กรุณาใส่ข้อความ' });
      }
      if (messageType === 'image' && !imageUrl) {
        console.warn('⚠️ ไม่มี image URL');
        return res.status(400).json({ success: false, message: 'กรุณาใส่ URL รูปภาพ' });
      }
      if (messageType === 'location' && (!latitude || !longitude)) {
        console.warn('⚠️ ไม่มี location');
        return res.status(400).json({ success: false, message: 'กรุณาใส่ตำแหน่งที่ตั้ง' });
      }

      // เตรียม sender_type
      const senderType = userRole === 'rider' ? 'rider' : 'member';
      console.log('📤 Preparing to insert message with senderType:', senderType);

      // Insert message
      const query = `
        INSERT INTO chat_messages (
          room_id, sender_id, sender_type, message_text, message_type, 
          image_url, latitude, longitude, is_read
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING message_id, room_id, sender_id, sender_type, message_text, 
                  message_type, image_url, latitude, longitude, is_read, created_at
      `;

      const result = await pool.query(query, [
        roomId,
        userId,
        senderType,
        messageText,
        messageType,
        imageUrl,
        latitude,
        longitude
      ]);

      console.log('✅ Insert result:', result.rows[0]);

      // อัปเดตเวลาใน chat_rooms
      await pool.query(`
        UPDATE chat_rooms 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE room_id = $1
      `, [roomId]);
      console.log('🕐 Updated chat_rooms.updated_at');

      const message = result.rows[0];

      // เตรียม response
      const response = {
        ...message,
        sender_name: userQuery.rows[0].display_name || 'Unknown',
        sender_photo: userQuery.rows[0].photo_url || null,
        sender_type: userRole
      };

      console.log('📤 Final response:', response);

      res.json({
        success: true,
        data: response,
        message: 'ส่งข้อความเรียบร้อยแล้ว'
      });

    } catch (error) {
      console.error('❌ Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการส่งข้อความ'
      });
    }
  }

  // Upload chat image
  static uploadChatImage(req, res) {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'ไม่พบไฟล์รูปภาพ'
        });
      }

      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/chat-images/${req.file.filename}`;

      res.json({
        success: true,
        image_url: imageUrl,
        message: 'อัพโลดรูปภาพสำเร็จ'
      });
    });
  }
}

module.exports = RiderChatController;