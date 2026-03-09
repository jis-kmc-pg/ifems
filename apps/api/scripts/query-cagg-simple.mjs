/**
 * Simple Continuous Aggregate Query (Refresh 없이)
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
    console.log('✅ Connected\n');

    // USAGE 데이터 조회
    console.log('📈 USAGE Continuous Aggregate (최근 10개):');
    const usageResult = await client.query(`
SELECT
  to_char(bucket, 'HH24:MI:SS') as time,
  "tagId",
  ROUND(first_value::numeric, 2) as first_val,
  ROUND(last_value::numeric, 2) as last_val,
  ROUND(raw_usage_diff::numeric, 2) as diff,
  data_count as count
FROM cagg_usage_1min
ORDER BY bucket DESC
LIMIT 10;
    `);

    console.table(usageResult.rows);

    // TREND 데이터 조회
    console.log('\n⚡ TREND Continuous Aggregate (최근 10개):');
    const trendResult = await client.query(`
SELECT
  to_char(bucket, 'HH24:MI:SS') as time,
  "tagId",
  ROUND(last_value::numeric, 2) as last_val,
  data_count as count
FROM cagg_trend_10sec
ORDER BY bucket DESC
LIMIT 10;
    `);

    console.table(trendResult.rows);

    // SENSOR 데이터 조회
    console.log('\n🌡️  SENSOR Continuous Aggregate (최근 10개):');
    const sensorResult = await client.query(`
SELECT
  to_char(bucket, 'HH24:MI:SS') as time,
  "tagId",
  ROUND(avg_value::numeric, 2) as avg,
  ROUND(min_value::numeric, 2) as min,
  ROUND(max_value::numeric, 2) as max,
  data_count as count
FROM cagg_sensor_10sec
ORDER BY bucket DESC
LIMIT 10;
    `);

    console.table(sensorResult.rows);

    // 전체 통계
    console.log('\n📊 Summary:');
    const summary = await client.query(`
SELECT 'USAGE' as type, COUNT(*) as buckets FROM cagg_usage_1min
UNION ALL
SELECT 'TREND', COUNT(*) FROM cagg_trend_10sec
UNION ALL
SELECT 'SENSOR', COUNT(*) FROM cagg_sensor_10sec;
    `);

    console.table(summary.rows);

    console.log('\n🎉 Query completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
