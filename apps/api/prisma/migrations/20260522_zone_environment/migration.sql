-- ============================================================
-- Phase 4-1 Zone 실내 온도 측정 인프라
-- Date: 2026-05-22
-- Scope:
--   1) Zone마다 'ZONE_ENV' 가상 facility 1개 신설 (각 Zone에 1:1)
--      - 실제 BMS는 Zone별 별도 온도 센서가 있으므로, 이를 모델링하기 위한
--        가상 facility (type='ZONE_ENV')
--   2) INDOOR_TEMP tag (INSTANTANEOUS, ENVIRONMENT, °C) 등록
--   3) 24h 모의 시계열 (사인파 + 야간 낮밤 차)
-- ============================================================

-- 1) zone_env line (모든 ZONE_ENV facility를 한 라인에 모음)
INSERT INTO public.lines (id, code, name, "factoryId", "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'ZONE_ENV', '존 환경 센서', f.id, 200, true, now(), now()
  FROM public.factories f WHERE f.code = 'hw4' OR f.name LIKE '%4공장%' LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- 2) Zone마다 ZONE_ENV facility 1개 (Outdoor 제외)
INSERT INTO public.facilities
  (id, code, name, "lineId", type, status, "isProcessing", "zoneId", metadata, "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'ENV-' || z.code,
    z.name || ' — 환경 센서',
    (SELECT id FROM public.lines WHERE code = 'ZONE_ENV' LIMIT 1),
    'ZONE_ENV',
    'NORMAL'::"FacilityStatus",
    false,
    z.id,
    jsonb_build_object('purpose', 'zone-environment-sensor'),
    now(), now()
  FROM fems.zones z
 WHERE z."zoneType" <> 'OUTDOOR'
   AND NOT EXISTS (
     SELECT 1 FROM public.facilities f
      WHERE f."zoneId" = z.id AND f.type = 'ZONE_ENV'
   )
ON CONFLICT (code) DO NOTHING;

-- 3) INDOOR_TEMP tag (INSTANTANEOUS, ENVIRONMENT, °C)
INSERT INTO public.tags
  (id, "facilityId", "tagName", "displayName", "measureType", category, "energyType", unit, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f.id,
       replace(f.code, '-', '_') || '_INDOOR_TEMP', '실내 온도',
       'INSTANTANEOUS'::"MeasureType", 'ENVIRONMENT'::"TagCategory", NULL,
       '°C', 0, true, now(), now()
  FROM public.facilities f WHERE f.type = 'ZONE_ENV'
ON CONFLICT ("tagName") DO NOTHING;

-- 4) INDOOR_TEMP 24h × 10분 모의 시계열 (Zone별 base 온도 + 일중 변동)
WITH series AS (
  SELECT generate_series(NOW() - interval '24 hours', NOW(), interval '10 minutes') AS ts
), temp_tags AS (
  SELECT t.id AS tag_id, z."zoneType",
         CASE z."zoneType"
           WHEN 'PRODUCTION' THEN 26.0
           WHEN 'OFFICE'     THEN 23.0
           WHEN 'CORRIDOR'   THEN 22.0
           WHEN 'WAREHOUSE'  THEN 18.0
           WHEN 'PARKING'    THEN 15.0
           WHEN 'LOUNGE'     THEN 24.0
           ELSE 22.0
         END AS base_temp
    FROM public.tags t
    JOIN public.facilities f ON t."facilityId" = f.id
    JOIN fems.zones z         ON f."zoneId" = z.id
   WHERE f.type = 'ZONE_ENV' AND t."tagName" LIKE '%_INDOOR_TEMP'
)
INSERT INTO public.tag_data_raw (timestamp, "tagId", value, quality, type)
SELECT
  s.ts, tt.tag_id,
  tt.base_temp
    + 2.5 * sin(2 * pi() * EXTRACT(hour FROM s.ts) / 24.0)  -- 일중 사인파
    + (random() - 0.5) * 0.6                                  -- ±0.3°C 노이즈
    AS value,
  'GOOD'::"DataQuality", 'TEST'::"DataSourceType"
  FROM series s CROSS JOIN temp_tags tt
ON CONFLICT (timestamp, "tagId") DO NOTHING;

-- ============================================================
-- 검증
-- ============================================================
\echo === ZONE_ENV facility ===
SELECT count(*) AS env_facilities FROM public.facilities WHERE type = 'ZONE_ENV';

\echo === INDOOR_TEMP tag ===
SELECT count(*) AS indoor_temp_tags
  FROM public.tags t JOIN public.facilities f ON t."facilityId" = f.id
 WHERE f.type = 'ZONE_ENV';

\echo === 시계열 행수 ===
SELECT count(*) AS temp_rows
  FROM public.tag_data_raw r
  JOIN public.tags t ON r."tagId" = t.id
  JOIN public.facilities f ON t."facilityId" = f.id
 WHERE f.type = 'ZONE_ENV';

\echo === Zone별 최근 온도 ===
SELECT z.code, z.name, ROUND(latest.value::numeric, 1) AS temp_c
  FROM fems.zones z
  JOIN public.facilities f ON f."zoneId" = z.id AND f.type = 'ZONE_ENV'
  JOIN public.tags t ON t."facilityId" = f.id AND t."tagName" LIKE '%_INDOOR_TEMP'
  LEFT JOIN LATERAL (
    SELECT value FROM public.tag_data_raw r
     WHERE r."tagId" = t.id ORDER BY r.timestamp DESC LIMIT 1
  ) latest ON true
 ORDER BY z.code;
