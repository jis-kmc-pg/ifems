-- ============================================================
-- Phase 3 — 에너지 흐름도 (Integration Flow Chart)
-- Date: 2026-05-21
-- Scope:
--   fems.energy_flows — Supply/Convert 소스 ↔ Shop(facility) ↔ 세부분기 매핑
--   화면: DSH-009 에너지 흐름도 + 매핑 CRUD
-- ============================================================

CREATE TABLE IF NOT EXISTS fems.energy_flows (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "sourceType"    VARCHAR(20)  NOT NULL,        -- ELECTRICITY | GAS | WATER | AIR
    "targetShop"    VARCHAR(50)  NOT NULL,        -- Stamping, Welding, Paint, ... (자유 텍스트)
    "branchLabel"   VARCHAR(50),                  -- Boiler, 2F, 3F, PW, IW, Booth, Canteen (NULL=대표)
    "value"         DOUBLE PRECISION,             -- 매핑값 (단위는 source 기준)
    "unit"          VARCHAR(20),                  -- MWh, MSft³, kgal, ft³
    "color"         VARCHAR(20),                  -- 흐름 화살표 색 (#FDB813 등)
    "order"         INT          NOT NULL DEFAULT 0,
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "description"   TEXT,
    "createdBy"     VARCHAR(100),
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "energy_flows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "energy_flows_sourceType_check"
        CHECK ("sourceType" IN ('ELECTRICITY','GAS','WATER','AIR'))
);

CREATE INDEX IF NOT EXISTS "energy_flows_source_idx"     ON fems.energy_flows("sourceType");
CREATE INDEX IF NOT EXISTS "energy_flows_target_idx"     ON fems.energy_flows("targetShop");
CREATE INDEX IF NOT EXISTS "energy_flows_active_order"   ON fems.energy_flows("isActive","order");

COMMENT ON TABLE fems.energy_flows IS '에너지 흐름도 매핑 (Supply/Convert → Shop → 세부분기)';

-- updated_at 트리거
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_energy_flows_updated_at') THEN
        CREATE TRIGGER tr_energy_flows_updated_at BEFORE UPDATE ON fems.energy_flows
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
END$$;

-- ============================================================
-- 시드: HMGMA 화면 모음 5페이지 매핑 (실제 슬라이드의 매핑 그대로)
-- ============================================================

INSERT INTO fems.energy_flows ("sourceType","targetShop","branchLabel","value","unit","color","order","createdBy") VALUES
-- Electricity
('ELECTRICITY','Stamping',  NULL,        11.45, 'MWh',  '#FDB813', 10, 'seed'),
('ELECTRICITY','Welding',   NULL,        29.54, 'MWh',  '#FDB813', 20, 'seed'),
('ELECTRICITY','Paint',     NULL,       238.46, 'MWh',  '#FDB813', 30, 'seed'),
('ELECTRICITY','Head',      NULL,         3.74, 'MWh',  '#FDB813', 40, 'seed'),
('ELECTRICITY','Assembly',  NULL,        48.66, 'MWh',  '#FDB813', 50, 'seed'),
('ELECTRICITY','CC',        NULL,        25.91, 'MWh',  '#FDB813', 60, 'seed'),
('ELECTRICITY','UT',        NULL,        31.26, 'MWh',  '#FDB813', 70, 'seed'),
-- Gas (Paint/Assembly 세부 분기 포함)
('GAS',        'Paint',     'Boiler',    89.1, 'kSft³', '#E94560', 10, 'seed'),
('GAS',        'Paint',     '2F',       545.9, 'kSft³', '#E94560', 11, 'seed'),
('GAS',        'Paint',     '3F',       657.4, 'kSft³', '#E94560', 12, 'seed'),
('GAS',        'Assembly',  'Booth',      0.0, 'Sft³',  '#E94560', 20, 'seed'),
('GAS',        'Assembly',  'Canteen',   33.1, 'kSft³', '#E94560', 21, 'seed'),
-- Water (Stamping/Welding/Paint/Assembly/UT는 PW/IW 분기, VPC/CC는 단일)
('WATER',      'Stamping',  'PW',        1.11, 'kgal',  '#3B82F6', 10, 'seed'),
('WATER',      'Stamping',  'IW',        0.00, 'kgal',  '#3B82F6', 11, 'seed'),
('WATER',      'Welding',   'PW',        1.80, 'kgal',  '#3B82F6', 20, 'seed'),
('WATER',      'Welding',   'IW',        0.00, 'kgal',  '#3B82F6', 21, 'seed'),
('WATER',      'Paint',     'PW',      353.97, 'kgal',  '#3B82F6', 30, 'seed'),
('WATER',      'Paint',     'IW',      349.53, 'kgal',  '#3B82F6', 31, 'seed'),
('WATER',      'Head',      NULL,         0.0, 'gal',   '#3B82F6', 40, 'seed'),
('WATER',      'Assembly',  'PW',       13.32, 'kgal',  '#3B82F6', 50, 'seed'),
('WATER',      'Assembly',  'IW',        4.56, 'kgal',  '#3B82F6', 51, 'seed'),
('WATER',      'Assembly',  'Canteen',   4.62, 'kgal',  '#3B82F6', 52, 'seed'),
('WATER',      'VPC',       NULL,        1.98, 'kgal',  '#3B82F6', 60, 'seed'),
('WATER',      'CC',        NULL,       10.35, 'kgal',  '#3B82F6', 70, 'seed'),
('WATER',      'UT',        'PW',       50.64, 'kgal',  '#3B82F6', 80, 'seed'),
('WATER',      'UT',        'IW',       49.89, 'kgal',  '#3B82F6', 81, 'seed'),
-- Air
('AIR',        'Stamping',  NULL,       129.77, 'ft³',  '#27AE60', 10, 'seed'),
('AIR',        'Welding',   NULL,        84.56, 'kft³', '#27AE60', 20, 'seed'),
('AIR',        'Paint',     NULL,         7.25, 'Mft³', '#27AE60', 30, 'seed'),
('AIR',        'Assembly',  NULL,       696.7,  'kft³', '#27AE60', 40, 'seed')
ON CONFLICT DO NOTHING;

\echo === 시드 결과 ===
SELECT "sourceType", count(*) FROM fems.energy_flows GROUP BY "sourceType" ORDER BY "sourceType";
