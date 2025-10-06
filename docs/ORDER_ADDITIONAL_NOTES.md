# Order Items Additional Notes Documentation

## Overview
เพิ่มความสามารถในการเก็บรายละเอียดเพิ่มเติมของแต่ละเมนูที่ลูกค้าสั่ง เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง

## Database Changes

### New Column Added
```sql
ALTER TABLE public.order_items 
ADD COLUMN additional_notes TEXT DEFAULT '';

COMMENT ON COLUMN public.order_items.additional_notes IS 'รายละเอียดเพิ่มเติมของแต่ละเมนู เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง';
```

### Table Structure
```sql
-- ตาราง order_items หลังการแก้ไข
CREATE TABLE public.order_items (
    item_id integer NOT NULL,
    order_id integer,
    food_id integer,
    food_name text,
    quantity integer,
    sell_price numeric(10,2),
    subtotal numeric(10,2),
    selected_options jsonb DEFAULT '[]'::jsonb,
    original_price numeric(10,2),
    original_subtotal numeric(10,2),
    original_options jsonb DEFAULT '[]'::jsonb,
    additional_notes TEXT DEFAULT ''  -- ← คอลัมน์ใหม่
);
```

## API Changes

### 1. POST /orders (Create Order)

**Request Body Update:**
```json
{
  "basket": [
    {
      "cart_id": 123,
      "market_id": 1,
      "food_id": 26,
      "food_name": "กระเพราะมังสวิรัติ",
      "quantity": 1,
      "sell_price": 64.00,
      "selected_options": [
        {
          "label": "ไซส์หรับ",
          "extraPrice": 12
        }
      ],
      "additional_notes": "ไม่ใส่ผักชี, เผ็ดน้อย, ไข่ดาวไม่สุก"  // ← เพิ่มใหม่
    }
  ],
  "address_id": 10,
  "address": "123 ถนนสุขุมวิท",
  "deliveryType": "แบบ/วางไว้จุดที่ระบุ",
  "paymentMethod": "เงินสด",
  "note": "โทรก่อนถึง",
  "distances": {"1": 2.5},
  "deliveryFees": {"1": 25.00},
  "totalPrices": {"1": 101.00}
}
```

**Field Description:**
- `additional_notes` (string, optional): รายละเอียดเพิ่มเติมของแต่ละเมนู
  - ตัวอย่าง: "ไม่ใส่ผักชี, เผ็ดน้อย", "ไม่ใส่น้ำแข็ง", "เพิ่มเนื้อ"
  - หากไม่ระบุจะเป็นค่าว่าง ""

### 2. GET /orders/:order_id (Get Order Status)

**Response Update:**
```json
{
  "success": true,
  "order": {
    "order_id": 205,
    "market_id": 38,
    "status": "waiting",
    "total_price": 86.00,
    "delivery_fee": 10.00,
    "items": [
      {
        "item_id": 17,
        "food_id": 26,
        "food_name": "กระเพราะมังสวิรัติ",
        "quantity": 1,
        "sell_price": 64.00,
        "subtotal": 76.00,
        "selected_options": [
          {
            "label": "ไซส์หรับ",
            "extraPrice": 12
          }
        ],
        "additional_notes": "ไม่ใส่ผักชี, เผ็ดน้อย"  // ← เพิ่มใหม่
      }
    ]
  }
}
```

### 3. GET /orders/customer (Get Customer Orders)

**Response Update:**
```json
{
  "success": true,
  "data": [
    {
      "order_id": 205,
      "market_id": 38,
      "market_name": "ร้าน รายแรง",
      "status": "waiting",
      "total_price": 86.00,
      "created_at": "2025-10-06T10:30:00Z",
      "items": [
        {
          "item_id": 17,
          "food_id": 26,
          "food_name": "กระเพราะมังสวิรัติ",
          "quantity": 1,
          "sell_price": 64.00,
          "subtotal": 76.00,
          "selected_options": [
            {
              "label": "ไซส์หรับ",
              "extraPrice": 12
            }
          ],
          "additional_notes": "ไม่ใส่ผักชี, เผ็ดน้อย"  // ← เพิ่มใหม่
        }
      ]
    }
  ]
}
```

## Frontend Integration

### 1. Cart/Basket Data Structure
```typescript
interface CartItem {
  cart_id?: number;
  market_id: number;
  food_id: number;
  food_name: string;
  quantity: number;
  sell_price: number;
  selected_options: Array<{
    label: string;
    extraPrice: number;
  }>;
  additional_notes?: string;  // ← เพิ่มใหม่
}
```

### 2. UI Components

**Input Field for Additional Notes:**
```jsx
// React Component Example
<div className="additional-notes">
  <label>รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
  <textarea
    value={item.additional_notes || ''}
    onChange={(e) => updateItemNotes(item.food_id, e.target.value)}
    placeholder="เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง"
    maxLength={500}
    rows={2}
  />
</div>
```

**Display in Order Summary:**
```jsx
// Order Item Display
<div className="order-item">
  <h4>{item.food_name}</h4>
  <p>จำนวน: {item.quantity}</p>
  <p>ราคา: {item.subtotal} บาท</p>
  
  {item.selected_options?.length > 0 && (
    <div className="options">
      <strong>ตัวเลือก:</strong>
      {item.selected_options.map(opt => opt.label).join(', ')}
    </div>
  )}
  
  {item.additional_notes && (
    <div className="additional-notes">
      <strong>หรายละเอียดเพิ่มเติม:</strong> {item.additional_notes}
    </div>
  )}
</div>
```

## Use Cases

### ตัวอย่างการใช้งาน:

1. **เมนูอาหาร:**
   - "ไม่ใส่ผักชี, เผ็ดน้อย"
   - "เพิ่มเนื้อ, ไข่ดาวไม่สุก"
   - "ไม่ใส่หอมใหญ่"

2. **เครื่องดื่ม:**
   - "ไม่ใส่น้ำแข็ง"
   - "หวานน้อย, น้ำแข็งน้อย"
   - "เปลี่ยนเป็นนมอัลมอนด์"

3. **ของหวาน:**
   - "ไม่ใส่วิปครีม"
   - "เพิ่มช็อกโกแลต"
   - "ไม่ใส่สีเขียว"

## Validation Rules

### Frontend Validation:
- Maximum length: 500 characters
- Allow empty string (not required)
- Trim whitespace before sending

### Backend Validation:
- Store as TEXT type (unlimited length)
- Default value: empty string ""
- No special validation required

## Database Migration

### Run Migration:
```bash
# Run the SQL script to add the new column
psql -d your_database -f database/add_additional_notes_column.sql
```

### Verify Migration:
```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
  AND column_name = 'additional_notes';
```

## Benefits

✅ **Enhanced Customer Experience**: ลูกค้าสามารถระบุความต้องการเฉพาะได้  
✅ **Better Order Accuracy**: ร้านทราบรายละเอียดที่ลูกค้าต้องการ  
✅ **Flexible System**: รองรับความต้องการที่หลากหลาย  
✅ **Optional Field**: ไม่บังคับกรอก ไม่กระทบระบบเดิม  
✅ **Backward Compatible**: ระบบเดิมยังใช้งานได้ปกติ  

## Testing

### Test Cases:
1. **Order with additional notes**: สร้างออเดอร์พร้อมรายละเอียดเพิ่มเติม
2. **Order without additional notes**: สร้างออเดอร์โดยไม่มีรายละเอียดเพิ่มเติม
3. **Get order with notes**: ดึงข้อมูลออเดอร์ที่มีรายละเอียดเพิ่มเติม
4. **Long text notes**: ทดสอบข้อความยาว
5. **Special characters**: ทดสอบอักขระพิเศษ

### Sample Test Data:
```json
{
  "additional_notes": "ไม่ใส่ผักชี, เผ็ดน้อย, ไข่ดาวไม่สุก, เพิ่มเนื้อ"
}
```