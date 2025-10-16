# ------------------------------
# 1️⃣ ใช้ Node.js official image
# ------------------------------
FROM node:18-alpine

# ------------------------------
# 2️⃣ ติดตั้ง timezone data
# ------------------------------
RUN apk add --no-cache tzdata

# ตั้งค่า timezone เป็น Bangkok
ENV TZ=Asia/Bangkok
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# ------------------------------
# 3️⃣ ตั้ง working directory
# ------------------------------
WORKDIR /app

# ✅ เปลี่ยนจาก / เป็น /app (ตามปกติ)
# เพราะ / อาจขัดแย้งกับ system directories

# ------------------------------
# 4️⃣ คัดลอก package.json และ package-lock.json
# ------------------------------
COPY package*.json ./

# ------------------------------
# 5️⃣ ติดตั้ง dependencies
# ------------------------------
RUN npm install --production
# ✅ --production หลีกเลี่ยง dev dependencies ทำให้ image เล็กลง

# ✅ ล้าง npm cache เพื่อลด image size
RUN npm cache clean --force

# ------------------------------
# 6️⃣ คัดลอกโค้ดทั้งหมดเข้า container
# ------------------------------
COPY . .

# ✅ ส่วน node_modules ที่ build จาก host ไม่จำเป็นถ้ามี .dockerignore
# .dockerignore ควรมี: node_modules .git .env .DS_Store

# ------------------------------
# 7️⃣ สร้าง non-root user (security best practice)
# ------------------------------
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

# ✅ ทำให้ safe กว่า เพราะไม่ใช้ root

# ------------------------------
# 8️⃣ ตั้งค่า port
# ------------------------------
EXPOSE 4000

# ✅ ตรงกับ port ที่ใช้ใน docker-compose (${PORT})

# ------------------------------
# 9️⃣ Health check
# ------------------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD npm run health || exit 1

# ✅ Optional: ถ้า project มี script "health" สำหรับ health check

# ✅ เทียบเคียงกับ docker-compose healthcheck

# ✅ ใช้ shell form ของ CMD เพื่อให้ signals ทำงาน
# ✅ ถ้าต้องการ exec form: CMD ["node", "src/index.js"]
CMD ["npm", "start"]