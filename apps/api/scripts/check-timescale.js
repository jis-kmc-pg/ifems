/**
 * Check TimescaleDB setup and hypertables
 */

const { Client } = require('pg');

async function checkTimescale() {
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

    // Check TimescaleDB extension
    console.log('📦 Checking TimescaleDB extension...');
    const extResult = await client.query(`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';
    `);
    if (extResult.rows.length > 0) {
      console.log('✅ TimescaleDB extension installed:', extResult.rows[0]);
    } else {
      console.log('❌ TimescaleDB extension NOT installed');
    }
    console.log('');

    // Check hypertables
    console.log('📊 Checking hypertables...');
    const hypertableResult = await client.query(`
      SELECT hypertable_schema, hypertable_name, num_dimensions
      FROM timescaledb_information.hypertables;
    `);
    if (hypertableResult.rows.length > 0) {
      console.log('✅ Hypertables found:');
      console.table(hypertableResult.rows);
    } else {
      console.log('⚠️  No hypertables found');
    }
    console.log('');

    // Check if energy_timeseries is a hypertable
    console.log('🔍 Checking energy_timeseries table...');
    const tableResult = await client.query(`
      SELECT
        tablename,
        schemaname
      FROM pg_tables
      WHERE tablename = 'energy_timeseries';
    `);

    if (tableResult.rows.length > 0) {
      console.log('✅ energy_timeseries table exists');

      const isHypertable = await client.query(`
        SELECT * FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'energy_timeseries';
      `);

      if (isHypertable.rows.length > 0) {
        console.log('✅ energy_timeseries IS a hypertable');
      } else {
        console.log('❌ energy_timeseries is NOT a hypertable (required for Continuous Aggregates)');
      }
    } else {
      console.log('❌ energy_timeseries table does NOT exist');
    }
    console.log('');

    // Check existing continuous aggregates
    console.log('📈 Checking existing continuous aggregates...');
    const caResult = await client.query(`
      SELECT view_name, view_schema, materialized_only
      FROM timescaledb_information.continuous_aggregates;
    `);
    if (caResult.rows.length > 0) {
      console.log('✅ Continuous aggregates found:');
      console.table(caResult.rows);
    } else {
      console.log('⚠️  No continuous aggregates found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTimescale();
