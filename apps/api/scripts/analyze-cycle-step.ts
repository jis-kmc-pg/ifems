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

  // 1. 특정 MATERIAL_ID의 STEP 상세
  const mid = 'L5012512272035012S600';
  const steps = await c.query(
    `SELECT "MACH_ID", "TAG_NAME", "STEP_SEQ", "START_DT", "END_DT", "DIFF_SEC", "MODEL_ID"
     FROM "STEP_STD_MST_MMS"
     WHERE "MATERIAL_ID" = $1
     ORDER BY "MACH_ID", "TAG_NAME", "STEP_SEQ"`,
    [mid],
  );
  console.log(`=== MATERIAL ${mid} STEP (${steps.rows.length}건) ===`);
  for (const r of steps.rows) {
    console.log(`  MACH=${r.MACH_ID} TAG=${r.TAG_NAME} SEQ=${r.STEP_SEQ} ${(r.START_DT || '').substring(0, 19)}~${(r.END_DT || '').substring(0, 19)} diff=${r.DIFF_SEC}`);
  }

  // 2. MODEL_ID 분포
  const models = await c.query(`
    SELECT "MODEL_ID", COUNT(*) as cnt
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "MODEL_ID" ORDER BY cnt DESC LIMIT 10
  `);
  console.log('\n=== MODEL_ID 분포 TOP 10 ===');
  for (const r of models.rows) {
    console.log(`  MODEL=${r.MODEL_ID}: ${r.cnt}건`);
  }

  // 3. STAND_YN 분포
  const standyn = await c.query(`
    SELECT "STAND_YN", COUNT(*) as cnt
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "STAND_YN" ORDER BY "STAND_YN"
  `);
  console.log('\n=== STAND_YN 분포 ===');
  for (const r of standyn.rows) {
    console.log(`  STAND_YN=${r.STAND_YN}: ${r.cnt}건`);
  }

  // 4. MACH_ID별 TAG 수
  const machTags = await c.query(`
    SELECT "MACH_ID", COUNT(DISTINCT "TAG_NAME") as tag_count
    FROM "CYCLE_STD_MST_MMS"
    GROUP BY "MACH_ID" ORDER BY tag_count DESC LIMIT 10
  `);
  console.log('\n=== MACH_ID별 TAG 수 TOP 10 ===');
  for (const r of machTags.rows) {
    console.log(`  MACH=${r.MACH_ID}: ${r.tag_count}개 TAG`);
  }

  // 5. 1시간 배치 내 평균 싸이클 수 (SAVE_DT 기준)
  const batchSize = await c.query(`
    SELECT AVG(cnt)::integer as avg_per_batch,
      MIN(cnt) as min_per_batch, MAX(cnt) as max_per_batch
    FROM (
      SELECT LEFT("SAVE_DT", 16) as save_min, COUNT(*) as cnt
      FROM "CYCLE_STD_MST_MMS"
      WHERE "SAVE_DT" IS NOT NULL
      GROUP BY 1
    ) sub
  `);
  console.log('\n=== 1시간 배치당 싸이클 수 ===');
  const b = batchSize.rows[0];
  console.log(`  avg=${b.avg_per_batch} min=${b.min_per_batch} max=${b.max_per_batch}`);

  // 6. 싸이클-스텝 연관 샘플 (매칭되는 MATERIAL_ID로 전체 흐름)
  const matched = await c.query(`
    SELECT DISTINCT c."MATERIAL_ID"
    FROM "CYCLE_STD_MST_MMS" c
    JOIN "STEP_STD_MST_MMS" s ON c."MATERIAL_ID" = s."MATERIAL_ID"
      AND c."MACH_ID" = s."MACH_ID" AND c."TAG_NAME" = s."TAG_NAME"
    LIMIT 3
  `);
  for (const m of matched.rows) {
    console.log(`\n=== 샘플 MATERIAL: ${m.MATERIAL_ID} ===`);

    const cyc = await c.query(`
      SELECT "MACH_ID","TAG_NAME","MODEL_ID","START_DT","END_DT","DIFF_DESC","STAND_YN"
      FROM "CYCLE_STD_MST_MMS"
      WHERE "MATERIAL_ID" = $1
      ORDER BY "START_DT"
      LIMIT 5
    `, [m.MATERIAL_ID]);
    console.log('  CYCLE:');
    for (const r of cyc.rows) {
      console.log(`    MACH=${r.MACH_ID} TAG=${r.TAG_NAME} ${r.START_DT.substring(0, 19)}~${r.END_DT.substring(0, 19)} diff=${r.DIFF_DESC}ms STAND=${r.STAND_YN}`);
    }

    // 첫번째 CYCLE의 STEP들
    if (cyc.rows.length > 0) {
      const first = cyc.rows[0];
      const stp = await c.query(`
        SELECT "STEP_SEQ","START_DT","END_DT","DIFF_SEC"
        FROM "STEP_STD_MST_MMS"
        WHERE "MATERIAL_ID" = $1 AND "MACH_ID" = $2 AND "TAG_NAME" = $3
        ORDER BY "STEP_SEQ"
      `, [m.MATERIAL_ID, first.MACH_ID, first.TAG_NAME]);
      console.log(`  STEP (MACH=${first.MACH_ID} TAG=${first.TAG_NAME}): ${stp.rows.length}개`);
      for (const s of stp.rows.slice(0, 10)) {
        console.log(`    SEQ=${s.STEP_SEQ} ${(s.START_DT || '').substring(0, 19)}~${(s.END_DT || '').substring(0, 19)} diff=${s.DIFF_SEC}s`);
      }
      if (stp.rows.length > 10) console.log(`    ... +${stp.rows.length - 10} more`);
    }
  }

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
