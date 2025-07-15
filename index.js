const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/APIsRoute');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);


const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';  // ฟังทุก interface
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
