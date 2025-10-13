const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// === 📂 ตรวจสอบและสร้างโฟลเดอร์ uploads ถ้ายังไม่มี ===
const uploadDir = path.join(__dirname, "../../uploads/complaints");
if (!fs.existsSync(uploadDir)) {
  console.log("📁 Creating folder:", uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
}

// === ⚙️ ตั้งค่า Multer สำหรับอัปโหลดไฟล์หลักฐาน ===
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const fileName = `complaint-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}${path.extname(file.originalname)}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowed = [   "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/pjpeg",
      "image/jfif",
      "image/pjpg",
      "image/x-png",
      "application/octet-stream" // สำหรับบางเครื่องที่ไม่ส่ง mimetype
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("ประเภทไฟล์ไม่ถูกต้อง (อนุญาตเฉพาะ jpg, png, webp)"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === 📨 POST: ส่งคำร้องเรียน ===
router.post("/", upload.single("evidence"), async (req, res) => {
  const { user_id, rider_id, market_id, role, subject, message } = req.body;

  const evidenceUrl = req.file
    ? `/uploads/complaints/${req.file.filename}`
    : null;

  if (!role || !subject || !message) {
    return res
      .status(400)
      .json({ error: "❌ ข้อมูลไม่ครบ กรุณากรอกให้ครบทุกช่อง" });
  }

  try {
    let validUserId = user_id ? parseInt(user_id) : null;
    let validRiderId = rider_id ? parseInt(rider_id) : null;
    let validMarketId = market_id ? parseInt(market_id) : null;

    console.log("🧠 Received complaint:", {
      user_id,
      rider_id,
      market_id,
      role,
      subject,
      message,
      file: evidenceUrl,
    });

    // === ดึง market_id ถ้า role เป็น market แล้วไม่ได้ส่งมา ===
    if (role === "market" && !validMarketId && validUserId) {
      const resMarket = await pool.query(
        "SELECT market_id FROM markets WHERE owner_id = $1 LIMIT 1",
        [validUserId]
      );
      if (resMarket.rows.length > 0) {
        validMarketId = resMarket.rows[0].market_id;
        console.log("📦 Auto-assigned market_id:", validMarketId);
      } else {
        console.warn("⚠️ ไม่พบ market_id ของผู้ใช้:", validUserId);
      }
    }

    // === ดึง rider_id ถ้า role เป็น rider แล้วไม่ได้ส่งมา ===
    if (role === "rider" && !validRiderId && validUserId) {
      const resRider = await pool.query(
        "SELECT rider_id FROM rider_profiles WHERE user_id = $1 LIMIT 1",
        [validUserId]
      );
      if (resRider.rows.length > 0) {
        validRiderId = resRider.rows[0].rider_id;
        console.log("📦 Auto-assigned rider_id:", validRiderId);
      } else {
        console.warn("⚠️ ไม่พบ rider_id ของผู้ใช้:", validUserId);
      }
    }

    // === เพิ่มคำร้องเรียนลงฐานข้อมูล ===
    const insertQuery = `
  INSERT INTO public.complaints 
    (user_id, rider_id, market_id, role, subject, message, evidence_url, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
  RETURNING *;
`;

    const result = await pool.query(insertQuery, [
      validUserId,
      validRiderId,
      validMarketId,
      role,
      subject,
      message,
      evidenceUrl,
    ]);

    console.log("✅ Complaint inserted successfully:", result.rows[0]);

    res.status(200).json({
      message: "✅ ส่งคำร้องเรียนสำเร็จ",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error inserting complaint:", err);

    // แยกประเภท Error เพื่อ debug ง่ายขึ้น
    if (err.code === "23503") {
      res.status(400).json({
        error: "⚠️ Foreign key ผิดพลาด (user_id / rider_id / market_id ไม่ถูกต้อง)",
      });
    } else if (err.code === "42P01") {
      res.status(500).json({
        error: "❌ ตาราง complaints ไม่พบในฐานข้อมูล",
      });
    } else {
      res.status(500).json({ error: `❌ ${err.message}` });
    }
  }
});

// === 🧾 GET: ดึงคำร้องเรียนทั้งหมด (สำหรับแอดมิน) ===
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        u.display_name AS user_name,
        u.email AS email,
        u.role AS user_role,
        m.shop_name AS market_name,
        owner.display_name AS owner_name,     -- ✅ เพิ่มชื่อเจ้าของร้าน
        ur.display_name AS rider_name         -- ✅ ชื่อไรเดอร์จาก users
      FROM public.complaints c
      LEFT JOIN public.users u ON c.user_id = u.user_id
      LEFT JOIN public.markets m ON c.market_id = m.market_id
      LEFT JOIN public.users owner ON m.owner_id = owner.user_id  -- ✅ ดึงชื่อเจ้าของร้าน
      LEFT JOIN public.rider_profiles r ON c.rider_id = r.rider_id
      LEFT JOIN public.users ur ON r.user_id = ur.user_id
      ORDER BY c.created_at DESC;
    `;

    const { rows } = await pool.query(query);

    console.log(`📋 Complaints fetched: ${rows.length} rows`);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching all complaints:", err);

    if (err.code === "42P01") {
      res.status(500).json({ error: "❌ ตาราง complaints ไม่พบในฐานข้อมูล" });
    } else if (err.code === "42703") {
      res.status(500).json({
        error: `❌ คอลัมน์ที่ระบุไม่ถูกต้อง (${err.message})`,
      });
    } else {
      res
        .status(500)
        .json({ error: `❌ เกิดข้อผิดพลาดไม่ทราบสาเหตุ: ${err.message}` });
    }
  }
});
// === 🛠️ PATCH: อัปเดตสถานะการตรวจสอบคำร้อง ===
router.patch("/:complaint_id", async (req, res) => {
  const { complaint_id } = req.params;
  const { status } = req.body;

  if (!["pending", "checked"].includes(status)) {
    return res.status(400).json({ error: "สถานะไม่ถูกต้อง (pending/checked)" });
  }

  try {
    const result = await pool.query(
      "UPDATE public.complaints SET status = $1 WHERE complaint_id = $2 RETURNING *",
      [status, complaint_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "ไม่พบคำร้องเรียนที่ระบุ" });
    }

    res.json({
      message: "✅ อัปเดตสถานะสำเร็จ",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error updating complaint status:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดขณะอัปเดตสถานะ" });
  }
});


// === 🧾 GET: ดึงคำร้องเรียนของ user ตาม user_id (เฉพาะของตัวเอง) ===
router.get("/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const query = `
      SELECT 
        c.*,
        u.display_name AS user_name,
        u.role AS user_role,
        m.shop_name AS market_name,
        owner.display_name AS owner_name,
        ur.display_name AS rider_name
      FROM public.complaints c
      LEFT JOIN public.users u ON c.user_id = u.user_id
      LEFT JOIN public.markets m ON c.market_id = m.market_id
      LEFT JOIN public.users owner ON m.owner_id = owner.user_id
      LEFT JOIN public.rider_profiles r ON c.rider_id = r.rider_id
      LEFT JOIN public.users ur ON r.user_id = ur.user_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC;
    `;
    const { rows } = await pool.query(query, [user_id]);

    console.log(`👤 User ${user_id} complaints fetched: ${rows.length}`);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching user complaints:", err);

    if (err.code === "42P01") {
      res.status(500).json({ error: "❌ ตาราง complaints ไม่พบในฐานข้อมูล" });
    } else {
      res.status(500).json({ error: `❌ ${err.message}` });
    }
  }
});

module.exports = router;
