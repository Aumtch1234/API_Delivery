require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const cron = require('node-cron');
const authRoutes = require('./routes/APIsRoute');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (modifier === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();

    const result = await pool.query('SELECT market_id, open_time, close_time, is_open, is_manual_override, override_until FROM markets');

    for (const market of result.rows) {
      if (!market.open_time || !market.close_time) {
        console.log(`[Cron] ร้าน ${market.market_id} ไม่มีข้อมูลเวลาเปิดหรือปิด`);
        continue;
      }

      let skipUpdate = false;

      if (market.is_manual_override) {
        if (market.override_until && now > new Date(market.override_until)) {
          await pool.query('UPDATE markets SET is_manual_override = false, override_until = NULL WHERE market_id = $1', [market.market_id]);
          console.log(`[Cron] ยกเลิก override ร้าน ${market.market_id} เนื่องจากหมดเวลา`);
        } else {
          skipUpdate = true;
          console.log(`[Cron] ร้าน ${market.market_id} อยู่ในช่วง override, ข้ามการอัปเดต`);
        }
      }

      if (!skipUpdate) {
        const { hours: openHour, minutes: openMinute } = convertTo24Hour(market.open_time);
        const { hours: closeHour, minutes: closeMinute } = convertTo24Hour(market.close_time);

        const openDate = new Date(now);
        openDate.setHours(openHour, openMinute, 0, 0);

        const closeDate = new Date(now);
        closeDate.setHours(closeHour, closeMinute, 0, 0);

        let shouldOpen = false;

        if (closeDate <= openDate) {
          // กรณีข้ามคืน
          if (now >= openDate || now <= closeDate) {
            shouldOpen = true;
          }
        } else {
          if (now >= openDate && now <= closeDate) {
            shouldOpen = true;
          }
        }

        if (market.is_open !== shouldOpen) {
          await pool.query('UPDATE markets SET is_open = $1 WHERE market_id = $2', [shouldOpen, market.market_id]);
          console.log(`[Cron] ร้าน ${market.market_id} เปลี่ยนสถานะ is_open เป็น ${shouldOpen}`);
        }
      }
    }

    console.log(`[Cron] จบการทำงานของ cron job รอบนี้ เวลา: ${now.toISOString()}\n\n`);
  } catch (error) {
    console.error(`[Cron] เกิดข้อผิดพลาดในการอัปเดตสถานะร้าน:`, error);
  }
});


const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';  // ฟังทุก interface
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Email user:', process.env.EMAIL_FROM);
  console.log('Email pass length:', process.env.EMAIL_PASS?.length);

});
