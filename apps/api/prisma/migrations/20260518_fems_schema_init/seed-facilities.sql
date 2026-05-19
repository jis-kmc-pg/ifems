-- ============================================================
-- i-FEMS 부대설비 — HVAC/LIGHTING facilities + tags 시드
-- Date: 2026-05-19
-- Scope:
--   1) lines: UTILITY 신규 (부대설비 전용 line)
--   2) facilities: HVAC 6대 + LIGHTING 11개 회로
--   3) tags: 각 facility별 운전상태(DISCRETE OPERATION) + 전력(CUMULATIVE ENERGY)
-- 멱등성: ON CONFLICT 가드로 재실행 안전
-- ============================================================

-- ============================================================
-- [1] UTILITY 라인 추가 (부대설비 전용)
-- ============================================================
INSERT INTO public.lines (id, code, name, "factoryId", "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'UTILITY', '유틸리티', f.id, 99, true, now(), now()
  FROM public.factories f
 WHERE f.code = 'hw4' OR f.name LIKE '%4공장%'
 LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- [2] HVAC 공조기 6대 — zones별 매핑
-- ============================================================
INSERT INTO public.facilities
  (id, code, name, "lineId", type, status, "isProcessing", "zoneId", metadata, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.code, v.name,
  l.id, 'HVAC', 'NORMAL'::"FacilityStatus", false,
  z.id,
  jsonb_build_object('capacityRT', v.cap_rt, 'manufacturer', '가상', 'auxClass', 'HVAC'),
  now(), now()
  FROM (VALUES
    ('HW4-HVAC-A',         '공조기 A (블록 작업장)',     'HW4-PROD-A',     100),
    ('HW4-HVAC-B',         '공조기 B (헤드 작업장)',     'HW4-PROD-B',      90),
    ('HW4-HVAC-C',         '공조기 C (크랭크 작업장)',   'HW4-PROD-C',      80),
    ('HW4-HVAC-D',         '공조기 D (조립 작업장)',     'HW4-PROD-D',      70),
    ('HW4-HVAC-OFFICE-1F', '공조기 사무동 1층',          'HW4-OFFICE-1F',   20),
    ('HW4-HVAC-OFFICE-2F', '공조기 사무동 2층',          'HW4-OFFICE-2F',   20)
  ) AS v(code, name, zone_code, cap_rt)
  JOIN fems.zones z ON z.code = v.zone_code
  CROSS JOIN (SELECT id FROM public.lines WHERE code = 'UTILITY' LIMIT 1) l
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- [3] LIGHTING 조명 회로 — zones별 1회로씩
-- ============================================================
INSERT INTO public.facilities
  (id, code, name, "lineId", type, status, "isProcessing", "zoneId", metadata, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.code, v.name,
  l.id, 'LIGHTING', 'NORMAL'::"FacilityStatus", false,
  z.id,
  jsonb_build_object('ratedW', v.rated_w, 'fixtureCount', v.cnt, 'fixtureType', 'LED', 'auxClass', 'LIGHTING'),
  now(), now()
  FROM (VALUES
    ('HW4-LGT-PROD-A',     '조명 회로 (블록 작업장)',      'HW4-PROD-A',     12000,  60),
    ('HW4-LGT-PROD-B',     '조명 회로 (헤드 작업장)',      'HW4-PROD-B',     11000,  55),
    ('HW4-LGT-PROD-C',     '조명 회로 (크랭크 작업장)',    'HW4-PROD-C',     10000,  50),
    ('HW4-LGT-PROD-D',     '조명 회로 (조립 작업장)',      'HW4-PROD-D',      9000,  45),
    ('HW4-LGT-OFFICE-1F',  '조명 회로 (사무동 1층)',       'HW4-OFFICE-1F',   2400,  40),
    ('HW4-LGT-OFFICE-2F',  '조명 회로 (사무동 2층)',       'HW4-OFFICE-2F',   2400,  40),
    ('HW4-LGT-MEETING',    '조명 회로 (회의실)',           'HW4-MEETING',      480,   8),
    ('HW4-LGT-CORRIDOR',   '조명 회로 (복도)',             'HW4-CORRIDOR',    1200,  20),
    ('HW4-LGT-WAREHOUSE-1','조명 회로 (자재창고)',         'HW4-WAREHOUSE-1', 2000,  20),
    ('HW4-LGT-WAREHOUSE-2','조명 회로 (완제품창고)',       'HW4-WAREHOUSE-2', 3000,  30),
    ('HW4-LGT-PARKING',    '조명 회로 (지하 주차장)',      'HW4-PARKING-B1',  3600,  60)
  ) AS v(code, name, zone_code, rated_w, cnt)
  JOIN fems.zones z ON z.code = v.zone_code
  CROSS JOIN (SELECT id FROM public.lines WHERE code = 'UTILITY' LIMIT 1) l
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- [4] HVAC 태그 — 각 공조기별 운전상태 + 전력
-- ============================================================
INSERT INTO public.tags
  (id, "facilityId", "tagName", "displayName", "measureType", category, "energyType", unit, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f.id,
       replace(f.code,'-','_') || '_OPERATION', '운전상태',
       'DISCRETE'::"MeasureType", 'OPERATION'::"TagCategory", NULL, 'on/off', 0, true, now(), now()
  FROM public.facilities f WHERE f.type = 'HVAC'
ON CONFLICT ("tagName") DO NOTHING;

INSERT INTO public.tags
  (id, "facilityId", "tagName", "displayName", "measureType", category, "energyType", unit, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f.id,
       replace(f.code,'-','_') || '_POWER', '소비전력',
       'CUMULATIVE'::"MeasureType", 'ENERGY'::"TagCategory", 'elec'::"EnergyType", 'kWh', 1, true, now(), now()
  FROM public.facilities f WHERE f.type = 'HVAC'
ON CONFLICT ("tagName") DO NOTHING;

-- ============================================================
-- [5] LIGHTING 태그 — 각 회로별 점등상태 + 전력
-- ============================================================
INSERT INTO public.tags
  (id, "facilityId", "tagName", "displayName", "measureType", category, "energyType", unit, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f.id,
       replace(f.code,'-','_') || '_ONOFF', '점등상태',
       'DISCRETE'::"MeasureType", 'OPERATION'::"TagCategory", NULL, 'on/off', 0, true, now(), now()
  FROM public.facilities f WHERE f.type = 'LIGHTING'
ON CONFLICT ("tagName") DO NOTHING;

INSERT INTO public.tags
  (id, "facilityId", "tagName", "displayName", "measureType", category, "energyType", unit, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f.id,
       replace(f.code,'-','_') || '_POWER', '소비전력',
       'CUMULATIVE'::"MeasureType", 'ENERGY'::"TagCategory", 'elec'::"EnergyType", 'kWh', 1, true, now(), now()
  FROM public.facilities f WHERE f.type = 'LIGHTING'
ON CONFLICT ("tagName") DO NOTHING;

-- ============================================================
-- [6] 검증 출력
-- ============================================================
\echo === 부대설비 facilities 카운트 ===
SELECT type, count(*) FROM public.facilities WHERE type IN ('HVAC','LIGHTING') GROUP BY type;

\echo === zones별 부대설비 매핑 ===
SELECT z.code, z."zoneType",
       count(f.id) FILTER (WHERE f.type='HVAC')     AS hvac,
       count(f.id) FILTER (WHERE f.type='LIGHTING') AS lighting
  FROM fems.zones z
  LEFT JOIN public.facilities f ON f."zoneId" = z.id AND f.type IN ('HVAC','LIGHTING')
 WHERE z.code LIKE 'HW4-%' AND z.code <> 'HW4-ROOT'
 GROUP BY z.code, z."zoneType"
 ORDER BY z.code;

\echo === 추가된 부대설비 태그 ===
SELECT f.type, count(t.id) AS tag_cnt
  FROM public.facilities f
  JOIN public.tags t ON t."facilityId" = f.id
 WHERE f.type IN ('HVAC','LIGHTING')
 GROUP BY f.type;
