import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. cagg_usage_1h 오늘 데이터 직접 조회
  console.log('=== cagg_usage_1h - Today data ===');
  const today = await prisma.$queryRawUnsafe<any[]>(`
    SELECT bucket, energy_type, COUNT(*) as tag_count,
      SUM(last_value - first_value) as total_usage
    FROM cagg_usage_1h
    WHERE bucket >= '2026-03-09 15:00:00'::timestamp
      AND bucket < '2026-03-10 15:00:00'::timestamp
    GROUP BY bucket, energy_type
    ORDER BY bucket, energy_type;
  `);
  console.log(`  Rows: ${today.length}`);
  for (const r of today) {
    console.log(`  ${r.bucket} | ${r.energy_type} | tags: ${r.tag_count} | usage: ${Number(r.total_usage).toFixed(2)}`);
  }

  // 2. DB 서버 시간 확인
  console.log('\n=== DB Time ===');
  const time = await prisma.$queryRawUnsafe<any[]>(`SELECT NOW() as now, NOW() AT TIME ZONE 'Asia/Seoul' as kst;`);
  console.log(`  NOW(): ${time[0].now}`);
  console.log(`  KST: ${time[0].kst}`);

  // 3. 모니터링 서비스와 동일한 쿼리 실행
  console.log('\n=== Monitoring Query Simulation ===');
  const KST_OFFSET = '9 hours';
  const targetUtc = '2026-03-09 15:00:00';
  const nextDayUtc = '2026-03-10 15:00:00';

  const diffCurrent = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date_trunc('hour', sub.hb) as hour_bucket, sub.energy_type,
      SUM(sub.tag_usage) as usage
    FROM (
      SELECT c.energy_type::text, date_trunc('hour', c.bucket + INTERVAL '${KST_OFFSET}') as hb,
        LAST(c.last_value, c.bucket) - FIRST(c.first_value, c.bucket) as tag_usage
      FROM cagg_usage_1h c
      WHERE c.bucket >= '${targetUtc}'::timestamp AND c.bucket < '${nextDayUtc}'::timestamp AND c.last_value IS NOT NULL
      GROUP BY c."tagId", c.energy_type, date_trunc('hour', c.bucket + INTERVAL '${KST_OFFSET}')
    ) sub GROUP BY hour_bucket, sub.energy_type ORDER BY hour_bucket
  `);

  console.log(`  Results: ${diffCurrent.length}`);
  for (const r of diffCurrent) {
    console.log(`  ${r.hour_bucket} | ${r.energy_type} | usage: ${Number(r.usage).toFixed(2)}`);
  }

  // 4. cagg_trend_usage_1h 확인
  console.log('\n=== cagg_trend_usage_1h - Today ===');
  const trend = await prisma.$queryRawUnsafe<any[]>(`
    SELECT bucket, energy_type, COUNT(*) as fac_count, SUM(sum_value) as total
    FROM cagg_trend_usage_1h
    WHERE bucket >= '2026-03-09 15:00:00'::timestamp
      AND bucket < '2026-03-10 15:00:00'::timestamp
    GROUP BY bucket, energy_type
    ORDER BY bucket, energy_type;
  `);
  console.log(`  Rows: ${trend.length}`);
  for (const r of trend) {
    console.log(`  ${r.bucket} | ${r.energy_type} | facs: ${r.fac_count} | total: ${Number(r.total).toFixed(2)}`);
  }

  // 5. Raw data 최근 확인
  console.log('\n=== Raw data (last 10min) ===');
  const raw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MAX(timestamp) as latest, MIN(timestamp) as earliest
    FROM tag_data_raw
    WHERE timestamp >= NOW() - INTERVAL '10 minutes';
  `);
  console.log(`  count: ${raw[0].cnt}, earliest: ${raw[0].earliest}, latest: ${raw[0].latest}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
