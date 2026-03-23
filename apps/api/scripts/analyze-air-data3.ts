import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 수정된 쿼리로 시뮬레이션
  console.log('=== 수정된 에어 감지 시뮬레이션 ===');
  console.log('(date_trunc + minBaseline 파라미터 적용)\n');

  for (const minBaseline of [0, 10, 50, 100]) {
    console.log('--- minBaseline (threshold1) = ' + minBaseline + ' ---');
    for (const surgePct of [5, 10, 15, 20, 30, 50]) {
      const surgeRatio = 1 + surgePct / 100;
      const detected = await prisma.$queryRawUnsafe<any[]>(`
        WITH hourly AS (
          SELECT cu."facilityId", f.code as fac_code,
            SUM(cu.last_value - cu.first_value) AS current_usage
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          JOIN facilities f ON t."facilityId" = f.id
          WHERE t."energyType" = 'air' AND t."isActive" = true
            AND cu.bucket >= date_trunc('hour', NOW()) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId", f.code
        ),
        daily_avg AS (
          SELECT cu."facilityId",
            SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly
          FROM cagg_usage_1h cu
          JOIN tags t ON cu."tagId" = t.id
          WHERE t."energyType" = 'air' AND t."isActive" = true
            AND cu.bucket >= NOW() - INTERVAL '25 hours'
            AND cu.bucket < date_trunc('hour', NOW()) - INTERVAL '1 hour'
            AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
          GROUP BY cu."facilityId"
        )
        SELECT h.fac_code, h.current_usage, d.avg_hourly,
          h.current_usage / d.avg_hourly * 100 AS usage_ratio
        FROM hourly h
        JOIN daily_avg d ON h."facilityId" = d."facilityId"
        WHERE d.avg_hourly > ${minBaseline}
          AND h.current_usage / d.avg_hourly > ${surgeRatio}
        ORDER BY usage_ratio DESC;
      `);
      const line = '  surgePct=' + surgePct + '% (ratio>' + surgeRatio.toFixed(2) + '): ' + detected.length + '개 설비';
      if (detected.length > 0 && detected.length <= 5) {
        const examples = detected.map(d => d.fac_code + '(' + Number(d.usage_ratio).toFixed(0) + '%)').join(', ');
        console.log(line + ' [' + examples + ']');
      } else {
        console.log(line);
      }
    }
    console.log('');
  }

  // hourly CTE 상세 확인
  console.log('=== hourly CTE 데이터 (수정 후) ===');
  const hourly = await prisma.$queryRawUnsafe<any[]>(`
    SELECT cu."facilityId", f.code as fac_code,
      SUM(cu.last_value - cu.first_value) AS current_usage,
      COUNT(*) as tag_count
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= date_trunc('hour', NOW()) - INTERVAL '1 hour'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY cu."facilityId", f.code
    ORDER BY current_usage DESC
    LIMIT 15;
  `);
  console.log('  설비수: ' + hourly.length);
  for (const h of hourly) {
    console.log('  ' + h.fac_code + ': ' + Number(h.current_usage).toFixed(1) + 'L (tags=' + h.tag_count + ')');
  }

  // daily_avg 상세
  console.log('\n=== daily_avg 데이터 ===');
  const dailyAvg = await prisma.$queryRawUnsafe<any[]>(`
    SELECT cu."facilityId", f.code as fac_code,
      SUM(cu.last_value - cu.first_value) / GREATEST(COUNT(DISTINCT cu.bucket), 1) AS avg_hourly,
      COUNT(DISTINCT cu.bucket) as bucket_count
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= NOW() - INTERVAL '25 hours'
      AND cu.bucket < date_trunc('hour', NOW()) - INTERVAL '1 hour'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY cu."facilityId", f.code
    ORDER BY avg_hourly DESC
    LIMIT 15;
  `);
  for (const d of dailyAvg) {
    console.log('  ' + d.fac_code + ': avg=' + Number(d.avg_hourly).toFixed(1) + 'L/h (buckets=' + d.bucket_count + ')');
  }

  // 전력 품질 디버그
  console.log('\n=== 전력 품질 디버그 ===');
  const qualData = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MAX(d.timestamp) as latest
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND d.timestamp >= NOW() - INTERVAL '5 minutes'
  `);
  console.log('  QUALITY 데이터 (최근 5분): ' + qualData[0].cnt + '건, latest=' + qualData[0].latest);

  const qualData30 = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MAX(d.timestamp) as latest
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND d.timestamp >= NOW() - INTERVAL '30 minutes'
  `);
  console.log('  QUALITY 데이터 (최근 30분): ' + qualData30[0].cnt + '건, latest=' + qualData30[0].latest);

  // QUALITY 태그 수
  const qTags = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt FROM tags WHERE category = 'QUALITY' AND "isActive" = true
  `);
  console.log('  QUALITY 활성 태그 수: ' + qTags[0].cnt);

  // PF 태그 값 샘플
  const pfSample = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t."tagName", d.value, d.timestamp
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND t."tagName" LIKE '%_PF'
    ORDER BY d.timestamp DESC
    LIMIT 5;
  `);
  console.log('  PF 태그 최근 데이터:');
  for (const p of pfSample) {
    console.log('    ' + p.tagName + ': ' + Number(p.value).toFixed(2) + ' @ ' + p.timestamp);
  }

  // Phase A/B/C 태그 값 샘플
  const phaseSample = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t."tagName", d.value, d.timestamp
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND (t."tagName" LIKE '%_A' OR t."tagName" LIKE '%_B' OR t."tagName" LIKE '%_C')
    ORDER BY d.timestamp DESC
    LIMIT 10;
  `);
  console.log('  Phase A/B/C 최근 데이터:');
  for (const p of phaseSample) {
    console.log('    ' + p.tagName + ': ' + Number(p.value).toFixed(2) + ' @ ' + p.timestamp);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
