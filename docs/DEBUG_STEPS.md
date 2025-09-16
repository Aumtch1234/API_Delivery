# ขั้นตอนการ Debug API Topup

## ตรวจสอบทีละขั้นตอน

### 1. ทดสอบ API ว่าทำงานหรือไม่
ลองเรียก API อื่นก่อน เช่น profile:
```
GET http://localhost:3000/rider/profile
Authorization: Bearer xWKN4UU7bb3POPn6TxS1B1zk16QU
```

### 2. ตรวจสอบ JWT Token
ลอง decode JWT token ว่าข้อมูลถูกต้องหรือไม่:
- ไปที่ https://jwt.io/
- Paste token: `xWKN4UU7bb3POPn6TxS1B1zk16QU`
- ดูว่ามี user_id และ role = 'rider' หรือไม่

### 3. ทดสอบแบบไม่มีไฟล์ก่อน
ลองส่งแค่ slip_url:
```
POST http://localhost:3000/rider/topup
Authorization: Bearer xWKN4UU7bb3POPn6TxS1B1zk16QU
Content-Type: application/x-www-form-urlencoded

amount=100&slip_url=https://res.cloudinary.com/demo/image/upload/sample.jpg
```

### 4. ตรวจสอบ Console Log
หลังจากส่ง request แล้ว ดู log ใน terminal:
- มี "=== Topup API Called ===" หรือไม่?
- req.user มีข้อมูลหรือไม่?
- Error ตรงไหน?

### 5. ตรวจสอบ Database Connection
ลองดูว่าเชื่อมต่อ database ได้หรือไม่:
```sql
SELECT * FROM users WHERE role = 'rider' LIMIT 1;
```

### 6. ตรวจสอบ Environment Variables
```bash
echo $JWT_SECRET
echo $CLOUDINARY_CLOUD_NAME
echo $CLOUDINARY_API_KEY
```

## ปัญหาที่เป็นไปได้

1. **JWT Token ไม่ถูกต้อง** → ได้ 401 Unauthorized
2. **Database Connection ล้มเหลว** → ได้ 500 Internal Server Error
3. **Cloudinary Config ผิด** → Error ตอนอัปโหลด
4. **User ไม่ใช่ Rider** → ได้ 403 Forbidden
5. **ไม่มีตาราง rider_topups** → Database Error