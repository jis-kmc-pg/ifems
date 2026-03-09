const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: '192.168.123.205',
    port: 5432,
    user: 'postgres',
    password: 'qwe123!@#',
    database: 'ifems',
    options: '-c search_path=public',
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('📝 Starting migration...\n');

    // Step 1: Create Factory table
    console.log('[1/16] Creating factories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "factories" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "fullName" TEXT,
        "location" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Step 2: Create Line table
    console.log('[2/16] Creating lines table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "lines" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "factoryId" TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "lines_factoryId_idx" ON "lines"("factoryId")
    `);

    // Step 3: Insert Factory data
    console.log('[3/16] Inserting factory data...');
    await client.query(`
      INSERT INTO "factories" ("id", "code", "name", "fullName", "location", "createdAt", "updatedAt")
      VALUES (
        'factory-hw4',
        'hw4',
        '4공장',
        '화성PT4공장',
        '경기도 화성시',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT ("code") DO NOTHING
    `);

    // Step 4: Insert Line data
    console.log('[4/16] Inserting line data...');
    await client.query(`
      INSERT INTO "lines" ("id", "code", "name", "factoryId", "order", "createdAt", "updatedAt")
      VALUES
        ('line-block', 'BLOCK', '블록', 'factory-hw4', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('line-head', 'HEAD', '헤드', 'factory-hw4', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('line-crank', 'CRANK', '크랑크', 'factory-hw4', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('line-assemble', 'ASSEMBLE', '조립', 'factory-hw4', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("code") DO NOTHING
    `);

    // Step 5: Add lineId column
    console.log('[5/16] Adding lineId column to facilities...');
    await client.query(`
      ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "lineId" TEXT
    `);

    // Step 6: Update lineId
    console.log('[6/16] Updating facilities.lineId from line enum...');
    await client.query(`
      UPDATE "facilities"
      SET "lineId" = CASE
        WHEN "line" = 'BLOCK' THEN 'line-block'
        WHEN "line" = 'HEAD' THEN 'line-head'
        WHEN "line" = 'CRANK' THEN 'line-crank'
        WHEN "line" = 'ASSEMBLE' THEN 'line-assemble'
      END
    `);

    // Step 7: Make lineId NOT NULL
    console.log('[7/16] Setting lineId to NOT NULL...');
    await client.query(`
      ALTER TABLE "facilities" ALTER COLUMN "lineId" SET NOT NULL
    `);

    // Step 8: Add FK constraint
    console.log('[8/16] Adding foreign key constraint...');
    await client.query(`
      ALTER TABLE "facilities"
      ADD CONSTRAINT "facilities_lineId_fkey"
      FOREIGN KEY ("lineId") REFERENCES "lines"("id") ON DELETE CASCADE
    `);

    // Step 9: Add index
    console.log('[9/16] Adding index on lineId...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "facilities_lineId_idx" ON "facilities"("lineId")
    `);

    // Step 10: Drop old line column
    console.log('[10/16] Dropping old line enum column...');
    await client.query(`
      ALTER TABLE "facilities" DROP COLUMN IF EXISTS "line"
    `);

    // Step 11: Drop old Line enum
    console.log('[11/16] Dropping old Line enum type...');
    await client.query(`
      DROP TYPE IF EXISTS "Line" CASCADE
    `);

    // Step 12: Create new Tag enums
    console.log('[12/16] Creating TagType, EnergyType enums...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "TagType" AS ENUM ('TREND', 'USAGE', 'SENSOR');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "EnergyType" AS ENUM ('elec', 'air');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Step 13: Update TagDataType enum
    console.log('[13/16] Updating TagDataType enum...');
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE "TagDataType" RENAME TO "TagDataType_old";
      EXCEPTION
        WHEN undefined_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "TagDataType" AS ENUM ('T', 'Q');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Step 14: Recreate tags table
    console.log('[14/16] Recreating tags table...');
    await client.query(`DROP TABLE IF EXISTS "tags" CASCADE`);

    await client.query(`
      CREATE TABLE "tags" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "facilityId" TEXT NOT NULL,
        "tagName" TEXT NOT NULL UNIQUE,
        "displayName" TEXT NOT NULL,
        "tagType" "TagType" NOT NULL,
        "energyType" "EnergyType",
        "dataType" "TagDataType" NOT NULL,
        "unit" TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "tags_facilityId_idx" ON "tags"("facilityId")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "tags_tagType_idx" ON "tags"("tagType")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "tags_energyType_idx" ON "tags"("energyType")
    `);

    // Step 15: Drop old TagDataType enum
    console.log('[15/16] Dropping old TagDataType enum...');
    await client.query(`DROP TYPE IF EXISTS "TagDataType_old"`);

    // Step 16: Recreate tag_data_raw
    console.log('[16/16] Recreating tag_data_raw table...');
    await client.query(`DROP TABLE IF EXISTS "tag_data_raw" CASCADE`);

    await client.query(`
      CREATE TABLE "tag_data_raw" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "timestamp" TIMESTAMP(3) NOT NULL,
        "tagId" TEXT NOT NULL,
        "numericValue" DOUBLE PRECISION,
        "stringValue" TEXT,
        "booleanValue" BOOLEAN,
        "quality" "DataQuality" NOT NULL DEFAULT 'GOOD',
        "collectorId" TEXT,
        FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "tag_data_raw_timestamp_tagId_idx" ON "tag_data_raw"("timestamp", "tagId")
    `);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify results
    console.log('=== Verification ===\n');

    const factoryCount = await client.query('SELECT COUNT(*) FROM factories');
    console.log(`Factories: ${factoryCount.rows[0].count}`);

    const lineCount = await client.query('SELECT COUNT(*) FROM lines');
    console.log(`Lines: ${lineCount.rows[0].count}`);

    const facilityCount = await client.query('SELECT COUNT(*) FROM facilities');
    console.log(`Facilities: ${facilityCount.rows[0].count}`);

    const tagCount = await client.query('SELECT COUNT(*) FROM tags');
    console.log(`Tags: ${tagCount.rows[0].count}`);

    // Check facility lineId
    const facilityCheck = await client.query(`
      SELECT f.code, f.name, l.code as line_code, l.name as line_name
      FROM facilities f
      JOIN lines l ON f."lineId" = l.id
      LIMIT 5
    `);

    console.log('\n=== Sample Facilities (with Line FK) ===');
    facilityCheck.rows.forEach(row => {
      console.log(`${row.code}: ${row.name} → Line: ${row.line_code} (${row.line_name})`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.code) console.error('Code:', error.code);
    if (error.position) console.error('Position:', error.position);
    console.error('\nFull error:', JSON.stringify(error, null, 2));
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected');
  }
}

runMigration();
