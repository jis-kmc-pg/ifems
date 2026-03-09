-- ============================================================
-- Step 1: tag_data_raw에 메타데이터 컬럼 추가
-- Created: 2026-03-03
-- Description: Continuous Aggregate를 위한 메타데이터 중복 저장
-- ============================================================

-- facilityId 컬럼 추가
ALTER TABLE tag_data_raw
ADD COLUMN IF NOT EXISTS "facilityId" VARCHAR(36);

-- tagType 컬럼 추가
ALTER TABLE tag_data_raw
ADD COLUMN IF NOT EXISTS "tagType" VARCHAR(20);

-- energyType 컬럼 추가
ALTER TABLE tag_data_raw
ADD COLUMN IF NOT EXISTS "energyType" VARCHAR(20);

-- 인덱스 추가 (쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tag_data_raw_facility_time
  ON tag_data_raw("facilityId", timestamp);

CREATE INDEX IF NOT EXISTS idx_tag_data_raw_tag_type_time
  ON tag_data_raw("tagType", timestamp);

-- 기존 데이터에 메타데이터 채우기 (tags 테이블에서 복사)
UPDATE tag_data_raw tdr
SET
  "facilityId" = t."facilityId",
  "tagType" = t."tagType"::text,
  "energyType" = t."energyType"::text
FROM tags t
WHERE tdr."tagId" = t.id
  AND (tdr."facilityId" IS NULL OR tdr."tagType" IS NULL OR tdr."energyType" IS NULL);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Metadata columns added to tag_data_raw';
  RAISE NOTICE '📊 Added: facilityId, tagType, energyType';
  RAISE NOTICE '🔄 Existing data updated from tags table';
END $$;
