-- FacilityEnergyConfig에 since(적용 시작일) 컬럼 추가
-- 기존 데이터는 createdAt 값으로 초기화

ALTER TABLE "facility_energy_configs"
ADD COLUMN IF NOT EXISTS "since" TIMESTAMP(3) NOT NULL DEFAULT now();

-- 기존 데이터: createdAt을 since로 복사
UPDATE "facility_energy_configs" SET "since" = "createdAt" WHERE "since" = "createdAt";
