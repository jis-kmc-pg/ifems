-- ============================================================
-- i-FEMS Quality Continuous Aggregate (1분 버킷)
-- Created: 2026-03-06
-- Description: 전력 품질 데이터 집계 (3상 전류 A/B/C + 역률 PF)
--   - 불평형률: 쿼리 시점에서 A/B/C 값으로 계산
--   - 역률: AVG + MIN 집계
--   - 1분 버킷: 1초 수집 × 60개 = 안정적 AVG, 3상 시점 차이 상쇄
-- ============================================================

-- 기존 뷰 삭제 (재실행 대비)
DROP MATERIALIZED VIEW IF EXISTS cagg_quality_1min CASCADE;

-- ============================================================
-- 1. Quality Continuous Aggregate (1분)
--    category = 'QUALITY' 태그만 대상
--    tag_name으로 A/B/C/PF 구분 (쿼리 시점 CASE WHEN)
-- ============================================================
CREATE MATERIALIZED VIEW cagg_quality_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."tagName" AS tag_name,
  avg(t."numericValue") AS avg_value,
  min(t."numericValue") AS min_value,
  max(t."numericValue") AS max_value,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'INSTANTANEOUS'::"MeasureType"
  AND tag."category" = 'QUALITY'::"TagCategory"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('1 minute', t."timestamp"), t."tagId", tag."facilityId", tag."tagName"
WITH NO DATA;

-- Refresh Policy: 1분마다 갱신
SELECT add_continuous_aggregate_policy('cagg_quality_1min',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- ============================================================
-- 2. 초기 데이터 Refresh
-- ============================================================
CALL refresh_continuous_aggregate('cagg_quality_1min', NULL, NULL);
