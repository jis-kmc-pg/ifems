import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. 감지 쿼리 디버그 - avg_hourly > 100 필터 없이
  console.log('=== 에어 감지 디버그 (필터 없이) ===');
  const debug = await prisma.$queryRawUnsafe<any[]>(`
    WITH hourly AS (
      SELECT cu."facilityId", f.code as fac_code,
        SUM(cu.last_value - cu.first_value) AS current_usage
      FROM cagg_usage_1h cu
      JOIN tags t ON cu."tagId" = t.id
      JOIN facilities f ON t."facilityId" = f.id
      WHERE t."energyType" = 'air' AND t."isActive" = true
        AND cu.bucket >= NOW() - INTERVAL '1 hour'
        AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
      GROUP BY cu."facilityId", f.code
    ),
    daily_avg AS (
      SELECT cu."facilityId",
        SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly
      FROM cagg_usage_1h cu
      JOIN tags t ON cu."tagId" = t.id
      WHERE t."energyType" = 'air' AND t."isActive" = true
        AND cu.bucket >= NOW() - INTERVAL '24 hours'
        AND cu.bucket < NOW() - INTERVAL '1 hour'
        AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
      GROUP BY cu."facilityId"
    )
    SELECT h.fac_code, h.current_usage, d.avg_hourly,
      CASE WHEN d.avg_hourly > 0 THEN h.current_usage / d.avg_hourly * 100 ELSE 0 END AS usage_ratio
    FROM hourly h
    JOIN daily_avg d ON h."facilityId" = d."facilityId"
    ORDER BY usage_ratio DESC
    LIMIT 20;
  `);
  console.log('  결과: ' + debug.length + '행');
  for (const d of debug) {
    console.log('  ' + d.fac_code + ': cur=' + Number(d.current_usage).toFixed(1) + ' avg=' + Number(d.avg_hourly).toFixed(1) + ' ratio=' + Number(d.usage_ratio).toFixed(1) + '%');
  }

  // 2. hourly CTE만 - 현재 1시간 데이터 있는지
  console.log('\n=== 최근 1시간 에어 데이터 (hourly CTE) ===');
  const hourly = await prisma.$queryRawUnsafe<any[]>(`
    SELECT cu."facilityId", f.code as fac_code,
      SUM(cu.last_value - cu.first_value) AS current_usage,
      COUNT(*) as rows
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= NOW() - INTERVAL '1 hour'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY cu."facilityId", f.code
    ORDER BY f.code
    LIMIT 10;
  `);
  console.log('  설비수: ' + hourly.length);
  for (const h of hourly.slice(0, 5)) {
    console.log('  ' + h.fac_code + ': ' + Number(h.current_usage).toFixed(1) + 'L (rows=' + h.rows + ')');
  }

  // 3. DB 현재 시간과 최신 bucket 비교
  console.log('\n=== 시간 확인 ===');
  const time = await prisma.$queryRawUnsafe<any[]>(`
    SELECT NOW() as utc_now,
      NOW() AT TIME ZONE 'Asia/Seoul' as kst_now,
      (SELECT MAX(bucket) FROM cagg_usage_1h) as latest_bucket
  `);
  console.log('  UTC: ' + time[0].utc_now);
  console.log('  KST: ' + time[0].kst_now);
  console.log('  latest bucket: ' + time[0].latest_bucket);
  console.log('  NOW()-1h: would be ' + new Date(new Date(time[0].utc_now).getTime() - 3600000));

  // 4. 설비별 에어 태그 합산 확인 (설비 하나의 전체 태그)
  console.log('\n=== 설비별 에어 태그 수 (합산에 영향) ===');
  const tagCounts = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t."facilityId", f.code, COUNT(*) as tag_count
    FROM tags t
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
    GROUP BY t."facilityId", f.code
    ORDER BY tag_count DESC
    LIMIT 10;
  `);
  for (const t of tagCounts) {
    console.log('  ' + t.code + ': ' + t.tag_count + '개 에어 태그');
  }

  // 5. 개별 태그 기준 hourly usage (합산이 아닌)
  console.log('\n=== 개별 태그 시간당 사용량 (최근 5시간) ===');
  const tagUsage = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t."tagName", cu.bucket,
      cu.last_value - cu.first_value as usage,
      cu.first_value, cu.last_value
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= NOW() - INTERVAL '5 hours'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    ORDER BY t."tagName", cu.bucket
    LIMIT 30;
  `);
  for (const t of tagUsage) {
    console.log('  ' + t.tagName + ' | ' + t.bucket + ' | usage=' + Number(t.usage).toFixed(1) + ' (first=' + Number(t.first_value).toFixed(1) + ' last=' + Number(t.last_value).toFixed(1) + ')');
  }

  // 6. 설비 하나의 시간별 합산 사용량 추이 (24시간)
  console.log('\n=== HNK10_100 시간별 에어 합산 (24h, 2개 태그) ===');
  const fac100 = await prisma.$queryRawUnsafe<any[]>(`
    SELECT cu.bucket,
      SUM(cu.last_value - cu.first_value) as total_usage,
      COUNT(*) as tag_count
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE f.code = 'HNK10_100' AND t."energyType" = 'air'
      AND cu.bucket >= NOW() - INTERVAL '24 hours'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY cu.bucket
    ORDER BY cu.bucket;
  `);
  for (const r of fac100) {
    console.log('  ' + r.bucket + ' | usage=' + Number(r.total_usage).toFixed(1) + 'L (tags=' + r.tag_count + ')');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
