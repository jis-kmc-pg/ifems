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

  // 1. STEP이 CYCLE 시간 범위 밖에 있는 건수
  const violations = await c.query(`
    SELECT COUNT(*) as cnt
    FROM "STEP_STD_MST_MMS" s
    JOIN "CYCLE_STD_MST_MMS" c
      ON s."MATERIAL_ID" = c."MATERIAL_ID"
      AND s."MACH_ID" = c."MACH_ID"
      AND s."TAG_NAME" = c."TAG_NAME"
      AND s."MODEL_ID" = c."MODEL_ID"
    WHERE s."START_DT" < c."START_DT" OR s."END_DT" > c."END_DT"
  `);
  console.log('=== STEP이 CYCLE 범위 밖인 건수 ===');
  console.log(`  위반: ${violations.rows[0].cnt}건`);

  // 2. 매칭되는 STEP-CYCLE 총 건수
  const matched = await c.query(`
    SELECT COUNT(*) as cnt
    FROM "STEP_STD_MST_MMS" s
    JOIN "CYCLE_STD_MST_MMS" c
      ON s."MATERIAL_ID" = c."MATERIAL_ID"
      AND s."MACH_ID" = c."MACH_ID"
      AND s."TAG_NAME" = c."TAG_NAME"
      AND s."MODEL_ID" = c."MODEL_ID"
  `);
  console.log(`  매칭: ${matched.rows[0].cnt}건`);

  // 3. 정상 범위 내 샘플 (CYCLE과 STEP 시간 관계)
  const sample = await c.query(`
    SELECT c."MACH_ID", c."TAG_NAME", c."MATERIAL_ID",
      c."START_DT" as c_start, c."END_DT" as c_end,
      s."STEP_SEQ", s."START_DT" as s_start, s."END_DT" as s_end
    FROM "STEP_STD_MST_MMS" s
    JOIN "CYCLE_STD_MST_MMS" c
      ON s."MATERIAL_ID" = c."MATERIAL_ID"
      AND s."MACH_ID" = c."MACH_ID"
      AND s."TAG_NAME" = c."TAG_NAME"
      AND s."MODEL_ID" = c."MODEL_ID"
    WHERE s."START_DT" >= c."START_DT" AND s."END_DT" <= c."END_DT"
    ORDER BY c."START_DT", s."STEP_SEQ"
    LIMIT 20
  `);
  console.log('\n=== 정상 CYCLE→STEP 샘플 ===');
  let prevMat = '';
  for (const r of sample.rows) {
    if (r.MATERIAL_ID !== prevMat) {
      console.log(`\n  CYCLE: MACH=${r.MACH_ID} TAG=${r.TAG_NAME} MAT=${r.MATERIAL_ID}`);
      console.log(`    시간: ${r.c_start.substring(0, 23)} ~ ${r.c_end.substring(0, 23)}`);
      prevMat = r.MATERIAL_ID;
    }
    console.log(`    STEP SEQ=${r.STEP_SEQ}: ${r.s_start.substring(11, 23)} ~ ${r.s_end.substring(11, 23)}`);
  }

  // 4. STEP 간 시간 순서 확인 (이전 STEP END <= 다음 STEP START?)
  const ordering = await c.query(`
    WITH step_ordered AS (
      SELECT s."MATERIAL_ID", s."MACH_ID", s."TAG_NAME", s."MODEL_ID",
        s."STEP_SEQ", s."START_DT", s."END_DT",
        LAG(s."END_DT") OVER (
          PARTITION BY s."MATERIAL_ID", s."MACH_ID", s."TAG_NAME", s."MODEL_ID"
          ORDER BY s."STEP_SEQ"
        ) as prev_end
      FROM "STEP_STD_MST_MMS" s
    )
    SELECT
      COUNT(*) as total_with_prev,
      SUM(CASE WHEN "START_DT" >= prev_end THEN 1 ELSE 0 END) as sequential,
      SUM(CASE WHEN "START_DT" < prev_end THEN 1 ELSE 0 END) as overlap
    FROM step_ordered
    WHERE prev_end IS NOT NULL
  `);
  console.log('\n=== STEP 간 시간 순서 ===');
  const o = ordering.rows[0];
  console.log(`  순차(이전END≤현재START): ${o.sequential}건`);
  console.log(`  겹침(이전END>현재START): ${o.overlap}건`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
