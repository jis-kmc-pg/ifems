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

  // 1. STAND_YN=1 (기준 싸이클) 현황
  const std1 = await c.query(`
    SELECT COUNT(*) as cnt,
      COUNT(DISTINCT "MACH_ID") as mach_count,
      COUNT(DISTINCT "TAG_NAME") as tag_count
    FROM "CYCLE_STD_MST_MMS"
    WHERE "STAND_YN" = 1
  `);
  console.log('=== STAND_YN=1 (기준 싸이클) ===');
  console.log(`  총 ${std1.rows[0].cnt}건, ${std1.rows[0].mach_count}대 설비, ${std1.rows[0].tag_count}개 태그`);

  // 2. STAND_YN=1 상세 목록
  const list1 = await c.query(`
    SELECT "MACH_ID", "TAG_NAME", "MATERIAL_ID", "MODEL_ID",
      "START_DT", "END_DT", "DIFF_DESC", "DTW", "U_ENERGY", "STAND_YN"
    FROM "CYCLE_STD_MST_MMS"
    WHERE "STAND_YN" = 1
    ORDER BY "MACH_ID", "TAG_NAME"
  `);
  console.log('\n=== STAND_YN=1 전체 목록 ===');
  for (const r of list1.rows) {
    console.log(`  MACH=${r.MACH_ID} TAG=${r.TAG_NAME} MAT=${r.MATERIAL_ID} MODEL=${r.MODEL_ID} DTW=${r.DTW} ENERGY=${r.U_ENERGY} DIFF=${r.DIFF_DESC}`);
  }

  // 3. STAND_YN별 DTW null/not null 분포
  const dtwDist = await c.query(`
    SELECT "STAND_YN",
      SUM(CASE WHEN "DTW" IS NULL THEN 1 ELSE 0 END) as dtw_null,
      SUM(CASE WHEN "DTW" IS NOT NULL THEN 1 ELSE 0 END) as dtw_set,
      COUNT(*) as total
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "STAND_YN"
    ORDER BY "STAND_YN"
  `);
  console.log('\n=== STAND_YN별 DTW 분포 ===');
  for (const r of dtwDist.rows) {
    console.log(`  STAND_YN=${r.STAND_YN}: total=${r.total} | DTW null=${r.dtw_null}, set=${r.dtw_set}`);
  }

  // 4. STAND_YN=1이 없는 MACH_ID (기준 싸이클 누락 설비)
  const missing = await c.query(`
    SELECT DISTINCT c."MACH_ID", c."TAG_NAME"
    FROM "CYCLE_STD_MST_MMS" c
    WHERE NOT EXISTS (
      SELECT 1 FROM "CYCLE_STD_MST_MMS" s
      WHERE s."MACH_ID" = c."MACH_ID" AND s."TAG_NAME" = c."TAG_NAME" AND s."STAND_YN" = 1
    )
    ORDER BY c."MACH_ID", c."TAG_NAME"
  `);
  console.log(`\n=== STAND_YN=1 누락 (MACH+TAG 조합): ${missing.rows.length}개 ===`);
  for (const r of missing.rows.slice(0, 20)) {
    console.log(`  MACH=${r.MACH_ID} TAG=${r.TAG_NAME}`);
  }
  if (missing.rows.length > 20) console.log(`  ... +${missing.rows.length - 20}개`);

  // 5. 같은 MATERIAL_ID의 STAND_YN 변화 흐름 샘플
  const flow = await c.query(`
    SELECT "MACH_ID", "TAG_NAME", "MATERIAL_ID", "STAND_YN", "DTW",
      "START_DT", "SAVE_DT"
    FROM "CYCLE_STD_MST_MMS"
    WHERE "MACH_ID" = (SELECT "MACH_ID" FROM "CYCLE_STD_MST_MMS" WHERE "STAND_YN" = 2 AND "DTW" IS NOT NULL LIMIT 1)
      AND "TAG_NAME" = (SELECT "TAG_NAME" FROM "CYCLE_STD_MST_MMS" WHERE "STAND_YN" = 2 AND "DTW" IS NOT NULL LIMIT 1)
    ORDER BY "START_DT" DESC
    LIMIT 10
  `);
  console.log('\n=== STAND_YN 변화 흐름 샘플 ===');
  for (const r of flow.rows) {
    console.log(`  MAT=${r.MATERIAL_ID.substring(0, 20)} STAND=${r.STAND_YN} DTW=${r.DTW} START=${r.START_DT.substring(0, 19)} SAVE=${(r.SAVE_DT || '').substring(0, 19)}`);
  }

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
