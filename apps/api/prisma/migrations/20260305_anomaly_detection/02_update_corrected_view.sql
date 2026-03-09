-- ============================================================
-- Step 2: cagg_usage_1min_corrected 뷰 업데이트 (리셋 + 이상 통합)
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
  -- 리셋 보정값
  COALESCE(SUM(CASE WHEN r.event_type = 'reset' THEN r.value_before_reset ELSE 0 END), 0) as reset_correction,
  -- 이상 대체값 (있으면)
  MAX(CASE WHEN r.event_type = 'anomaly' THEN r.replacement_value END) as anomaly_replacement,
  -- 이상 여부
  BOOL_OR(r.event_type = 'anomaly' AND r.correction_applied = true) as has_anomaly,
  -- 최종 보정값: 이상이면 대체값, 아니면 리셋 보정 적용
  CASE
    WHEN BOOL_OR(r.event_type = 'anomaly' AND r.correction_applied = true) THEN
      COALESCE(MAX(CASE WHEN r.event_type = 'anomaly' THEN r.replacement_value END), 0)
    ELSE
      u.raw_usage_diff + COALESCE(SUM(CASE WHEN r.event_type = 'reset' THEN r.value_before_reset ELSE 0 END), 0)
  END as corrected_usage_diff,
  -- 이벤트 시간 목록
  ARRAY_AGG(r.reset_time) FILTER (WHERE r.reset_time IS NOT NULL) as event_times
FROM cagg_usage_1min u
LEFT JOIN meter_reset_events r
  ON u."tagId" = r.tag_id
  AND r.reset_time >= u.bucket
  AND r.reset_time < u.bucket + INTERVAL '1 minute'
  AND r.correction_applied = true
GROUP BY u.bucket, u."tagId", u."facilityId", u.energy_type,
         u.first_value, u.last_value, u.raw_usage_diff, u.data_count;

COMMENT ON VIEW cagg_usage_1min_corrected IS '1분 적산 집계 (리셋 보정 + 이상 데이터 대체 포함)';
