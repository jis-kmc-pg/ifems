-- ============================================================
-- Step 4: TREND + SENSOR Continuous Aggregate 생성
-- ============================================================

-- TREND Continuous Aggregate
DROP MATERIALIZED VIEW IF EXISTS cagg_trend_10sec CASCADE;

CREATE MATERIALIZED VIEW cagg_trend_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType"::text as energy_type,
  LAST(t."numericValue", t.timestamp) as last_value,
  COUNT(*) as data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'TREND'
  AND t."numericValue" IS NOT NULL
GROUP BY bucket, t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW cagg_trend_10sec IS '10초 TREND 집계 (순시값 LAST)';

-- SENSOR Continuous Aggregate
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

COMMENT ON MATERIALIZED VIEW cagg_sensor_10sec IS '10초 SENSOR 집계 (평균값 AVG)';

-- 생성 확인
SELECT view_name, materialized_only
FROM timescaledb_information.continuous_aggregates
WHERE view_name IN ('cagg_trend_10sec', 'cagg_sensor_10sec');
