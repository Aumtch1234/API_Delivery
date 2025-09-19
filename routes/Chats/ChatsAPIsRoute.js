const express = require('express');
const router = express.Router();

const { createChatRoom, 
        getChatMessages, 
        markMessagesAsRead } =
  require('../../controllers/Chats/ChatsController');

const { verifyTokenAny } = require('../../middleware/Chats/authAnyChats.js');

// สร้างห้องแชทจาก order_id
router.post('/rooms/create', createChatRoom);

// ดึงข้อความ
router.get('/rooms/:roomId/messages', getChatMessages);

// mark-as-read (ต้องมี req.user)
router.patch('/rooms/:roomId/mark-as-read', verifyTokenAny, markMessagesAsRead);

module.exports = router;