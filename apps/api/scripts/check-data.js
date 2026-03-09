/**
 * Check if tables have data
 */

const { Client } = require('pg');

async function checkData() {
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

    // Check energy_timeseries data count
    console.log('📊 Checking energy_timeseries data...');
    const energyCount = await client.query('SELECT COUNT(*) FROM energy_timeseries');
    console.log(`Total rows: ${energyCount.rows[0].count}`);

    if (parseInt(energyCount.rows[0].count) > 0) {
      const energySample = await client.query(`
        SELECT * FROM energy_timeseries
        ORDER BY timestamp DESC
        LIMIT 3;
      `);
      console.log('Latest 3 rows:');
      console.table(energySample.rows);

      const timeRange = await client.query(`
        SELECT
          MIN(timestamp) as earliest,
          MAX(timestamp) as latest
        FROM energy_timeseries;
      `);
      console.log('Time range:');
      console.table(timeRange.rows);
    }
    console.log('');

    // Check tag_data_raw data count
    console.log('📊 Checking tag_data_raw data...');
    const tagCount = await client.query('SELECT COUNT(*) FROM tag_data_raw');
    console.log(`Total rows: ${tagCount.rows[0].count}`);

    if (parseInt(tagCount.rows[0].count) > 0) {
      const tagSample = await client.query(`
        SELECT * FROM tag_data_raw
        ORDER BY timestamp DESC
        LIMIT 3;
      `);
      console.log('Latest 3 rows:');
      console.table(tagSample.rows);
    }
    console.log('');

    // Check energy_usage_1min data count
    console.log('📊 Checking energy_usage_1min data...');
    const caCount = await client.query('SELECT COUNT(*) FROM energy_usage_1min');
    console.log(`Total rows: ${caCount.rows[0].count}`);

    if (parseInt(caCount.rows[0].count) > 0) {
      const caSample = await client.query(`
        SELECT * FROM energy_usage_1min
        ORDER BY bucket DESC
        LIMIT 5;
      `);
      console.log('Latest 5 rows:');
      console.table(caSample.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkData();
