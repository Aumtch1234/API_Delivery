const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Starting database migration...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'fix_rider_topup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the migration
        await pool.query(sql);
        
        console.log('✅ Database migration completed successfully!');
        console.log('- rider_topups table updated');
        console.log('- Foreign key constraint fixed');
        console.log('- Column renamed from rider_id to user_id');
        console.log('- Indexes created for better performance');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Error details:', error);
    } finally {
        await pool.end();
    }
}

runMigration();