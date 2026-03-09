import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'ifems',
  user: 'postgres',
  password: '1',
});

async function main() {
  await client.connect();

  console.log('🔄 Refreshing Continuous Aggregates...\n');

  // 1. cagg_usage_1min refresh (최근 1시간)
  console.log('📊 Refreshing cagg_usage_1min (last 1 hour)...');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const now = new Date();

  await client.query(
    `CALL refresh_continuous_aggregate('cagg_usage_1min', '${oneHourAgo.toISOString()}', '${now.toISOString()}');`
  );

  console.log(`✅ Refreshed: ${oneHourAgo.toISOString()} ~ ${now.toISOString()}\n`);

  // 2. cagg_usage_1min_corrected view 조회 (테스트)
  console.log('🔍 Querying cagg_usage_1min_corrected...');
  const result = await client.query(`
    SELECT
      bucket,
      "tagId",
      "facilityId",
      energy_type,
      raw_usage_diff,
      reset_correction,
      corrected_usage_diff,
      data_count,
      reset_times
    FROM cagg_usage_1min_corrected
    WHERE bucket >= $1 AND bucket < $2
    ORDER BY bucket DESC
    LIMIT 10;
  `, [oneHourAgo.toISOString(), now.toISOString()]);

  console.log(`Found ${result.rows.length} rows:\n`);
  result.rows.forEach((row) => {
    console.log(`  ${row.bucket.toISOString()} | usage: ${row.raw_usage_diff} | correction: ${row.reset_correction} | corrected: ${row.corrected_usage_diff}`);
  });

  await client.end();
}

main().catch(console.error);
