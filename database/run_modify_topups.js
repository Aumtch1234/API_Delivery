const pool = require('../config/db');

async function modifyRiderTopupsTable() {
    try {
        console.log('🚀 เริ่มแก้ไขตาราง rider_topups...');
        
        // 1. เพิ่ม column rider_id
        console.log('📝 เพิ่ม column rider_id...');
        try {
            await pool.query('ALTER TABLE rider_topups ADD COLUMN rider_id INTEGER');
            console.log('✅ เพิ่ม column rider_id สำเร็จ');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  column rider_id มีอยู่แล้ว');
            } else {
                throw error;
            }
        }

        // 2. อัปเดตข้อมูล rider_id จาก rider_profiles
        console.log('🔄 อัปเดตข้อมูล rider_id...');
        const updateResult = await pool.query(`
            UPDATE rider_topups 
            SET rider_id = rp.rider_id
            FROM rider_profiles rp
            WHERE rider_topups.user_id = rp.user_id 
            AND rider_topups.rider_id IS NULL
        `);
        console.log(`✅ อัปเดต ${updateResult.rowCount} records`);

        // 3. เพิ่ม foreign key constraint
        console.log('🔗 เพิ่ม foreign key constraint...');
        try {
            await pool.query(`
                ALTER TABLE rider_topups 
                ADD CONSTRAINT rider_topups_rider_id_fkey 
                FOREIGN KEY (rider_id) REFERENCES rider_profiles(rider_id)
            `);
            console.log('✅ เพิ่ม foreign key constraint สำเร็จ');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  foreign key constraint มีอยู่แล้ว');
            } else {
                throw error;
            }
        }

        // 4. เพิ่ม index
        console.log('📊 เพิ่ม index...');
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_rider_topups_rider_id ON rider_topups(rider_id)');
            console.log('✅ เพิ่ม index สำเร็จ');
        } catch (error) {
            console.log('ℹ️  index มีอยู่แล้ว');
        }

        // 5. เพิ่ม comment
        console.log('💬 เพิ่ม comment...');
        await pool.query("COMMENT ON COLUMN rider_topups.rider_id IS 'รหัสไรเดอร์ (อ้างอิงจาก rider_profiles table)'");
        console.log('✅ เพิ่ม comment สำเร็จ');

        // 6. ตรวจสอบข้อมูล
        console.log('🔍 ตรวจสอบข้อมูล...');
        const checkResult = await pool.query(`
            SELECT 
                rt.topup_id,
                rt.user_id,
                rt.rider_id,
                rt.amount,
                rt.status,
                u.display_name,
                rp.id_card_number
            FROM rider_topups rt
            JOIN users u ON rt.user_id = u.user_id
            JOIN rider_profiles rp ON rt.rider_id = rp.rider_id
            ORDER BY rt.topup_id
        `);
        
        console.log('📋 ข้อมูลในตาราง:');
        console.table(checkResult.rows);

        console.log('🎉 แก้ไขตาราง rider_topups เสร็จสิ้น!');
        
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

modifyRiderTopupsTable();