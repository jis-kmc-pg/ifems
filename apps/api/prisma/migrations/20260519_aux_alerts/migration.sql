-- ============================================================
-- Phase 2-③ 부대설비 알림 통합
-- Date: 2026-05-19
-- Scope:
--   AlertType enum 확장: HVAC_FAULT / LIGHT_FAULT / INTERLOCK_VIOLATION
--   기존 5개 값 + 신규 3개 = 총 8개
-- 멱등성: pg_type 사전 확인으로 재실행 안전
-- ============================================================

DO $$
BEGIN
    -- HVAC_FAULT
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'AlertType' AND e.enumlabel = 'HVAC_FAULT'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'HVAC_FAULT';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'AlertType' AND e.enumlabel = 'LIGHT_FAULT'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'LIGHT_FAULT';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'AlertType' AND e.enumlabel = 'INTERLOCK_VIOLATION'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'INTERLOCK_VIOLATION';
    END IF;
END$$;

-- ============================================================
-- 검증
-- ============================================================
\echo === AlertType enum 전체 값 ===
SELECT e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
 WHERE t.typname = 'AlertType'
 ORDER BY e.enumsortorder;
