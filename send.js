// ไฟล์นี้เป็นตัวอย่างการส่งข้อความผ่าน Socket.IO โดยต้องติดตั้ง npm i socket.io-client ก่อน
// รันใน terminal ด้วยคำสั่ง (node send.js userId roomId "ข้อความที่ต้องการส่ง") เช่น node send.js 31 1 "สวัสดีจากลูกค้า"

// node send.js <userId> <roomId> "<message>"
const { io } = require('socket.io-client');

const base = 'http://localhost:4000';
const userId = process.argv[2] || '31';    // 31 = ลูกค้า, หรือ 37 = ฝั่งไรเดอร์ (users.user_id)
const roomId = parseInt(process.argv[3] || '1', 10);
const text   = process.argv[4] || 'hello from script';

const socket = io(base, {
  transports: ['websocket'],
  query: { userId } // เดโม่ auth ง่าย ๆ (ของจริงค่อยเปลี่ยนเป็น JWT)
});

socket.on('connect', () => {
  console.log('connected as user', userId);
  socket.emit('join', { roomId });
  setTimeout(() => {
    socket.emit('message:send', {
      roomId,
      text,
      type: 'text'
    });
  }, 300);
});

socket.on('joined', (p) => console.log('joined room', p));
socket.on('message:new', (m) => {
  console.log('NEW:', m);
  process.exit(0);
});

socket.on('connect_error', (e) => console.error('connect_error', e.message));
