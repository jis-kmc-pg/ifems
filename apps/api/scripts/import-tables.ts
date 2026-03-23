import { Client } from 'pg';
import * as fs from 'fs';
import * as readline from 'readline';

const local = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1',
  database: 'ifems',
});

const remote = new Client({
  host: '192.168.123.205',
  port: 5432,
  user: 'postgres',
  password: 'qwe123!@#',
  database: 'hmchw',
  statement_timeout: 300000,
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (inQuotes) {
      if (line[i] === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (line[i] === '"') {
        inQuotes = false;
      } else {
        current += line[i];
      }
    } else {
      if (line[i] === '"') {
        inQuotes = true;
      } else if (line[i] === ',') {
        result.push(current);
        current = '';
      } else {
        current += line[i];
      }
    }
  }
  result.push(current);
  return result;
}

async function main() {
  await local.connect();
  console.log('✅ 로컬 DB 연결');

  // 1. 테이블 생성
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
  console.log('✅ 테이블 생성 완료');

  // 2. CYCLE: CSV에서 로드
  await local.query('TRUNCATE "CYCLE_STD_MST_MMS"');

  const csvPath = 'd:/AI_PJ/IFEMS/Tag/cycle20260304.csv';
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8') });

  let lineNum = 0;
  let batch: any[][] = [];
  let totalCycle = 0;
  const BATCH = 200;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // header skip

    const cols = parseCSVLine(line);
    if (cols.length < 16) continue;

    const row = [
      parseInt(cols[0]), cols[1], cols[2], cols[3] || null,
      cols[4], cols[5],
      cols[6] ? parseInt(cols[6]) : null,
      parseInt(cols[7]),
      cols[8] === 'NULL' || !cols[8] ? null : parseFloat(cols[8]),
      cols[9] === 'NULL' || !cols[9] ? null : parseFloat(cols[9]),
      cols[10] === 'NULL' || !cols[10] ? null : parseFloat(cols[10]),
      cols[11] === 'NULL' || !cols[11] ? null : parseInt(cols[11]),
      cols[12] === 'NULL' || !cols[12] ? null : cols[12],
      cols[13] === 'NULL' || !cols[13] ? null : parseInt(cols[13]),
      cols[14] === 'NULL' || !cols[14] ? null : parseInt(cols[14]),
      parseInt(cols[15]),
    ];
    batch.push(row);

    if (batch.length >= BATCH) {
      await insertCycleBatch(batch);
      totalCycle += batch.length;
      batch = [];
      if (totalCycle % 10000 === 0) console.log(`  CYCLE: ${totalCycle}건...`);
    }
  }
  if (batch.length > 0) {
    await insertCycleBatch(batch);
    totalCycle += batch.length;
  }
  console.log(`✅ CYCLE_STD_MST_MMS: ${totalCycle}건 CSV에서 로드 완료`);

  // 3. STEP: 원격 DB에서 소량 (LIMIT 5000)
  await remote.connect();
  console.log('✅ 원격 DB 연결');
  await local.query('TRUNCATE "STEP_STD_MST_MMS"');

  let stepOffset = 0;
  let totalStep = 0;
  const STEP_LIMIT = 10000;
  while (totalStep < STEP_LIMIT) {
    const fetchSize = Math.min(500, STEP_LIMIT - totalStep);
    const rows = await remote.query(
      `SELECT * FROM hmchw."STEP_STD_MST_MMS" LIMIT ${fetchSize} OFFSET ${stepOffset}`
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
    stepOffset += fetchSize;
    console.log(`  STEP: ${totalStep}건...`);
    if (rows.rows.length < fetchSize) break;
  }
  console.log(`✅ STEP_STD_MST_MMS: ${totalStep}건 원격에서 로드 완료`);

  // 4. 검증
  const v1 = await local.query('SELECT COUNT(*) as cnt FROM "CYCLE_STD_MST_MMS"');
  const v2 = await local.query('SELECT COUNT(*) as cnt FROM "STEP_STD_MST_MMS"');
  console.log(`\n=== 로컬 DB 결과 ===`);
  console.log(`CYCLE_STD_MST_MMS: ${v1.rows[0].cnt}건`);
  console.log(`STEP_STD_MST_MMS: ${v2.rows[0].cnt}건`);

  await remote.end();
  await local.end();

  async function insertCycleBatch(rows: any[][]) {
    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const r of rows) {
      placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      values.push(...r);
    }
    await local.query(
      `INSERT INTO "CYCLE_STD_MST_MMS" ("MACH_ID","TAG_NAME","MATERIAL_ID","CYCLE_NM","START_DT","END_DT","DIFF_DESC","STAND_YN","U_ENERGY","PERSON","DTW","CYCLE_DELAY","SAVE_DT","OFFSET","OFFSET_YN","MODEL_ID") VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
