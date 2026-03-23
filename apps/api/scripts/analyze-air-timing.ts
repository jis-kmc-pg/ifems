import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. DB timezone and time expressions
  console.log('=== DB 시간 및 타임존 ===');
  const timeInfo = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      NOW()::text as now_text,
      CURRENT_TIMESTAMP::text as cts_text,
      date_trunc('hour', NOW())::text as trunc_text,
      (date_trunc('hour', NOW()) - INTERVAL '1 hour')::text as trunc_minus1h,
      current_setting('timezone') as tz_setting
  `);
  const ti = timeInfo[0];
  console.log('  NOW(): ' + ti.now_text);
  console.log('  CURRENT_TIMESTAMP: ' + ti.cts_text);
  console.log('  date_trunc(hour, NOW()): ' + ti.trunc_text);
  console.log('  date_trunc - 1h: ' + ti.trunc_minus1h);
  console.log('  timezone setting: ' + ti.tz_setting);

  // 2. bucket column type and latest values
  console.log('\n=== cagg_usage_1h bucket 정보 ===');
  const bucketInfo = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      MAX(bucket)::text as latest_bucket,
      MIN(bucket)::text as earliest_bucket,
      pg_typeof(MAX(bucket))::text as bucket_type
    FROM cagg_usage_1h
  `);
  console.log('  bucket type: ' + bucketInfo[0].bucket_type);
  console.log('  latest: ' + bucketInfo[0].latest_bucket);
  console.log('  earliest: ' + bucketInfo[0].earliest_bucket);

  // 3. Direct comparison test
  console.log('\n=== 직접 비교 테스트 ===');
  const compareTest = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      MAX(bucket)::text as latest,
      (date_trunc('hour', NOW()) - INTERVAL '1 hour')::text as cutoff,
      MAX(bucket) >= (date_trunc('hour', NOW()) - INTERVAL '1 hour') as passes_filter,
      MAX(bucket) >= (NOW() - INTERVAL '2 hours') as passes_2h_filter
    FROM cagg_usage_1h
  `);
  const ct = compareTest[0];
  console.log('  latest bucket: ' + ct.latest);
  console.log('  cutoff (trunc-1h): ' + ct.cutoff);
  console.log('  latest >= cutoff: ' + ct.passes_filter);
  console.log('  latest >= NOW()-2h: ' + ct.passes_2h_filter);

  // 4. Count rows matching various conditions
  console.log('\n=== 조건별 행수 ===');
  const conditions = [
    { name: 'bucket >= NOW() - 1h', sql: "bucket >= NOW() - INTERVAL '1 hour'" },
    { name: 'bucket >= NOW() - 2h', sql: "bucket >= NOW() - INTERVAL '2 hours'" },
    { name: 'bucket >= trunc(NOW())-1h', sql: "bucket >= date_trunc('hour', NOW()) - INTERVAL '1 hour'" },
    { name: 'bucket >= trunc(NOW())', sql: "bucket >= date_trunc('hour', NOW())" },
    { name: 'bucket = latest', sql: 'bucket = (SELECT MAX(bucket) FROM cagg_usage_1h)' },
  ];
  for (const c of conditions) {
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as cnt FROM cagg_usage_1h WHERE ${c.sql}`
    );
    console.log('  ' + c.name + ': ' + result[0].cnt + '건');
  }

  // 5. Latest 3 buckets with air tag join
  console.log('\n=== 최근 3 bucket (에어 태그 JOIN) ===');
  const latest3 = await prisma.$queryRawUnsafe<any[]>(`
    SELECT DISTINCT cu.bucket::text as bucket_text, COUNT(*) as cnt
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
    GROUP BY cu.bucket
    ORDER BY cu.bucket DESC
    LIMIT 5
  `);
  for (const r of latest3) {
    console.log('  ' + r.bucket_text + ': ' + r.cnt + '건');
  }

  // 6. 에어 설비별 최근 버킷 사용량 (hourly CTE 대체)
  console.log('\n=== 에어: 최근 2 bucket 설비별 합산 ===');
  const recentUsage = await prisma.$queryRawUnsafe<any[]>(`
    WITH recent_buckets AS (
      SELECT DISTINCT bucket FROM cagg_usage_1h ORDER BY bucket DESC LIMIT 2
    )
    SELECT f.code, cu.bucket::text as bucket_text,
      SUM(cu.last_value - cu.first_value) as usage
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket IN (SELECT bucket FROM recent_buckets)
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY f.code, cu.bucket
    ORDER BY f.code, cu.bucket DESC
    LIMIT 20
  `);
  for (const r of recentUsage) {
    console.log('  ' + r.code + ' | ' + r.bucket_text + ' | ' + Number(r.usage).toFixed(1) + 'L');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
