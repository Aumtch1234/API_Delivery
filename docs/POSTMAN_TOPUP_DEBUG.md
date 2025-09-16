# แก้ไขปัญหา API Topup ใน Postman

## ปัญหาที่พบ
```json
{
    "success": false,
    "error": "เกิดข้อผิดพลาดในเซิร์ฟเวอร์"
}
```

## วิธีแก้ไขและการตรวจสอบ

### 1. ตรวจสอบ URL
- **URL ที่ถูกต้อง**: `http://localhost:3000/rider/topup` (หรือ port ที่ใช้)
- **Method**: POST

### 2. ตรวจสอบ Authorization
ใน Postman:
1. ไปที่ tab **Authorization**
2. เลือก Type: **Bearer Token**
3. ใส่ JWT token ของไรเดอร์ในช่อง Token

หรือใน tab **Headers**:
```
Authorization: Bearer YOUR_RIDER_JWT_TOKEN
```

### 3. ตรวจสอบ Body
ใน tab **Body**:
1. เลือก **form-data** (ถูกต้องแล้ว)
2. เพิ่มฟิลด์:
   - `amount`: Text → `100` (หรือจำนวนที่ต้องการ)
   - `slip`: File → เลือกไฟล์รูปสลิป

### 4. ตัวอย่างการตั้งค่าที่ถูกต้อง

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data (อัตโนมัติ)
```

#### Body (form-data):
```
amount: 500
slip: [ไฟล์รูปภาพ .jpg, .png]
```

### 5. ขั้นตอนการทดสอบ

#### Step 1: ทดสอบการเข้าถึง API
```bash
curl -X POST http://localhost:3000/rider/topup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

ถ้าได้ error เกี่ยวกับ token → ปัญหาที่ Authorization
ถ้าได้ error เกี่ยวกับ amount → API ทำงาน แต่ขาดข้อมูล

#### Step 2: ทดสอบด้วยข้อมูลครบถ้วน
```bash
curl -X POST http://localhost:3000/rider/topup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "amount=500" \
  -F "slip=@path/to/slip.jpg"
```

### 6. Error Messages ที่อาจเจอ

#### ปัญหา Authorization:
```json
{
    "error": "ไม่พบ Authorization header กรุณาเข้าสู่ระบบ"
}
```

#### ปัญหาข้อมูล:
```json
{
    "success": false,
    "error": "กรุณากรอกจำนวนเงินที่ต้องการเติม"
}
```

#### ปัญหาไฟล์:
```json
{
    "success": false,
    "error": "กรุณาอัปโหลดสลิปการโอนเงินหรือส่ง slip_url"
}
```

### 7. การ Debug เพิ่มเติม

#### ตรวจสอบ Server Log:
ดูใน terminal ที่รัน Node.js server ว่ามี error log อะไร

#### ตรวจสอบ Token:
1. เข้าสู่ระบบก่อน (POST /rider/login)
2. Copy JWT token จาก response
3. ใช้ token นั้นใน Authorization header

### 8. ตัวอย่าง Flow ที่สมบูรณ์

#### 1. Login ก่อน:
```
POST /rider/login
{
    "email": "rider@example.com",
    "password": "password123"
}
```

Response:
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
}
```

#### 2. ใช้ Token ในการ Topup:
```
POST /rider/topup
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Form-data:
- amount: 500
- slip: [ไฟล์รูป]
```

### 9. วิธีแก้ปัญหาทั่วไป

1. **ตรวจสอบ Server ทำงานหรือไม่**
2. **ตรวจสอบ Port และ URL**
3. **ตรวจสอบ JWT Token ยังไม่หมดอายุ**
4. **ตรวจสอบขนาดไฟล์ไม่เกิน 10MB**
5. **ตรวจสอบไฟล์เป็นรูปภาพ (.jpg, .png)**

### 10. การทดสอบแบบไม่ใช้ไฟล์ (ทางเลือก)

ถ้าต้องการทดสอบโดยไม่อัปโหลดไฟล์:
```
Form-data:
- amount: 500
- slip_url: https://res.cloudinary.com/demo/image/upload/sample.jpg
```