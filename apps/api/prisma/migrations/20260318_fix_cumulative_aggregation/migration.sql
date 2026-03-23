-- ============================================================
-- FIX: 적산(CUMULATIVE) 상위 CA에서 SUM(raw_usage_diff) → LAST-FIRST 전환
-- 2026-03-18
--
-- 원칙: 적산 계량기는 결측 중에도 누적되므로 구간 사용량은
--        LAST(last_value) - FIRST(first_value)가 정확함.
--        SUM(raw_usage_diff)는 결측 구간 사용량이 누락되어 과소 계상됨.
--
-- 변경 대상: cagg_usage_15min, cagg_usage_1h, cagg_usage_1d
-- 변경 없음: cagg_usage_1min (1분 내 LAST-FIRST, 1초 수집이라 결측 사실상 없음)
-- ============================================================

-- ============================================================
-- Step 1: 상위→하위 순으로 DROP (의존성 역순)
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1d CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1h CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_usage_15min CASCADE;

-- ============================================================
-- Step 2: 하위→상위 순으로 CREATE (raw_usage_diff = LAST-FIRST)
-- ============================================================

-- 15분 집계 (from cagg_usage_1min)
CREATE MATERIALIZED VIEW cagg_usage_15min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  LAST(last_value, bucket) - FIRST(first_value, bucket) AS raw_usage_diff,
  SUM(data_count) AS data_count
FROM cagg_usage_1min
WHERE last_value IS NOT NULL
GROUP BY time_bucket('15 minutes', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_usage_15min SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_usage_15min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes'
);

-- 1시간 집계 (from cagg_usage_1min)
CREATE MATERIALIZED VIEW cagg_usage_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  LAST(last_value, bucket) - FIRST(first_value, bucket) AS raw_usage_diff,
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

-- 1일 집계 (from cagg_usage_1h)
CREATE MATERIALIZED VIEW cagg_usage_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS bucket,
  "tagId",
  "facilityId",
  energy_type,
  FIRST(first_value, bucket) AS first_value,
  LAST(last_value, bucket) AS last_value,
  LAST(last_value, bucket) - FIRST(first_value, bucket) AS raw_usage_diff,
  SUM(data_count) AS data_count
FROM cagg_usage_1h
GROUP BY time_bucket('1 day', bucket), "tagId", "facilityId", energy_type;

ALTER MATERIALIZED VIEW cagg_usage_1d SET (timescaledb.materialized_only = true);

SELECT add_continuous_aggregate_policy('cagg_usage_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

-- ============================================================
-- Step 3: 인덱스 재생성
-- ============================================================
CREATE INDEX IF NOT EXISTS cagg_usage_15min_bucket_idx ON cagg_usage_15min (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_15min_fac_bucket_idx ON cagg_usage_15min ("facilityId", bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1h_bucket_idx ON cagg_usage_1h (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1h_fac_bucket_idx ON cagg_usage_1h ("facilityId", bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1d_bucket_idx ON cagg_usage_1d (bucket);
CREATE INDEX IF NOT EXISTS cagg_usage_1d_fac_bucket_idx ON cagg_usage_1d ("facilityId", bucket);

-- ============================================================
-- Step 4: Backfill (기존 데이터 재집계)
-- ============================================================
CALL refresh_continuous_aggregate('cagg_usage_15min', NULL, localtimestamp);
CALL refresh_continuous_aggregate('cagg_usage_1h', NULL, localtimestamp);
CALL refresh_continuous_aggregate('cagg_usage_1d', NULL, localtimestamp);
