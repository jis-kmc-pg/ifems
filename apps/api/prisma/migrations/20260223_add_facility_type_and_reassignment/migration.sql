-- Phase 2: FacilityType and TagReassignmentLog
-- NOTE: Using TEXT for IDs to match existing schema

-- 1. FacilityType 테이블 생성
CREATE TABLE IF NOT EXISTS "facility_types" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(7),
  "icon" VARCHAR(50),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 2. Facility 테이블에 typeId 추가
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "typeId" TEXT;

ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_typeId_fkey";
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "facility_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "facilities_typeId_idx" ON "facilities"("typeId");

-- 3. TagReassignmentLog 테이블 생성
CREATE TABLE IF NOT EXISTS "tag_reassignment_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tagId" TEXT NOT NULL,
  "fromFacilityId" TEXT NOT NULL,
  "toFacilityId" TEXT NOT NULL,
  "reason" TEXT,
  "reassignedBy" VARCHAR(100),
  "reassignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tag_reassignment_logs_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tag_reassignment_logs_fromFacilityId_fkey"
    FOREIGN KEY ("fromFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tag_reassignment_logs_toFacilityId_fkey"
    FOREIGN KEY ("toFacilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "tag_reassignment_logs_tagId_idx" ON "tag_reassignment_logs"("tagId");
CREATE INDEX IF NOT EXISTS "tag_reassignment_logs_fromFacilityId_idx" ON "tag_reassignment_logs"("fromFacilityId");
CREATE INDEX IF NOT EXISTS "tag_reassignment_logs_toFacilityId_idx" ON "tag_reassignment_logs"("toFacilityId");

-- 4. 기본 설비 유형 삽입 (예시 데이터)
INSERT INTO "facility_types" ("id", "code", "name", "description", "color", "icon", "order", "createdAt", "updatedAt") VALUES
  ('facilitytype-machining', 'MACHINING', '가공설비', '절삭, 연삭 등 가공 작업', '#3B82F6', 'Settings', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('facilitytype-assembly', 'ASSEMBLY', '조립설비', '부품 조립 및 체결', '#10B981', 'Wrench', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('facilitytype-inspection', 'INSPECTION', '검사설비', '품질 검사 및 측정', '#F59E0B', 'Search', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('facilitytype-painting', 'PAINTING', '도장설비', '도장 및 코팅', '#EF4444', 'Paintbrush', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('facilitytype-utility', 'UTILITY', '유틸리티', '공조, 전력 등 지원 설비', '#8B5CF6', 'Zap', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
