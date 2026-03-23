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

  const r = await c.query('SELECT id, code, name FROM facilities ORDER BY code LIMIT 50');
  console.log('=== facilities.code 샘플 ===');
  for (const row of r.rows) console.log(`  ${row.code} → ${row.name} (${row.id.substring(0,8)}...)`);

  const cnt = await c.query('SELECT COUNT(*) as cnt FROM facilities');
  console.log(`\n총: ${cnt.rows[0].cnt}개 설비`);

  // MCN_CD 형식 비교
  const mapping = await c.query(`
    SELECT m."MCN_CD",
      REPLACE(m."MCN_CD", '_', '-') as converted,
      f.code as fac_code
    FROM "CYCLE_MMS_MAPPING" m
    LEFT JOIN facilities f ON f.code = REPLACE(m."MCN_CD", '_', '-')
    WHERE f.id IS NULL
    LIMIT 10
  `);
  console.log('\n=== 변환 시도 (underscore → hyphen) ===');
  for (const row of mapping.rows) {
    console.log(`  ${row.MCN_CD} → ${row.converted} (NOT FOUND)`);
  }

  // facilities.code에서 HNK로 시작하는 것
  const hnk = await c.query(`SELECT code FROM facilities WHERE code LIKE 'HNK%' ORDER BY code LIMIT 30`);
  console.log('\n=== HNK 시작 facilities ===');
  for (const row of hnk.rows) console.log(`  ${row.code}`);

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
