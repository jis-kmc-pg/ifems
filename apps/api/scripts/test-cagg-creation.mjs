/**
 * Continuous Aggregate 생성 테스트 (단계별 실행)
 */
import pg from 'pg';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'ifems',
  user: 'postgres',
  password: '1',
});

async function executeSQL(description, sql) {
  console.log(`\n📝 ${description}`);
  console.log(`SQL: ${sql.substring(0, 100)}...`);

  try {
    const result = await client.query(sql);
    console.log('✅ Success');

    if (result.rows && result.rows.length > 0) {
      console.table(result.rows);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed:');
    console.error('Message:', error.message);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to ifems database\n');
    console.log('━'.repeat(80));

    // Step 1: DROP 기존 View
    await executeSQL(
      'Step 1: Drop existing view',
      `DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1min CASCADE;`
    );

    // Step 2: CREATE Continuous Aggregate
    const createSQL = `
CREATE MATERIALIZED VIEW cagg_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" as energy_type,
  FIRST(t."numericValue", t.timestamp) as first_value,
  LAST(t."numericValue", t.timestamp) as last_value,
  LAST(t."numericValue", t.timestamp) - FIRST(t."numericValue", t.timestamp) as raw_usage_diff,
  COUNT(*) as data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'USAGE'
  AND t."numericValue" IS NOT NULL
GROUP BY bucket, t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;
    `.trim();

    const success = await executeSQL('Step 2: Create Continuous Aggregate', createSQL);

    if (!success) {
      console.log('\n⚠️ Creation failed. Trying without JOIN...');

      // JOIN 없이 시도 (tagType 필터 제거)
      const createSQLNoJoin = `
CREATE MATERIALIZED VIEW cagg_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', timestamp) as bucket,
  "tagId",
  FIRST("numericValue", timestamp) as first_value,
  LAST("numericValue", timestamp) as last_value,
  LAST("numericValue", timestamp) - FIRST("numericValue", timestamp) as raw_usage_diff,
  COUNT(*) as data_count
FROM tag_data_raw
WHERE "numericValue" IS NOT NULL
GROUP BY bucket, "tagId"
WITH NO DATA;
      `.trim();

      const successNoJoin = await executeSQL(
        'Step 2-Alt: Create without JOIN',
        createSQLNoJoin
      );

      if (successNoJoin) {
        console.log('\n✅ Creation successful without JOIN!');
        console.log('💡 JOIN may not be fully supported. Consider denormalizing data.');
      }
    } else {
      console.log('\n✅ Creation with JOIN successful!');
    }

    // Step 3: 확인
    await executeSQL(
      'Step 3: Verify creation',
      `SELECT view_name, materialized_only
       FROM timescaledb_information.continuous_aggregates
       WHERE view_name = 'cagg_usage_1min';`
    );

    console.log('\n━'.repeat(80));
    console.log('🎉 Test completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
