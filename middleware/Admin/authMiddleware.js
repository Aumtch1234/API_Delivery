// middlewares/auth.js
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });

    console.log("JWT payload:", user); // ✅ ดูว่า payload มีอะไรบ้าง
    req.user = user;
    next();
  });
};

exports.requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  const isAdmin = req.user?.is_admin === true;

  // ยอมรับทั้ง role แบบเก่าและ flag is_admin
  if (isAdmin || role === "admin" || role === "m_admin") return next();

  return res.status(403).json({ message: "Forbidden: admin only" });
};
