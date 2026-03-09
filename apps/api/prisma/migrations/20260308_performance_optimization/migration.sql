-- ============================================================
-- 성능 최적화: cagg_trend_usage_1min → Continuous Aggregate 전환
-- ============================================================
-- 문제: cagg_trend_usage_1min이 일반 VIEW로 매 쿼리마다 16.2M행 Seq Scan (44초)
-- 해결: Continuous Aggregate로 전환하여 사전 집계 (1~3초 예상)
-- ============================================================

-- Step 1: 기존 VIEW 체인 삭제
DROP VIEW IF EXISTS cagg_usage_combined_1min CASCADE;
DROP VIEW IF EXISTS cagg_trend_usage_1min CASCADE;

-- Step 2: cagg_trend_usage_1min을 Continuous Aggregate로 재생성
-- 10초 데이터(cagg_trend_10sec) → 1분 평균값 사전 집계
CREATE MATERIALIZED VIEW cagg_trend_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t.bucket) AS bucket,
  t."tagId",
  t."facilityId",
  t.energy_type,
  AVG(t.last_value) AS avg_value,
  SUM(t.data_count) AS data_count
FROM cagg_trend_10sec t
WHERE t.last_value IS NOT NULL
GROUP BY time_bucket('1 minute', t.bucket), t."tagId", t."facilityId", t.energy_type;

-- materialized_only 설정 (실시간 미집계 데이터 제외)
ALTER MATERIALIZED VIEW cagg_trend_usage_1min SET (timescaledb.materialized_only = true);

-- Step 3: Refresh 정책 (1분마다, 1일 전~1분 전)
SELECT add_continuous_aggregate_policy('cagg_trend_usage_1min',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- Step 4: 인덱스 추가 (쿼리 패턴 최적화)
CREATE INDEX IF NOT EXISTS cagg_trend_usage_1min_bucket_idx
  ON cagg_trend_usage_1min (bucket);
CREATE INDEX IF NOT EXISTS cagg_trend_usage_1min_facilityId_bucket_idx
  ON cagg_trend_usage_1min ("facilityId", bucket);
CREATE INDEX IF NOT EXISTS cagg_trend_usage_1min_energy_type_bucket_idx
  ON cagg_trend_usage_1min (energy_type, bucket);

-- Step 5: cagg_usage_combined_1min VIEW 재생성
-- INTEGRAL_TRAP 부분: avg_value → 에너지타입별 usage_diff 변환
CREATE OR REPLACE VIEW cagg_usage_combined_1min AS
-- DIFF 설비 (적산차, 리셋 보정 포함)
SELECT
  bucket,
  "tagId",
  "facilityId",
  energy_type::text AS energy_type,
  first_value,
  last_value,
  corrected_usage_diff AS usage_diff,
  COALESCE(reset_correction, 0)::double precision AS reset_correction,
  data_count::bigint AS data_count,
  'DIFF'::text AS calc_method
FROM cagg_usage_1min_corrected

UNION ALL

-- INTEGRAL_TRAP 설비 (순시값 적분)
SELECT
  t.bucket,
  t."tagId",
  t."facilityId",
  t.energy_type::text AS energy_type,
  NULL::double precision AS first_value,
  NULL::double precision AS last_value,
  CASE WHEN t.energy_type = 'elec' THEN t.avg_value / 60.0
       WHEN t.energy_type = 'air' THEN t.avg_value
       ELSE t.avg_value / 60.0
  END AS usage_diff,
  0::double precision AS reset_correction,
  t.data_count::bigint AS data_count,
  'INTEGRAL_TRAP'::text AS calc_method
FROM cagg_trend_usage_1min t
WHERE EXISTS (
  SELECT 1 FROM facility_energy_configs fec
  WHERE fec."facilityId" = t."facilityId"
    AND fec."energyType"::text = t.energy_type::text
    AND fec."calcMethod" = 'INTEGRAL_TRAP'
    AND fec."isActive" = true
);

-- Step 6: 기존 데이터 backfill (초기 1회)
CALL refresh_continuous_aggregate('cagg_trend_usage_1min', NULL, localtimestamp);
