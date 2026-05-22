-- ============================================================
-- Phase 2-③ 3대 파트 분류 view — public.v_facility_part
-- Date: 2026-05-22
-- 분류: UTILITY | HVAC | LIGHTING
--   - HVAC, LIGHTING: facilities.type 그대로
--   - 그 외(MC/COMPRESSOR/COOLING/DUST_COLLECTOR/...): UTILITY 로 통합
-- 사용처: 사이드바 그룹·KPI 집계·필터링
-- ============================================================

CREATE OR REPLACE VIEW public.v_facility_part AS
SELECT
    f.id,
    f.code,
    f.name,
    f."lineId",
    f."zoneId",
    f.type,
    f.status,
    f."isProcessing",
    f.metadata,
    CASE
        WHEN f.type = 'HVAC'     THEN 'HVAC'
        WHEN f.type = 'LIGHTING' THEN 'LIGHTING'
        ELSE 'UTILITY'
    END AS part
FROM public.facilities f;

COMMENT ON VIEW public.v_facility_part IS '설비 → 3대 파트 분류 (UTILITY/HVAC/LIGHTING)';

\echo === 파트별 facility 분포 ===
SELECT part, count(*) AS cnt
  FROM public.v_facility_part
 GROUP BY part
 ORDER BY part;
