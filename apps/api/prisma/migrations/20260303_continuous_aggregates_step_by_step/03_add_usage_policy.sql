-- ============================================================
-- Step 3: USAGE Continuous Aggregate에 Refresh Policy 추가
-- ============================================================

-- 기존 Policy 삭제 (있을 경우)
SELECT remove_continuous_aggregate_policy('cagg_usage_1min', if_exists => true);

-- Refresh Policy 추가: 1분마다 갱신
SELECT add_continuous_aggregate_policy('cagg_usage_1min',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- Policy 확인
SELECT view_name, schedule_interval, config
FROM timescaledb_information.jobs
WHERE application_name LIKE '%cagg_usage_1min%';
