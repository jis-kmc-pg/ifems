import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tag = await prisma.tag.findFirst({
    where: { tagName: 'TEST_USAGE_001' },
  });

  if (!tag) {
    console.log('❌ Tag not found');
    return;
  }

  // 최근 1분 데이터 전체 조회 (시간순 정렬)
  const recentData = await prisma.tagDataRaw.findMany({
    where: {
      tagId: tag.id,
      timestamp: {
        gte: new Date(Date.now() - 60 * 1000),
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  console.log(`📊 Recent 60 seconds data (${recentData.length} records):\n`);

  let prevValue: number | null = null;
  for (const d of recentData) {
    const diff = prevValue !== null ? d.numericValue - prevValue : 0;
    const decreasePercent =
      prevValue !== null && d.numericValue < prevValue
        ? ((prevValue - d.numericValue) / prevValue) * 100
        : 0;

    const indicator =
      decreasePercent >= 10 ? '🔴 RESET!' : diff < 0 ? '⚠️ decrease' : '';

    console.log(
      `${d.timestamp.toISOString()} | ${d.numericValue.toFixed(0).padStart(5)} | diff: ${diff.toFixed(0).padStart(6)} | ${indicator}`,
    );

    prevValue = d.numericValue;
  }

  // SQL 쿼리 직접 실행 (Reset Detector와 동일한 로직)
  console.log('\n🔍 Running reset detection query (same as ResetDetectorService):\n');

  const resets = await prisma.$queryRaw<
    Array<{
      timestamp: Date;
      current_value: number;
      previous_value: number;
      decrease_percent: number;
    }>
  >`
    WITH value_changes AS (
      SELECT
        timestamp,
        "numericValue" as current_value,
        LAG("numericValue") OVER (ORDER BY timestamp) as previous_value
      FROM tag_data_raw
      WHERE "tagId" = ${tag.id}
        AND timestamp >= NOW() - INTERVAL '2 minutes'
        AND "numericValue" IS NOT NULL
      ORDER BY timestamp
    )
    SELECT
      timestamp,
      current_value,
      previous_value,
      ((previous_value - current_value) / previous_value) as decrease_percent
    FROM value_changes
    WHERE previous_value IS NOT NULL
      AND current_value < previous_value
      AND ((previous_value - current_value) / previous_value) >= 0.1
      AND timestamp >= NOW() - INTERVAL '30 seconds'
    ORDER BY timestamp DESC
    LIMIT 5;
  `;

  console.log(`Found ${resets.length} resets:`);
  resets.forEach((r) => {
    console.log(
      `  ${r.timestamp.toISOString()} | ${r.previous_value} → ${r.current_value} | -${(Number(r.decrease_percent) * 100).toFixed(2)}%`,
    );
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
