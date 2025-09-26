// ===================================
// routes/Chats/CustomerChatRoutes.js
// ===================================

const express = require('express');
const router = express.Router();
const CustomerChatController = require('../../controllers/Chats/CustomerChatController');
const authenticateCustomer = require('../../middleware/Chats/verifyCustomerAuth'); // middleware ตรวจ JWT (ลูกค้าใช้ user_id)

router.get('/rooms', authenticateCustomer, CustomerChatController.getCustomerChatRooms);
router.get('/room/:roomId/messages', authenticateCustomer, CustomerChatController.getChatMessages);
router.put('/room/:roomId/join', authenticateCustomer, CustomerChatController.joinChatRoom);
router.put('/room/:roomId/mark-read', authenticateCustomer, CustomerChatController.markMessagesAsRead);

router.post('/room/message', authenticateCustomer, CustomerChatController.sendMessage);
router.post('/upload-image', authenticateCustomer, CustomerChatController.uploadChatImage);

router.get('/unread-count', authenticateCustomer, CustomerChatController.getUnreadCount);

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Customer Chat Service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
