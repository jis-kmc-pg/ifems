-- CreateTable: system_settings (시스템 설정 key-value)
CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" VARCHAR(500),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- 기본값 시드: 에어 단가
INSERT INTO "system_settings" ("key", "value", "description", "updatedAt")
VALUES (
    'air_cost_per_liter',
    '0.5',
    '에어 단가 (원/L) - 누기비용 추정에 사용',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
