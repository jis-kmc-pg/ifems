/**
 * VQTT Migration Script
 * tag_data_raw: numericValue→value, remove stringValue/booleanValue/collectorId, add type enum
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function migrate() {
  console.log('=== VQTT Migration Start ===');

  // 1. Create DataSourceType enum
  console.log('1. Creating DataSourceType enum...');
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataSourceType') THEN
        CREATE TYPE "DataSourceType" AS ENUM ('TEST', 'COMMISSIONING', 'REAL');
      END IF;
    END
    $$;
  `);
  console.log('   Done.');

  // 2. Rename numericValue -> value
  console.log('2. Renaming numericValue -> value...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tag_data_raw RENAME COLUMN "numericValue" TO value;
  `);
  console.log('   Done.');

  // 3. Drop unused columns
  console.log('3. Dropping stringValue, booleanValue, collectorId...');
  await prisma.$executeRawUnsafe(`ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "stringValue";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "booleanValue";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tag_data_raw DROP COLUMN IF EXISTS "collectorId";`);
  console.log('   Done.');

  // 4. Add type column
  console.log('4. Adding type column (default TEST)...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tag_data_raw ADD COLUMN IF NOT EXISTS type "DataSourceType" NOT NULL DEFAULT 'TEST';
  `);
  console.log('   Done.');

  // 5. Verify
  console.log('\n=== Verification ===');
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'tag_data_raw'
    ORDER BY ordinal_position;
  `);
  console.log('Columns:');
  for (const col of columns) {
    console.log(`  ${col.column_name} (${col.data_type})`);
  }

  const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) as count FROM tag_data_raw;`);
  console.log(`\nTotal rows: ${count[0].count}`);

  console.log('\n=== VQTT Migration Complete ===');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
