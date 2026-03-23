import { Client } from 'pg';

const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '1', database: 'ifems' });

async function main() {
  await c.connect();

  // 1. CYCLE_MMS_MAPPING
  const mapping = await c.query('SELECT COUNT(*) as cnt FROM "CYCLE_MMS_MAPPING"');
  console.log(`CYCLE_MMS_MAPPING: ${mapping.rows[0].cnt}건`);

  // 2. CYCLE_STD_MST_MMS STAND_YN별
  const cycles = await c.query('SELECT "STAND_YN", COUNT(*) as cnt FROM "CYCLE_STD_MST_MMS" GROUP BY "STAND_YN" ORDER BY "STAND_YN"');
  console.log('\nCYCLE_STD_MST_MMS (STAND_YN별):');
  for (const r of cycles.rows) console.log(`  STAND_YN=${r.STAND_YN}: ${r.cnt}건`);

  // 3. STEP_STD_MST_MMS
  const steps = await c.query('SELECT COUNT(*) as cnt FROM "STEP_STD_MST_MMS"');
  console.log(`\nSTEP_STD_MST_MMS: ${steps.rows[0].cnt}건`);

  // 4. 신규 추가된 매핑 확인 (PLANT_CD='ifems')
  const newMapping = await c.query(`SELECT COUNT(*) as cnt FROM "CYCLE_MMS_MAPPING" WHERE "PLANT_CD" = 'ifems'`);
  console.log(`\n신규 매핑 (PLANT_CD=ifems): ${newMapping.rows[0].cnt}건`);

  // 5. 기준 싸이클 샘플
  const refSample = await c.query(`SELECT "MACH_ID", "TAG_NAME", "MATERIAL_ID", "DIFF_DESC" FROM "CYCLE_STD_MST_MMS" WHERE "STAND_YN" = 1 ORDER BY "MACH_ID" LIMIT 5`);
  console.log('\n기준 싸이클 샘플:');
  for (const r of refSample.rows) console.log(`  MACH=${r.MACH_ID} TAG=${r.TAG_NAME} DUR=${Math.round(r.DIFF_DESC / 1000)}초`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
