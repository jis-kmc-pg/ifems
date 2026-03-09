/**
 * 단계별 Continuous Aggregate Migration 실행
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'ifems',
  user: 'postgres',
  password: '1',
});

const migrationFiles = [
  '01_create_reset_table.sql',
  '02_create_usage_cagg.sql',
  '03_add_usage_policy.sql',
  '04_create_trend_sensor_cagg.sql',
  '05_add_trend_sensor_policy.sql',
  '06_create_corrected_view.sql',
];

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`\n📄 Executing: ${path.basename(filePath)}`);

  try {
    const result = await client.query(sql);
    console.log('✅ Success');

    // NOTICE 메시지 출력
    if (result.rows && result.rows.length > 0) {
      console.log('📊 Result:');
      console.table(result.rows);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed:');
    console.error(error.message);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to database: ifems\n');
    console.log('━'.repeat(60));

    const migrationDir = path.join(
      __dirname,
      '../prisma/migrations/20260303_continuous_aggregates_step_by_step'
    );

    for (const file of migrationFiles) {
      const filePath = path.join(migrationDir, file);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        continue;
      }

      const success = await runMigration(filePath);

      if (!success) {
        console.log('\n⚠️ Migration failed. Stopping...');
        break;
      }

      console.log('━'.repeat(60));
    }

    console.log('\n🎉 All migrations completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
