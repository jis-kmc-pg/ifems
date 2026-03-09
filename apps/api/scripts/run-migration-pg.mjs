/**
 * Migration 실행 스크립트 (pg 사용)
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/20260303_add_continuous_aggregates_and_reset_events/migration.sql'
  );

  console.log('📂 Reading migration file...');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to PostgreSQL...');
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'ifems',
    user: 'postgres',
    password: '1',
  });

  try {
    await client.connect();
    console.log('✅ Connected');

    console.log('🚀 Executing migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
