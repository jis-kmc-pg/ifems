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

  // 1. mapping 관련 테이블 검색 (모든 스키마)
  const tables = await c.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name ILIKE '%cycle%map%' OR table_name ILIKE '%mms%map%' OR table_name ILIKE '%mach%map%'
    ORDER BY table_schema, table_name
  `);
  console.log('=== CYCLE/MMS 매핑 테이블 검색 ===');
  for (const r of tables.rows) console.log(`  ${r.table_schema}.${r.table_name}`);
  if (tables.rows.length === 0) console.log('  (없음)');

  // 2. hmchw 스키마의 모든 테이블 목록
  const allTables = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'hmchw'
    ORDER BY table_name
  `);
  console.log('\n=== hmchw 스키마 전체 테이블 ===');
  for (const r of allTables.rows) console.log(`  ${r.table_name}`);

  // 3. CYCLE_MMS_MAPPING 직접 시도
  for (const schema of ['hmchw', 'public']) {
    try {
      const sample = await c.query(`SELECT * FROM ${schema}."CYCLE_MMS_MAPPING" LIMIT 5`);
      console.log(`\n=== ${schema}.CYCLE_MMS_MAPPING 샘플 ===`);
      if (sample.rows.length > 0) {
        console.log('컬럼:', Object.keys(sample.rows[0]).join(', '));
        for (const r of sample.rows) console.log(JSON.stringify(r));
      }
    } catch (e: any) {
      console.log(`\n${schema}.CYCLE_MMS_MAPPING: ${e.message.split('\n')[0]}`);
    }
  }

  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
