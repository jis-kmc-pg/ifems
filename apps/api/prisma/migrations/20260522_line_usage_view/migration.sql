-- ============================================================
-- Phase 4-3 라인별 합산 view (Line 단위 facility 카운트 + 24h 사용량)
-- Date: 2026-05-22
-- ============================================================

-- 1) 라인별 facility 카운트 (3대 파트별)
CREATE OR REPLACE VIEW public.v_line_facility_count AS
SELECT
    l.id              AS "lineId",
    l.code            AS "lineCode",
    l.name            AS "lineName",
    count(*) FILTER (WHERE v.part = 'UTILITY')  AS utility_count,
    count(*) FILTER (WHERE v.part = 'HVAC')     AS hvac_count,
    count(*) FILTER (WHERE v.part = 'LIGHTING') AS lighting_count,
    count(*)                                     AS total_count
  FROM public.lines l
  LEFT JOIN public.v_facility_part v ON v."lineId" = l.id
 GROUP BY l.id, l.code, l.name;

COMMENT ON VIEW public.v_line_facility_count IS '라인별 facility 카운트 (3대 파트 분류)';

-- 2) 라인별 24h 사용량 (CUMULATIVE ENERGY tag 차분 합)
CREATE OR REPLACE VIEW public.v_line_usage_24h AS
WITH per_tag AS (
    SELECT
        l.id      AS "lineId",
        l.code    AS "lineCode",
        t."energyType",
        t.id      AS tag_id,
        MAX(r.value) - MIN(r.value) AS diff
      FROM public.lines l
      JOIN public.facilities f ON f."lineId" = l.id
      JOIN public.tags       t ON t."facilityId" = f.id
      JOIN public.tag_data_raw r ON r."tagId" = t.id AND r.timestamp >= NOW() - interval '24 hours'
     WHERE t."measureType" = 'CUMULATIVE' AND t.category = 'ENERGY'
     GROUP BY l.id, l.code, t."energyType", t.id
)
SELECT "lineId", "lineCode", "energyType", SUM(diff)::float AS usage_24h
  FROM per_tag
 GROUP BY "lineId", "lineCode", "energyType";

COMMENT ON VIEW public.v_line_usage_24h IS '라인별 24h 누적 사용량 (CUMULATIVE ENERGY tag 차분 합)';

-- ============================================================
-- 검증
-- ============================================================
\echo === 라인별 facility 카운트 ===
SELECT "lineCode", utility_count, hvac_count, lighting_count, total_count
  FROM public.v_line_facility_count
 ORDER BY "lineCode";

\echo === 라인별 24h 사용량 ===
SELECT "lineCode", "energyType", ROUND(usage_24h::numeric, 2) AS usage_24h
  FROM public.v_line_usage_24h
 ORDER BY "lineCode", "energyType";
