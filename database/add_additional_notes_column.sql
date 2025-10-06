-- เพิ่มคอลัมน์ additional_notes ในตาราง order_items
-- เพื่อเก็บรายละเอียดเพิ่มเติมของแต่ละเมนูที่สั่ง

ALTER TABLE public.order_items 
ADD COLUMN additional_notes TEXT DEFAULT '';

-- เพิ่ม comment อธิบายการใช้งาน
COMMENT ON COLUMN public.order_items.additional_notes IS 'รายละเอียดเพิ่มเติมของแต่ละเมนู เช่น ไม่ใส่ผักชี, เผ็ดน้อย, ไม่ใส่น้ำแข็ง';

-- ตัวอย่างการใช้งาน:
-- UPDATE order_items SET additional_notes = 'ไม่ใส่ผักชี, เผ็ดน้อย' WHERE item_id = 1;