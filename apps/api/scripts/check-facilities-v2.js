/**
 * Check facilities table (lowercase) and its relationship
 */

const { Client } = require('pg');

async function checkFacilities() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1',
    database: 'ifems',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database: ifems\n');

    // Check facilities count
    const count = await client.query('SELECT COUNT(*) FROM facilities');
    console.log(`📊 Total facilities count: ${count.rows[0].count}\n`);

    // Check sample facilities
    console.log('📊 Sample facilities:');
    const facilities = await client.query(`
      SELECT id, code, name, type, status
      FROM facilities
      ORDER BY code
      LIMIT 20;
    `);
    console.table(facilities.rows);
    console.log('');

    // Search for HNK10-060 or HNK10_060
    console.log('🔍 Searching for HNK10 060 pattern...');
    const search = await client.query(`
      SELECT id, code, name, type, status
      FROM facilities
      WHERE code ILIKE '%HNK10%060%' OR code ILIKE '%HNK10-060%' OR code ILIKE '%HNK10_060%';
    `);
    if (search.rows.length > 0) {
      console.log('✅ Found matching facilities:');
      console.table(search.rows);
    } else {
      console.log('❌ No facilities matching HNK10 060 pattern');

      // Show facilities with HNK10 prefix
      const hnk10 = await client.query(`
        SELECT id, code, name, type, status
        FROM facilities
        WHERE code ILIKE 'HNK10%'
        ORDER BY code
        LIMIT 10;
      `);
      if (hnk10.rows.length > 0) {
        console.log('\n📋 Facilities starting with HNK10:');
        console.table(hnk10.rows);
      }
    }
    console.log('');

    // Check lines
    console.log('📊 Lines:');
    const lines = await client.query(`
      SELECT id, code, name
      FROM lines
      ORDER BY "order";
    `);
    console.table(lines.rows);
    console.log('');

    // Check tags for HNK10 facilities
    console.log('📊 Sample tags:');
    const tags = await client.query(`
      SELECT t.id, t."tagName", t."displayName", t."energyType", f.code as facility_code
      FROM tags t
      JOIN facilities f ON t."facilityId" = f.id
      WHERE f.code ILIKE 'HNK10%'
      LIMIT 10;
    `);
    if (tags.rows.length > 0) {
      console.table(tags.rows);
    } else {
      console.log('No tags found for HNK10 facilities');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkFacilities();
