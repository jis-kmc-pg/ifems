-- ============================================================
-- i-FEMS 부대설비 영역 확장 — 롤백 SQL
-- Date    : 2026-05-18
-- WARNING : 이 스크립트는 fems 스키마의 모든 테이블과 데이터를 삭제합니다.
--           실행 전 반드시 백업하세요. (pg_dump --schema=fems)
--
-- 실행 순서 (의존성 역순):
--   1) public.facilities의 zoneId FK/컬럼 제거
--   2) fems 트리거 제거
--   3) fems 테이블 제거 (자식 → 부모 순)
--   4) fems 함수/스키마 제거
-- ============================================================

BEGIN;

-- 1. public.facilities 변경 되돌리기
ALTER TABLE public.facilities
    DROP CONSTRAINT IF EXISTS "facilities_zone_fk";

DROP INDEX IF EXISTS public."facilities_zoneId_idx";

ALTER TABLE public.facilities
    DROP COLUMN IF EXISTS "zoneId";

-- 2. 트리거 제거
DROP TRIGGER IF EXISTS tr_energy_baselines_updated_at ON fems.energy_baselines;
DROP TRIGGER IF EXISTS tr_lux_standards_updated_at    ON fems.lux_standards;
DROP TRIGGER IF EXISTS tr_schedule_rules_updated_at   ON fems.schedule_rules;
DROP TRIGGER IF EXISTS tr_zones_updated_at            ON fems.zones;

-- 3. 테이블 제거 (자식 → 부모)
DROP TABLE IF EXISTS fems.control_commands CASCADE;
DROP TABLE IF EXISTS fems.energy_baselines CASCADE;
DROP TABLE IF EXISTS fems.lux_standards    CASCADE;
DROP TABLE IF EXISTS fems.schedule_rules   CASCADE;
DROP TABLE IF EXISTS fems.zones            CASCADE;

-- 4. 함수 제거
DROP FUNCTION IF EXISTS fems.set_updated_at() CASCADE;

-- 5. 스키마 제거 (모든 객체 삭제 후)
DROP SCHEMA IF EXISTS fems CASCADE;

COMMIT;

-- 검증 쿼리 (롤백 성공 확인용)
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'fems';
-- -- → 0 rows 반환되어야 함
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'facilities' AND column_name = 'zoneId';
-- -- → 0 rows 반환되어야 함
