-- ============================================================
-- Step 5: TREND + SENSOR Policy 추가
-- ============================================================

-- TREND Policy
SELECT remove_continuous_aggregate_policy('cagg_trend_10sec', if_exists => true);

SELECT add_continuous_aggregate_policy('cagg_trend_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);

-- SENSOR Policy
SELECT remove_continuous_aggregate_policy('cagg_sensor_10sec', if_exists => true);

SELECT add_continuous_aggregate_policy('cagg_sensor_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);

-- Policy 확인
SELECT view_name, schedule_interval
FROM timescaledb_information.jobs
WHERE application_name LIKE '%Continuous Aggregate%';
