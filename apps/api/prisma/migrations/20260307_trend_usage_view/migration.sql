-- ============================================================
-- cagg_trend_usage_1min: 순시값(TREND) 태그 → 1분 사용량 변환 뷰
-- ============================================================
-- 목적: INTEGRAL_TRAP 설비(에어 175개, 전력 1개)의 사용량 집계
-- 방식: cagg_trend_10sec의 순시값(kW, L/min)을 1분 평균 × (1/60)h 로 적분
-- 사용처: cagg_usage_1min과 UNION하여 전체 사용량 조회
-- ============================================================

-- 기존 뷰가 있으면 삭제 (재실행 대비)
DROP VIEW IF EXISTS cagg_trend_usage_1min CASCADE;

-- ============================================================
-- 순시값 → 1분 사용량 변환 뷰
-- ============================================================
-- AVG(last_value): 1분 내 순시값 평균 (예: kW, L/min)
-- × (1/60): 1분 = 1/60시간 → kW × h = kWh, L/min × min = L
--
-- 에어(air): 단위가 L/min → AVG × 1분 = L (그대로)
-- 전력(elec): 단위가 kW → AVG × (1/60)h = kWh
-- ============================================================
CREATE OR REPLACE VIEW cagg_trend_usage_1min AS
SELECT
  time_bucket('1 minute', t.bucket) AS bucket,
  t."tagId",
  t."facilityId",
  t.energy_type,
  -- 순시값 → 사용량 변환
  -- elec(kW): AVG * (1/60) = kWh per minute
  -- air(L/min): AVG * 1 = L per minute
  CASE
    WHEN t.energy_type = 'elec' THEN AVG(t.last_value) / 60.0
    WHEN t.energy_type = 'air'  THEN AVG(t.last_value)
    ELSE AVG(t.last_value) / 60.0
  END AS raw_usage_diff,
  SUM(t.data_count) AS data_count
FROM cagg_trend_10sec t
WHERE t.last_value IS NOT NULL
GROUP BY time_bucket('1 minute', t.bucket), t."tagId", t."facilityId", t.energy_type;

COMMENT ON VIEW cagg_trend_usage_1min IS '순시값(TREND) 태그를 1분 사용량으로 변환한 뷰 (INTEGRAL_TRAP 설비용)';

-- ============================================================
-- 통합 뷰: cagg_usage_combined_1min
-- cagg_usage_1min_corrected (DIFF 적산) + cagg_trend_usage_1min (INTEGRAL_TRAP 순시)
-- ============================================================
DROP VIEW IF EXISTS cagg_usage_combined_1min CASCADE;

CREATE OR REPLACE VIEW cagg_usage_combined_1min AS
-- DIFF 설비: 기존 corrected 뷰 사용 (리셋 보정 포함)
-- reset_correction: FIRST/LAST 방식 계산에 필요한 리셋 보정값
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

-- INTEGRAL_TRAP 설비: 순시값 적분 뷰
-- 중복 방지: facility_energy_configs에서 INTEGRAL_TRAP으로 설정된 설비+에너지타입만
SELECT
  t.bucket,
  t."tagId",
  t."facilityId",
  t.energy_type::text AS energy_type,
  NULL::double precision AS first_value,
  NULL::double precision AS last_value,
  t.raw_usage_diff AS usage_diff,
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

COMMENT ON VIEW cagg_usage_combined_1min IS 'DIFF(적산차) + INTEGRAL_TRAP(순시적분) 통합 사용량 뷰';

-- ============================================================
-- 인덱스 참고: cagg_trend_10sec에 이미 bucket 기반 인덱스 존재
-- cagg_usage_1min_corrected는 cagg_usage_1min 기반으로 인덱스 상속
-- 추가 인덱스 불필요
-- ============================================================
