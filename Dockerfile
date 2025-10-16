# ------------------------------
# 1️⃣ ใช้ Node.js official image
# ------------------------------
FROM node:18-alpine

# ------------------------------
# 2️⃣ ตั้ง working directory
# ------------------------------
WORKDIR /

RUN apt-get update && apt-get install -y tzdata && \
    ln -snf /usr/share/zoneinfo/Asia/Bangkok /etc/localtime && \
    echo "Asia/Bangkok" > /etc/timezone
# ------------------------------
# 3️⃣ คัดลอก package.json และ package-lock.json
# ------------------------------
COPY package*.json ./

# ------------------------------
# 4️⃣ ติดตั้ง dependencies
# ------------------------------
RUN npm install --production

# ------------------------------
# 5️⃣ คัดลอกโค้ดทั้งหมดเข้า container
# ------------------------------
COPY . .

# ------------------------------
# 6️⃣ ตั้งค่า port (API คุณใช้ 4000)
# ------------------------------
EXPOSE 4000

# ------------------------------
# 7️⃣ คำสั่งเริ่ม API
# ------------------------------
CMD ["npm", "start"]
