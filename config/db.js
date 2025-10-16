const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('connect', (client) => {
  client.query("SET TIMEZONE TO 'Asia/Bangkok'");
  console.log('🕐 PostgreSQL timezone set to Asia/Bangkok');
});

module.exports = pool;
