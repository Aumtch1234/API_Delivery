# ระบบเติมเงิน GP (Game Point) สำหรับไรเดอร์ - เวอร์ชัน Bearer Token

## ภาพรวมระบบ

ระบบเติมเงิน GP เป็นระบบที่ให้ไรเดอร์สามารถเติมเงินเข้าบัญชี GP เพื่อใช้ในการทำงาน โดยต้องผ่านการอนุมัติจากแอดมินก่อน

**การเปลี่ยนแปลงสำคัญ:**
- ใช้ Bearer Token (JWT) แทนการส่ง rider_id และ admin_id ใน request body
- เพิ่มความปลอดภัยและลดความผิดพลาดในการส่งข้อมูล
- ดึงข้อมูล user จาก JWT token ที่ได้รับการตรวจสอบแล้ว

## โครงสร้างฐานข้อมูล

### ตาราง `rider_topups`
```sql
CREATE TABLE rider_topups (
    topup_id SERIAL PRIMARY KEY,              -- รหัสการเติมเงิน
    rider_id INTEGER NOT NULL,                -- รหัสไรเดอร์ (FK จาก users)
    amount DECIMAL(10,2) NOT NULL,            -- จำนวนเงินที่เติม
    slip_url TEXT NOT NULL,                   -- URL รูปสลิปการโอนเงิน
    status TEXT DEFAULT 'pending',            -- สถานะ (pending, approved, rejected)
    rejection_reason TEXT,                    -- เหตุผลการปฏิเสธ
    admin_id INTEGER,                         -- รหัสแอดมินที่ดำเนินการ
    approved_at TIMESTAMP,                    -- วันที่อนุมัติ
    created_at TIMESTAMP DEFAULT NOW(),       -- วันที่สร้างคำขอ
    updated_at TIMESTAMP DEFAULT NOW(),       -- วันที่อัปเดตล่าสุด
    
    CONSTRAINT status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);
```

## API สำหรับไรเดอร์

### 1. เติมเงิน GP
```
POST /api/rider/topup
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

Body:
- amount: จำนวนเงินที่เติม (required)
- slip: ไฟล์รูปสลิป (recommended) หรือ slip_url: URL รูปสลิป
```

**วิธีการอัปโหลด:**
1. **แนะนำ**: อัปโหลดไฟล์รูปสลิปผ่าน `slip` field
2. **ทางเลือก**: ส่ง URL รูปสลิปจาก Cloudinary ผ่าน `slip_url` field

**หมายเหตุ:** 
- `rider_id` จะถูกดึงอัตโนมัติจาก JWT token
- ระบบรองรับทั้งการอัปโหลดไฟล์และการส่ง URL
- การอัปโหลดไฟล์จะถูกเก็บใน folder `rider-topup-slips` บน Cloudinary

**Response:**
```json
{
    "success": true,
    "message": "ส่งคำขอเติมเงินสำเร็จ รอการอนุมัติจากแอดมิน",
    "data": {
        "topup_id": 1,
        "rider_id": 123,
        "amount": "500.00",
        "slip_url": "https://res.cloudinary.com/.../rider-topup-slips/...",
        "status": "pending",
        "created_at": "2025-01-15T10:30:00Z"
    }
}
```

**Error Responses:**
```json
// ไม่มีข้อมูลเงิน
{
    "success": false,
    "error": "กรุณากรอกจำนวนเงินที่ต้องการเติม"
}

// จำนวนเงินไม่ถูกต้อง
{
    "success": false,
    "error": "จำนวนเงินที่เติมต้องมากกว่า 0"
}

// ไม่มีสลิป
{
    "success": false,
    "error": "กรุณาอัปโหลดสลิปการโอนเงินหรือส่ง slip_url"
}

// URL ไม่ถูกต้อง
{
    "success": false,
    "error": "รูปแบบ URL ไม่ถูกต้อง"
}

// ไม่ใช่ URL Cloudinary
{
    "success": false,
    "error": "กรุณาใช้ URL รูปภาพจาก Cloudinary เท่านั้น"
}

// Error การอัปโหลด
{
    "success": false,
    "error": "เกิดข้อผิดพลาดในการอัปโหลดสลิป กรุณาลองใหม่อีกครั้ง"
}
```

### 2. ดูประวัติการเติมเงิน
```
GET /api/rider/topup-history
Authorization: Bearer <JWT_TOKEN>
```

**หมายเหตุ:** แสดงเฉพาะประวัติของไรเดอร์ที่เป็นเจ้าของ token

**Response:**
```json
{
    "success": true,
    "data": {
        "topup_history": [
            {
                "topup_id": 1,
                "amount": "500.00",
                "slip_url": "https://cloudinary.com/...",
                "status": "approved",
                "rejection_reason": null,
                "created_at": "2025-01-15T10:30:00Z",
                "approved_at": "2025-01-15T11:00:00Z",
                "updated_at": "2025-01-15T11:00:00Z"
            }
        ],
        "statistics": {
            "total_topups": "5",
            "pending_topups": "1",
            "approved_topups": "3",
            "rejected_topups": "1",
            "total_approved_amount": "1500.00"
        }
    }
}
```

### 3. ดูสถานะการเติมเงินรายการเดียว
```
GET /api/rider/topup/{topup_id}/status
Authorization: Bearer <JWT_TOKEN>
```

**หมายเหตุ:** ตรวจสอบว่าเป็นของไรเดอร์ที่เป็นเจ้าของ token เท่านั้น

## API สำหรับแอดมิน

### 1. ดูการเติมเงินทั้งหมด
```
GET /admin/topups/all
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### 2. ดูการเติมเงินที่รอการอนุมัติ
```
GET /admin/topups/pending
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### 3. ดูการเติมเงินที่อนุมัติแล้ว
```
GET /admin/topups/approved
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### 4. ดูการเติมเงินที่ถูกปฏิเสธ
```
GET /admin/topups/rejected
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### 5. อนุมัติ/ปฏิเสธการเติมเงิน
```
PUT /admin/topups/{topup_id}/approve
Authorization: Bearer <ADMIN_JWT_TOKEN>

Body:
{
    "status": "approved" | "rejected",
    "rejection_reason": "เหตุผลการปฏิเสธ (ถ้า status = rejected)"
}
```

**หมายเหตุ:** `admin_id` จะถูกดึงอัตโนมัติจาก JWT token

**Response (อนุมัติ):**
```json
{
    "success": true,
    "message": "อนุมัติการเติมเงินสำเร็จ",
    "data": {
        "topup_id": 1,
        "rider_id": 123,
        "amount": "500.00",
        "status": "approved",
        "admin_id": 1,
        "rejection_reason": null,
        "approved_at": "2025-01-15T11:00:00Z",
        "updated_at": "2025-01-15T11:00:00Z",
        "new_balance": "1500.00"
    }
}
```

### 6. ดูสถิติการเติมเงิน
```
GET /admin/topups/statistics
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

## การใช้งาน Bearer Token

### สำหรับไรเดอร์
```javascript
// เติมเงินแบบอัปโหลดไฟล์ (แนะนำ)
const formData = new FormData();
formData.append('amount', '500');
formData.append('slip', slipFile); // File object

const response = await fetch('/api/rider/topup', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${riderToken}`
        // ไม่ต้องระบุ Content-Type เพราะเป็น multipart/form-data
    },
    body: formData
});

// เติมเงินแบบส่ง URL (ทางเลือก)
const formDataUrl = new FormData();
formDataUrl.append('amount', '500');
formDataUrl.append('slip_url', 'https://res.cloudinary.com/.../slip.jpg');

const responseUrl = await fetch('/api/rider/topup', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${riderToken}`
    },
    body: formDataUrl
});

// ดูประวัติ
const history = await fetch('/api/rider/topup-history', {
    headers: {
        'Authorization': `Bearer ${riderToken}`
    }
});
```

### สำหรับแอดมิน
```javascript
// อนุมัติการเติมเงิน
const response = await fetch(`/admin/topups/${topupId}/approve`, {
    method: 'PUT',
    headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        status: 'approved'
    })
});

// ดูรายการที่รอการอนุมัติ
const pending = await fetch('/admin/topups/pending', {
    headers: {
        'Authorization': `Bearer ${adminToken}`
    }
});
```

## Routes ที่เพิ่มใหม่

### RiderAPIsRoute.js
```javascript
// Top-up Routes (ต้องการ authentication)
router.post('/topup', verifyRiderToken, upload.single('slip'), riderTopUp);
router.get('/topup-history', verifyRiderToken, getRiderTopUpHistory);
router.get('/topup/:topup_id/status', verifyRiderToken, getRiderTopUpStatus);
```

### AdminAPIsRoute.js
```javascript
// Top-up Management (ต้องการ admin authentication)
router.get('/topups/all', verifyToken, adminGetAllRiderTopUps);
router.get('/topups/pending', verifyToken, adminGetPendingRiderTopUps);
router.get('/topups/approved', verifyToken, adminGetApprovedRiderTopUps);
router.get('/topups/rejected', verifyToken, adminGetRejectedRiderTopUps);
router.put('/topups/:topup_id/approve', verifyToken, adminApproveRiderTopUp);
router.get('/topups/statistics', verifyToken, adminGetTopUpStatistics);
```

## การตรวจสอบและ Validation

### สำหรับไรเดอร์
- ตรวจสอบ JWT token และดึง rider_id
- ตรวจสอบจำนวนเงิน > 0
- ตรวจสอบการอัปโหลดสลิป
- ตรวจสอบว่าไรเดอร์มีสิทธิ์ในระบบ

### สำหรับแอดมิน
- ตรวจสอบ JWT token และดึง admin_id
- ตรวจสอบสิทธิ์แอดมิน
- ตรวจสอบสถานะที่ถูกต้อง
- บังคับใส่เหตุผลเมื่อปฏิเสธ
- ตรวจสอบว่าคำขอยังเป็น pending

## ความปลอดภัย (Security)

1. **JWT Token Validation**: ตรวจสอบ token ทุกครั้งก่อนเข้าถึง API
2. **Role-based Access**: แยกสิทธิ์ชัดเจนระหว่างไรเดอร์และแอดมิน
3. **Data Ownership**: ไรเดอร์เห็นเฉพาะข้อมูลของตนเอง
4. **Transaction Safety**: ใช้ BEGIN/COMMIT/ROLLBACK ป้องกันข้อมูลเสียหาย
5. **Input Validation**: ตรวจสอบข้อมูลอย่างละเอียดทุกขั้นตอน

## ข้อผิดพลาดที่อาจเกิดขึ้น

### Rider APIs
- `401 Unauthorized`: Token ไม่ถูกต้องหรือหมดอายุ
- `403 Forbidden`: ไม่มีสิทธิ์เป็นไรเดอร์
- `400 Bad Request`: ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง
- `404 Not Found`: ไม่พบรายการเติมเงินที่ระบุ

### Admin APIs
- `401 Unauthorized`: Token ไม่ถูกต้องหรือหมดอายุ
- `403 Forbidden`: ไม่มีสิทธิ์แอดมิน
- `400 Bad Request`: สถานะหรือข้อมูลไม่ถูกต้อง
- `404 Not Found`: ไม่พบการเติมเงินที่ระบุ

## สรุปการเปลี่ยนแปลง

1. **เพิ่มความปลอดภัย**: ใช้ JWT token แทนการส่ง ID ใน request
2. **ลดความผิดพลาด**: ไม่ต้องจำหรือส่ง rider_id/admin_id ผิด
3. **เพิ่มความสะดวก**: ระบบดึงข้อมูลจาก token อัตโนมัติ
4. **รองรับ Role-based**: แยกสิทธิ์ชัดเจนระหว่าง role ต่างๆ
5. **API ที่สะอาด**: Request body มีข้อมูลเฉพาะที่จำเป็นเท่านั้น

## การทดสอบ

```bash
# ไรเดอร์เติมเงิน
curl -X POST /api/rider/topup \
  -H "Authorization: Bearer YOUR_RIDER_TOKEN" \
  -F "amount=500" \
  -F "slip=@slip.jpg"

# แอดมินอนุมัติ
curl -X PUT /admin/topups/1/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'
```

ระบบนี้พร้อมใช้งานและมีความปลอดภัยสูงขึ้นด้วยการใช้ Bearer Token!