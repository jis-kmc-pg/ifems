-- ============================================================
-- Hierarchical Continuous Aggregates: 1min -> 1h -> 1d
-- All use default origin (-infinity) for hierarchy compatibility
-- KST offset applied at query time (bucket + INTERVAL '9 hours')
-- ============================================================

-- ============================================================
-- HOURLY CAs (from 1min)
-- ============================================================
CREATE MATERIALIZED VIEW cagg_usage_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  SUM(raw_usage_diff) AS raw_usage_diff,
  SUM(data_count) AS data_count
FROM cagg_usage_1min
WHERE last_value IS NOT NULL
GROUP BY time_bucket('1 hour', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_usage_1h SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_usage_1h',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

CREATE MATERIALIZED VIEW cagg_trend_usage_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  SUM(avg_value) AS sum_value,
  SUM(data_count) AS data_count
FROM cagg_trend_usage_1min
WHERE avg_value IS NOT NULL
GROUP BY time_bucket('1 hour', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_trend_usage_1h SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_trend_usage_1h',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- ============================================================
-- DAILY CAs (from 1h, UTC day boundaries)
-- KST daily = query with bucket + INTERVAL '9 hours'
-- ============================================================
CREATE MATERIALIZED VIEW cagg_usage_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  SUM(raw_usage_diff) AS raw_usage_diff,
  SUM(data_count) AS data_count
FROM cagg_usage_1h
GROUP BY time_bucket('1 day', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_usage_1d SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_usage_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

CREATE MATERIALIZED VIEW cagg_trend_usage_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  SUM(sum_value) AS sum_value,
  SUM(data_count) AS data_count
FROM cagg_trend_usage_1h
GROUP BY time_bucket('1 day', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_trend_usage_1d SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_trend_usage_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS cagg_usage_1h_bucket_idx ON cagg_usage_1h (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1h_fac_bucket_idx ON cagg_usage_1h ("facilityId", bucket);
CREATE INDEX IF NOT EXISTS cagg_trend_usage_1h_bucket_idx ON cagg_trend_usage_1h (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1d_bucket_idx ON cagg_usage_1d (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1d_fac_bucket_idx ON cagg_usage_1d ("facilityId", bucket);
CREATE INDEX IF NOT EXISTS cagg_trend_usage_1d_bucket_idx ON cagg_trend_usage_1d (bucket);

-- ============================================================
-- Backfill
-- ============================================================
CALL refresh_continuous_aggregate('cagg_usage_1h', NULL, localtimestamp);
CALL refresh_continuous_aggregate('cagg_trend_usage_1h', NULL, localtimestamp);
CALL refresh_continuous_aggregate('cagg_usage_1d', NULL, localtimestamp);
CALL refresh_continuous_aggregate('cagg_trend_usage_1d', NULL, localtimestamp);
