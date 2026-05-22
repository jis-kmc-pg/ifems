-- ============================================================
-- Phase 2-② 조명 Relay 마스터 — fems.lighting_relays
-- Date: 2026-05-22
-- Scope: LIGHTING facility → Relay N개 세분화
-- ============================================================

CREATE TABLE IF NOT EXISTS fems.lighting_relays (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "facilityId"    TEXT NOT NULL,                       -- public.facilities (type=LIGHTING)
    "zoneId"        TEXT,                                 -- fems.zones
    "code"          VARCHAR(50) NOT NULL,                 -- HW4-LGT-PROD-A-R1
    "name"          VARCHAR(100) NOT NULL,
    "ratedW"        DOUBLE PRECISION,
    "fixtureCount"  INT,
    "fixtureType"   VARCHAR(50),                          -- LED, FL, HID 등
    "onOffTagId"    TEXT,                                 -- public.tags (DISCRETE)
    "powerTagId"    TEXT,                                 -- public.tags (CUMULATIVE)
    "metadata"      JSONB,
    "order"         INT NOT NULL DEFAULT 0,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "lighting_relays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lighting_relays_code_key" UNIQUE ("code"),
    CONSTRAINT "lighting_relays_facility_fk"
        FOREIGN KEY ("facilityId") REFERENCES public.facilities("id") ON DELETE CASCADE,
    CONSTRAINT "lighting_relays_zone_fk"
        FOREIGN KEY ("zoneId") REFERENCES fems.zones("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "lighting_relays_facility_idx" ON fems.lighting_relays("facilityId");
CREATE INDEX IF NOT EXISTS "lighting_relays_zone_idx"     ON fems.lighting_relays("zoneId");
CREATE INDEX IF NOT EXISTS "lighting_relays_active_order" ON fems.lighting_relays("isActive","order");

COMMENT ON TABLE fems.lighting_relays IS '조명 Relay 마스터 — LIGHTING facility 안의 개별 회로 단위';

-- updated_at 트리거
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_lighting_relays_updated_at') THEN
        CREATE TRIGGER tr_lighting_relays_updated_at BEFORE UPDATE ON fems.lighting_relays
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
END$$;

-- ============================================================
-- 시드: 기존 LIGHTING facility 11개 → 각 Relay 1개 (1:1 PoC)
--   기존 ONOFF/POWER 태그를 onOffTagId/powerTagId로 연결
-- ============================================================
INSERT INTO fems.lighting_relays
  ("facilityId", "zoneId", "code", "name", "ratedW", "fixtureCount", "fixtureType",
   "onOffTagId", "powerTagId", "order")
SELECT
    f.id                                         AS "facilityId",
    f."zoneId"                                   AS "zoneId",
    f.code || '-R1'                              AS "code",
    f.name || ' Relay 1'                         AS "name",
    COALESCE((f.metadata->>'ratedW')::float, 0)  AS "ratedW",
    COALESCE((f.metadata->>'fixtureCount')::int, 0) AS "fixtureCount",
    COALESCE(f.metadata->>'fixtureType', 'LED')  AS "fixtureType",
    (SELECT t.id FROM public.tags t WHERE t."facilityId" = f.id AND t."tagName" LIKE '%_ONOFF' LIMIT 1) AS "onOffTagId",
    (SELECT t.id FROM public.tags t WHERE t."facilityId" = f.id AND t."tagName" LIKE '%_POWER' LIMIT 1) AS "powerTagId",
    0                                            AS "order"
  FROM public.facilities f
 WHERE f.type = 'LIGHTING'
ON CONFLICT (code) DO NOTHING;

\echo === Relay 시드 결과 ===
SELECT z.code AS zone, count(r.id) AS relays,
       SUM(r."ratedW")::int AS rated_w_total
  FROM fems.lighting_relays r
  LEFT JOIN fems.zones z ON r."zoneId" = z.id
 GROUP BY z.code
 ORDER BY z.code;
