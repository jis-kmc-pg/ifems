import { Client } from 'pg';

const c = new Client({
  host: '192.168.123.205',
  port: 5432,
  user: 'postgres',
  password: 'qwe123!@#',
  database: 'hmchw',
  statement_timeout: 30000,
});

async function main() {
  await c.connect();

  // 1. 전체 건수
  const cnt = await c.query('SELECT COUNT(*) as cnt FROM hmchw."CYCLE_MMS_MAPPING"');
  console.log(`=== CYCLE_MMS_MAPPING: 총 ${cnt.rows[0].cnt}건 ===`);

  // 2. ENERGY_TYPE 분포
  const types = await c.query(`
    SELECT "ENERGY_TYPE", COUNT(*) as cnt, COUNT(DISTINCT "MACH_ID") as mach_cnt
    FROM hmchw."CYCLE_MMS_MAPPING"
    GROUP BY "ENERGY_TYPE"
  `);
  console.log('\n=== ENERGY_TYPE 분포 ===');
  for (const r of types.rows) console.log(`  ${r.ENERGY_TYPE}: ${r.cnt}건, ${r.mach_cnt}대`);

  // 3. TARGET_YN 분포
  const target = await c.query(`
    SELECT "TARGET_YN", COUNT(*) as cnt
    FROM hmchw."CYCLE_MMS_MAPPING"
    GROUP BY "TARGET_YN"
  `);
  console.log('\n=== TARGET_YN 분포 ===');
  for (const r of target.rows) console.log(`  TARGET_YN=${r.TARGET_YN}: ${r.cnt}건`);

  // 4. MCN_CD → i-FEMS 설비 코드 매핑 샘플
  console.log('\n=== MCN_CD (설비코드) 샘플 ===');
  const mcn = await c.query(`
    SELECT "MACH_ID", "TAG_NAME", "MCN_CD", "ENERGY_TYPE", "PLANT_CD", "LINE_CD"
    FROM hmchw."CYCLE_MMS_MAPPING"
    ORDER BY "MACH_ID"
    LIMIT 30
  `);
  for (const r of mcn.rows) {
    console.log(`  MACH=${r.MACH_ID} TAG=${r.TAG_NAME} MCN=${r.MCN_CD} TYPE=${r.ENERGY_TYPE} PLANT=${r.PLANT_CD} LINE=${r.LINE_CD}`);
  }

  // 5. MACH_ID 범위
  const range = await c.query(`
    SELECT MIN("MACH_ID") as min_id, MAX("MACH_ID") as max_id, COUNT(DISTINCT "MACH_ID") as cnt
    FROM hmchw."CYCLE_MMS_MAPPING"
  `);
  console.log(`\n=== MACH_ID 범위: ${range.rows[0].min_id} ~ ${range.rows[0].max_id} (${range.rows[0].cnt}개 고유값) ===`);

  // 6. MCN_CD 패턴 확인 (i-FEMS의 facility code와 매칭되는지)
  const mcnPatterns = await c.query(`
    SELECT DISTINCT "MCN_CD" FROM hmchw."CYCLE_MMS_MAPPING" ORDER BY "MCN_CD" LIMIT 50
  `);
  console.log('\n=== MCN_CD 전체 목록 ===');
  for (const r of mcnPatterns.rows) console.log(`  ${r.MCN_CD}`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
