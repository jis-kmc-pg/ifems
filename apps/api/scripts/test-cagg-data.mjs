/**
 * Continuous Aggregate 데이터 테스트
 */
import pg from 'pg';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'ifems',
  user: 'postgres',
  password: '1',
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to ifems\n');
    console.log('━'.repeat(80));

    // 1. Refresh Continuous Aggregates
    console.log('\n📊 Step 1: Refreshing Continuous Aggregates...');

    await client.query(`CALL refresh_continuous_aggregate('cagg_usage_1min', NULL, NULL);`);
    console.log('✅ cagg_usage_1min refreshed');

    await client.query(`CALL refresh_continuous_aggregate('cagg_trend_10sec', NULL, NULL);`);
    console.log('✅ cagg_trend_10sec refreshed');

    await client.query(`CALL refresh_continuous_aggregate('cagg_sensor_10sec', NULL, NULL);`);
    console.log('✅ cagg_sensor_10sec refreshed');

    // 2. Query USAGE data
    console.log('\n━'.repeat(80));
    console.log('\n📈 Step 2: Query USAGE data (최근 5분)');

    const usageResult = await client.query(`
SELECT
  bucket,
  "tagId",
  "facilityId",
  first_value,
  last_value,
  raw_usage_diff,
  data_count
FROM cagg_usage_1min
WHERE bucket >= NOW() - INTERVAL '5 minutes'
ORDER BY bucket DESC
LIMIT 5;
    `);

    if (usageResult.rows.length > 0) {
      console.table(usageResult.rows);
    } else {
      console.log('⚠️ No data found');
    }

    // 3. Query TREND data
    console.log('\n━'.repeat(80));
    console.log('\n⚡ Step 3: Query TREND data (최근 1분)');

    const trendResult = await client.query(`
SELECT
  bucket,
  "tagId",
  last_value,
  data_count
FROM cagg_trend_10sec
WHERE bucket >= NOW() - INTERVAL '1 minute'
ORDER BY bucket DESC
LIMIT 5;
    `);

    if (trendResult.rows.length > 0) {
      console.table(trendResult.rows);
    } else {
      console.log('⚠️ No data found');
    }

    // 4. Query SENSOR data
    console.log('\n━'.repeat(80));
    console.log('\n🌡️  Step 4: Query SENSOR data (최근 1분)');

    const sensorResult = await client.query(`
SELECT
  bucket,
  "tagId",
  sensor_name,
  ROUND(avg_value::numeric, 2) as avg_value,
  ROUND(min_value::numeric, 2) as min_value,
  ROUND(max_value::numeric, 2) as max_value,
  data_count
FROM cagg_sensor_10sec
WHERE bucket >= NOW() - INTERVAL '1 minute'
ORDER BY bucket DESC
LIMIT 5;
    `);

    if (sensorResult.rows.length > 0) {
      console.table(sensorResult.rows);
    } else {
      console.log('⚠️ No data found');
    }

    // 5. Corrected USAGE view
    console.log('\n━'.repeat(80));
    console.log('\n🔄 Step 5: Query USAGE with reset correction (최근 5분)');

    const correctedResult = await client.query(`
SELECT
  bucket,
  "tagId",
  raw_usage_diff,
  reset_correction,
  corrected_usage_diff,
  data_count
FROM cagg_usage_1min_corrected
WHERE bucket >= NOW() - INTERVAL '5 minutes'
ORDER BY bucket DESC
LIMIT 5;
    `);

    if (correctedResult.rows.length > 0) {
      console.table(correctedResult.rows);
    } else {
      console.log('⚠️ No data found');
    }

    // 6. Summary
    console.log('\n━'.repeat(80));
    console.log('\n📊 Summary:');

    const summaryResult = await client.query(`
SELECT
  'USAGE' as type,
  COUNT(*) as total_buckets,
  MIN(bucket) as earliest,
  MAX(bucket) as latest
FROM cagg_usage_1min
UNION ALL
SELECT
  'TREND' as type,
  COUNT(*) as total_buckets,
  MIN(bucket) as earliest,
  MAX(bucket) as latest
FROM cagg_trend_10sec
UNION ALL
SELECT
  'SENSOR' as type,
  COUNT(*) as total_buckets,
  MIN(bucket) as earliest,
  MAX(bucket) as latest
FROM cagg_sensor_10sec;
    `);

    console.table(summaryResult.rows);

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
