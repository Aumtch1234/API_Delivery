const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../../utils/Rider/cloudinary');

// อัพเดตข้อมูล rider เบอร์โทรphone
exports.updateRiderPhone = async (req, res) => {
    const { phone } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!phone) {
        return res.status(400).json({
            error: 'กรุณากรอกเบอร์โทรศัพท์'
        });
    }

    // ตรวจสอบรูปแบบเบอร์โทรศัพท์ (10 หลัก)
    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
        return res.status(400).json({
            error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก)'
        });
    }

    try {
        // ตรวจสอบว่าเบอร์โทรนี้ถูกใช้แล้วหรือไม่
        const existingPhone = await pool.query(
            'SELECT user_id FROM users WHERE phone = $1 AND user_id != $2',
            [phone, req.user.user_id]
        );

        if (existingPhone.rows.length > 0) {
            return res.status(400).json({
                error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว'
            });
        }

        // อัพเดตเบอร์โทรศัพท์ในฐานข้อมูล phone อยู่ในตาราง users
        await pool.query(
            'UPDATE users SET phone = $1 WHERE user_id = $2',
            [phone, req.user.user_id]
        );

        res.json({
            message: 'อัพเดตเบอร์โทรศัพท์สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating rider phone:', error);
        res.status(500).json({
            error: 'เกิดข้อผิดพลาดในการอัพเดตเบอร์โทรศัพท์'
        });
    }
};

// อัพเดตข้อมูล rider หมายเลข PromptPay
exports.updateRiderPromptPay = async (req, res) => {
    const { promptpay } = req.body;
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!promptpay) {
        return res.status(400).json({
            error: 'กรุณากรอกหมายเลข PromptPay'
        });
    }

    // ตรวจสอบรูปแบบ PromptPay (เบอร์โทร 10 หลัก หรือ เลขบัตรประชาชน 13 หลัก)
    const phonePattern = /^[0-9]{10}$/;
    const idCardPattern = /^[0-9]{13}$/;
    
    if (!phonePattern.test(promptpay) && !idCardPattern.test(promptpay)) {
        return res.status(400).json({
            error: 'รูปแบบ PromptPay ไม่ถูกต้อง (ต้องเป็นเบอร์โทร 10 หลัก หรือ เลขบัตรประชาชน 13 หลัก)'
        });
    }

    try {
        // ตรวจสอบว่า PromptPay นี้ถูกใช้แล้วหรือไม่
        const existingPromptPay = await pool.query(
            'SELECT user_id FROM rider_profiles WHERE promptpay = $1 AND user_id != $2',
            [promptpay, req.user.user_id]
        );

        if (existingPromptPay.rows.length > 0) {
            return res.status(400).json({
                error: 'หมายเลข PromptPay นี้ถูกใช้งานแล้ว'
            });
        }

        // อัพเดตหมายเลข PromptPay ในฐานข้อมูล rider_profiles
        const result = await pool.query(
            'UPDATE rider_profiles SET promptpay = $1 WHERE user_id = $2',
            [promptpay, req.user.user_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'ไม่พบข้อมูลไรเดอร์ กรุณาส่งเอกสารยืนยันตัวตนก่อน'
            });
        }

        res.json({
            message: 'อัพเดตหมายเลข PromptPay สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating rider promptpay:', error);
        res.status(500).json({
            error: 'เกิดข้อผิดพลาดในการอัพเดตหมายเลข PromptPay'
        });
    }
};

// อัพเดตข้อมูล เพศ
exports.updateRiderGender = async (req, res) => {
    const { gender } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (gender === undefined || gender === null) {
        return res.status(400).json({
            error: 'กรุณากรอกเพศ'
        });
    }

    // ตรวจสอบค่าเพศที่ถูกต้อง (0 = ชาย, 1 = หญิง, 2 = อื่นๆ)
    if (![0, 1, 2].includes(parseInt(gender))) {
        return res.status(400).json({
            error: 'ค่าเพศไม่ถูกต้อง (0 = ชาย, 1 = หญิง, 2 = อื่นๆ)'
        });
    }

    try {
        // อัพเดตเพศในฐานข้อมูล users
        await pool.query(
            'UPDATE users SET gender = $1 WHERE user_id = $2',
            [parseInt(gender), req.user.user_id]
        );

        const genderText = {0: 'ชาย', 1: 'หญิง', 2: 'อื่นๆ'}[parseInt(gender)];
        res.json({
            message: `อัพเดตเพศเป็น ${genderText} สำเร็จ`
        });
    } catch (error) {
        console.error('Error updating rider gender:', error);
        res.status(500).json({
            error: 'เกิดข้อผิดพลาดในการอัพเดตเพศ'
        });
    }
};

// อัพเดตข้อมูล วันเกิด
exports.updateRiderBirthdate = async (req, res) => {
    const { birthdate } = req.body;
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!birthdate) {
        return res.status(400).json({
            error: 'กรุณากรอกวันเกิด'
        });
    }

    // ตรวจสอบรูปแบบวันที่ (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(birthdate)) {
        return res.status(400).json({
            error: 'รูปแบบวันเกิดไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)'
        });
    }

    // ตรวจสอบว่าเป็นวันที่ที่ถูกต้อง
    const date = new Date(birthdate);
    if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== birthdate) {
        return res.status(400).json({
            error: 'วันเกิดไม่ถูกต้อง'
        });
    }

    // ตรวจสอบอายุ (ต้องมีอายุอย่างน้อย 18 ปี)
    // const today = new Date();
    // const age = today.getFullYear() - date.getFullYear();
    // const monthDiff = today.getMonth() - date.getMonth();
    
    // if (age < 18 || (age === 18 && monthDiff < 0) || 
    //     (age === 18 && monthDiff === 0 && today.getDate() < date.getDate())) {
    //     return res.status(400).json({
    //         error: 'ต้องมีอายุอย่างน้อย 18 ปี'
    //     });
    // }

    try {
        // อัพเดตวันเกิดในฐานข้อมูล users
        await pool.query(
            'UPDATE users SET birthdate = $1 WHERE user_id = $2',
            [birthdate, req.user.user_id]
        );

        res.json({
            message: 'อัพเดตวันเกิดสำเร็จ'
        });
    }
    catch (error) {
        console.error('Error updating rider birthdate:', error);
        return res.status(500).json({
            error: 'เกิดข้อผิดพลาดในการอัพเดตวันเกิด'
        });
    }
};

// อัพเดตข้อมูล รูปโปรไฟล์
exports.updateRiderPhoto = async (req, res) => {
    try {
        let photo_url = null;

        // ตรวจสอบว่ามีการอัปโหลดไฟล์หรือไม่
        if (req.file) {
            // อัปโหลดรูปภาพไปยัง Cloudinary
            const uploadResult = await uploadToCloudinary(req.file.buffer, 'rider-profiles');
            photo_url = uploadResult.secure_url;
        } else if (req.body.photo_url) {
            // รองรับการส่ง URL มาตรง ๆ (สำหรับ backward compatibility)
            photo_url = req.body.photo_url;

            // ตรวจสอบรูปแบบ URL
            try {
                new URL(photo_url);
            } catch (e) {
                return res.status(400).json({
                    error: 'รูปแบบ URL ไม่ถูกต้อง'
                });
            }

            // ตรวจสอบว่าเป็น URL ของ Cloudinary หรือไม่
            if (!photo_url.includes('cloudinary.com') && !photo_url.includes('res.cloudinary.com')) {
                return res.status(400).json({
                    error: 'กรุณาใช้ URL รูปภาพจาก Cloudinary เท่านั้น'
                });
            }
        } else {
            return res.status(400).json({
                error: 'กรุณาอัปโหลดรูปโปรไฟล์หรือส่ง photo_url'
            });
        }

        // อัพเดตรูปโปรไฟล์ในฐานข้อมูล users
        await pool.query(
            'UPDATE users SET photo_url = $1 WHERE user_id = $2',
            [photo_url, req.user.user_id]
        );

        res.json({
            message: 'อัพเดตรูปโปรไฟล์สำเร็จ',
            photo_url: photo_url
        });
    } catch (error) {
        console.error('Error updating rider photo:', error);
        
        // จัดการ error ของ Cloudinary
        if (error.message && error.message.includes('cloudinary')) {
            return res.status(400).json({
                error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง'
            });
        }
        
        res.status(500).json({
            error: 'เกิดข้อผิดพลาดในการอัพเดตรูปโปรไฟล์'
        });
    }
};
