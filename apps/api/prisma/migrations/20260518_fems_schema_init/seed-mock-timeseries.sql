-- ============================================================
-- i-FEMS 부대설비 — 모의 시계열 데이터 시드 (ifems_dev 전용)
-- Date: 2026-05-19
-- Scope:
--   HVAC 6대 + LIGHTING 11대 = 17 facilities
--   각 2 tags (운전상태 + 소비전력)
--   24시간 × 10분 간격 = 144 buckets/facility
-- 멱등성: ON CONFLICT 가드
-- ⚠️ 운영 ifems DB에 적용하지 말 것 (개발 검증용 가짜 데이터)
-- ============================================================

-- 1) HVAC 운전상태 (DISCRETE): 평일 08:00-18:00 = 1, 그 외 = 0
--    base: 24h 전 (1d_ago) 부터 현재까지 10분 간격
WITH series AS (
  SELECT generate_series(
    NOW() - interval '24 hours',
    NOW(),
    interval '10 minutes'
  ) AS ts
), hvac_state_tags AS (
  SELECT t.id AS tag_id, t."tagName"
    FROM public.tags t
    JOIN public.facilities f ON t."facilityId" = f.id
   WHERE f.type = 'HVAC'
     AND t."tagName" LIKE '%_OPERATION'
)
INSERT INTO public.tag_data_raw (timestamp, "tagId", value, quality, type)
SELECT
  s.ts,
  h.tag_id,
  CASE
    WHEN EXTRACT(hour FROM s.ts) BETWEEN 8 AND 17 THEN 1.0
    ELSE 0.0
  END AS value,
  'GOOD'::"DataQuality",
  'TEST'::"DataSourceType"
  FROM series s CROSS JOIN hvac_state_tags h
ON CONFLICT (timestamp, "tagId") DO NOTHING;

-- 2) HVAC 소비전력 (CUMULATIVE): 운전 중일 때 1분당 ~0.1 kWh 누적
WITH series AS (
  SELECT generate_series(
    NOW() - interval '24 hours',
    NOW(),
    interval '10 minutes'
  ) AS ts,
  ROW_NUMBER() OVER (ORDER BY generate_series(NOW() - interval '24 hours', NOW(), interval '10 minutes')) AS idx
), hvac_power_tags AS (
  SELECT t.id AS tag_id, t."tagName",
         COALESCE((f.metadata->>'capacityRT')::float, 50) AS cap_rt
    FROM public.tags t
    JOIN public.facilities f ON t."facilityId" = f.id
   WHERE f.type = 'HVAC'
     AND t."tagName" LIKE '%_POWER'
)
INSERT INTO public.tag_data_raw (timestamp, "tagId", value, quality, type)
SELECT
  s.ts,
  h.tag_id,
  -- 누적값: 운전 시간대 가중치 × 능력 비례 + 베이스 + 정규분포 가까운 변동
  (h.cap_rt * 0.05) * s.idx *
    (CASE WHEN EXTRACT(hour FROM s.ts) BETWEEN 8 AND 17 THEN 1.0 ELSE 0.15 END) +
    (random() * 0.5) AS value,
  'GOOD'::"DataQuality",
  'TEST'::"DataSourceType"
  FROM series s CROSS JOIN hvac_power_tags h
ON CONFLICT (timestamp, "tagId") DO NOTHING;

-- 3) LIGHTING 점등상태: zone별 다른 패턴
--    PRODUCTION 작업장: 평일 08:00-22:00 ON
--    OFFICE/MEETING: 평일 09:00-18:00 ON
--    PARKING: 야간 + 평일 점심 시간만 ON (18:00-09:00 + 12:00-13:00)
--    CORRIDOR/WAREHOUSE: 평일 07:00-23:00 ON
WITH series AS (
  SELECT generate_series(
    NOW() - interval '24 hours',
    NOW(),
    interval '10 minutes'
  ) AS ts
), lgt_state_tags AS (
  SELECT t.id AS tag_id, z."zoneType"
    FROM public.tags t
    JOIN public.facilities f ON t."facilityId" = f.id
    JOIN fems.zones z         ON f."zoneId" = z.id
   WHERE f.type = 'LIGHTING'
     AND t."tagName" LIKE '%_ONOFF'
)
INSERT INTO public.tag_data_raw (timestamp, "tagId", value, quality, type)
SELECT
  s.ts,
  l.tag_id,
  CASE
    WHEN l."zoneType" = 'PRODUCTION' AND EXTRACT(hour FROM s.ts) BETWEEN 8 AND 21 THEN 1.0
    WHEN l."zoneType" IN ('OFFICE') AND EXTRACT(hour FROM s.ts) BETWEEN 9 AND 17 THEN 1.0
    WHEN l."zoneType" IN ('CORRIDOR','WAREHOUSE') AND EXTRACT(hour FROM s.ts) BETWEEN 7 AND 22 THEN 1.0
    WHEN l."zoneType" = 'PARKING' AND (EXTRACT(hour FROM s.ts) >= 18 OR EXTRACT(hour FROM s.ts) < 9) THEN 1.0
    ELSE 0.0
  END AS value,
  'GOOD'::"DataQuality",
  'TEST'::"DataSourceType"
  FROM series s CROSS JOIN lgt_state_tags l
ON CONFLICT (timestamp, "tagId") DO NOTHING;

-- 4) LIGHTING 소비전력 (CUMULATIVE): 점등 상태에 비례 누적
WITH series AS (
  SELECT generate_series(
    NOW() - interval '24 hours',
    NOW(),
    interval '10 minutes'
  ) AS ts,
  ROW_NUMBER() OVER (ORDER BY generate_series(NOW() - interval '24 hours', NOW(), interval '10 minutes')) AS idx
), lgt_power_tags AS (
  SELECT t.id AS tag_id, z."zoneType",
         COALESCE((f.metadata->>'ratedW')::float, 1000) / 1000.0 AS rated_kw
    FROM public.tags t
    JOIN public.facilities f ON t."facilityId" = f.id
    JOIN fems.zones z         ON f."zoneId" = z.id
   WHERE f.type = 'LIGHTING'
     AND t."tagName" LIKE '%_POWER'
)
INSERT INTO public.tag_data_raw (timestamp, "tagId", value, quality, type)
SELECT
  s.ts,
  l.tag_id,
  -- 점등 시 (1/6) kWh / 10min × rated_kw 비례 누적
  l.rated_kw * s.idx / 6.0 *
    (CASE
       WHEN l."zoneType" = 'PRODUCTION' AND EXTRACT(hour FROM s.ts) BETWEEN 8 AND 21 THEN 1.0
       WHEN l."zoneType" = 'OFFICE' AND EXTRACT(hour FROM s.ts) BETWEEN 9 AND 17 THEN 1.0
       WHEN l."zoneType" IN ('CORRIDOR','WAREHOUSE') AND EXTRACT(hour FROM s.ts) BETWEEN 7 AND 22 THEN 1.0
       WHEN l."zoneType" = 'PARKING' AND (EXTRACT(hour FROM s.ts) >= 18 OR EXTRACT(hour FROM s.ts) < 9) THEN 1.0
       ELSE 0.1
    END) AS value,
  'GOOD'::"DataQuality",
  'TEST'::"DataSourceType"
  FROM series s CROSS JOIN lgt_power_tags l
ON CONFLICT (timestamp, "tagId") DO NOTHING;

-- ============================================================
-- 검증
-- ============================================================
\echo === HVAC/LIGHTING 시계열 행수 ===
SELECT f.type, count(*) AS rows
  FROM public.tag_data_raw r
  JOIN public.tags t ON r."tagId" = t.id
  JOIN public.facilities f ON t."facilityId" = f.id
 WHERE f.type IN ('HVAC','LIGHTING')
 GROUP BY f.type;

\echo
\echo === 샘플 HVAC 전력 (최근 5개) ===
SELECT t."tagName", r.timestamp, ROUND(r.value::numeric, 2) AS value
  FROM public.tag_data_raw r
  JOIN public.tags t ON r."tagId" = t.id
  JOIN public.facilities f ON t."facilityId" = f.id
 WHERE f.type = 'HVAC' AND t."tagName" LIKE '%_POWER'
 ORDER BY r.timestamp DESC, t."tagName"
 LIMIT 5;
