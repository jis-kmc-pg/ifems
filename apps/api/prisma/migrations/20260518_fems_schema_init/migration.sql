-- ============================================================
-- i-FEMS 부대설비 영역 확장 — 초기 스키마 마이그레이션
-- Date    : 2026-05-18
-- Purpose : 공조(HVAC) / 조명(Lighting) / 환경(ENV) 도메인을 위한 별도 스키마 격리
-- Context : 화성 PT4공장 i-FEMS — 본설비(HNK10~40) + 생산유틸리티(UTL) 외에
--           공조/조명/환경 부대설비를 신규 영역으로 추가
-- Strategy:
--   1. fems 스키마 신설 (public과 네임스페이스 분리)
--   2. cross-schema FK는 명시적으로 (public.factories, public.facilities 참조)
--   3. 신규 테이블만 추가 — 기존 데이터/CA/쿼리 영향 없음
--   4. KS A 3011 작업조도 기준 시드 포함
-- ============================================================

-- 0. 스키마 생성
CREATE SCHEMA IF NOT EXISTS fems;

COMMENT ON SCHEMA fems IS 'i-FEMS 부대설비 영역 (공조/조명/환경) 도메인 스키마';

-- ============================================================
-- 1. zones (공간 단위) — 부대설비 관리의 뿌리 마스터
-- ============================================================
CREATE TABLE IF NOT EXISTS fems.zones (
    "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "code"        VARCHAR(50)  NOT NULL,
    "name"        VARCHAR(100) NOT NULL,
    "parentId"    TEXT,
    "factoryId"   TEXT,
    "areaSqm"     DOUBLE PRECISION,
    "zoneType"    VARCHAR(20)  NOT NULL,
    "metadata"    JSONB,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "zones_code_key" UNIQUE ("code"),
    CONSTRAINT "zones_zoneType_check"
        CHECK ("zoneType" IN ('PRODUCTION','OFFICE','CORRIDOR','WAREHOUSE','UTILITY','OUTDOOR','PARKING','LOUNGE')),
    CONSTRAINT "zones_parent_fk"
        FOREIGN KEY ("parentId") REFERENCES fems.zones("id") ON DELETE SET NULL,
    CONSTRAINT "zones_factory_fk"
        FOREIGN KEY ("factoryId") REFERENCES public.factories("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "zones_parent_idx"   ON fems.zones("parentId");
CREATE INDEX IF NOT EXISTS "zones_factory_idx" ON fems.zones("factoryId");
CREATE INDEX IF NOT EXISTS "zones_zoneType_idx" ON fems.zones("zoneType");

COMMENT ON TABLE  fems.zones IS '공간 단위 마스터 (공장 > 동 > 층 > 존 계층 구조)';
COMMENT ON COLUMN fems.zones."areaSqm"  IS '면적(㎡) — 조명원단위(W/㎡) 계산용';
COMMENT ON COLUMN fems.zones."zoneType" IS 'PRODUCTION|OFFICE|CORRIDOR|WAREHOUSE|UTILITY|OUTDOOR|PARKING|LOUNGE';

-- ============================================================
-- 2. schedule_rules (자동 운전 스케줄 룰 엔진)
-- ============================================================
CREATE TABLE IF NOT EXISTS fems.schedule_rules (
    "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "name"           VARCHAR(100) NOT NULL,
    "description"    TEXT,
    "targetType"     VARCHAR(20)  NOT NULL,
    "targetScope"    VARCHAR(20)  NOT NULL,
    "targetId"       TEXT         NOT NULL,
    "dayOfWeek"      INT[]        NOT NULL DEFAULT '{}'::INT[],
    "startTime"      TIME,
    "endTime"        TIME,
    "condition"      JSONB,
    "action"         VARCHAR(20)  NOT NULL,
    "actionValue"    JSONB,
    "priority"       INT          NOT NULL DEFAULT 0,
    "enabled"        BOOLEAN      NOT NULL DEFAULT true,
    "effectiveFrom"  DATE,
    "effectiveTo"    DATE,
    "createdBy"      VARCHAR(100),
    "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_rules_targetType_check"
        CHECK ("targetType" IN ('HVAC','LIGHTING','MIXED')),
    CONSTRAINT "schedule_rules_targetScope_check"
        CHECK ("targetScope" IN ('FACILITY','ZONE')),
    CONSTRAINT "schedule_rules_action_check"
        CHECK ("action" IN ('ON','OFF','SETPOINT')),
    CONSTRAINT "schedule_rules_dayOfWeek_check"
        CHECK ("dayOfWeek" <@ ARRAY[0,1,2,3,4,5,6]),
    CONSTRAINT "schedule_rules_effectiveRange_check"
        CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE INDEX IF NOT EXISTS "schedule_rules_target_idx"
    ON fems.schedule_rules("targetScope","targetId");
CREATE INDEX IF NOT EXISTS "schedule_rules_enabled_idx"
    ON fems.schedule_rules("enabled") WHERE "enabled" = true;
CREATE INDEX IF NOT EXISTS "schedule_rules_effective_idx"
    ON fems.schedule_rules("effectiveFrom","effectiveTo");
CREATE INDEX IF NOT EXISTS "schedule_rules_priority_idx"
    ON fems.schedule_rules("priority" DESC);

COMMENT ON TABLE  fems.schedule_rules IS '부대설비 자동 운전 스케줄 룰 엔진 (시간/요일/조건 기반 ON·OFF·SETPOINT)';
COMMENT ON COLUMN fems.schedule_rules."dayOfWeek"   IS 'PostgreSQL DOW: 0=일 .. 6=토. 예) 평일=[1,2,3,4,5]';
COMMENT ON COLUMN fems.schedule_rules."condition"   IS 'JSONB 조건. 예) {"oaTempLt":18,"co2Gt":1000,"occupancy":false}';
COMMENT ON COLUMN fems.schedule_rules."actionValue" IS 'JSONB 액션값. 예) {"setpoint":24,"mode":"cooling"}';
COMMENT ON COLUMN fems.schedule_rules."targetId"    IS 'targetScope에 따라 facilities.id 또는 fems.zones.id 참조 (논리적 FK)';

-- ============================================================
-- 3. control_commands (제어 명령 이력 — 감사 추적용)
-- ============================================================
CREATE TABLE IF NOT EXISTS fems.control_commands (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "ruleId"        TEXT,
    "facilityId"    TEXT         NOT NULL,
    "command"       VARCHAR(20)  NOT NULL,
    "commandValue"  JSONB,
    "source"        VARCHAR(20)  NOT NULL,
    "triggeredBy"   VARCHAR(100) NOT NULL DEFAULT 'system',
    "result"        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    "errorMessage"  TEXT,
    "executedAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "control_commands_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "control_commands_command_check"
        CHECK ("command" IN ('ON','OFF','SETPOINT')),
    CONSTRAINT "control_commands_source_check"
        CHECK ("source" IN ('SCHEDULE','MANUAL','INTERLOCK','API')),
    CONSTRAINT "control_commands_result_check"
        CHECK ("result" IN ('SUCCESS','FAILED','PENDING')),
    CONSTRAINT "control_commands_rule_fk"
        FOREIGN KEY ("ruleId") REFERENCES fems.schedule_rules("id") ON DELETE SET NULL,
    CONSTRAINT "control_commands_facility_fk"
        FOREIGN KEY ("facilityId") REFERENCES public.facilities("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "control_commands_facility_time_idx"
    ON fems.control_commands("facilityId","executedAt" DESC);
CREATE INDEX IF NOT EXISTS "control_commands_rule_idx"
    ON fems.control_commands("ruleId");
CREATE INDEX IF NOT EXISTS "control_commands_source_idx"
    ON fems.control_commands("source");
CREATE INDEX IF NOT EXISTS "control_commands_result_idx"
    ON fems.control_commands("result");
CREATE INDEX IF NOT EXISTS "control_commands_executedAt_idx"
    ON fems.control_commands("executedAt" DESC);

COMMENT ON TABLE  fems.control_commands IS '제어 명령 이력 (룰 자동 + 수동 + 인터록 + API 모두 기록)';
COMMENT ON COLUMN fems.control_commands."source" IS 'SCHEDULE=룰엔진, MANUAL=수동, INTERLOCK=출입연동, API=외부';

-- ============================================================
-- 4. lux_standards (작업조도 기준 — KS A 3011)
-- ============================================================
CREATE TABLE IF NOT EXISTS fems.lux_standards (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "zoneType"      VARCHAR(50)  NOT NULL,
    "requiredLux"   INT          NOT NULL,
    "description"   TEXT,
    "reference"     VARCHAR(100),
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "lux_standards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lux_standards_zoneType_key" UNIQUE ("zoneType"),
    CONSTRAINT "lux_standards_requiredLux_check" CHECK ("requiredLux" > 0)
);

COMMENT ON TABLE fems.lux_standards IS '영역별 작업조도 기준 (KS A 3011 등 표준 출처 명시)';

-- KS A 3011 기준 시드
INSERT INTO fems.lux_standards ("zoneType","requiredLux","description","reference") VALUES
    ('정밀가공',    750, '정밀가공 작업장 (정밀조립, 검사용 작업대)',     'KS A 3011'),
    ('일반가공',    300, '일반 기계가공/조립 작업장',                   'KS A 3011'),
    ('검사',       1000, '품질검사실, 외관검사대',                      'KS A 3011'),
    ('사무',        500, '사무 공간',                                  'KS A 3011'),
    ('회의실',      500, '회의실, 교육실',                              'KS A 3011'),
    ('복도',        150, '복도, 통로',                                  'KS A 3011'),
    ('창고',        200, '일반 창고, 자재창고',                         'KS A 3011'),
    ('주차장',       75, '실내 주차장',                                 'KS A 3011'),
    ('휴게실',      300, '휴게실, 식당',                                'KS A 3011'),
    ('유틸리티',    200, '컴프레서/쿨링타워/집진기 등 기계실',           'KS A 3011')
ON CONFLICT ("zoneType") DO NOTHING;

-- ============================================================
-- 5. energy_baselines (에너지 절감효과 검증 베이스라인)
-- ============================================================
CREATE TABLE IF NOT EXISTS fems.energy_baselines (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "name"          VARCHAR(100) NOT NULL,
    "targetType"    VARCHAR(20)  NOT NULL,
    "targetId"      TEXT         NOT NULL,
    "baselineFrom"  DATE         NOT NULL,
    "baselineTo"    DATE         NOT NULL,
    "modelType"     VARCHAR(20)  NOT NULL,
    "coefficients"  JSONB,
    "baselineKwh"   DOUBLE PRECISION,
    "rSquared"      DOUBLE PRECISION,
    "notes"         TEXT,
    "createdBy"     VARCHAR(100),
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "energy_baselines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "energy_baselines_targetType_check"
        CHECK ("targetType" IN ('HVAC','LIGHTING','ZONE','FACILITY')),
    CONSTRAINT "energy_baselines_modelType_check"
        CHECK ("modelType" IN ('LINEAR','SEASONAL','LOOKUP','REGRESSION')),
    CONSTRAINT "energy_baselines_range_check"
        CHECK ("baselineTo" >= "baselineFrom"),
    CONSTRAINT "energy_baselines_rSquared_check"
        CHECK ("rSquared" IS NULL OR ("rSquared" >= 0 AND "rSquared" <= 1))
);

CREATE INDEX IF NOT EXISTS "energy_baselines_target_idx"
    ON fems.energy_baselines("targetType","targetId");
CREATE INDEX IF NOT EXISTS "energy_baselines_active_idx"
    ON fems.energy_baselines("isActive") WHERE "isActive" = true;

COMMENT ON TABLE  fems.energy_baselines IS '에너지 절감효과 검증 베이스라인 (회귀모델 기반 사전/사후 비교)';
COMMENT ON COLUMN fems.energy_baselines."coefficients" IS '회귀계수. 예) {"intercept":12.5,"oaTemp":0.8,"production":0.05}';
COMMENT ON COLUMN fems.energy_baselines."rSquared"     IS '회귀 적합도 R² (0~1)';

-- ============================================================
-- 6. public.facilities ⇄ fems.zones 연결 (cross-schema FK)
--    NULLABLE 컬럼이라 기존 325개 설비 데이터 영향 없음
-- ============================================================
ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS "zoneId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'facilities_zone_fk'
    ) THEN
        ALTER TABLE public.facilities
            ADD CONSTRAINT "facilities_zone_fk"
            FOREIGN KEY ("zoneId") REFERENCES fems.zones("id") ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS "facilities_zoneId_idx" ON public.facilities("zoneId");

COMMENT ON COLUMN public.facilities."zoneId" IS '공간 매핑 — fems.zones.id (NULL 허용)';

-- ============================================================
-- 7. updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION fems.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    -- zones
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_zones_updated_at') THEN
        CREATE TRIGGER tr_zones_updated_at BEFORE UPDATE ON fems.zones
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
    -- schedule_rules
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_schedule_rules_updated_at') THEN
        CREATE TRIGGER tr_schedule_rules_updated_at BEFORE UPDATE ON fems.schedule_rules
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
    -- lux_standards
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_lux_standards_updated_at') THEN
        CREATE TRIGGER tr_lux_standards_updated_at BEFORE UPDATE ON fems.lux_standards
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
    -- energy_baselines
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_energy_baselines_updated_at') THEN
        CREATE TRIGGER tr_energy_baselines_updated_at BEFORE UPDATE ON fems.energy_baselines
            FOR EACH ROW EXECUTE FUNCTION fems.set_updated_at();
    END IF;
END$$;

-- ============================================================
-- 8. 권한 (필요 시 운영 계정에 부여)
-- ============================================================
-- GRANT USAGE ON SCHEMA fems TO ifems_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fems TO ifems_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA fems GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ifems_app;
