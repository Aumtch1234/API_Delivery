
// ===================================
// routes/Chats/RiderChatRoutes.js
// ===================================

const express = require('express');
const router = express.Router();
const RiderChatController = require('../../controllers/Chats/RiderChatController');
const verifyRiderAuth = require('../../middleware/Chats/verifyRiderAuth'); // แก้ path

// Chat Room Management Routes

// Get all chat rooms for a specific rider
router.get('/rooms/:riderId', verifyRiderAuth, RiderChatController.getRiderChatRooms);

// Get active chat rooms assigned to rider
router.get('/active-rooms/:riderId', verifyRiderAuth, RiderChatController.getActiveRooms);

// Create new chat room (when order is created or rider assigned)
router.post('/room', verifyRiderAuth, RiderChatController.createChatRoom);

// Accept or join an existing chat room (when rider accepts order)
router.put('/room/:roomId/join', verifyRiderAuth, RiderChatController.joinChatRoom);

// Update chat room status (active, closed, archived)
router.put('/room/:roomId/status', verifyRiderAuth, RiderChatController.updateRoomStatus);

// Message Management Routes

// Get messages in a specific chat room (with pagination)
router.get('/room/:roomId/messages', verifyRiderAuth, RiderChatController.getChatMessages);

// Send message to a chat room
router.post('/room/message', verifyRiderAuth, RiderChatController.sendMessage);

// Mark messages as read in a specific room  
router.put('/room/:roomId/mark-read', verifyRiderAuth, RiderChatController.markMessagesAsRead);

// Get unread message count for rider across all rooms
router.get('/unread-count/:riderId', verifyRiderAuth, RiderChatController.getUnreadCount);

// File Upload Routes

// Upload image for chat
router.post('/upload-image', verifyRiderAuth, RiderChatController.uploadChatImage);

// Utility Routes

// Auto-create chat room when order is ready
router.post('/auto-create-room/:orderId', verifyRiderAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await RiderChatController.autoCreateChatRoom(orderId);

    if (result.success) {
      res.json({
        success: true,
        data: { room_id: result.room_id },
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error in auto-create room route:', error);
    res.status(500).json({
      success: false,
    
      message: 'เกิดข้อผิดพลาดในการสร้างห้องแชทอัตโนมัติ'
    });
  }
});

// Health check route for chat service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Rider Chat Service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;