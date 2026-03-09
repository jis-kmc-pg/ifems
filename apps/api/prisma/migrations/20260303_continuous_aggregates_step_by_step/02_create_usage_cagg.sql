-- ============================================================
-- Step 2: USAGE Continuous Aggregate 생성 (Policy 제외)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1min CASCADE;

CREATE MATERIALIZED VIEW cagg_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType"::text as energy_type,
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

COMMENT ON MATERIALIZED VIEW cagg_usage_1min IS '1분 적산 집계 (리셋 미보정)';

-- 생성 확인
SELECT view_name, materialized_only
FROM timescaledb_information.continuous_aggregates
WHERE view_name = 'cagg_usage_1min';
