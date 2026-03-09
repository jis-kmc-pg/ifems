-- TimescaleDB Continuous Aggregate for 1-minute energy usage
-- Purpose: Pre-aggregated 1-minute energy data for faster queries
-- Created: 2026-02-28

-- Drop existing continuous aggregate if exists
DROP MATERIALIZED VIEW IF EXISTS energy_usage_1min CASCADE;

-- Create continuous aggregate for 1-minute energy usage
CREATE MATERIALIZED VIEW energy_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS power_kwh,
  AVG("airL") AS air_l
FROM energy_timeseries
GROUP BY bucket, "facilityId"
WITH NO DATA;

-- Create indexes for better query performance
CREATE INDEX ON energy_usage_1min (bucket DESC, "facilityId");
CREATE INDEX ON energy_usage_1min ("facilityId", bucket DESC);

-- Add refresh policy (refresh every 5 minutes for data older than 10 minutes)
SELECT add_continuous_aggregate_policy('energy_usage_1min',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 minutes',
  schedule_interval => INTERVAL '5 minutes');

-- Initial refresh
CALL refresh_continuous_aggregate('energy_usage_1min', NULL, NULL);

-- Verify creation
SELECT
  view_name,
  materialized_only,
  compression_enabled
FROM timescaledb_information.continuous_aggregates
WHERE view_name = 'energy_usage_1min';
