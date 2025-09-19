// ไฟล์นี้เป็นตัวอย่างการส่งข้อความผ่าน Socket.IO โดยต้องติดตั้ง npm i socket.io-client ก่อน
// รันใน terminal ด้วยคำสั่ง (node send.js userId roomId "ข้อความที่ต้องการส่ง") เช่น node send.js 31 1 "สวัสดีจากลูกค้า"

// ใช้: node send.js <userId> <roomId> "<message>"
// ตัวอย่าง: node send.js 31 1 "สวัสดีจากลูกค้า"

const { io } = require('socket.io-client');

// --------- CLI args ----------
const userId = parseInt(process.argv[2], 10);
const roomId = parseInt(process.argv[3], 10);
const text   = process.argv[4];

if (!userId || !roomId || typeof text !== 'string') {
  console.error('วิธีใช้: node send.js <userId:int> <roomId:int> "<message:string>"');
  process.exit(1);
}

// เปลี่ยน BASE ถ้ารันบนเครื่อง/พอร์ตอื่น
const BASE = 'http://127.0.0.1:4000/chat';

// --------- Connect ----------
const socket = io(BASE, {
  // เปิด fallback เผื่อ websocket ถูกบล็อกชั่วคราว
  transports: ['websocket', 'polling'],
  query: { userId },        // ตรงกับ middleware ใน SocketChats.js
  timeout: 8000,            // กัน timeout เร็วเกิน
  reconnection: false,      // สคริปต์ครั้งเดียว ไม่ต้อง reconnect
});

// safety timer กันค้าง
const GLOBAL_TIMEOUT_MS = 15000;
const globalTimer = setTimeout(() => {
  console.error('หมดเวลา: ไม่สามารถส่งข้อความได้ภายในเวลาที่กำหนด');
  try { socket.close(); } catch {}
  process.exit(1);
}, GLOBAL_TIMEOUT_MS);

socket.on('connect', () => {
  console.log(`✅ connected as userId=${userId}, socket.id=${socket.id}`);
  // เข้าห้องก่อน (ต้องเป็นสมาชิกของห้องตาม DB)
  socket.emit('join', { roomId });
});

let joined = false;

socket.on('joined', ({ roomId: joinedRoom }) => {
  joined = true;
  console.log(`🏷️ joined room ${joinedRoom}`);

  // หน่วงนิดหน่อยให้เข้าห้องเสร็จจริง ๆ
  setTimeout(() => {
    const payload = { roomId, text, type: 'text' };
    console.log('📨 sending:', payload);
    socket.emit('message:send', payload);
  }, 200);
});

// เมื่อ server กระจายข้อความกลับมา
socket.on('message:new', (msg) => {
  console.log('🆕 message:new =>', msg);
  cleanupAndExit(0);
});

// error สำคัญ
socket.on('connect_error', (err) => {
  console.error('❌ connect_error:', err?.message || err);
  // ฮินต์ทั่วไป
  console.error('ตรวจสอบว่า server รันอยู่, พอร์ต/host ถูกต้อง, namespace /chat ตรงกัน, และ userId เป็นสมาชิกห้องนี้ใน DB');
  cleanupAndExit(1);
});

socket.on('error', (err) => {
  console.error('❌ error:', err);
});

socket.on('disconnect', (reason) => {
  console.log('ℹ️ disconnected:', reason);
  // ถ้ายังไม่ส่งสำเร็จจะโดน global timeout ปิดเอง
});

// ถ้า join ไม่สำเร็จในเวลานี้ จะพยายามส่งเลย (บางกรณี server ไม่ emit 'joined' กลับ)
// และถ้ายังไม่สำเร็จ จะโดน global timeout ปิด
setTimeout(() => {
  if (!joined) {
    console.warn('⚠️ ยังไม่ได้รับ joined ภายในเวลา → ลองส่งข้อความเลย');
    socket.emit('message:send', { roomId, text, type: 'text' });
  }
}, 2000);

// --------- helpers ----------
function cleanupAndExit(code) {
  clearTimeout(globalTimer);
  try { socket.close(); } catch {}
  // เผื่อ stdout ยังไม่ flush
  setTimeout(() => process.exit(code), 150);
}
