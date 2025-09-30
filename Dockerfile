# 1. ใช้ Node.js base image
FROM node:22.19.0

# 2. ตั้ง working directory
WORKDIR /

# 3. คัดลอกไฟล์ package และติดตั้ง dependency
COPY package*.json ./
RUN npm install --omit=dev

# 4. คัดลอกโค้ดทั้งหมดเข้า container
COPY . .

# 5. กำหนดพอร์ตที่ API ใช้ (เช่น 4000)
EXPOSE 4000

# 6. คำสั่งรัน API
CMD ["node", "index.js"]
