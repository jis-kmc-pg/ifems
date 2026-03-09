-- ============================================================
-- Step 1: 리셋 이벤트 테이블만 먼저 생성
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

CREATE INDEX IF NOT EXISTS idx_meter_reset_events_tag_time
  ON meter_reset_events(tag_id, reset_time);
CREATE INDEX IF NOT EXISTS idx_meter_reset_events_time
  ON meter_reset_events(reset_time);

COMMENT ON TABLE meter_reset_events IS '계측기 누적치 리셋 이벤트 기록';
