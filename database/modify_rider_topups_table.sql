-- คำสั่งแก้ไขตาราง rider_topups เพื่อเพิ่ม rider_id column
-- และปรับปรุงข้อมูลให้ตรงกับ rider_profiles

-- 1. เพิ่ม column rider_id ในตาราง rider_topups
ALTER TABLE rider_topups 
ADD COLUMN rider_id INTEGER;

-- 2. อัปเดตข้อมูล rider_id จาก rider_profiles table
UPDATE rider_topups 
SET rider_id = rp.rider_id
FROM rider_profiles rp
WHERE rider_topups.user_id = rp.user_id;

-- 3. เพิ่ม foreign key constraint สำหรับ rider_id
ALTER TABLE rider_topups 
ADD CONSTRAINT rider_topups_rider_id_fkey 
FOREIGN KEY (rider_id) REFERENCES rider_profiles(rider_id);

-- 4. เพิ่ม index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_rider_topups_rider_id ON rider_topups(rider_id);

-- 5. เพิ่ม comment อธิบาย
COMMENT ON COLUMN rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)';

-- 6. รีเซ็ต sequence ให้เริ่มจาก 1
ALTER SEQUENCE rider_topups_topup_id_seq RESTART WITH 1;

-- 7. ลบข้อมูลเก่าทั้งหมด (หากต้องการ)
TRUNCATE TABLE rider_topups RESTART IDENTITY CASCADE;

-- 8. เพิ่มข้อมูลตัวอย่างใหม่ พร้อม rider_id
INSERT INTO rider_topups (user_id, rider_id, amount, slip_url, status, created_at, updated_at) VALUES
(33, 8, 100.00, 'https://res.cloudinary.com/djqdn2zru/image/upload/v1757943216/rider-topup-slips/fcunitujzs187gcd2tnr.png', 'pending', NOW(), NOW()),
(33, 8, 200.00, 'https://example.com/slip2.png', 'approved', NOW(), NOW()),
(33, 8, 150.00, 'https://example.com/slip3.png', 'rejected', NOW(), NOW());

-- 9. ตรวจสอบข้อมูลที่เพิ่ม
SELECT 
    rt.topup_id,
    rt.user_id,
    rt.rider_id,
    rt.amount,
    rt.slip_url,
    rt.status,
    rt.created_at,
    u.display_name,
    u.phone,
    rp.id_card_number
FROM rider_topups rt
JOIN users u ON rt.user_id = u.user_id
JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
ORDER BY rt.topup_id;

-- 10. ตรวจสอบโครงสร้างตาราง
\d rider_topups;