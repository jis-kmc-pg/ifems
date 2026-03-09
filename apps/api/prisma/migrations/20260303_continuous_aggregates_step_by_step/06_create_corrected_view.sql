-- ============================================================
-- Step 6: 리셋 보정 포함 View 생성
-- ============================================================

DROP VIEW IF EXISTS cagg_usage_1min_corrected CASCADE;

CREATE OR REPLACE VIEW cagg_usage_1min_corrected AS
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

COMMENT ON VIEW cagg_usage_1min_corrected IS '1분 적산 집계 (리셋 보정 포함)';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ All Continuous Aggregates setup completed!';
  RAISE NOTICE '📊 Created: cagg_usage_1min, cagg_trend_10sec, cagg_sensor_10sec';
  RAISE NOTICE '🔄 Created: meter_reset_events table';
  RAISE NOTICE '📈 Created: cagg_usage_1min_corrected view';
END $$;
