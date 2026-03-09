/**
 * Check UUID mapping between facilities and energy_timeseries
 */

const { Client } = require('pg');

async function checkUuidMapping() {
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

    // Check HNK10_060 UUID
    console.log('🔍 Checking HNK10_060 facility...');
    const hnk060 = await client.query(`
      SELECT id, code, name
      FROM facilities
      WHERE code = 'HNK10_060';
    `);
    if (hnk060.rows.length > 0) {
      console.log('✅ HNK10_060 facility found:');
      console.table(hnk060.rows);

      const facilityUuid = hnk060.rows[0].id;
      console.log(`\nFacility UUID: ${facilityUuid}\n`);

      // Check if this facility has energy_timeseries data
      console.log('📊 Checking energy_timeseries for HNK10_060...');
      const energyData = await client.query(`
        SELECT *
        FROM energy_timeseries
        WHERE "facilityId" = $1
        ORDER BY timestamp DESC
        LIMIT 5;
      `, [facilityUuid]);

      if (energyData.rows.length > 0) {
        console.log('✅ Energy data found:');
        console.table(energyData.rows);
      } else {
        console.log('❌ No energy_timeseries data for HNK10_060');
      }

      // Check tags for HNK10_060
      console.log('\n📊 Checking tags for HNK10_060...');
      const tags = await client.query(`
        SELECT id, "tagName", "displayName", "energyType"
        FROM tags
        WHERE "facilityId" = $1
        LIMIT 10;
      `, [facilityUuid]);

      if (tags.rows.length > 0) {
        console.log('✅ Tags found:');
        console.table(tags.rows);

        // Check tag_data_raw for these tags
        const tagId = tags.rows[0].id;
        console.log(`\n📊 Checking tag_data_raw for tag ${tags.rows[0].tagName}...`);
        const tagData = await client.query(`
          SELECT *
          FROM tag_data_raw
          WHERE "tagId" = $1
          ORDER BY timestamp DESC
          LIMIT 5;
        `, [tagId]);

        if (tagData.rows.length > 0) {
          console.log('✅ Tag data found:');
          console.table(tagData.rows);
        } else {
          console.log('❌ No tag_data_raw for this tag');
        }
      } else {
        console.log('❌ No tags found for HNK10_060');
      }
    }

    // Check which facilities have energy_timeseries data
    console.log('\n📊 Facilities with energy_timeseries data:');
    const facilitiesWithData = await client.query(`
      SELECT f.code, f.name, COUNT(e.id) as data_count
      FROM facilities f
      LEFT JOIN energy_timeseries e ON f.id = e."facilityId"
      WHERE e.id IS NOT NULL
      GROUP BY f.code, f.name
      ORDER BY data_count DESC
      LIMIT 10;
    `);

    if (facilitiesWithData.rows.length > 0) {
      console.table(facilitiesWithData.rows);
    } else {
      console.log('❌ No facilities with energy_timeseries data');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkUuidMapping();
