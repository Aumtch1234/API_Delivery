# Rider API Documentation

## Overview
API สำหรับการสมัครและยืนยันตัวตนของไรเดอร์ในระบบ API Delivery

## Base URL
```
/rider
```

## Authentication
- การสมัครไรเดอร์ไม่ต้องการ authentication
- การยืนยันตัวตน, ตรวจสอบสถานะ, และดูโปรไฟล์ ต้องการ JWT token
- Admin APIs ต้องการ JWT token ของ admin

### JWT Token
ส่ง token ใน header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### Authentication Endpoints

#### เข้าสู่ระบบไรเดอร์
**POST** `/rider/login`

เข้าสู่ระบบสำหรับไรเดอร์

##### Request Body
```javascript
{
  "email": "string",        // อีเมล (required)
  "password": "string"      // รหัสผ่าน (required)
}
```

##### Response
```javascript
{
  "message": "เข้าสู่ระบบสำเร็จ",
  "token": "jwt_token_here",
  "user": {
    "user_id": 123,
    "email": "rider@example.com",
    "display_name": "ชื่อไรเดอร์",
    "role": "rider",
    "is_verified": false
  },
  "rider_status": {
    "has_submitted": true,
    "approval_status": "pending",
    "submitted_at": "2025-09-02T10:30:00.000Z"
  }
}
```

#### รีเฟรช Token
**POST** `/rider/refresh-token`

รีเฟรช access token

##### Request Body
```javascript
{
  "refresh_token": "string"    // Refresh token (required)
}
```

##### Response
```javascript
{
  "message": "รีเฟรช token สำเร็จ",
  "token": "new_jwt_token_here"
}
```

#### ดูโปรไฟล์
**GET** `/rider/profile`

ดูข้อมูลโปรไฟล์ของตัวเอง (ต้องการ authentication)

##### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
```

##### Response
```javascript
{
  "user_info": {
    "user_id": 123,
    "display_name": "ชื่อไรเดอร์",
    "email": "rider@example.com",
    "phone": "0812345678",
    "birthdate": "1990-01-01",
    "gender": "male",
    "photo_url": "string",
    "created_at": "2025-09-02T10:00:00.000Z",
    "is_verified": false
  },
  "rider_status": {
    "has_submitted": true,
    "approval_status": "pending",
    "submitted_at": "2025-09-02T10:30:00.000Z",
    "approved_at": null,
    "rejection_reason": null
  },
  "vehicle_info": {
    "vehicle_type": "motorcycle",
    "vehicle_brand_model": "Honda Wave",
    "vehicle_color": "Red",
    "vehicle_registration_number": "กก-1234",
    "vehicle_registration_province": "กรุงเทพมหานคร"
  },
  "address": {
    "house_number": "123/4",
    "street": "Main Street",
    "subdistrict": "ตำบล",
    "district": "อำเภอ",
    "province": "จังหวัด",
    "postal_code": "12345"
  }
}
```

### 1. สมัครสมาชิกไรเดอร์ (ขั้นตอนที่ 1)

**POST** `/rider/register`

ขั้นตอนแรกของการสมัครไรเดอร์ - กรอกข้อมูลส่วนตัวและที่อยู่

#### Request Body (multipart/form-data)
```javascript
{
  "display_name": "string",     // ชื่อที่แสดง (required)
  "email": "string",            // อีเมล (required, unique)
  "password": "string",         // รหัสผ่าน (required)
  "phone": "string",            // เบอร์โทรศัพท์ (required)
  "birthdate": "string",        // วันเกิด YYYY-MM-DD (required)
  "gender": "string",           // เพศ (required)
  "address": "string",          // ที่อยู่ (optional)
  "province": "string",         // จังหวัด (optional)
  "amphure": "string",          // อำเภอ (optional)
  "tambon": "string",           // ตำบล (optional)
  "profile_photo": "file"       // รูปโปรไฟล์ (optional)
}
```

#### Response
```javascript
{
  "message": "ลงทะเบียนสำเร็จ ขั้นตอนต่อไปกรุณายืนยันตัวตน",
  "user_id": 123,
  "next_step": "identity_verification"
}
```

### 2. ยืนยันตัวตนไรเดอร์ (ขั้นตอนที่ 2)

**POST** `/rider/identity-verification`

ขั้นตอนที่สองของการสมัครไรเดอร์ - อัปโหลดเอกสารและข้อมูลยานพาหนะ (ต้องการ authentication)

#### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Request Body (multipart/form-data)
```javascript
{
  // ไม่ต้องส่ง user_id เพราะได้จาก token แล้ว
  "id_card_number": "string",             // เลขบัตรประชาชน 13 หลัก (required)
  "driving_license_number": "string",     // เลขใบขับขี่ (required)
  "vehicle_type": "motorcycle",           // ประเภทรถ (default: motorcycle)
  "vehicle_brand_model": "string",        // ยี่ห้อ/รุ่นรถ (required)
  "vehicle_color": "string",              // สีรถ (required)
  "vehicle_registration_number": "string", // หมายเลขทะเบียนรถ เช่น "กก-1234" (required)
  "vehicle_registration_province": "string", // จังหวัดที่ออกทะเบียนรถ (required)
  
  // ไฟล์รูปภาพที่จำเป็น (required)
  "id_card_selfie": "file",               // รูปถ่ายคู่บัตรประชาชน
  "id_card_photo": "file",                // รูปถ่ายบัตรประชาชน
  "driving_license_photo": "file",        // รูปใบขับขี่
  "vehicle_photo": "file",                // รูปถ่ายรถ
  "vehicle_registration_photo": "file"    // รูปคู่มือทะเบียนรถ
}
```

#### Response
```javascript
{
  "message": "ส่งข้อมูลยืนยันตัวตนสำเร็จ รอการอนุมัติจากแอดมิน",
  "status": "pending_approval"
}
```

### 3. ตรวจสอบสถานะการอนุมัติ

**GET** `/rider/approval-status/:user_id`

ตรวจสอบสถานะการอนุมัติของไรเดอร์ (ต้องการ authentication และสามารถดูได้เฉพาะข้อมูลของตัวเอง)

#### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Response
```javascript
{
  "status": "pending|approved|rejected",
  "submitted_at": "2025-09-02T10:30:00.000Z",
  "approved_at": "2025-09-02T15:30:00.000Z",    // ถ้าได้รับการอนุมัติ
  "rejection_reason": "string",                  // ถ้าถูกปฏิเสธ
  "rider_info": {
    "name": "string",
    "email": "string"
  }
}
```

## Admin APIs

### 4. ดูรายการไรเดอร์ที่รอการอนุมัติ

**GET** `/admin/riders/pending`

ดูรายการไรเดอร์ที่รอการอนุมัติ (สำหรับ Admin)

#### Query Parameters
- `page`: หน้า (default: 1)
- `limit`: จำนวนต่อหน้า (default: 10)

#### Response
```javascript
{
  "riders": [
    {
      "rider_id": 1,
      "user_id": 123,
      "display_name": "string",
      "email": "string",
      "phone": "string",
      "submitted_at": "2025-09-02T10:30:00.000Z",
      "province": "string",
      "district": "string"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 45,
    "has_next": true,
    "has_prev": false
  }
}
```

### 5. ดูรายละเอียดไรเดอร์

**GET** `/admin/riders/:rider_id`

ดูรายละเอียดไรเดอร์ทั้งหมด (สำหรับ Admin)

#### Response
```javascript
{
  "rider_info": {
    "rider_id": 1,
    "user_id": 123,
    "display_name": "string",
    "email": "string",
    "phone": "string",
    "birthdate": "1990-01-01",
    "gender": "male",
    "photo_url": "string",
    "registered_at": "2025-09-02T10:00:00.000Z"
  },
  "identity_documents": {
    "id_card_number": "1234567890123",
    "id_card_photo_url": "string",
    "id_card_selfie_url": "string",
    "driving_license_number": "string",
    "driving_license_photo_url": "string"
  },
  "vehicle_info": {
    "vehicle_type": "motorcycle",
    "vehicle_brand_model": "Honda Wave",
    "vehicle_color": "Red",
    "vehicle_registration_number": "กก-1234",
    "vehicle_registration_province": "กรุงเทพมหานคร",
    "vehicle_photo_url": "string",
    "vehicle_registration_photo_url": "string"
  },
  "address": {
    "house_number": "string",
    "street": "string",
    "subdistrict": "string",
    "district": "string",
    "province": "string",
    "postal_code": "string"
  },
  "approval_info": {
    "status": "pending",
    "submitted_at": "2025-09-02T10:30:00.000Z",
    "approved_at": null,
    "approved_by": null,
    "rejection_reason": null
  }
}
```

### 6. อนุมัติไรเดอร์

**PATCH** `/admin/riders/:rider_id/approve`

อนุมัติไรเดอร์ (สำหรับ Admin)

#### Request Body
```javascript
{
  "admin_id": 1    // ID ของ admin ที่อนุมัติ
}
```

#### Response
```javascript
{
  "message": "อนุมัติไรเดอร์สำเร็จ",
  "rider_id": 1,
  "status": "approved"
}
```

### 7. ปฏิเสธไรเดอร์

**PATCH** `/admin/riders/:rider_id/reject`

ปฏิเสธไรเดอร์ (สำหรับ Admin)

#### Request Body
```javascript
{
  "admin_id": 1,           // ID ของ admin ที่ปฏิเสธ
  "reason": "string"       // เหตุผลในการปฏิเสธ (required)
}
```

#### Response
```javascript
{
  "message": "ปฏิเสธไรเดอร์สำเร็จ",
  "rider_id": 1,
  "status": "rejected",
  "reason": "string"
}
```

### 8. ดูรายการไรเดอร์ทั้งหมด

**GET** `/admin/riders/all`

ดูรายการไรเดอร์ทั้งหมด (สำหรับ Admin)

#### Query Parameters
- `page`: หน้า (default: 1)
- `limit`: จำนวนต่อหน้า (default: 10)
- `status`: กรองตามสถานะ (all|pending|approved|rejected, default: all)
- `search`: ค้นหาตามชื่อหรืออีเมล

#### Response
```javascript
{
  "riders": [
    {
      "rider_id": 1,
      "user_id": 123,
      "display_name": "string",
      "email": "string",
      "phone": "string",
      "approval_status": "approved",
      "submitted_at": "2025-09-02T10:30:00.000Z",
      "approved_at": "2025-09-02T15:30:00.000Z",
      "province": "string",
      "district": "string",
      "approved_by_admin": "admin_username"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 45,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "status": "all",
    "search": ""
  }
}
```

## Error Responses

### Validation Errors (400)
```javascript
{
  "error": "กรุณากรอกข้อมูลให้ครบถ้วน"
}
```

### Duplicate Data (400)
```javascript
{
  "error": "อีเมลนี้ถูกใช้งานแล้ว"
}
```

### Not Found (404)
```javascript
{
  "error": "ไม่พบข้อมูลไรเดอร์"
}
```

### Server Error (500)
```javascript
{
  "error": "เกิดข้อผิดพลาดในการลงทะเบียน"
}
```

## Postman Testing Guide

### Base URL
```
http://localhost:3000/rider
```

### 1. ทดสอบการสมัครไรเดอร์
**POST** `/rider/register`
- Body: form-data
- ไม่ต้องการ token

### 2. ทดสอบการเข้าสู่ระบบ
**POST** `/rider/login`
- Body: raw (JSON)
```json
{
  "email": "rider@example.com",
  "password": "password123"
}
```
- บันทึก token ที่ได้มาใช้ในขั้นตอนถัดไป

### 3. ทดสอบการดูโปรไฟล์
**GET** `/rider/profile`
- Headers: `Authorization: Bearer YOUR_TOKEN`

### 4. ทดสอบการยืนยันตัวตน
**POST** `/rider/identity-verification`
- Headers: `Authorization: Bearer YOUR_TOKEN`
- Body: form-data
  - id_card_number (Text): "1101700123456"
  - driving_license_number (Text): "DL1234567890"
  - vehicle_brand_model (Text): "Honda Wave 125i"
  - vehicle_color (Text): "แดง"
  - vehicle_registration_number (Text): "กก-1234"
  - vehicle_registration_province (Text): "กรุงเทพมหานคร"
  - id_card_selfie (File): รูปถ่ายคู่บัตรประชาชน
  - id_card_photo (File): รูปถ่ายบัตรประชาชน
  - driving_license_photo (File): รูปใบขับขี่
  - vehicle_photo (File): รูปถ่ายรถ
  - vehicle_registration_photo (File): รูปคู่มือทะเบียนรถ

### 5. ทดสอบการตรวจสอบสถานะ
**GET** `/rider/approval-status/123`
- Headers: `Authorization: Bearer YOUR_TOKEN`
- user_id ใน URL ต้องตรงกับ user_id ของ token

### Middleware Protection Test
1. **ไม่ส่ง token** → 401 Unauthorized
2. **ส่ง token ผิด** → 401 Invalid token
3. **ส่ง token หมดอายุ** → 401 Token expired
4. **ดูข้อมูลคนอื่น** → 403 Forbidden
5. **ส่งข้อมูลซ้ำ** → 400 Already submitted

## Database Schema

### Tables
- `users` - ข้อมูลผู้ใช้พื้นฐาน (role = 'rider')
- `rider_addresses` - ที่อยู่ของไรเดอร์
- `rider_profiles` - ข้อมูลยืนยันตัวตนของไรเดอร์

### Status Flow
1. **Registration** - user สมัครใน `users` table
2. **Identity Submission** - ส่งเอกสารใน `rider_profiles` (status: pending)
3. **Admin Review** - admin ตรวจสอบและอนุมัติ/ปฏิเสธ
4. **Approved** - rider สามารถใช้งานระบบได้
5. **Rejected** - rider ต้องส่งเอกสารใหม่
