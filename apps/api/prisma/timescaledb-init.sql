-- i-FEMS TimescaleDB Initialization Script
-- PostgreSQL + TimescaleDB 시계열 데이터 최적화

-- ============================================================
-- 1. TimescaleDB Extension 활성화
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- 2. Hypertable 생성
-- ============================================================

-- TagDataRaw 하이퍼테이블 (1일 단위 Chunk)
SELECT create_hypertable(
  'tag_data_raw',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- EnergyTimeseries 하이퍼테이블 (7일 단위 Chunk)
SELECT create_hypertable(
  'energy_timeseries',
  'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- ============================================================
-- 3. Compression 설정 (자동 압축)
-- ============================================================

-- TagDataRaw 압축 설정 (1주일 이후 데이터 자동 압축)
ALTER TABLE tag_data_raw SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"tagId"',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
  'tag_data_raw',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- EnergyTimeseries 압축 설정 (30일 이후 데이터 자동 압축)
ALTER TABLE energy_timeseries SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"facilityId"',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
  'energy_timeseries',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- ============================================================
-- 4. Retention Policy (자동 삭제)
-- ============================================================

-- TagDataRaw: 3개월 보관 (이후 자동 삭제)
SELECT add_retention_policy(
  'tag_data_raw',
  INTERVAL '3 months',
  if_not_exists => TRUE
);

-- EnergyTimeseries: 2년 보관
SELECT add_retention_policy(
  'energy_timeseries',
  INTERVAL '2 years',
  if_not_exists => TRUE
);

-- ============================================================
-- 5. Continuous Aggregate (실시간 집계 뷰)
-- ============================================================

-- 15분 단위 에너지 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS energy_15min_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS avg_power,
  MAX("powerKwh") AS max_power,
  MIN("powerKwh") AS min_power,
  SUM("powerKwh") AS sum_power,
  AVG("airL") AS avg_air,
  MAX("airL") AS max_air,
  MIN("airL") AS min_air,
  SUM("airL") AS sum_air,
  AVG(imbalance) AS avg_imbalance,
  AVG("powerFactor") AS avg_power_factor,
  COUNT(*) AS sample_count
FROM energy_timeseries
GROUP BY bucket, "facilityId"
WITH NO DATA;

-- Refresh Policy 설정 (5분마다 최신 데이터 갱신)
SELECT add_continuous_aggregate_policy(
  'energy_15min_agg',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- 1시간 단위 에너지 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS energy_1hour_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS avg_power,
  MAX("powerKwh") AS max_power,
  MIN("powerKwh") AS min_power,
  SUM("powerKwh") AS sum_power,
  AVG("airL") AS avg_air,
  MAX("airL") AS max_air,
  MIN("airL") AS min_air,
  SUM("airL") AS sum_air,
  AVG(imbalance) AS avg_imbalance,
  AVG("powerFactor") AS avg_power_factor,
  COUNT(*) AS sample_count
FROM energy_timeseries
GROUP BY bucket, "facilityId"
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'energy_1hour_agg',
  start_offset => INTERVAL '4 hours',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

-- 1일 단위 에너지 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS energy_1day_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', timestamp) AS bucket,
  "facilityId",
  AVG("powerKwh") AS avg_power,
  MAX("powerKwh") AS max_power,
  MIN("powerKwh") AS min_power,
  SUM("powerKwh") AS sum_power,
  AVG("airL") AS avg_air,
  MAX("airL") AS max_air,
  MIN("airL") AS min_air,
  SUM("airL") AS sum_air,
  AVG(imbalance) AS avg_imbalance,
  AVG("powerFactor") AS avg_power_factor,
  COUNT(*) AS sample_count
FROM energy_timeseries
GROUP BY bucket, "facilityId"
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'energy_1day_agg',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================
-- 6. 인덱스 추가 (성능 최적화)
-- ============================================================

-- TagDataRaw 인덱스
CREATE INDEX IF NOT EXISTS idx_tag_data_raw_tag_time
  ON tag_data_raw ("tagId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tag_data_raw_time_only
  ON tag_data_raw (timestamp DESC);

-- EnergyTimeseries 인덱스
CREATE INDEX IF NOT EXISTS idx_energy_ts_facility_time
  ON energy_timeseries ("facilityId", timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_ts_time_only
  ON energy_timeseries (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_ts_status
  ON energy_timeseries (status);

-- Alert 인덱스
CREATE INDEX IF NOT EXISTS idx_alerts_facility_detected
  ON alerts ("facilityId", "detectedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_severity_type
  ON alerts (severity, type);

CREATE INDEX IF NOT EXISTS idx_alerts_detected_only
  ON alerts ("detectedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_type_severity_time
  ON alerts (type, severity, "detectedAt" DESC);

-- CycleData 인덱스
CREATE INDEX IF NOT EXISTS idx_cycle_facility_start
  ON cycle_data ("facilityId", "startTime" DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_status
  ON cycle_data (status);

CREATE INDEX IF NOT EXISTS idx_cycle_number
  ON cycle_data ("cycleNumber");

CREATE INDEX IF NOT EXISTS idx_cycle_facility_number
  ON cycle_data ("facilityId", "cycleNumber");

-- ============================================================
-- 7. 통계 정보 업데이트
-- ============================================================

ANALYZE tag_data_raw;
ANALYZE energy_timeseries;
ANALYZE alerts;
ANALYZE cycle_data;
ANALYZE reference_cycles;

-- ============================================================
-- 완료 메시지
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ TimescaleDB 초기화 완료!';
  RAISE NOTICE '✅ Hypertables: tag_data_raw, energy_timeseries';
  RAISE NOTICE '✅ Continuous Aggregates: energy_15min_agg, energy_1hour_agg, energy_1day_agg';
  RAISE NOTICE '✅ Retention Policies: 3개월 (raw), 2년 (timeseries)';
  RAISE NOTICE '✅ Compression Policies: 7일 (raw), 30일 (timeseries)';
  RAISE NOTICE '✅ Indexes: 14개 성능 최적화 인덱스 생성 완료';
END$$;
