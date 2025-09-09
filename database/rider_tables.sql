-- ตารางที่อยู่ของไรเดอร์ (rider_addresses)
CREATE TABLE public.rider_addresses (
    address_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    house_number TEXT,
    street TEXT,
    subdistrict TEXT NOT NULL,  -- ตำบล
    district TEXT NOT NULL,     -- อำเภอ
    province TEXT NOT NULL,     -- จังหวัด
    postal_code TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rider_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- ตารางข้อมูลไรเดอร์ (rider_profiles)
CREATE TABLE public.rider_profiles (
    rider_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    
    -- ข้อมูลบัตรประชาชน
    id_card_number TEXT NOT NULL UNIQUE,
    id_card_photo_url TEXT NOT NULL,        -- รูปถ่ายบัตรประชาชน
    id_card_selfie_url TEXT NOT NULL,       -- รูปถ่ายคู่บัตรประชาชน
    
    -- ข้อมูลใบขับขี่
    driving_license_number TEXT NOT NULL UNIQUE,
    driving_license_photo_url TEXT NOT NULL, -- รูปใบขับขี่
    
    -- ข้อมูลรถ
    vehicle_type TEXT NOT NULL DEFAULT 'motorcycle', -- ประเภทรถ (ตอนนี้มีแค่ motorcycle)
    vehicle_brand_model TEXT NOT NULL,       -- ยี่ห้อ/รุ่นรถ
    vehicle_color TEXT NOT NULL,             -- สีรถ
    vehicle_registration_number TEXT NOT NULL, -- หมายเลขทะเบียนรถ
    vehicle_registration_province TEXT NOT NULL, -- จังหวัดที่ออกทะเบียนรถ
    vehicle_photo_url TEXT NOT NULL,         -- รูปถ่ายรถ
    vehicle_registration_photo_url TEXT NOT NULL, -- รูปคู่มือทะเบียนรถ
    
    -- สถานะการอนุมัติ
    approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
    approved_by INTEGER,                     -- admin ที่อนุมัติ
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    rejection_reason TEXT,
    
    -- วันที่สร้างและอัปเดต
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_rider_profiles_user_id FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rider_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES public.admins(id),
    CONSTRAINT chk_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_vehicle_type CHECK (vehicle_type IN ('motorcycle')),
    CONSTRAINT unique_vehicle_registration UNIQUE (vehicle_registration_number, vehicle_registration_province)
);

-- ดัชนี (Indexes) สำหรับการค้นหาที่รวดเร็ว
CREATE INDEX idx_rider_addresses_user_id ON public.rider_addresses(user_id);
CREATE INDEX idx_rider_addresses_province ON public.rider_addresses(province);
CREATE INDEX idx_rider_addresses_district ON public.rider_addresses(district, province);
CREATE INDEX idx_rider_profiles_user_id ON public.rider_profiles(user_id);
CREATE INDEX idx_rider_profiles_approval_status ON public.rider_profiles(approval_status);
CREATE INDEX idx_rider_profiles_id_card_number ON public.rider_profiles(id_card_number);
CREATE INDEX idx_rider_profiles_driving_license_number ON public.rider_profiles(driving_license_number);
CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles(vehicle_registration_number);
CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles(vehicle_registration_province);

-- ฟังก์ชันสำหรับอัปเดต updated_at อัตโนมัติ (ถ้ายังไม่มี)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger สำหรับอัปเดต updated_at อัตโนมัติ
CREATE TRIGGER update_rider_addresses_updated_at 
    BEFORE UPDATE ON public.rider_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_profiles_updated_at 
    BEFORE UPDATE ON public.rider_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment สำหรับอธิบายตาราง
COMMENT ON TABLE public.rider_addresses IS 'ตารางเก็บที่อยู่ของไรเดอร์';
COMMENT ON TABLE public.rider_profiles IS 'ตารางเก็บข้อมูลไรเดอร์ที่ต้องการยืนยันตัวตน';

COMMENT ON COLUMN public.rider_addresses.subdistrict IS 'ตำบล';
COMMENT ON COLUMN public.rider_addresses.district IS 'อำเภอ';
COMMENT ON COLUMN public.rider_addresses.province IS 'จังหวัด';

COMMENT ON COLUMN public.rider_profiles.id_card_photo_url IS 'รูปถ่ายบัตรประชาชน';
COMMENT ON COLUMN public.rider_profiles.id_card_selfie_url IS 'รูปถ่ายคู่บัตรประชาชน';
COMMENT ON COLUMN public.rider_profiles.driving_license_photo_url IS 'รูปใบขับขี่';
COMMENT ON COLUMN public.rider_profiles.vehicle_photo_url IS 'รูปถ่ายรถ';
COMMENT ON COLUMN public.rider_profiles.vehicle_registration_photo_url IS 'รูปคู่มือทะเบียนรถ';
COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';
COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';
COMMENT ON COLUMN public.rider_profiles.vehicle_type IS 'ประเภทรถ (ปัจจุบันรองรับแค่ motorcycle)';
