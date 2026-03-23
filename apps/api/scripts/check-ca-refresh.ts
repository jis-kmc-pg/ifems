import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. CA 리프레시 정책 확인
  console.log('=== CA Refresh Policies ===');
  const jobs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT job_id, application_name, schedule_interval::text,
      config::text, next_start::text
    FROM timescaledb_information.jobs
    WHERE proc_name = 'policy_refresh_continuous_aggregate'
    ORDER BY job_id;
  `);
  for (const j of jobs) {
    console.log(`  Job ${j.job_id}: ${j.application_name}`);
    console.log(`    interval: ${j.schedule_interval}, next: ${j.next_start}`);
    console.log(`    last_status: ${j.last_run_status}, duration: ${j.last_run_duration}`);
    console.log(`    config: ${j.config}`);
  }
  if (jobs.length === 0) console.log('  ⚠️ No refresh policies found!');

  // 2. 각 CA 최근 데이터 확인
  console.log('\n=== CA Latest Data ===');
  const cas = [
    'cagg_trend_10sec', 'cagg_usage_1min', 'cagg_quality_1min',
    'cagg_usage_15min', 'cagg_trend_usage_15min',
    'cagg_usage_1h', 'cagg_trend_usage_1h',
    'cagg_usage_1d', 'cagg_trend_usage_1d',
  ];

  for (const ca of cas) {
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ cnt: bigint; latest: Date; earliest: Date }>>(`
        SELECT COUNT(*) as cnt, MAX(bucket) as latest, MIN(bucket) as earliest FROM ${ca};
      `);
      const r = result[0];
      console.log(`  ${ca}: ${r.cnt} rows | earliest: ${r.earliest} | latest: ${r.latest}`);
    } catch (e: any) {
      console.log(`  ${ca}: ERROR - ${e.message?.substring(0, 100)}`);
    }
  }

  // 3. Raw 데이터 최근 확인
  console.log('\n=== Raw Data Latest ===');
  const raw = await prisma.$queryRawUnsafe<Array<{ cnt: bigint; latest: Date }>>(`
    SELECT COUNT(*) as cnt, MAX(timestamp) as latest
    FROM tag_data_raw
    WHERE timestamp >= NOW() - INTERVAL '30 minutes';
  `);
  console.log(`  tag_data_raw (last 30min): ${raw[0].cnt} rows, latest: ${raw[0].latest}`);

  // 4. 수동 리프레시 시도 (1분 CA만)
  console.log('\n=== Manual Refresh Test ===');
  try {
    await prisma.$executeRawUnsafe(`
      CALL refresh_continuous_aggregate('cagg_usage_1min', NOW() - INTERVAL '2 hours', NOW());
    `);
    console.log('  cagg_usage_1min: refresh OK');
  } catch (e: any) {
    console.log(`  cagg_usage_1min: refresh FAILED - ${e.message?.substring(0, 200)}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CALL refresh_continuous_aggregate('cagg_trend_10sec', NOW() - INTERVAL '2 hours', NOW());
    `);
    console.log('  cagg_trend_10sec: refresh OK');
  } catch (e: any) {
    console.log(`  cagg_trend_10sec: refresh FAILED - ${e.message?.substring(0, 200)}`);
  }

  // 리프레시 후 확인
  const after = await prisma.$queryRawUnsafe<Array<{ cnt: bigint; latest: Date }>>(`
    SELECT COUNT(*) as cnt, MAX(bucket) as latest FROM cagg_usage_1min WHERE bucket >= NOW() - INTERVAL '2 hours';
  `);
  console.log(`  After refresh - cagg_usage_1min (last 2h): ${after[0].cnt} rows, latest: ${after[0].latest}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
