import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. 에어 태그 현황
  console.log('=== AIR 태그 현황 ===');
  const airTags = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t."facilityId", f.code as fac_code, COUNT(*) as tag_count
    FROM tags t
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
    GROUP BY t."facilityId", f.code
    ORDER BY f.code
    LIMIT 20;
  `);
  console.log('  에어 태그 설비 수: ' + airTags.length);
  for (const t of airTags.slice(0, 5)) {
    console.log('  ' + t.fac_code + ': ' + t.tag_count + '개 태그');
  }

  // 2. cagg_usage_1h 에어 데이터 현황
  console.log('\n=== cagg_usage_1h AIR 데이터 ===');
  const airCA = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as cnt, MIN(bucket) as earliest, MAX(bucket) as latest
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    WHERE t."energyType" = 'air';
  `);
  console.log('  총 행: ' + airCA[0].cnt + ', earliest: ' + airCA[0].earliest + ', latest: ' + airCA[0].latest);

  // 3. 설비별 시간당 에어 사용량 분포 (최근 24시간)
  console.log('\n=== 설비별 시간당 에어 사용량 (최근 24h) ===');
  const hourlyUsage = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      f.code as fac_code,
      cu.bucket,
      SUM(cu.last_value - cu.first_value) as usage
    FROM cagg_usage_1h cu
    JOIN tags t ON cu."tagId" = t.id
    JOIN facilities f ON t."facilityId" = f.id
    WHERE t."energyType" = 'air' AND t."isActive" = true
      AND cu.bucket >= NOW() - INTERVAL '24 hours'
      AND cu.last_value IS NOT NULL AND cu.first_value IS NOT NULL
    GROUP BY f.code, cu.bucket
    ORDER BY f.code, cu.bucket;
  `);
  console.log('  총 행: ' + hourlyUsage.length);

  // 설비별 통계
  const facMap = new Map<string, number[]>();
  for (const r of hourlyUsage) {
    const usage = Number(r.usage);
    if (!facMap.has(r.fac_code)) facMap.set(r.fac_code, []);
    facMap.get(r.fac_code)!.push(usage);
  }

  console.log('\n=== 설비별 에어 사용량 통계 ===');
  for (const [fac, usages] of facMap.entries()) {
    if (usages.length < 2) continue;
    const avg = usages.reduce((a, b) => a + b, 0) / usages.length;
    const min = Math.min(...usages);
    const max = Math.max(...usages);
    const std = Math.sqrt(usages.reduce((sum, v) => sum + (v - avg) ** 2, 0) / usages.length);
    const maxRatio = avg > 0 ? max / avg * 100 : 0;
    console.log('  ' + fac + ': avg=' + avg.toFixed(1) + ' min=' + min.toFixed(1) + ' max=' + max.toFixed(1) + ' std=' + std.toFixed(1) + ' max/avg=' + maxRatio.toFixed(0) + '% hours=' + usages.length);
  }

  // 4. 현재 감지 시뮬레이션 (다양한 임계값)
  console.log('\n=== 에어 감지 시뮬레이션 ===');
  for (const surgePct of [5, 10, 15, 20, 30, 50]) {
    const ratio = 1 + surgePct / 100;
    const detected = await prisma.$queryRawUnsafe<any[]>(`
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
        h.current_usage / d.avg_hourly * 100 AS usage_ratio
      FROM hourly h
      JOIN daily_avg d ON h."facilityId" = d."facilityId"
      WHERE d.avg_hourly > 100
        AND h.current_usage / d.avg_hourly > ${ratio}
      ORDER BY usage_ratio DESC;
    `);
    console.log('  surgePct=' + surgePct + '% (ratio>' + ratio + '): ' + detected.length + '개 설비 감지');
    for (const d of detected.slice(0, 3)) {
      console.log('    ' + d.fac_code + ': cur=' + Number(d.current_usage).toFixed(0) + 'L avg=' + Number(d.avg_hourly).toFixed(0) + 'L ratio=' + Number(d.usage_ratio).toFixed(0) + '%');
    }
  }

  // 5. alerts 테이블 현황
  console.log('\n=== 현재 alerts 테이블 ===');
  const alertCount = await prisma.$queryRawUnsafe<any[]>(`
    SELECT type, COUNT(*) as cnt FROM alerts GROUP BY type ORDER BY type;
  `);
  if (alertCount.length === 0) console.log('  비어있음 (0건)');
  for (const a of alertCount) {
    console.log('  ' + a.type + ': ' + a.cnt + '건');
  }

  // 6. 전력 품질: 불평형률
  console.log('\n=== 전력 품질: 불평형률 시뮬레이션 ===');
  for (const threshold of [2.0, 3.0, 5.0, 8.0]) {
    const imbalance = await prisma.$queryRawUnsafe<any[]>(`
      WITH phase_data AS (
        SELECT t."facilityId", f.code as fac_code,
          CASE WHEN t."tagName" LIKE '%_A' THEN 'A'
               WHEN t."tagName" LIKE '%_B' THEN 'B'
               WHEN t."tagName" LIKE '%_C' THEN 'C' END AS phase,
          AVG(d.value) AS avg_value
        FROM tag_data_raw d
        JOIN tags t ON d."tagId" = t.id
        JOIN facilities f ON t."facilityId" = f.id
        WHERE t.category = 'QUALITY' AND t."isActive" = true
          AND (t."tagName" LIKE '%_A' OR t."tagName" LIKE '%_B' OR t."tagName" LIKE '%_C')
          AND d.timestamp >= NOW() - INTERVAL '5 minutes'
          AND d.value IS NOT NULL AND d.value > 0
        GROUP BY t."facilityId", f.code, phase
      )
      SELECT fac_code,
        MAX(avg_value) AS max_val, MIN(avg_value) AS min_val, AVG(avg_value) AS avg_val,
        (MAX(avg_value) - MIN(avg_value)) / AVG(avg_value) * 100 AS imbalance_pct
      FROM phase_data GROUP BY "facilityId", fac_code
      HAVING COUNT(DISTINCT phase) = 3
        AND (MAX(avg_value) - MIN(avg_value)) / AVG(avg_value) * 100 > ${threshold}
      ORDER BY imbalance_pct DESC;
    `);
    console.log('  임계=' + threshold + '%: ' + imbalance.length + '개 설비');
    for (const d of imbalance.slice(0, 3)) {
      console.log('    ' + d.fac_code + ': ' + Number(d.imbalance_pct).toFixed(1) + '% (max=' + Number(d.max_val).toFixed(1) + ' min=' + Number(d.min_val).toFixed(1) + ')');
    }
  }

  // 7. 전력 품질: 역률
  console.log('\n=== 전력 품질: 역률 시뮬레이션 ===');
  for (const threshold of [95, 90, 85, 80]) {
    const pf = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t."facilityId", f.code as fac_code, AVG(d.value) AS avg_pf
      FROM tag_data_raw d
      JOIN tags t ON d."tagId" = t.id
      JOIN facilities f ON t."facilityId" = f.id
      WHERE t.category = 'QUALITY' AND t."isActive" = true
        AND t."tagName" LIKE '%_PF'
        AND d.timestamp >= NOW() - INTERVAL '5 minutes'
        AND d.value IS NOT NULL
      GROUP BY t."facilityId", f.code
      HAVING AVG(d.value) < ${threshold}
      ORDER BY avg_pf ASC;
    `);
    console.log('  기준=' + threshold + '%: ' + pf.length + '개 설비');
    for (const d of pf.slice(0, 3)) {
      console.log('    ' + d.fac_code + ': PF=' + Number(d.avg_pf).toFixed(1) + '%');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
