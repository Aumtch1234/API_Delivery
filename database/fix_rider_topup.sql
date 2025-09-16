-- แก้ไข Foreign Key ใน rider_topups table
-- ลบ constraint เดิมที่อ้างอิงไปยัง rider_profiles
ALTER TABLE rider_topups DROP CONSTRAINT IF EXISTS rider_topups_rider_id_fkey;

-- เปลี่ยนชื่อ column เพื่อความชัดเจน (จาก rider_id เป็น user_id)
ALTER TABLE rider_topups RENAME COLUMN rider_id TO user_id;

-- เพิ่ม foreign key constraint ใหม่ที่อ้างอิงไปยัง users table
ALTER TABLE rider_topups 
ADD CONSTRAINT rider_topups_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- เพิ่ม index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_rider_topups_user_id ON rider_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_topups_status ON rider_topups(status);
CREATE INDEX IF NOT EXISTS idx_rider_topups_created_at ON rider_topups(created_at);

-- เพิ่ม comment อธิบาย
COMMENT ON COLUMN rider_topups.user_id IS 'รหัสผู้ใช้ที่เป็นไรเดอร์ (อ้างอิงจาก users table)';
COMMENT ON TABLE rider_topups IS 'ตารางเก็บข้อมูลการเติมเงิน GP ของไรเดอร์';