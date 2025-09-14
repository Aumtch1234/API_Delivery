const axios = require('axios');
const pool = require('../../config/db');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

exports.Distance = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { basket } = req.body || [];

        console.log('Headers:', req.headers);
        console.log('User from token:', req.user);
        console.log('Basket received:', basket);



        if (!basket || !basket.length) {
            return res.status(400).json({ success: false, message: 'Basket is empty' });
        }

        // ดึงที่อยู่หลักลูกค้า
        const customerResult = await pool.query(
            'SELECT latitude, longitude FROM client_addresses WHERE user_id = $1 AND set_address = true LIMIT 1',
            [userId]
        );

        if (!customerResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Customer default address not found' });
        }

        const customer = customerResult.rows[0];

        // ดึง marketId ทั้งหมดไม่ซ้ำ
        // กรอง marketId ซ้ำ
        const marketIds = [...new Set(basket.map(item => item.marketId))];

        // ดึงข้อมูลร้าน
        const markets = {};
        for (const marketId of marketIds) {
            const marketResult = await pool.query(
                'SELECT latitude, longitude, shop_name FROM markets WHERE market_id = $1',
                [marketId]
            );
            if (marketResult.rows.length) {
                markets[marketId] = marketResult.rows[0];
            }
        }

        // สร้าง destinations string
        const destinations = marketIds.map(id => `${markets[id].latitude},${markets[id].longitude}`).join('|');

        // เรียก Distance Matrix API ครั้งเดียว
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${customer.latitude},${customer.longitude}&destinations=${destinations}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;

        const response = await axios.get(url);
        const data = response.data;
        console.log('DistanceMatrix API response:', data);

        // map ผลลัพธ์
        const results = [];
        data.rows[0].elements.forEach((element, index) => {
            const marketId = marketIds[index];
            if (element.status === 'OK') {
                results.push({
                    marketId,
                    storeName: markets[marketId].shop_name,
                    distance: (element.distance.value / 1000).toFixed(2) + ' km',
                    duration: Math.round(element.duration.value / 60) + ' นาที',
                });
                console.log(element)
            }
        });

        res.json({ success: true, data: results });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

