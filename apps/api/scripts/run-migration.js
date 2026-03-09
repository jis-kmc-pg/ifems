/**
 * Run SQL migration file using pg client
 * Usage: node scripts/run-migration.js <sql-file-path>
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration(sqlFilePath) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1',
    database: 'ifems',
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database: ifems');

    // Read SQL file
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`📄 Reading SQL file: ${sqlFilePath}`);
    console.log(`📝 SQL content length: ${sqlContent.length} characters`);

    // Execute SQL
    console.log('🔄 Executing SQL...');
    const result = await client.query(sqlContent);

    console.log('✅ Migration completed successfully!');
    if (result.rows && result.rows.length > 0) {
      console.log('📊 Query result:');
      console.table(result.rows);
    }
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Main
const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node run-migration.js <sql-file-path>');
  process.exit(1);
}

const absolutePath = path.resolve(sqlFile);
if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

runMigration(absolutePath);
