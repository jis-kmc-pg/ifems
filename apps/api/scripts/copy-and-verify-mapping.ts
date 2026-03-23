import { Client } from 'pg';

const remote = new Client({
  host: '192.168.123.205',
  port: 5432,
  user: 'postgres',
  password: 'qwe123!@#',
  database: 'hmchw',
  statement_timeout: 60000,
});

const local = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1',
  database: 'ifems',
});

async function main() {
  await remote.connect();
  await local.connect();

  // 1. 로컬에 매핑 테이블 생성
  await local.query(`
    CREATE TABLE IF NOT EXISTS "CYCLE_MMS_MAPPING" (
      "MACH_ID" integer NOT NULL,
      "TAG_NAME" varchar(50) NOT NULL,
      "PLANT_CD" varchar(20),
      "LINE_CD" varchar(20),
      "MCN_CD" varchar(50),
      "ENERGY_TYPE" varchar(20),
      "TARGET_YN" integer DEFAULT 1,
      "SAVE_DT" varchar(50),
      PRIMARY KEY ("MACH_ID", "TAG_NAME")
    );
  `);
  await local.query('TRUNCATE "CYCLE_MMS_MAPPING"');

  // 2. 원격에서 전부 복사 (495건이니 한번에 가능)
  const rows = await remote.query('SELECT * FROM hmchw."CYCLE_MMS_MAPPING"');
  for (const r of rows.rows) {
    await local.query(
      `INSERT INTO "CYCLE_MMS_MAPPING" ("MACH_ID","TAG_NAME","PLANT_CD","LINE_CD","MCN_CD","ENERGY_TYPE","TARGET_YN","SAVE_DT")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [r.MACH_ID, r.TAG_NAME, r.PLANT_CD, r.LINE_CD, r.MCN_CD, r.ENERGY_TYPE, r.TARGET_YN, r.SAVE_DT]
    );
  }
  console.log(`✅ CYCLE_MMS_MAPPING: ${rows.rows.length}건 복사 완료`);

  // 3. MCN_CD → i-FEMS facilities.code 매핑 확인
  // MCN_CD: HNK10_010_1 → facilities.code: HNK10-010-1 (언더스코어→하이픈)
  const matchResult = await local.query(`
    SELECT m."MACH_ID", m."TAG_NAME", m."MCN_CD", m."ENERGY_TYPE",
      f.id as facility_id, f.code as facility_code, f.name as facility_name
    FROM "CYCLE_MMS_MAPPING" m
    LEFT JOIN facilities f ON f.code = REPLACE(m."MCN_CD", '_', '-')
    ORDER BY m."MACH_ID"
    LIMIT 30
  `);
  console.log('\n=== MCN_CD → facilities 매핑 확인 (첫 30건) ===');
  let matched = 0, unmatched = 0;
  for (const r of matchResult.rows) {
    const status = r.facility_id ? '✅' : '❌';
    if (r.facility_id) matched++; else unmatched++;
    console.log(`  ${status} MACH=${r.MACH_ID} MCN=${r.MCN_CD} → ${r.facility_code || 'NOT FOUND'} (${r.facility_name || ''})`);
  }

  // 4. 전체 매핑 통계
  const stats = await local.query(`
    SELECT
      COUNT(*) as total,
      COUNT(f.id) as matched,
      COUNT(*) - COUNT(f.id) as unmatched
    FROM "CYCLE_MMS_MAPPING" m
    LEFT JOIN facilities f ON f.code = REPLACE(m."MCN_CD", '_', '-')
  `);
  console.log(`\n=== 전체 매핑 통계 ===`);
  console.log(`  총: ${stats.rows[0].total}건 | 매칭: ${stats.rows[0].matched}건 | 미매칭: ${stats.rows[0].unmatched}건`);

  // 5. 미매칭 MCN_CD 목록
  const unmatchedList = await local.query(`
    SELECT DISTINCT m."MCN_CD"
    FROM "CYCLE_MMS_MAPPING" m
    LEFT JOIN facilities f ON f.code = REPLACE(m."MCN_CD", '_', '-')
    WHERE f.id IS NULL
    ORDER BY m."MCN_CD"
  `);
  if (unmatchedList.rows.length > 0) {
    console.log('\n=== 미매칭 MCN_CD 목록 ===');
    for (const r of unmatchedList.rows) console.log(`  ${r.MCN_CD}`);
  }

  // 6. TAG_NAME → tags.tagName 매핑 확인
  const tagMatch = await local.query(`
    SELECT
      COUNT(*) as total,
      COUNT(t.id) as matched
    FROM "CYCLE_MMS_MAPPING" m
    LEFT JOIN tags t ON t."tagName" = m."TAG_NAME"
  `);
  console.log(`\n=== TAG_NAME → tags 매핑 ===`);
  console.log(`  총: ${tagMatch.rows[0].total}건 | 매칭: ${tagMatch.rows[0].matched}건`);

  await remote.end();
  await local.end();
}

main().catch(e => { console.error(e.message); remote.end(); local.end(); process.exit(1); });
