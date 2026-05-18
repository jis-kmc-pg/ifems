-- ============================================================
-- i-FEMS 부대설비 영역 — 초기 시드 데이터 (PT4공장)
-- Date: 2026-05-18
-- Scope:
--   1) fems.zones — PT4공장 구역 계층 (작업장/사무/유틸리티/외부)
--   2) fems.schedule_rules — 기본 운전 룰 예시 3종
--   3) public.facilities.zoneId — 컴프레서/쿨링타워 등 기계실 매핑 예시
-- 멱등성: ON CONFLICT 가드로 재실행 안전
-- ============================================================

-- ============================================================
-- [1] zones 시드 — 2계층 (root → leaf)
-- ============================================================

-- ROOT: 화성PT4공장 (factory_id 자동 매핑)
INSERT INTO fems.zones (code, name, "factoryId", "zoneType", "areaSqm", metadata)
SELECT 'HW4-ROOT', '화성PT4공장 전체', id, 'PRODUCTION', NULL,
       jsonb_build_object('level', 'root', 'note', '공장 전체 root zone')
  FROM public.factories
 WHERE code = 'hw4' OR name LIKE '%4공장%'
 LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- LEAF: 작업장 (생산)
INSERT INTO fems.zones (code, name, "parentId", "factoryId", "zoneType", "areaSqm")
SELECT v.code, v.name, r.id, r."factoryId", v."zoneType", v."areaSqm"
  FROM (VALUES
    ('HW4-PROD-A',     '블록 라인 작업장 (HNK10)',     'PRODUCTION', 4500.0),
    ('HW4-PROD-B',     '헤드 라인 작업장 (HNK20)',     'PRODUCTION', 4200.0),
    ('HW4-PROD-C',     '크랭크 라인 작업장 (HNK30)',   'PRODUCTION', 3800.0),
    ('HW4-PROD-D',     '조립 라인 작업장 (HNK40)',     'PRODUCTION', 3500.0)
  ) AS v(code, name, "zoneType", "areaSqm")
  CROSS JOIN (SELECT id, "factoryId" FROM fems.zones WHERE code='HW4-ROOT') r
ON CONFLICT (code) DO NOTHING;

-- LEAF: 사무 영역
INSERT INTO fems.zones (code, name, "parentId", "factoryId", "zoneType", "areaSqm")
SELECT v.code, v.name, r.id, r."factoryId", v."zoneType", v."areaSqm"
  FROM (VALUES
    ('HW4-OFFICE-1F',  '사무동 1층 (행정)',           'OFFICE',  450.0),
    ('HW4-OFFICE-2F',  '사무동 2층 (엔지니어링)',     'OFFICE',  450.0),
    ('HW4-MEETING',    '회의실 (대/소회의실 묶음)',   'OFFICE',   80.0)
  ) AS v(code, name, "zoneType", "areaSqm")
  CROSS JOIN (SELECT id, "factoryId" FROM fems.zones WHERE code='HW4-ROOT') r
ON CONFLICT (code) DO NOTHING;

-- LEAF: 부대시설
INSERT INTO fems.zones (code, name, "parentId", "factoryId", "zoneType", "areaSqm")
SELECT v.code, v.name, r.id, r."factoryId", v."zoneType", v."areaSqm"
  FROM (VALUES
    ('HW4-CORRIDOR',     '복도 (전 구간)',              'CORRIDOR', 600.0),
    ('HW4-WAREHOUSE-1',  '자재창고 1',                  'WAREHOUSE', 800.0),
    ('HW4-WAREHOUSE-2',  '완제품창고',                  'WAREHOUSE', 1200.0),
    ('HW4-PARKING-B1',   '지하 주차장 B1',              'PARKING', 2000.0),
    ('HW4-UTILITY',      '유틸리티동 (컴프/쿨링/집진)',  'UTILITY', 350.0),
    ('HW4-LOUNGE',       '휴게실/식당',                  'LOUNGE',  250.0),
    ('HW4-OUTDOOR',      '옥외 (옥상/외기)',            'OUTDOOR', NULL)
  ) AS v(code, name, "zoneType", "areaSqm")
  CROSS JOIN (SELECT id, "factoryId" FROM fems.zones WHERE code='HW4-ROOT') r
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- [2] 기존 facilities → zone 매핑 (유틸리티동 예시)
-- ============================================================
UPDATE public.facilities
   SET "zoneId" = (SELECT id FROM fems.zones WHERE code='HW4-UTILITY')
 WHERE type IN ('COMPRESSOR','COOLING','DUST_COLLECTOR')
   AND "zoneId" IS NULL;

-- HNK10/20/30/40 라인의 설비 → 각 작업장 매핑
UPDATE public.facilities f
   SET "zoneId" = z.id
  FROM public.lines l, fems.zones z
 WHERE f."lineId" = l.id
   AND f."zoneId" IS NULL
   AND ((l.code = 'BLOCK'    AND z.code = 'HW4-PROD-A') OR
        (l.code = 'HEAD'     AND z.code = 'HW4-PROD-B') OR
        (l.code = 'CRANK'    AND z.code = 'HW4-PROD-C') OR
        (l.code = 'ASSEMBLE' AND z.code = 'HW4-PROD-D'));

-- ============================================================
-- [3] schedule_rules 시드 — 기본 룰 3종 (예시)
-- ============================================================

-- 룰 1: 평일 점심시간 (12:00-13:00) 사무동 조명 OFF
INSERT INTO fems.schedule_rules
  (name, description, "targetType", "targetScope", "targetId",
   "dayOfWeek", "startTime", "endTime",
   action, "actionValue", priority, "createdBy")
SELECT
  '평일 점심 사무동 조명 OFF',
  '12:00~13:00 사무동 전 층 조명 자동 소등',
  'LIGHTING', 'ZONE', z.id,
  ARRAY[1,2,3,4,5], '12:00'::time, '13:00'::time,
  'OFF', NULL, 10, 'seed'
  FROM fems.zones z
 WHERE z.code IN ('HW4-OFFICE-1F','HW4-OFFICE-2F')
ON CONFLICT DO NOTHING;

-- 룰 2: 야간 (22:00-06:00) 창고/주차장 조명 OFF (점유 센서 없을 때)
INSERT INTO fems.schedule_rules
  (name, description, "targetType", "targetScope", "targetId",
   "dayOfWeek", "startTime", "endTime",
   condition, action, "actionValue", priority, "createdBy")
SELECT
  '야간 창고/주차장 조명 OFF',
  '22:00~06:00 occupancy=false 시 자동 소등',
  'LIGHTING', 'ZONE', z.id,
  ARRAY[0,1,2,3,4,5,6], '22:00'::time, '06:00'::time,
  '{"occupancy": false}'::jsonb,
  'OFF', NULL, 5, 'seed'
  FROM fems.zones z
 WHERE z.code IN ('HW4-WAREHOUSE-1','HW4-WAREHOUSE-2','HW4-PARKING-B1')
ON CONFLICT DO NOTHING;

-- 룰 3: 주말 사무동 공조 OFF
INSERT INTO fems.schedule_rules
  (name, description, "targetType", "targetScope", "targetId",
   "dayOfWeek", "startTime", "endTime",
   action, "actionValue", priority, "createdBy")
SELECT
  '주말 사무동 공조 OFF',
  '토/일 전일 사무동 공조 정지',
  'HVAC', 'ZONE', z.id,
  ARRAY[0,6], '00:00'::time, '23:59'::time,
  'OFF', NULL, 8, 'seed'
  FROM fems.zones z
 WHERE z.code IN ('HW4-OFFICE-1F','HW4-OFFICE-2F','HW4-MEETING')
ON CONFLICT DO NOTHING;

-- ============================================================
-- [4] 검증 출력
-- ============================================================
\echo === zones 시드 결과 ===
SELECT "zoneType", COUNT(*) FROM fems.zones GROUP BY "zoneType" ORDER BY "zoneType";

\echo === facilities zone 매핑 결과 ===
SELECT z.code AS zone, z.name, COUNT(f.id) AS mapped_facilities
  FROM fems.zones z
  LEFT JOIN public.facilities f ON f."zoneId" = z.id
 WHERE z.code LIKE 'HW4-%'
 GROUP BY z.code, z.name
 ORDER BY z.code;

\echo === schedule_rules 시드 결과 ===
SELECT name, "targetType", "targetScope", "startTime", "endTime", enabled
  FROM fems.schedule_rules
 ORDER BY priority DESC, name;
