# Rider Credit System Documentation

## Overview
ระบบหักเครดิตไรเดอร์อัตโนมัติเมื่อรับงาน เพื่อให้แน่ใจว่าไรเดอร์มีเครดิตเพียงพอก่อนรับออเดอร์

## Database Schema

### rider_profiles
```sql
gp_balance NUMERIC(10,2) DEFAULT 0.00  -- เครดิตปัจจุบันของไรเดอร์
```

### orders  
```sql
rider_required_gp NUMERIC(10,2)  -- ค่าเครดิตที่ต้องหักเมื่อรับออเดอร์
```

## Credit Deduction Process

### 1. การทำงานของระบบ
```
1. ไรเดอร์กดรับงาน (assignRider API)
2. ระบบตรวจสอบเครดิตปัจจุบัน (rider_profiles.gp_balance)
3. ระบบดูค่าใช้จ่าย (orders.rider_required_gp)
4. คำนวณ: new_balance = current_balance - required_credit
5. ตรวจสอบว่า new_balance >= 0
6. หากเพียงพอ: หักเครดิตและรับงาน
7. หากไม่เพียงพอ: ปฏิเสธการรับงาน
```

### 2. Transaction Safety
- ใช้ PostgreSQL Transaction (BEGIN/COMMIT/ROLLBACK)
- Atomic operations ป้องกันการสูญเสียข้อมูล
- ตรวจสอบทุกขั้นตอนก่อน commit

## API Response

### Success Response
```json
{
  "success": true,
  "message": "Rider assigned successfully",
  "data": {
    "order_id": 123,
    "status": "rider_assigned",
    "rider_id": 456,
    "assigned_at": "2025-10-06T10:30:00Z",
    "credit_transaction": {
      "previous_balance": 100.00,
      "credit_deducted": 10.00,
      "new_balance": 90.00
    }
  }
}
```

### Insufficient Credit Error
```json
{
  "success": false,
  "error": "Insufficient credit",
  "required_credit": 10.00,
  "available_credit": 5.00,
  "shortage": 5.00
}
```

## Socket Events

### Real-time Credit Update
```json
{
  "order_id": 123,
  "status": "rider_assigned",
  "hasShop": true,
  "hasRider": true,
  "rider_id": 456,
  "market_id": 789,
  "timestamp": "2025-10-06T10:30:00Z",
  "credit_info": {
    "credit_deducted": 10.00,
    "new_balance": 90.00
  }
}
```

## Error Handling

### Common Errors:
1. **Rider profile not found**: rider_id ไม่มีในระบบ
2. **Order cost data not found**: order_id ไม่มีข้อมูลค่าใช้จ่าย
3. **Insufficient credit**: เครดิตไม่เพียงพอ
4. **Database transaction failed**: ข้อผิดพลาดในการอัปเดตข้อมูล

### Error Response Format:
```json
{
  "success": false,
  "error": "Error description",
  "required_credit": 10.00,
  "available_credit": 5.00,
  "shortage": 5.00
}
```

## Business Logic

### Credit Validation Rules:
1. **เครดิตต้องมากกว่าหรือเท่ากับค่าใช้จ่าย**
   - `rider_profiles.gp_balance >= orders.rider_required_gp`

2. **การหักเครดิตต้องทำในธุรกรรมเดียว**
   - อัปเดทออเดอร์และเครดิตพร้อมกัน
   - หากล้มเหลวจะ rollback ทั้งหมด

3. **Real-time notification**
   - ส่ง socket event ให้ไรเดอร์ทราบยอดเครดิตใหม่
   - แจ้งเตือนเมื่อเครดิตถูกหัก

## Database Queries

### Check Rider Credit:
```sql
SELECT gp_balance FROM rider_profiles WHERE rider_id = $1
```

### Check Order Cost:
```sql
SELECT rider_required_gp FROM orders WHERE order_id = $1
```

### Update Credit:
```sql
UPDATE rider_profiles 
SET gp_balance = $1 
WHERE rider_id = $2 
RETURNING gp_balance
```

### Assign Order:
```sql
UPDATE orders 
SET status = 'rider_assigned', 
    rider_id = $2, 
    updated_at = NOW()
WHERE order_id = $1
RETURNING *
```

## Testing Scenarios

### Scenario 1: Sufficient Credit
```
Current Balance: 100.00
Required Credit: 10.00
Result: ✅ Success, New Balance: 90.00
```

### Scenario 2: Insufficient Credit
```
Current Balance: 5.00
Required Credit: 10.00
Result: ❌ Error "Insufficient credit"
```

### Scenario 3: Exact Credit
```
Current Balance: 10.00
Required Credit: 10.00
Result: ✅ Success, New Balance: 0.00
```

## Integration Points

### Frontend Integration:
1. **แสดงเครดิตปัจจุบัน** ก่อนรับงาน
2. **แจ้งเตือนเครดิตไม่พอ** เมื่อพยายามรับงาน
3. **อัปเดทยอดเครดิต** real-time หลังรับงาน
4. **แสดงประวัติการหักเครดิต** ในหน้าจัดการเครดิต

### Backend Integration:
1. **Rider TopUp System**: เติมเครดิต
2. **Order Management**: ตั้งค่า rider_required_gp
3. **Analytics**: รายงานการใช้เครดิต
4. **Admin Panel**: จัดการเครดิตไรเดอร์

## Security Considerations

### Data Integrity:
- ใช้ NUMERIC(10,2) สำหรับความแม่นยำของตัวเลข
- Transaction isolation ป้องกัน race conditions
- Validation ที่หลายระดับ

### Audit Trail:
- Log ทุกการทำธุรกรรมเครดิต
- เก็บประวัติการเปลี่ยนแปลงยอดเครดิต
- ติดตาม timestamp ของทุกการทำงาน

## Performance Optimization

### Database Performance:
- Index บน rider_id และ order_id
- Connection pooling สำหรับ transactions
- Prepared statements ป้องกัน SQL injection

### Monitoring:
- Track การใช้เครดิตต่อวัน
- Alert เมื่อมีการทำธุรกรรมผิดปกติ
- Dashboard สำหรับติดตามสถิติ