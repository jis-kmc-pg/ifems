/**
 * Migration 실행 스크립트
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/20260303_add_continuous_aggregates_and_reset_events/migration.sql'
  );

  console.log('📂 Reading migration file...');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🚀 Executing migration...');

  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
