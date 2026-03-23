import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  console.log('=== 전력 품질 감지 시뮬레이션 (UTC 기반) ===\n');

  // 1. 불평형률 시뮬레이션
  console.log('--- 불평형률 (Phase Imbalance) ---');
  for (const threshold of [1.0, 2.0, 3.0, 5.0, 8.0, 10.0, 15.0, 20.0]) {
    const results = await prisma.$queryRawUnsafe<any[]>(`
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
          AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
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
    let line = '  threshold=' + threshold + '%: ' + results.length + '개 설비';
    if (results.length > 0 && results.length <= 5) {
      const ex = results.map(r => r.fac_code + '(' + Number(r.imbalance_pct).toFixed(1) + '%)').join(', ');
      line += ' [' + ex + ']';
    } else if (results.length > 5) {
      const ex = results.slice(0, 3).map(r => r.fac_code + '(' + Number(r.imbalance_pct).toFixed(1) + '%)').join(', ');
      line += ' [' + ex + ' ... +' + (results.length - 3) + ']';
    }
    console.log(line);
  }

  // 2. 역률 시뮬레이션
  console.log('\n--- 역률 저하 (Low PF) ---');
  for (const threshold of [98, 95, 93, 90, 88, 85, 80]) {
    const results = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t."facilityId", f.code as fac_code, AVG(d.value) AS avg_pf
      FROM tag_data_raw d
      JOIN tags t ON d."tagId" = t.id
      JOIN facilities f ON t."facilityId" = f.id
      WHERE t.category = 'QUALITY' AND t."isActive" = true
        AND t."tagName" LIKE '%_PF'
        AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
        AND d.value IS NOT NULL
      GROUP BY t."facilityId", f.code
      HAVING AVG(d.value) < ${threshold}
      ORDER BY avg_pf ASC;
    `);
    let line = '  threshold=' + threshold + '%: ' + results.length + '개 설비';
    if (results.length > 0 && results.length <= 5) {
      const ex = results.map(r => r.fac_code + '(PF=' + Number(r.avg_pf).toFixed(1) + '%)').join(', ');
      line += ' [' + ex + ']';
    } else if (results.length > 5) {
      const ex = results.slice(0, 3).map(r => r.fac_code + '(PF=' + Number(r.avg_pf).toFixed(1) + '%)').join(', ');
      line += ' [' + ex + ' ... +' + (results.length - 3) + ']';
    }
    console.log(line);
  }

  // 3. 전체 PF 분포
  console.log('\n--- 전체 PF 분포 ---');
  const pfDist = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      CASE
        WHEN AVG(d.value) < 80 THEN '<80'
        WHEN AVG(d.value) < 85 THEN '80-85'
        WHEN AVG(d.value) < 90 THEN '85-90'
        WHEN AVG(d.value) < 95 THEN '90-95'
        ELSE '95+'
      END AS pf_range,
      COUNT(*) as fac_count
    FROM tag_data_raw d
    JOIN tags t ON d."tagId" = t.id
    WHERE t.category = 'QUALITY' AND t."isActive" = true
      AND t."tagName" LIKE '%_PF'
      AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
      AND d.value IS NOT NULL
    GROUP BY t."facilityId"
    ORDER BY MIN(AVG(d.value)) OVER ()
  `);
  // Re-query with proper grouping
  const pfRanges = await prisma.$queryRawUnsafe<any[]>(`
    WITH fac_pf AS (
      SELECT t."facilityId", AVG(d.value) AS avg_pf
      FROM tag_data_raw d
      JOIN tags t ON d."tagId" = t.id
      WHERE t.category = 'QUALITY' AND t."isActive" = true
        AND t."tagName" LIKE '%_PF'
        AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
        AND d.value IS NOT NULL
      GROUP BY t."facilityId"
    )
    SELECT
      CASE
        WHEN avg_pf < 80 THEN '<80'
        WHEN avg_pf < 85 THEN '80-85'
        WHEN avg_pf < 90 THEN '85-90'
        WHEN avg_pf < 95 THEN '90-95'
        ELSE '95+'
      END AS pf_range,
      COUNT(*) as cnt,
      MIN(avg_pf)::numeric(5,1) as min_pf,
      MAX(avg_pf)::numeric(5,1) as max_pf
    FROM fac_pf
    GROUP BY 1
    ORDER BY min_pf;
  `);
  for (const r of pfRanges) {
    console.log('  ' + r.pf_range + ': ' + r.cnt + '개 설비 (min=' + r.min_pf + ', max=' + r.max_pf + ')');
  }

  // 4. 전체 imbalance 분포
  console.log('\n--- 전체 불평형률 분포 ---');
  const imbRanges = await prisma.$queryRawUnsafe<any[]>(`
    WITH phase_data AS (
      SELECT t."facilityId",
        CASE WHEN t."tagName" LIKE '%_A' THEN 'A'
             WHEN t."tagName" LIKE '%_B' THEN 'B'
             WHEN t."tagName" LIKE '%_C' THEN 'C' END AS phase,
        AVG(d.value) AS avg_value
      FROM tag_data_raw d
      JOIN tags t ON d."tagId" = t.id
      WHERE t.category = 'QUALITY' AND t."isActive" = true
        AND (t."tagName" LIKE '%_A' OR t."tagName" LIKE '%_B' OR t."tagName" LIKE '%_C')
        AND d.timestamp >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
        AND d.value IS NOT NULL AND d.value > 0
      GROUP BY t."facilityId", phase
    ),
    fac_imb AS (
      SELECT "facilityId",
        (MAX(avg_value) - MIN(avg_value)) / AVG(avg_value) * 100 AS imbalance_pct
      FROM phase_data
      GROUP BY "facilityId"
      HAVING COUNT(DISTINCT phase) = 3
    )
    SELECT
      CASE
        WHEN imbalance_pct < 2 THEN '<2%'
        WHEN imbalance_pct < 5 THEN '2-5%'
        WHEN imbalance_pct < 10 THEN '5-10%'
        WHEN imbalance_pct < 20 THEN '10-20%'
        ELSE '20%+'
      END AS range,
      COUNT(*) as cnt,
      MIN(imbalance_pct)::numeric(5,1) as min_pct,
      MAX(imbalance_pct)::numeric(5,1) as max_pct
    FROM fac_imb
    GROUP BY 1
    ORDER BY min_pct;
  `);
  for (const r of imbRanges) {
    console.log('  ' + r.range + ': ' + r.cnt + '개 설비 (min=' + r.min_pct + '%, max=' + r.max_pct + '%)');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
