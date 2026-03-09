-- ============================================================
-- FacilityEnergyConfig → Config(헤더) + ConfigTag(상세) 분리
-- 설비당 energyType별 복수 태그 매핑 지원
-- ============================================================

-- 1. 새 테이블 생성: facility_energy_config_tags
CREATE TABLE IF NOT EXISTS "facility_energy_config_tags" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "configId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "facility_energy_config_tags_pkey" PRIMARY KEY ("id")
);

-- 2. 기존 config의 usageTagId → config_tags로 마이그레이션
INSERT INTO "facility_energy_config_tags" ("id", "configId", "tagId", "isActive", "order")
SELECT
    gen_random_uuid(),
    c."id",
    c."usageTagId",
    true,
    0
FROM "facility_energy_configs" c
WHERE c."usageTagId" IS NOT NULL;

-- 3. config에서 usageTagId 컬럼 제거
ALTER TABLE "facility_energy_configs" DROP COLUMN IF EXISTS "usageTagId";

-- 4. history 테이블 구조 변경
-- 기존 컬럼 제거
ALTER TABLE "facility_energy_config_histories" DROP COLUMN IF EXISTS "prevTagId";
ALTER TABLE "facility_energy_config_histories" DROP COLUMN IF EXISTS "newTagId";
ALTER TABLE "facility_energy_config_histories" DROP COLUMN IF EXISTS "newCalcMethod";

-- 새 컬럼 추가
DO $$
BEGIN
    -- prevCalcMethod는 이미 존재하므로 nullable로 변경만
    ALTER TABLE "facility_energy_config_histories" ALTER COLUMN "prevCalcMethod" DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- newCalcMethod를 nullable로 재추가
ALTER TABLE "facility_energy_config_histories" ADD COLUMN IF NOT EXISTS "newCalcMethod" "CalcMethod";

-- action 컬럼 추가
ALTER TABLE "facility_energy_config_histories" ADD COLUMN IF NOT EXISTS "action" VARCHAR(20) NOT NULL DEFAULT 'UPDATE';

-- tagId, tagName 컬럼 추가
ALTER TABLE "facility_energy_config_histories" ADD COLUMN IF NOT EXISTS "tagId" TEXT;
ALTER TABLE "facility_energy_config_histories" ADD COLUMN IF NOT EXISTS "tagName" VARCHAR(200);

-- 5. 인덱스 & 유니크 제약
CREATE UNIQUE INDEX IF NOT EXISTS "facility_energy_config_tags_configId_tagId_key"
    ON "facility_energy_config_tags"("configId", "tagId");
CREATE INDEX IF NOT EXISTS "facility_energy_config_tags_configId_idx"
    ON "facility_energy_config_tags"("configId");
CREATE INDEX IF NOT EXISTS "facility_energy_config_tags_tagId_idx"
    ON "facility_energy_config_tags"("tagId");

-- 6. FK 제약
ALTER TABLE "facility_energy_config_tags"
    ADD CONSTRAINT "facility_energy_config_tags_configId_fkey"
    FOREIGN KEY ("configId") REFERENCES "facility_energy_configs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facility_energy_config_tags"
    ADD CONSTRAINT "facility_energy_config_tags_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
