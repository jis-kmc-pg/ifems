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

  // 1. Reset event 확인
  console.log('📋 Reset Events:\n');
  const resets = await client.query(`
    SELECT id, tag_id, reset_time, value_before_reset, value_after_reset, correction_applied
    FROM meter_reset_events
    ORDER BY reset_time DESC
    LIMIT 5;
  `);

  resets.rows.forEach((r) => {
    console.log(`  ${r.reset_time.toISOString()} | tag: ${r.tag_id.substring(0, 8)}... | ${r.value_before_reset} → ${r.value_after_reset} | applied: ${r.correction_applied}`);
  });

  if (resets.rows.length === 0) {
    console.log('  ❌ No reset events found');
    await client.end();
    return;
  }

  const resetEvent = resets.rows[0];
  const resetTime = new Date(resetEvent.reset_time);
  const tagId = resetEvent.tag_id;

  console.log(`\n🔍 Debugging reset at ${resetTime.toISOString()} for tag ${tagId.substring(0, 8)}...\n`);

  // 2. 해당 시간대의 cagg_usage_1min 확인
  console.log('📊 cagg_usage_1min (base view):\n');
  const baseView = await client.query(`
    SELECT bucket, "tagId", raw_usage_diff, data_count
    FROM cagg_usage_1min
    WHERE "tagId" = $1
      AND bucket >= $2 - INTERVAL '5 minutes'
      AND bucket <= $2 + INTERVAL '5 minutes'
    ORDER BY bucket DESC;
  `, [tagId, resetTime]);

  if (baseView.rows.length === 0) {
    console.log('  ❌ No data in cagg_usage_1min');
  } else {
    baseView.rows.forEach((r) => {
      const isResetBucket = r.bucket >= resetTime && r.bucket < new Date(resetTime.getTime() + 60000);
      console.log(`  ${r.bucket.toISOString()} | usage: ${r.raw_usage_diff} | count: ${r.data_count} ${isResetBucket ? '← RESET BUCKET' : ''}`);
    });
  }

  // 3. cagg_usage_1min_corrected 확인
  console.log('\n📈 cagg_usage_1min_corrected (with JOIN):\n');
  const correctedView = await client.query(`
    SELECT bucket, "tagId", raw_usage_diff, reset_correction, corrected_usage_diff, data_count, reset_times
    FROM cagg_usage_1min_corrected
    WHERE "tagId" = $1
      AND bucket >= $2 - INTERVAL '5 minutes'
      AND bucket <= $2 + INTERVAL '5 minutes'
    ORDER BY bucket DESC;
  `, [tagId, resetTime]);

  if (correctedView.rows.length === 0) {
    console.log('  ❌ No data in cagg_usage_1min_corrected');
  } else {
    correctedView.rows.forEach((r) => {
      const isResetBucket = r.bucket >= resetTime && r.bucket < new Date(resetTime.getTime() + 60000);
      console.log(`  ${r.bucket.toISOString()} | raw: ${r.raw_usage_diff} | correction: ${r.reset_correction} | corrected: ${r.corrected_usage_diff} ${isResetBucket ? '← RESET BUCKET' : ''}`);
      if (r.reset_times && r.reset_times.length > 0) {
        console.log(`    Reset times: ${r.reset_times.map(t => new Date(t).toISOString()).join(', ')}`);
      }
    });
  }

  // 4. JOIN 조건 직접 테스트
  console.log('\n🔬 Testing JOIN condition directly:\n');
  const joinTest = await client.query(`
    SELECT
      u.bucket,
      u."tagId",
      r.reset_time,
      r.value_before_reset,
      r.reset_time >= u.bucket as cond1,
      r.reset_time < u.bucket + INTERVAL '1 minute' as cond2,
      r.correction_applied as cond3
    FROM cagg_usage_1min u
    LEFT JOIN meter_reset_events r
      ON u."tagId" = r.tag_id
    WHERE u."tagId" = $1
      AND u.bucket >= $2 - INTERVAL '5 minutes'
      AND u.bucket <= $2 + INTERVAL '5 minutes'
    ORDER BY u.bucket DESC;
  `, [tagId, resetTime]);

  joinTest.rows.forEach((r) => {
    if (r.reset_time) {
      console.log(`  Bucket: ${r.bucket.toISOString()}`);
      console.log(`  Reset: ${r.reset_time.toISOString()}`);
      console.log(`  Conditions: reset >= bucket? ${r.cond1}, reset < bucket+1min? ${r.cond2}, correction_applied? ${r.cond3}`);
      console.log(`  Match: ${r.cond1 && r.cond2 && r.cond3 ? '✅ YES' : '❌ NO'}`);
      console.log('');
    }
  });

  await client.end();
}

main().catch(console.error);
