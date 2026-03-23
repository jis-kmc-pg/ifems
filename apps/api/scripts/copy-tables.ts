import { Client } from 'pg';

const remote = new Client({
  host: '192.168.123.205',
  port: 5432,
  user: 'postgres',
  password: 'qwe123!@#',
  database: 'hmchw',
  statement_timeout: 600000,
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
  console.log('✅ 양쪽 DB 연결 완료');

  // 1. 로컬에 테이블 생성 (없으면)
  await local.query(`
    CREATE TABLE IF NOT EXISTS "CYCLE_STD_MST_MMS" (
      "MACH_ID" integer NOT NULL,
      "TAG_NAME" varchar(50) NOT NULL,
      "MATERIAL_ID" varchar(50) NOT NULL,
      "CYCLE_NM" varchar(50),
      "START_DT" varchar(50) NOT NULL,
      "END_DT" varchar(50) NOT NULL,
      "DIFF_DESC" integer,
      "STAND_YN" integer NOT NULL DEFAULT 3,
      "U_ENERGY" numeric,
      "PERSON" numeric,
      "DTW" numeric,
      "CYCLE_DELAY" integer,
      "SAVE_DT" varchar(50),
      "OFFSET" integer,
      "OFFSET_YN" integer,
      "MODEL_ID" integer NOT NULL,
      PRIMARY KEY ("MACH_ID", "TAG_NAME", "START_DT", "END_DT", "MODEL_ID", "MATERIAL_ID")
    );
  `);
  console.log('✅ CYCLE_STD_MST_MMS 테이블 생성 완료');

  await local.query(`
    CREATE TABLE IF NOT EXISTS "STEP_STD_MST_MMS" (
      "MACH_ID" integer NOT NULL,
      "TAG_NAME" varchar(50) NOT NULL,
      "MATERIAL_ID" varchar(50) NOT NULL,
      "STEP_SEQ" integer NOT NULL,
      "START_DT" varchar(50) NOT NULL,
      "END_DT" varchar(50) NOT NULL,
      "DIFF_SEC" integer,
      "SAVE_DT" varchar(50),
      "MODEL_ID" integer NOT NULL,
      PRIMARY KEY ("MACH_ID", "TAG_NAME", "MATERIAL_ID", "STEP_SEQ", "START_DT", "END_DT", "MODEL_ID")
    );
  `);
  console.log('✅ STEP_STD_MST_MMS 테이블 생성 완료');

  // 2. 기존 데이터 삭제 후 복사
  await local.query('TRUNCATE "CYCLE_STD_MST_MMS"');
  await local.query('TRUNCATE "STEP_STD_MST_MMS"');

  // CYCLE 데이터 복사 (배치, ORDER BY 제거로 속도 향상)
  const BATCH = 500;
  let offset = 0;
  let totalCycle = 0;
  while (true) {
    const rows = await remote.query(
      `SELECT * FROM hmchw."CYCLE_STD_MST_MMS" LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (rows.rows.length === 0) break;

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const r of rows.rows) {
      placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      values.push(r.MACH_ID, r.TAG_NAME, r.MATERIAL_ID, r.CYCLE_NM, r.START_DT, r.END_DT,
        r.DIFF_DESC, r.STAND_YN, r.U_ENERGY, r.PERSON, r.DTW, r.CYCLE_DELAY, r.SAVE_DT,
        r.OFFSET, r.OFFSET_YN, r.MODEL_ID);
    }

    await local.query(
      `INSERT INTO "CYCLE_STD_MST_MMS" ("MACH_ID","TAG_NAME","MATERIAL_ID","CYCLE_NM","START_DT","END_DT","DIFF_DESC","STAND_YN","U_ENERGY","PERSON","DTW","CYCLE_DELAY","SAVE_DT","OFFSET","OFFSET_YN","MODEL_ID") VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`,
      values,
    );

    totalCycle += rows.rows.length;
    offset += BATCH;
    if (rows.rows.length < BATCH) break;
  }
  console.log(`✅ CYCLE_STD_MST_MMS: ${totalCycle}건 복사 완료`);

  // STEP 데이터 복사
  offset = 0;
  let totalStep = 0;
  while (true) {
    const rows = await remote.query(
      `SELECT * FROM hmchw."STEP_STD_MST_MMS" LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (rows.rows.length === 0) break;

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const r of rows.rows) {
      placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      values.push(r.MACH_ID, r.TAG_NAME, r.MATERIAL_ID, r.STEP_SEQ, r.START_DT, r.END_DT,
        r.DIFF_SEC, r.SAVE_DT, r.MODEL_ID);
    }

    await local.query(
      `INSERT INTO "STEP_STD_MST_MMS" ("MACH_ID","TAG_NAME","MATERIAL_ID","STEP_SEQ","START_DT","END_DT","DIFF_SEC","SAVE_DT","MODEL_ID") VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`,
      values,
    );

    totalStep += rows.rows.length;
    offset += BATCH;
    if (rows.rows.length < BATCH) break;
  }
  console.log(`✅ STEP_STD_MST_MMS: ${totalStep}건 복사 완료`);

  // 3. 검증
  const v1 = await local.query('SELECT COUNT(*) as cnt FROM "CYCLE_STD_MST_MMS"');
  const v2 = await local.query('SELECT COUNT(*) as cnt FROM "STEP_STD_MST_MMS"');
  console.log(`\n=== 로컬 DB 검증 ===`);
  console.log(`CYCLE_STD_MST_MMS: ${v1.rows[0].cnt}건`);
  console.log(`STEP_STD_MST_MMS: ${v2.rows[0].cnt}건`);

  await remote.end();
  await local.end();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
