/**
 * Check database schema for energy-related tables
 */

const { Client } = require('pg');

async function checkSchema() {
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

    // Check energy_timeseries structure
    console.log('📋 Checking energy_timeseries columns...');
    const energyColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'energy_timeseries'
      ORDER BY ordinal_position;
    `);
    if (energyColumns.rows.length > 0) {
      console.table(energyColumns.rows);
    } else {
      console.log('⚠️  energy_timeseries has no columns or does not exist');
    }
    console.log('');

    // Check tag_data_raw structure
    console.log('📋 Checking tag_data_raw columns...');
    const tagColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tag_data_raw'
      ORDER BY ordinal_position;
    `);
    if (tagColumns.rows.length > 0) {
      console.table(tagColumns.rows);
    } else {
      console.log('⚠️  tag_data_raw has no columns or does not exist');
    }
    console.log('');

    // Check energy_usage_1min structure
    console.log('📋 Checking energy_usage_1min columns...');
    const caColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'energy_usage_1min'
      ORDER BY ordinal_position;
    `);
    if (caColumns.rows.length > 0) {
      console.table(caColumns.rows);
    } else {
      console.log('⚠️  energy_usage_1min has no columns or does not exist');
    }
    console.log('');

    // Check continuous aggregate definition
    console.log('🔍 Checking energy_usage_1min definition...');
    const caDef = await client.query(`
      SELECT view_definition
      FROM information_schema.views
      WHERE table_name = 'energy_usage_1min';
    `);
    if (caDef.rows.length > 0) {
      console.log('✅ View definition:');
      console.log(caDef.rows[0].view_definition);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
