// controllers/Chats/SocketChats.js - Fixed Version (แก้ไขปัญหาข้อความซ้ำ)
const pool = require('../../config/db');

function attachChatHandlers(io) {
  // Chat namespace for dedicated chat functionality
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log(`User connected to chat: ${socket.id}`);

    let currentRoomId = null;
    let currentUserId = null;
    let currentUserType = null;
    let currentRiderId = null;

    // Join chat room
    socket.on('join_room', async (data) => {
      try {
        const { roomId, userId, userType } = data;
        console.log(`📥 Join room request: roomId=${roomId}, userId=${userId}, userType=${userType}`);

        if (!roomId || !userId || !userType) {
          socket.emit('error', { message: 'Missing required data: roomId, userId, userType' });
          return;
        }

        let roomCheck;
        let actualUserId = userId;

        if (userType === 'customer') {
          roomCheck = await pool.query(`
            SELECT cr.*, 
                   u1.display_name as customer_name, u1.photo_url as customer_photo,
                   u2.display_name as rider_name, u2.photo_url as rider_photo
            FROM chat_rooms cr
            JOIN users u1 ON u1.user_id = cr.customer_id
            LEFT JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
            LEFT JOIN users u2 ON u2.user_id = rp.user_id
            WHERE cr.room_id = $1 AND cr.customer_id = $2 AND cr.status = 'active'
          `, [roomId, userId]);

        } else if (userType === 'rider') {
          let riderCheck = await pool.query(`
            SELECT rp.user_id, rp.rider_id 
            FROM rider_profiles rp 
            WHERE rp.rider_id = $1
          `, [userId]);

          if (riderCheck.rowCount > 0) {
            currentRiderId = userId;
            actualUserId = riderCheck.rows[0].user_id;
            console.log(`🔍 Rider ID ${userId} maps to User ID ${actualUserId}`);
          } else {
            riderCheck = await pool.query(`
              SELECT rp.user_id, rp.rider_id 
              FROM rider_profiles rp 
              WHERE rp.user_id = $1
            `, [userId]);

            if (riderCheck.rowCount > 0) {
              actualUserId = userId;
              currentRiderId = riderCheck.rows[0].rider_id;
              console.log(`🔍 User ID ${userId} maps to Rider ID ${currentRiderId}`);
            } else {
              socket.emit('error', { message: 'Rider not found' });
              return;
            }
          }

          roomCheck = await pool.query(`
            SELECT cr.*, 
                   u1.display_name as customer_name, u1.photo_url as customer_photo,
                   u2.display_name as rider_name, u2.photo_url as rider_photo
            FROM chat_rooms cr
            JOIN users u1 ON u1.user_id = cr.customer_id
            LEFT JOIN rider_profiles rp ON rp.rider_id = cr.rider_id
            LEFT JOIN users u2 ON u2.user_id = rp.user_id
            WHERE cr.room_id = $1 AND cr.rider_id = $2 AND cr.status = 'active'
          `, [roomId, currentRiderId]);

        } else {
          socket.emit('error', { message: 'Invalid userType. Must be "customer" or "rider"' });
          return;
        }

        if (!roomCheck || roomCheck.rowCount === 0) {
          console.log(`❌ Room access denied: roomId=${roomId}, userId=${userId}, userType=${userType}`);
          socket.emit('error', { message: 'Room not found or access denied' });
          return;
        }

        const room = roomCheck.rows[0];
        console.log(`✅ Room access granted: ${room.customer_name} <-> ${room.rider_name}`);

        if (currentRoomId) {
          socket.leave(`room_${currentRoomId}`);
          console.log(`🚪 Left previous room: ${currentRoomId}`);
        }

        currentRoomId = roomId;
        currentUserId = actualUserId;
        currentUserType = userType;

        socket.join(`room_${roomId}`);

        socket.to(`room_${roomId}`).emit('user_joined', {
          userId: actualUserId,
          userType,
          userName: userType === 'customer' ? room.customer_name : room.rider_name
        });

        socket.emit('joined_room', {
          roomId,
          roomInfo: room,
          message: 'Successfully joined room'
        });

        console.log(`🏠 User ${actualUserId} (${userType}) joined room ${roomId}`);

      } catch (error) {
        console.error('❌ Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // 🔥 แก้ไข: Send message - ป้องกันการบันทึกซ้ำ + ใช้ sender_type ที่ถูกต้อง
    socket.on('send_message', async (data) => {
      try {
        const { roomId, messageText, messageType = 'text', imageUrl, latitude, longitude, client_id } = data;

        console.log(`📤 Send message request:`, {
          roomId,
          messageText: messageText?.substring(0, 50) + '...',
          messageType,
          currentUserId,
          currentUserType,
          currentRoomId,
          client_id
        });

        if (!currentUserId || !currentUserType || currentRoomId !== roomId) {
          console.log(`❌ Unauthorized message attempt`);
          socket.emit('error', { message: 'Not authorized or not in room' });
          return;
        }

        // 🔥 ป้องกันการส่งข้อความซ้ำ (throttling + client_id)
        const messageKey = `${currentUserId}-${currentUserType}-${messageText}`;
        const now = Date.now();

        if (!socket.lastMessageTime) socket.lastMessageTime = {};
        if (!socket.lastMessageKey) socket.lastMessageKey = {};

        if (socket.lastMessageKey[roomId] === messageKey &&
          socket.lastMessageTime[roomId] &&
          (now - socket.lastMessageTime[roomId]) < 2000) {
          console.log('⚠️ Message throttled - too similar to recent message');
          socket.emit('error', { message: 'Message sent too quickly' });
          return;
        }

        socket.lastMessageKey[roomId] = messageKey;
        socket.lastMessageTime[roomId] = now;

        // 🔥 ตรวจสอบ client_id เพื่อป้องกันการบันทึกซ้ำ
        if (client_id) {
          const existingMessage = await pool.query(
            `SELECT message_id FROM chat_messages 
             WHERE room_id = $1 AND sender_id = $2 AND message_text = $3 
             AND created_at > NOW() - INTERVAL '10 seconds'`,
            [roomId, currentUserId, messageText]
          );
          
          if (existingMessage.rowCount > 0) {
            console.log('🔄 Duplicate message detected via client_id, skipping DB insert');
            socket.emit('message_sent', { success: true, duplicate: true });
            return;
          }
        }

        // 🔥 แก้ไข: ใช้ sender_type ที่ถูกต้อง
        let senderIdForDB = currentUserId;
        let senderTypeForDB;

        if (currentUserType === 'customer') {
          senderTypeForDB = 'customer'; // ไม่ใช้ 'member'
        } else if (currentUserType === 'rider') {
          senderTypeForDB = 'rider';
          // ตรวจสอบว่า currentUserId เป็น user_id หรือ rider_id
          const riderInfo = await pool.query(`
            SELECT user_id, rider_id FROM rider_profiles 
            WHERE user_id = $1 OR rider_id = $1
          `, [currentUserId]);
          
          if (riderInfo.rowCount > 0) {
            senderIdForDB = riderInfo.rows[0].user_id; // ใช้ user_id เสมอ
          }
        }

        // 🔥 Insert message ลง database (ครั้งเดียวเท่านั้น)
        const result = await pool.query(`
          INSERT INTO chat_messages (
            room_id, sender_id, sender_type, message_text, 
            message_type, image_url, latitude, longitude
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [roomId, senderIdForDB, senderTypeForDB, messageText, messageType, imageUrl, latitude, longitude]);

        const newMessage = result.rows[0];
        console.log(`💾 Message saved to DB: messageId=${newMessage.message_id}, senderType=${senderTypeForDB}`);

        // Get sender info based on userType
        let senderQuery, senderParams;
        if (currentUserType === 'customer') {
          senderQuery = 'SELECT display_name, photo_url FROM users WHERE user_id = $1';
          senderParams = [currentUserId];
        } else if (currentUserType === 'rider') {
          senderQuery = `
            SELECT u.display_name, u.photo_url 
            FROM users u 
            WHERE u.user_id = $1
          `;
          senderParams = [senderIdForDB]; // ใช้ user_id
        }

        const senderResult = await pool.query(senderQuery, senderParams);
        const senderInfo = senderResult.rows[0] || { display_name: 'Unknown', photo_url: null };

        // Format message for broadcast
        const messageForBroadcast = {
          message_id: newMessage.message_id,
          messageId: newMessage.message_id.toString(),
          room_id: newMessage.room_id,
          roomId: newMessage.room_id.toString(),
          sender_id: newMessage.sender_id,
          senderId: newMessage.sender_id,
          sender_type: newMessage.sender_type,
          senderType: newMessage.sender_type,
          sender_name: senderInfo.display_name,
          senderName: senderInfo.display_name,
          sender_photo: senderInfo.photo_url,
          senderPhoto: senderInfo.photo_url,
          message_text: newMessage.message_text,
          messageText: newMessage.message_text,
          message_type: newMessage.message_type,
          messageType: newMessage.message_type,
          image_url: newMessage.image_url,
          imageUrl: newMessage.image_url,
          latitude: newMessage.latitude,
          longitude: newMessage.longitude,
          is_read: newMessage.is_read,
          isRead: newMessage.is_read,
          created_at: newMessage.created_at,
          createdAt: newMessage.created_at,
          updated_at: newMessage.created_at,
          updatedAt: newMessage.created_at
        };

        // 🔥 แก้ไข: Broadcast ให้ทุกคนในห้อง (รวมผู้ส่ง) แต่ไม่ส่งซ้ำผ่าน HTTP
        chatNamespace.to(`room_${roomId}`).emit('new_message', messageForBroadcast);
        console.log(`📡 Message broadcasted to room ${roomId} (including sender)`);

        // ส่งการยืนยันกลับไปหาผู้ส่ง
        socket.emit('message_sent', {
          success: true,
          message: messageForBroadcast
        });

        // Update room's last activity
        await pool.query(`
          UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE room_id = $1
        `, [roomId]);

        console.log(`✅ Message sent successfully in room ${roomId} by ${currentUserType} ${senderIdForDB}`);

      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message', error: error.message });
      }
    });

    // Mark messages as read
    socket.on('mark_as_read', async (data) => {
      try {
        if (!currentRoomId || !currentUserId) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        let updateQuery;
        if (currentUserType === 'customer') {
          updateQuery = `
            UPDATE chat_messages 
            SET is_read = true 
            WHERE room_id = $1 AND sender_type = 'rider' AND is_read = false
          `;
        } else if (currentUserType === 'rider') {
          updateQuery = `
            UPDATE chat_messages 
            SET is_read = true 
            WHERE room_id = $1 AND sender_type = 'customer' AND is_read = false
          `;
        }

        if (updateQuery) {
          await pool.query(updateQuery, [currentRoomId]);
        }

        socket.to(`room_${currentRoomId}`).emit('messages_read', {
          roomId: currentRoomId,
          readBy: currentUserId,
          readByType: currentUserType
        });

        console.log(`Messages marked as read in room ${currentRoomId} by ${currentUserType} ${currentUserId}`);

      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      if (currentRoomId && currentUserId) {
        socket.to(`room_${currentRoomId}`).emit('user_typing', {
          userId: currentUserId,
          userType: currentUserType,
          isTyping: true
        });
      }
    });

    socket.on('typing_stop', (data) => {
      if (currentRoomId && currentUserId) {
        socket.to(`room_${currentRoomId}`).emit('user_typing', {
          userId: currentUserId,
          userType: currentUserType,
          isTyping: false
        });
      }
    });

    // Leave room
    socket.on('leave_room', () => {
      if (currentRoomId) {
        socket.leave(`room_${currentRoomId}`);
        socket.to(`room_${currentRoomId}`).emit('user_left', {
          userId: currentUserId,
          userType: currentUserType
        });
        console.log(`User ${currentUserId} (${currentUserType}) left room ${currentRoomId}`);
        currentRoomId = null;
        currentUserId = null;
        currentUserType = null;
        currentRiderId = null;
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (currentRoomId && currentUserId) {
        socket.to(`room_${currentRoomId}`).emit('user_left', {
          userId: currentUserId,
          userType: currentUserType
        });
        console.log(`User ${currentUserId} (${currentUserType}) disconnected from room ${currentRoomId}`);
      }
      console.log(`User disconnected from chat: ${socket.id}`);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return chatNamespace;
}

module.exports = attachChatHandlers;