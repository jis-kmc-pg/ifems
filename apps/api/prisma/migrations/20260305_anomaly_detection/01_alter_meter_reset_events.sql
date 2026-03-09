-- ============================================================
-- Step 1: meter_reset_events 테이블에 이상 감지 컬럼 추가
-- ============================================================

ALTER TABLE meter_reset_events
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'reset' NOT NULL,
  ADD COLUMN IF NOT EXISTS deviation_multiplier DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS replacement_value DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS consecutive_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_meter_reset_events_type ON meter_reset_events(event_type);

COMMENT ON COLUMN meter_reset_events.event_type IS '이벤트 유형: reset(리셋) | anomaly(이상)';
COMMENT ON COLUMN meter_reset_events.deviation_multiplier IS '이상 발생 시 실제 배율 (예: 7.3배)';
COMMENT ON COLUMN meter_reset_events.replacement_value IS '대체값 (직전 정상값 또는 NULL)';
COMMENT ON COLUMN meter_reset_events.consecutive_count IS '연속 이상 횟수 (1, 2, 3, ...)';
