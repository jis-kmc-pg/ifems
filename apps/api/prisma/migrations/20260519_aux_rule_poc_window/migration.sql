-- ============================================================
-- 부대설비 룰 PoC 기간 설정 (1주일 시범 운영)
-- Date: 2026-05-19
-- Scope: 시범 운영 안전장치 — effectiveFrom/To 미설정 룰에 PoC 기간 부여
--   - effectiveFrom: 2026-05-19
--   - effectiveTo:   2026-05-26 (1주일)
-- 멱등성: 기존 effectiveFrom/To 가 이미 설정된 룰은 건드리지 않음
-- 운영 효과: PoC 기간 종료 시 룰 자동 비활성화 (별도 갱신 시까지 발행 중단)
-- ============================================================

UPDATE fems.schedule_rules
   SET "effectiveFrom" = '2026-05-19'::date,
       "effectiveTo"   = '2026-05-26'::date,
       "updatedAt"     = NOW()
 WHERE enabled = true
   AND "effectiveFrom" IS NULL
   AND "effectiveTo"   IS NULL;

\echo === 적용된 룰 (PoC 기간) ===
SELECT name, "effectiveFrom"::text AS eff_from, "effectiveTo"::text AS eff_to, enabled
  FROM fems.schedule_rules
 ORDER BY priority DESC, name;
