const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM, // deliveryku65@gmail.com
    pass: process.env.EMAIL_PASS, // App Password 16 ตัว
  },
});

async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'รหัส OTP สำหรับยืนยันอีเมลของคุณ',
    text: `รหัส OTP ของคุณคือ: ${otp} (ใช้ได้ภายใน 5 นาที)`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP] Sent OTP to: ${toEmail} | OTP: ${otp} | MessageId: ${info.messageId}`);
  } catch (error) {
    console.error(`[OTP ERROR] Failed to send OTP to ${toEmail}:`, error);
    throw error; // ให้ error หลุดไปจับที่ controller
  }
}

module.exports = { sendOtpEmail };
