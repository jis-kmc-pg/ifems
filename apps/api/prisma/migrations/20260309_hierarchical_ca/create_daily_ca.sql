-- DIFF daily: cagg_usage_1h -> cagg_usage_1d
-- KST alignment: origin 2000-01-01 15:00 UTC = 2000-01-02 00:00 KST
CREATE MATERIALIZED VIEW cagg_usage_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket, '2000-01-01 15:00:00'::timestamp) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  SUM(raw_usage_diff) AS raw_usage_diff,
  SUM(data_count) AS data_count
FROM cagg_usage_1h
GROUP BY time_bucket('1 day', bucket, '2000-01-01 15:00:00'::timestamp), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_usage_1d SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_usage_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

-- INTEGRAL_TRAP daily: cagg_trend_usage_1h -> cagg_trend_usage_1d
CREATE MATERIALIZED VIEW cagg_trend_usage_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket, '2000-01-01 15:00:00'::timestamp) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  SUM(sum_value) AS sum_value,
  SUM(data_count) AS data_count
FROM cagg_trend_usage_1h
GROUP BY time_bucket('1 day', bucket, '2000-01-01 15:00:00'::timestamp), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_trend_usage_1d SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_trend_usage_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);
