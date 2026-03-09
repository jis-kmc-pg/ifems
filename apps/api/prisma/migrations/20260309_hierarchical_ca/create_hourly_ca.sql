-- DIFF hourly: cagg_usage_1min -> cagg_usage_1h
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

-- INTEGRAL_TRAP hourly: cagg_trend_usage_1min -> cagg_trend_usage_1h
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
