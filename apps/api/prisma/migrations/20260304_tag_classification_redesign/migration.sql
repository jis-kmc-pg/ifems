-- Tag Classification Redesign Migration
-- 태그 분류 체계 재설계: TagType/TagDataType → MeasureType/TagCategory
-- 현재 tags 테이블 0행, tag_data_raw 0행이므로 안전한 변경

-- ============================================================
-- 1. 신규 Enum 생성
-- ============================================================

CREATE TYPE "MeasureType" AS ENUM ('INSTANTANEOUS', 'CUMULATIVE', 'DISCRETE');
CREATE TYPE "TagCategory" AS ENUM ('ENERGY', 'QUALITY', 'ENVIRONMENT', 'OPERATION', 'CONTROL');
CREATE TYPE "CalcMethod" AS ENUM ('DIFF', 'INTEGRAL_TRAP');

-- EnergyType 확장
ALTER TYPE "EnergyType" ADD VALUE IF NOT EXISTS 'gas';
ALTER TYPE "EnergyType" ADD VALUE IF NOT EXISTS 'solar';

-- ============================================================
-- 2. Continuous Aggregate 뷰 삭제 (tagType 의존성 제거)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS energy_usage_1min CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_usage_1min CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_trend_10sec CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cagg_sensor_10sec CASCADE;

-- ============================================================
-- 3. tags 테이블 컬럼 변경
-- ============================================================

-- 기존 컬럼 삭제 (0행이므로 데이터 손실 없음)
ALTER TABLE "tags" DROP COLUMN IF EXISTS "tagType";
ALTER TABLE "tags" DROP COLUMN IF EXISTS "dataType";

-- 신규 컬럼 추가
ALTER TABLE "tags" ADD COLUMN "measureType" "MeasureType" NOT NULL DEFAULT 'INSTANTANEOUS';
ALTER TABLE "tags" ADD COLUMN "category" "TagCategory" NOT NULL DEFAULT 'ENERGY';

-- 인덱스
CREATE INDEX IF NOT EXISTS "tags_measureType_idx" ON "tags"("measureType");
CREATE INDEX IF NOT EXISTS "tags_category_idx" ON "tags"("category");

-- ============================================================
-- 4. Continuous Aggregate 뷰 재생성 (measureType 사용)
-- ============================================================

-- cagg_usage_1min: CUMULATIVE 태그의 1분 사용량 (차분)
CREATE MATERIALIZED VIEW cagg_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" AS energy_type,
  first(t."numericValue", t."timestamp") AS first_value,
  last(t."numericValue", t."timestamp") AS last_value,
  last(t."numericValue", t."timestamp") - first(t."numericValue", t."timestamp") AS raw_usage_diff,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'CUMULATIVE'::"MeasureType"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('1 minute', t."timestamp"), t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

-- cagg_trend_10sec: INSTANTANEOUS+ENERGY 태그의 10초 순시값
CREATE MATERIALIZED VIEW cagg_trend_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."energyType" AS energy_type,
  last(t."numericValue", t."timestamp") AS last_value,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'INSTANTANEOUS'::"MeasureType"
  AND tag."category" = 'ENERGY'::"TagCategory"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('10 seconds', t."timestamp"), t."tagId", tag."facilityId", tag."energyType"
WITH NO DATA;

-- cagg_sensor_10sec: INSTANTANEOUS+ENVIRONMENT 태그의 10초 평균
CREATE MATERIALIZED VIEW cagg_sensor_10sec
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', t."timestamp") AS bucket,
  t."tagId",
  tag."facilityId",
  tag."displayName" AS sensor_name,
  avg(t."numericValue") AS avg_value,
  min(t."numericValue") AS min_value,
  max(t."numericValue") AS max_value,
  count(*) AS data_count
FROM tag_data_raw t
LEFT JOIN tags tag ON t."tagId" = tag.id
WHERE tag."measureType" = 'INSTANTANEOUS'::"MeasureType"
  AND tag."category" = 'ENVIRONMENT'::"TagCategory"
  AND t."numericValue" IS NOT NULL
GROUP BY time_bucket('10 seconds', t."timestamp"), t."tagId", tag."facilityId", tag."displayName"
WITH NO DATA;

-- energy_usage_1min: 라인별 1분 사용량 (호환용)
CREATE MATERIALIZED VIEW energy_usage_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', t."timestamp") AS bucket,
  l.code AS line_code,
  tag."energyType" AS energy_type,
  t."tagId" AS tag_id,
  max(t."numericValue") - min(t."numericValue") AS usage
FROM tag_data_raw t
JOIN tags tag ON t."tagId" = tag.id
JOIN facilities f ON tag."facilityId" = f.id
JOIN lines l ON f."lineId" = l.id
WHERE tag."measureType" = 'CUMULATIVE'::"MeasureType"
GROUP BY time_bucket('1 minute', t."timestamp"), l.code, tag."energyType", t."tagId"
WITH NO DATA;

-- ============================================================
-- 5. FacilityEnergyConfig 테이블 생성
-- ============================================================

CREATE TABLE "facility_energy_configs" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "energyType" "EnergyType" NOT NULL,
  "usageTagId" TEXT NOT NULL,
  "calcMethod" "CalcMethod" NOT NULL,
  "description" TEXT,
  "configuredBy" VARCHAR(100),
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "facility_energy_configs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "facility_energy_configs"
  ADD CONSTRAINT "facility_energy_configs_facilityId_energyType_key"
  UNIQUE ("facilityId", "energyType");

ALTER TABLE "facility_energy_configs"
  ADD CONSTRAINT "facility_energy_configs_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facility_energy_configs"
  ADD CONSTRAINT "facility_energy_configs_usageTagId_fkey"
  FOREIGN KEY ("usageTagId") REFERENCES "tags"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "facility_energy_configs_facilityId_idx" ON "facility_energy_configs"("facilityId");
CREATE INDEX "facility_energy_configs_usageTagId_idx" ON "facility_energy_configs"("usageTagId");

-- ============================================================
-- 6. FacilityEnergyConfigHistory 테이블 생성
-- ============================================================

CREATE TABLE "facility_energy_config_histories" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "energyType" "EnergyType" NOT NULL,
  "prevTagId" TEXT,
  "prevCalcMethod" "CalcMethod",
  "newTagId" TEXT NOT NULL,
  "newCalcMethod" "CalcMethod" NOT NULL,
  "reason" TEXT,
  "changedBy" VARCHAR(100),
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "facility_energy_config_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "facility_energy_config_histories_facilityId_changedAt_idx"
  ON "facility_energy_config_histories"("facilityId", "changedAt");

-- ============================================================
-- 7. 구 Enum 삭제
-- ============================================================

DROP TYPE IF EXISTS "TagType" CASCADE;
DROP TYPE IF EXISTS "TagDataType" CASCADE;
