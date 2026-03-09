-- ============================================================
-- i-FEMS Continuous Aggregates + Reset Events
-- Created: 2026-03-03
-- Description: TimescaleDB Continuous Aggregates 생성 + 리셋 이벤트 관리
-- ============================================================

-- ============================================================
-- 0. 기존 객체 삭제 (재실행 대비)
-- ============================================================
-- 참고: 초기 생성 시에는 주석 처리
-- DROP VIEW IF EXISTS cagg_usage_1min_corrected CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1min CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS cagg_trend_10sec CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS cagg_sensor_10sec CASCADE;

-- ============================================================
-- 1. 리셋 이벤트 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_reset_events (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tag_id VARCHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  reset_time TIMESTAMPTZ NOT NULL,
  value_before_reset DOUBLE PRECISION NOT NULL,
  value_after_reset DOUBLE PRECISION,
  detection_method VARCHAR(20) DEFAULT 'auto' NOT NULL,
  correction_applied BOOLEAN DEFAULT true NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tag_id, reset_time)
);

CREATE INDEX idx_meter_reset_events_tag_time ON meter_reset_events(tag_id, reset_time);
CREATE INDEX idx_meter_reset_events_time ON meter_reset_events(reset_time);

COMMENT ON TABLE meter_reset_events IS '계측기 누적치 리셋 이벤트 기록';
COMMENT ON COLUMN meter_reset_events.detection_method IS 'auto: 자동 감지, manual: 수동 기록';
COMMENT ON COLUMN meter_reset_events.correction_applied IS '보정값 적용 여부';

-- ============================================================
-- 2. USAGE Continuous Aggregate (1분)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_usage_1min
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
JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'USAGE'
GROUP BY bucket, t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

-- Refresh Policy: 1분마다 갱신
SELECT add_continuous_aggregate_policy('cagg_usage_1min',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

COMMENT ON MATERIALIZED VIEW cagg_usage_1min IS '1분 적산 집계 (리셋 미보정)';

-- ============================================================
-- 3. 리셋 보정 포함 View
-- ============================================================
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

-- ============================================================
-- 4. TREND Continuous Aggregate (10초)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_trend_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t.timestamp) as bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType"::text as energy_type,
  LAST(t."numericValue", t.timestamp) as last_value,
  COUNT(*) as data_count
FROM tag_data_raw t
JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'TREND'
GROUP BY bucket, t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

-- Refresh Policy: 20초마다 갱신
SELECT add_continuous_aggregate_policy('cagg_trend_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);

COMMENT ON MATERIALIZED VIEW cagg_trend_10sec IS '10초 TREND 집계 (순시값 LAST)';

-- ============================================================
-- 5. SENSOR Continuous Aggregate (10초)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_sensor_10sec
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
JOIN tags tag ON t."tagId" = tag.id
WHERE tag."tagType" = 'SENSOR'
GROUP BY bucket, t."tagId", tag."facilityId", tag."displayName"
WITH NO DATA;

-- Refresh Policy: 20초마다 갱신
SELECT add_continuous_aggregate_policy('cagg_sensor_10sec',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '10 seconds',
  schedule_interval => INTERVAL '20 seconds'
);

COMMENT ON MATERIALIZED VIEW cagg_sensor_10sec IS '10초 SENSOR 집계 (평균값 AVG)';

-- ============================================================
-- 6. 초기 데이터 Refresh (비동기 실행)
-- ============================================================
-- 참고: 초기 데이터가 많으면 시간이 걸릴 수 있으므로
-- 백그라운드에서 자동으로 Refresh Policy가 실행되도록 함
-- 필요시 수동 실행: CALL refresh_continuous_aggregate('cagg_usage_1min', NULL, NULL);

-- ============================================================
-- 7. 완료 메시지
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Continuous Aggregates and Reset Events created successfully';
  RAISE NOTICE '📊 Created: cagg_usage_1min, cagg_trend_10sec, cagg_sensor_10sec';
  RAISE NOTICE '🔄 Created: meter_reset_events table';
  RAISE NOTICE '📈 Created: cagg_usage_1min_corrected view';
END $$;
