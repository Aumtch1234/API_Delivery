# Reviews System Documentation

## Overview
ระบบรีวิวใหม่ที่ปลอดภัยและใช้งานง่าย โดยดึง `marketId` และ `riderId` จาก JWT token โดยอัตโนมัติ

## Security Improvements ✅

### ก่อนการปรับปรุง:
```
GET /reviews/for/markets/:marketId  (ไม่ปลอดภัย - ใส่ marketId ใดก็ได้)
GET /reviews/for/riders/:riderId    (ไม่ปลอดภัย - ใส่ riderId ใดก็ได้)
```

### หลังการปรับปรุง:
```
GET /reviews/for/markets  (ปลอดภัย - marketId จาก token เท่านั้น)
GET /reviews/for/riders   (ปลอดภัย - riderId จาก token เท่านั้น)
```

## API Endpoints

### 1. Market Reviews (สำหรับเจ้าของร้าน)
```http
GET /reviews/for/markets
Authorization: Bearer <jwt_token>
Query Parameters:
  - limit (optional): จำนวนรีวิวต่อหน้า (default: 20, max: 50)
  - offset (optional): เริ่มจากรีวิวที่ (default: 0)
```

**Response:**
```json
{
  "ok": true,
  "market_summary": {
    "market_id": 1,
    "shop_name": "ร้านอาหารดี",
    "rating_avg": 4.5,
    "reviews_count": 10,
    "rating_5": 5,
    "rating_4": 3,
    "rating_3": 1,
    "rating_2": 1,
    "rating_1": 0
  },
  "items": [
    {
      "order_id": 123,
      "review_id": 1,
      "rating": 5,
      "comment": "อร่อยมาก บริการดี",
      "created_at": "2025-01-01T10:00:00Z",
      "reviewer_name": "คุณลูกค้า",
      "reviewer_photo": "https://...",
      "user_id": 456
    }
  ],
  "paging": {"limit": 20, "offset": 0},
  "authenticated_user": 789
}
```

### 2. Rider Reviews (สำหรับไรเดอร์)
```http
GET /reviews/for/riders
Authorization: Bearer <jwt_token>
Query Parameters:
  - limit (optional): จำนวนรีวิวต่อหน้า (default: 20, max: 50)
  - offset (optional): เริ่มจากรีวิวที่ (default: 0)
```

### 3. Create Market Review (สำหรับลูกค้า)
```http
POST /reviews/market
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "order_id": 123,
  "rating": 5,
  "comment": "อร่อยมาก บริการดี"
}
```

### 4. Create Rider Review (สำหรับลูกค้า)
```http
POST /reviews/rider
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "order_id": 123,
  "rating": 5,
  "comment": "ส่งเร็ว สุภาพ"
}
```

### 5. Get Order Reviews (ตรวจสอบรีวิวของออเดอร์)
```http
GET /reviews/orders/:orderId/for-user
Authorization: Bearer <jwt_token>
```

## Middleware Architecture

### 1. reviewsAuth.js
- `getMarketFromToken`: ตรวจสอบว่า user เป็นเจ้าของร้านและดึง marketId
- `getRiderFromToken`: ตรวจสอบว่า user เป็นไรเดอร์และดึง riderId

### 2. Authentication Flow
```
1. Client ส่ง JWT token
2. authenticateJWT middleware ตรวจสอบ token
3. getMarketFromToken ตรวจสอบ markets.approve = true และดึง marketId
4. getRiderFromToken ตรวจสอบ rider_profiles.approval_status = 'approved' และดึง riderId  
5. Controller ใช้ ID ที่ได้จาก middleware
```

## Security Features

✅ **Token-based Authentication**: ทุก API ต้องใช้ JWT token  
✅ **Ownership Verification**: ตรวจสอบความเป็นเจ้าของจาก database  
✅ **Approval Status Check**: ตรวจสอบสถานะอนุมัติของร้าน (approve = true) และไรเดอร์ (approval_status = 'approved')  
✅ **SQL Injection Protection**: ใช้ parameterized queries  
✅ **Input Validation**: ตรวจสอบข้อมูลครบถ้วน  

## Error Handling

### Common Error Codes:
- **401**: Token ไม่ถูกต้องหรือหายไป
- **403**: ไม่ใช่เจ้าของร้าน/ไรเดอร์ หรือยังไม่ได้รับการอนุมัติ
- **400**: ข้อมูลไม่ครบถ้วนหรือ format ผิด
- **500**: Server error

### Error Response Example:
```json
{
  "error": "User is not a market owner or market is not approved",
  "detail": "..."
}
```

## Database Requirements

### Tables Required:
- `markets`: ต้องมี `owner_id` และ `approve` columns (approve = true)
- `rider_profiles`: ต้องมี `user_id` และ `approval_status` columns (approval_status = 'approved')
- `market_reviews`: สำหรับรีวิวร้าน
- `rider_reviews`: สำหรับรีวิวไรเดอร์

### Database Schema:
```sql
-- markets table
CREATE TABLE public.markets (
    market_id integer NOT NULL,
    owner_id integer,
    shop_name text NOT NULL,
    approve boolean DEFAULT false,  -- ใช้สำหรับตรวจสอบการอนุมัติ
    ...
);

-- rider_profiles table  
CREATE TABLE public.rider_profiles (
    rider_id integer NOT NULL,
    user_id integer NOT NULL,
    approval_status text DEFAULT 'pending'::text, -- 'approved', 'pending', 'rejected'
    ...
);
```

## Flutter Client Usage

```dart
// Market Owner - ดูรีวิวร้านของตัวเอง
final reviews = await ReviewsService.getMyMarketReviews(
  token: userToken,
  limit: 20,
  offset: 0,
);

// Rider - ดูรีวิวการส่งของของตัวเอง
final reviews = await ReviewsService.getMyRiderReviews(
  token: userToken,
  limit: 20,
  offset: 0,
);

// Customer - สร้างรีวิว
final result = await ReviewsService.createMarketReview(
  orderId: 123,
  rating: 5,
  comment: 'อร่อยมาก',
  token: userToken,
);
```

## Benefits

🚀 **Improved Security**: ไม่สามารถดูรีวิวของร้าน/ไรเดอร์อื่นได้  
📱 **Simplified UI**: ไม่ต้องส่ง marketId/riderId จาก frontend  
🔒 **Better Authorization**: ตรวจสอบสิทธิ์ที่ database level  
⚡ **Performance**: ลด parameter validation ใน frontend  
🛡️ **Data Privacy**: ปกป้องข้อมูลรีวิวของแต่ละร้าน/ไรเดอร์  

## Migration Notes

### สำหรับ Frontend:
- เปลี่ยนจาก `/reviews/for/markets/:marketId` เป็น `/reviews/for/markets`
- เปลี่ยนจาก `/reviews/for/riders/:riderId` เป็น `/reviews/for/riders`
- ไม่ต้องส่ง marketId/riderId ใน URL หรือ query parameters

### สำหรับ Backend:
- เพิ่ม middleware ใหม่สำหรับ authentication
- ปรับ controller ให้ใช้ข้อมูลจาก middleware
- อัปเดต routes ให้ใช้ middleware ใหม่