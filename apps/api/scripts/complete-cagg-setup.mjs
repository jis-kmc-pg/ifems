/**
 * Complete Continuous Aggregate Setup
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

  try {
    await client.query(sql);
    console.log('✅ Success');
    return true;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to ifems\n');
    console.log('━'.repeat(80));

    // 1. Reset Events Table
    await executeSQL(
      '1. Create meter_reset_events table',
      `
CREATE TABLE IF NOT EXISTS meter_reset_events (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tag_id VARCHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  reset_time TIMESTAMPTZ NOT NULL,
  value_before_reset DOUBLE PRECISION NOT NULL,
  value_after_reset DOUBLE PRECISION,
  detection_method VARCHAR(20) DEFAULT 'auto' NOT NULL,
  correction_applied BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tag_id, reset_time)
);
      `
    );

    await executeSQL(
      '1-2. Create indexes',
      `
CREATE INDEX IF NOT EXISTS idx_meter_reset_events_tag_time
  ON meter_reset_events(tag_id, reset_time);
CREATE INDEX IF NOT EXISTS idx_meter_reset_events_time
  ON meter_reset_events(reset_time);
      `
    );

    // 2. USAGE Continuous Aggregate (이미 생성됨, Policy만 추가)
    await executeSQL(
      '2. Add USAGE refresh policy',
      `
SELECT remove_continuous_aggregate_policy('cagg_usage_1min', if_exists => true);
SELECT add_continuous_aggregate_policy('cagg_usage_1min',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);
      `
    );

    // 3. TREND Continuous Aggregate
    await executeSQL(
      '3. Create TREND Continuous Aggregate',
      `
DROP MATERIALIZED VIEW IF EXISTS cagg_trend_10sec CASCADE;

CREATE MATERIALIZED VIEW cagg_trend_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" as energy_type,
  LAST(t."numericValue", t.timestamp) as last_value,
  COUNT(*) as data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'TREND'
  AND t."numericValue" IS NOT NULL
GROUP BY bucket, t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;
      `
    );

    await executeSQL(
      '3-2. Add TREND refresh policy',
      `
SELECT add_continuous_aggregate_policy('cagg_trend_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);
      `
    );

    // 4. SENSOR Continuous Aggregate
    await executeSQL(
      '4. Create SENSOR Continuous Aggregate',
      `
DROP MATERIALIZED VIEW IF EXISTS cagg_sensor_10sec CASCADE;

CREATE MATERIALIZED VIEW cagg_sensor_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."displayName" as sensor_name,
  AVG(t."numericValue") as avg_value,
  MIN(t."numericValue") as min_value,
  MAX(t."numericValue") as max_value,
  COUNT(*) as data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'SENSOR'
  AND t."numericValue" IS NOT NULL
GROUP BY bucket, t."tagId", tag."facilityId", tag."displayName"
WITH NO DATA;
      `
    );

    await executeSQL(
      '4-2. Add SENSOR refresh policy',
      `
SELECT add_continuous_aggregate_policy('cagg_sensor_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);
      `
    );

    // 5. Reset Correction View
    await executeSQL(
      '5. Create reset correction view',
      `
DROP VIEW IF EXISTS cagg_usage_1min_corrected CASCADE;

CREATE VIEW cagg_usage_1min_corrected AS
SELECT
  u.bucket,
  u."tagId",
  u."facilityId",
  u.energy_type,
  u.first_value,
  u.last_value,
  u.raw_usage_diff,
  u.data_count,
  COALESCE(SUM(r.value_before_reset), 0) as reset_correction,
  u.raw_usage_diff + COALESCE(SUM(r.value_before_reset), 0) as corrected_usage_diff,
  ARRAY_AGG(r.reset_time) FILTER (WHERE r.reset_time IS NOT NULL) as reset_times
FROM cagg_usage_1min u
LEFT JOIN meter_reset_events r
  ON u."tagId" = r.tag_id
  AND r.reset_time >= u.bucket
  AND r.reset_time < u.bucket + INTERVAL '1 minute'
  AND r.correction_applied = true
GROUP BY u.bucket, u."tagId", u."facilityId", u.energy_type,
         u.first_value, u.last_value, u.raw_usage_diff, u.data_count;
      `
    );

    // 6. Verify
    const result = await client.query(`
SELECT view_name, materialized_only
FROM timescaledb_information.continuous_aggregates
ORDER BY view_name;
    `);

    console.log('\n━'.repeat(80));
    console.log('\n📊 Created Continuous Aggregates:');
    console.table(result.rows);

    console.log('\n🎉 All Continuous Aggregates setup completed!');
    console.log('✅ cagg_usage_1min (1분 적산, FIRST-LAST)');
    console.log('✅ cagg_trend_10sec (10초 순시, LAST)');
    console.log('✅ cagg_sensor_10sec (10초 센서, AVG)');
    console.log('✅ cagg_usage_1min_corrected (리셋 보정 포함)');
    console.log('✅ meter_reset_events (리셋 이벤트 테이블)');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

main();
