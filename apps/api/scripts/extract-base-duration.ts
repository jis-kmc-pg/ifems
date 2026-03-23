import { Client } from 'pg';

const c = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1',
  database: 'ifems',
});

async function main() {
  await c.connect();

  // 1. MACH_ID별 평균 DIFF_DESC (ms → 초)
  const machAvg = await c.query(`
    SELECT "MACH_ID",
      AVG("DIFF_DESC") / 1000.0 as avg_sec,
      MIN("DIFF_DESC") / 1000.0 as min_sec,
      MAX("DIFF_DESC") / 1000.0 as max_sec,
      COUNT(*) as cnt
    FROM "CYCLE_STD_MST_MMS"
    WHERE "DIFF_DESC" IS NOT NULL AND "DIFF_DESC" > 0
    GROUP BY "MACH_ID"
    ORDER BY "MACH_ID"
  `);
  console.log(`=== MACH_ID별 평균 duration (${machAvg.rows.length}개 설비) ===`);
  for (const r of machAvg.rows) {
    console.log(`  MACH=${r.MACH_ID}: avg=${Math.round(r.avg_sec)}초 (${Math.round(r.min_sec)}~${Math.round(r.max_sec)}), ${r.cnt}건`);
  }

  // 2. MACH_ID → TAG_NAME → facilityId 매핑
  const mapping = await c.query(`
    SELECT m."MACH_ID", m."TAG_NAME", t."facilityId", f.code as fac_code,
      AVG(c."DIFF_DESC") / 1000.0 as avg_sec
    FROM "CYCLE_MMS_MAPPING" m
    JOIN tags t ON t."tagName" = m."TAG_NAME"
    JOIN facilities f ON f.id = t."facilityId"
    LEFT JOIN "CYCLE_STD_MST_MMS" c ON c."MACH_ID" = m."MACH_ID" AND c."TAG_NAME" = m."TAG_NAME"
      AND c."DIFF_DESC" IS NOT NULL AND c."DIFF_DESC" > 0
    GROUP BY m."MACH_ID", m."TAG_NAME", t."facilityId", f.code
    ORDER BY f.code, m."MACH_ID"
  `);

  // 3. facilityId별 baseDuration (해당 설비의 모든 MACH_ID 평균)
  const facDuration: Record<string, { code: string; durations: number[] }> = {};
  for (const r of mapping.rows) {
    if (!r.avg_sec) continue;
    if (!facDuration[r.facilityId]) facDuration[r.facilityId] = { code: r.fac_code, durations: [] };
    facDuration[r.facilityId].durations.push(parseFloat(r.avg_sec));
  }

  console.log(`\n=== facilityId별 baseDuration (${Object.keys(facDuration).length}개 설비) ===`);
  const results: { facilityId: string; code: string; baseDuration: number }[] = [];
  for (const [fid, data] of Object.entries(facDuration)) {
    const avg = Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length);
    results.push({ facilityId: fid, code: data.code, baseDuration: avg });
    console.log(`  ${data.code}: ${avg}초 (${data.durations.length}개 태그)`);
  }

  // 4. 전체 통계
  const allDurations = results.map(r => r.baseDuration);
  allDurations.sort((a, b) => a - b);
  const median = allDurations[Math.floor(allDurations.length / 2)];
  console.log(`\n=== 통계 ===`);
  console.log(`  매핑된 설비: ${results.length}개`);
  console.log(`  중앙값: ${median}초`);
  console.log(`  범위: ${allDurations[0]}~${allDurations[allDurations.length - 1]}초`);

  // 5. 전체 트렌드 태그 설비 수 (매핑 안 되는 것 포함)
  const totalFac = await c.query(`
    SELECT COUNT(DISTINCT t."facilityId") as cnt
    FROM tags t
    WHERE t."measureType" = 'INSTANTANEOUS' AND t.category = 'ENERGY' AND t."isActive" = true
  `);
  console.log(`  전체 트렌드 설비: ${totalFac.rows[0].cnt}개`);
  console.log(`  미매핑 설비: ${parseInt(totalFac.rows[0].cnt) - results.length}개 → 중앙값(${median}초) 사용 예정`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
