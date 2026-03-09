/**
 * Check Facility table and its relationship with other tables
 */

const { Client } = require('pg');

async function checkFacilities() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1',
    database: 'ifems',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database: ifems\n');

    // Check Facility table structure
    console.log('📋 Checking Facility table columns...');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Facility'
      ORDER BY ordinal_position;
    `);
    if (columns.rows.length > 0) {
      console.table(columns.rows);
    } else {
      console.log('⚠️  Facility table does not exist');
      return;
    }
    console.log('');

    // Check sample Facility data
    console.log('📊 Checking Facility data...');
    const facilities = await client.query(`
      SELECT * FROM "Facility"
      LIMIT 10;
    `);
    if (facilities.rows.length > 0) {
      console.log(`Total facilities: ${facilities.rowCount}`);
      console.table(facilities.rows);
    }
    console.log('');

    // Check if HNK10-060 or HNK10_060 exists
    console.log('🔍 Searching for HNK10-060 or HNK10_060...');
    const search1 = await client.query(`
      SELECT * FROM "Facility"
      WHERE code LIKE '%HNK10%060%' OR name LIKE '%HNK10%060%';
    `);
    if (search1.rows.length > 0) {
      console.log('✅ Found matching facilities:');
      console.table(search1.rows);
    } else {
      console.log('❌ No facilities matching HNK10-060 or HNK10_060');
    }
    console.log('');

    // Check Facility count
    const count = await client.query('SELECT COUNT(*) FROM "Facility"');
    console.log(`📊 Total Facility count: ${count.rows[0].count}`);

    // Check Line table
    console.log('\n📋 Checking Line table...');
    const lines = await client.query(`
      SELECT * FROM "Line"
      LIMIT 5;
    `);
    if (lines.rows.length > 0) {
      console.table(lines.rows);
    }

    // Check FacilityTag relationship
    console.log('\n📋 Checking FacilityTag table...');
    const facilityTags = await client.query(`
      SELECT * FROM "FacilityTag"
      LIMIT 10;
    `);
    if (facilityTags.rows.length > 0) {
      console.log('✅ FacilityTag table exists:');
      console.table(facilityTags.rows);
    } else {
      console.log('⚠️  FacilityTag table is empty or does not exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkFacilities();
