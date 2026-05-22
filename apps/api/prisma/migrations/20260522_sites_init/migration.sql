-- ============================================================
-- Phase 2-① Site 계층 신설 (Site → Factory → Line → Facility)
-- Date: 2026-05-22
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sites (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code"      VARCHAR(50)  NOT NULL,
    "name"      VARCHAR(100) NOT NULL,
    "fullName"  TEXT,
    "address"   TEXT,
    "isActive"  BOOLEAN     NOT NULL DEFAULT true,
    "order"     INT         NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sites_code_key" UNIQUE ("code")
);

COMMENT ON TABLE public.sites IS '사이트(지리·법인 단위). 1 site → N factories.';

ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS "siteId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factories_site_fk') THEN
        ALTER TABLE public.factories
          ADD CONSTRAINT "factories_site_fk"
          FOREIGN KEY ("siteId") REFERENCES public.sites("id") ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS "factories_siteId_idx" ON public.factories("siteId");

-- updated_at 트리거 (set_updated_at 함수가 fems 스키마에 정의되어 있음 — 같은 함수 재사용)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_sites_updated_at') THEN
        CREATE TRIGGER tr_sites_updated_at BEFORE UPDATE ON public.sites
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
END$$;

-- ============================================================
-- 시드: 화성 사업장 + 기존 공장 매핑
-- ============================================================
INSERT INTO public.sites (code, name, "fullName", address)
VALUES ('hwasung', '화성 사업장', '화성PT4 사업장', '경기도 화성시')
ON CONFLICT (code) DO NOTHING;

UPDATE public.factories
   SET "siteId" = (SELECT id FROM public.sites WHERE code = 'hwasung')
 WHERE "siteId" IS NULL;

\echo === 시드 결과 ===
SELECT s.code AS site, s.name, count(f.id) AS factories
  FROM public.sites s
  LEFT JOIN public.factories f ON f."siteId" = s.id
 GROUP BY s.code, s.name
 ORDER BY s.code;
