# วิธีการเทส Admin Approve TopUp API ใน Postman

## 🔧 การตั้งค่า Postman

### 1. **Method และ URL**
- **Method**: `PUT`
- **URL**: `{{baseURL}}/admin/topups/:topup_id/approve`
- **ตัวอย่าง**: `http://localhost:3000/admin/topups/4/approve`

### 2. **Headers**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### 3. **Path Variables**
- `topup_id`: รหัสการเติมเงินที่ต้องการอนุมัติ/ปฏิเสธ (เช่น 4)

### 4. **Body (JSON)**

**สำหรับการอนุมัติ:**
```json
{
    "status": "approved"
}
```

**สำหรับการปฏิเสธ:**
```json
{
    "status": "rejected",
    "rejection_reason": "สลิปไม่ชัดเจน"
}
```

## 📋 ขั้นตอนการใช้งาน

### Step 1: ตั้งค่า Request
1. เปิด Postman
2. สร้าง request ใหม่
3. เลือก method เป็น `PUT`
4. ใส่ URL: `http://localhost:3000/admin/topups/4/approve`

### Step 2: ตั้งค่า Authorization
1. ไปที่ tab "Authorization"
2. เลือก Type เป็น "Bearer Token"
3. ใส่ JWT token ที่ได้จากการ login admin

### Step 3: ตั้งค่า Headers
1. ไปที่ tab "Headers"
2. เพิ่ม header:
   - Key: `Content-Type`
   - Value: `application/json`

### Step 4: ตั้งค่า Body
1. ไปที่ tab "Body"
2. เลือก "raw"
3. เลือก "JSON" จาก dropdown
4. ใส่ JSON data:
```json
{
    "status": "approved"
}
```

### Step 5: ส่ง Request
- คลิก "Send"

## ✅ Response ที่คาดหวัง

**สำเร็จ (200):**
```json
{
    "success": true,
    "message": "อนุมัติการเติมเงินสำเร็จ",
    "data": {
        "topup_id": 4,
        "user_id": 33,
        "rider_id": 8,
        "amount": 100.00,
        "status": "approved",
        "admin_id": 1,
        "approved_at": "2025-09-15T20:35:00.000Z",
        "updated_at": "2025-09-15T20:35:00.000Z"
    }
}
```

**Error (400):**
```json
{
    "success": false,
    "error": "กรุณาระบุสถานะ (status) ในการร้องขอ"
}
```

## 🚨 ปัญหาที่พบบ่อย

### 1. "Cannot destructure property 'status' of 'req.body'"
**สาเหตุ**: Postman ไม่ได้ส่ง JSON body
**แก้ไข**: 
- ตรวจสอบว่าเลือก "raw" และ "JSON" ใน Body tab
- ตรวจสอบ Content-Type header เป็น "application/json"

### 2. "401 Unauthorized"
**สาเหตุ**: JWT token ไม่ถูกต้องหรือหมดอายุ
**แก้ไข**: 
- Login admin ใหม่เพื่อรับ token ใหม่
- ตรวจสอบ Authorization header

### 3. "404 Not Found"
**สาเหตุ**: topup_id ไม่มีในระบบ
**แก้ไข**: 
- ตรวจสอบ topup_id ที่มีอยู่จาก GET `/admin/topups/pending`

## 🧪 การทดสอบ

1. **ทดสอบการอนุมัติ**:
   ```json
   { "status": "approved" }
   ```

2. **ทดสอบการปฏิเสธ**:
   ```json
   { 
       "status": "rejected", 
       "rejection_reason": "เอกสารไม่ครบถ้วน" 
   }
   ```

3. **ทดสอบ Error Cases**:
   - ส่ง body เป็น string แทน JSON
   - ไม่ส่ง status
   - ส่ง status ที่ไม่ถูกต้อง