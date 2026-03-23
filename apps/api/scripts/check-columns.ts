import { Client } from 'pg';

const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '1', database: 'ifems' });

async function main() {
  await c.connect();
  const r = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='CYCLE_STD_MST_MMS' ORDER BY ordinal_position`);
  console.log('=== CYCLE_STD_MST_MMS columns ===');
  for (const row of r.rows) console.log(`  ${row.column_name} (${row.data_type})`);
  const r2 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='STEP_STD_MST_MMS' ORDER BY ordinal_position`);
  console.log('=== STEP_STD_MST_MMS columns ===');
  for (const row of r2.rows) console.log(`  ${row.column_name} (${row.data_type})`);
  await c.end();
}

main().catch(e => { console.error(e.message); c.end(); process.exit(1); });
