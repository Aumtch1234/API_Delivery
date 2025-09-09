-- เพิ่มคอลัมน์ข้อมูลทะเบียนรถในตาราง rider_profiles
ALTER TABLE public.rider_profiles 
ADD COLUMN vehicle_registration_number TEXT NOT NULL DEFAULT '',
ADD COLUMN vehicle_registration_province TEXT NOT NULL DEFAULT '';

-- เพิ่ม index สำหรับการค้นหาทะเบียนรถ
CREATE INDEX idx_rider_profiles_vehicle_registration ON public.rider_profiles(vehicle_registration_number);
CREATE INDEX idx_rider_profiles_vehicle_province ON public.rider_profiles(vehicle_registration_province);

-- เพิ่ม constraint เพื่อป้องกันทะเบียนรถซ้ำ
ALTER TABLE public.rider_profiles 
ADD CONSTRAINT unique_vehicle_registration 
UNIQUE (vehicle_registration_number, vehicle_registration_province);

-- เพิ่ม comment อธิบายคอลัมน์ใหม่
COMMENT ON COLUMN public.rider_profiles.vehicle_registration_number IS 'หมายเลขทะเบียนรถ (ตัวอักษรและตัวเลข เช่น กก-1234)';
COMMENT ON COLUMN public.rider_profiles.vehicle_registration_province IS 'จังหวัดที่ออกทะเบียนรถ';

-- หากต้องการลบ default constraint หลังจากอัปเดตข้อมูลเก่าแล้ว
-- ALTER TABLE public.rider_profiles ALTER COLUMN vehicle_registration_number DROP DEFAULT;
-- ALTER TABLE public.rider_profiles ALTER COLUMN vehicle_registration_province DROP DEFAULT;
