const crypto = require('crypto');
const db = require('../../config/db'); // ใช้ PostgreSQL หรือ MongoDB ตามที่คุณใช้
const { sendOtpEmail } = require('../../utils/Client/mailer');

const otpStore = {}; // หรือใช้ Redis แทนใน production

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'ต้องระบุอีเมล' });

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  otpStore[email] = { otp, expiresAt };

  console.log(`[OTP] Sending OTP to: ${email} | OTP: ${otp} | Expires At: ${new Date(expiresAt).toISOString()}`);

  try {
    await sendOtpEmail(email, otp);
    return res.json({ success: true, message: 'ส่ง OTP แล้ว' });
  } catch (err) {
    console.error(`[OTP ERROR] Failed to send OTP to ${email}:`, err);
    return res.status(500).json({ success: false, message: 'ส่งอีเมลไม่สำเร็จ', error: err.message });
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'กรอกอีเมลและ OTP' });

  const data = otpStore[email];
  if (!data) {
    console.warn(`[OTP] OTP not found for email: ${email}`);
    return res.status(400).json({ message: 'ไม่มี OTP นี้ในระบบ' });
  }

  const { otp: validOtp, expiresAt } = data;

  if (Date.now() > expiresAt) {
    console.warn(`[OTP] OTP expired for email: ${email}`);
    return res.status(400).json({ message: 'OTP หมดอายุแล้ว' });
  }

  if (otp !== validOtp) {
    console.warn(`[OTP] Incorrect OTP for ${email} | Received: ${otp} | Expected: ${validOtp}`);
    return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' });
  }

  try {
    await db.query('UPDATE users SET is_verified = true WHERE email = $1', [email]);
    console.log(`[OTP] OTP verified and user updated: ${email}`);

    delete otpStore[email];

    return res.json({ success: true, message: 'ยืนยัน OTP และอัปเดตสถานะแล้ว' });
  } catch (err) {
    console.error(`[DB ERROR] Failed to update is_verified for ${email}:`, err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดตข้อมูล', error: err.message });
  }
};
