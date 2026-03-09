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

  // 리셋 발생 시간 기준으로 전후 데이터 조회
  const resetTime = new Date('2026-03-03T04:31:06.266Z');

  const data = await prisma.tagDataRaw.findMany({
    where: {
      tagId: tag.id,
      timestamp: {
        gte: new Date(resetTime.getTime() - 60 * 1000),
        lte: new Date(resetTime.getTime() + 60 * 1000),
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  console.log(`📊 Data around reset time (${resetTime.toISOString()}):\n`);

  let prevValue: number | null = null;
  for (const d of data) {
    const diff = prevValue !== null ? d.numericValue - prevValue : 0;
    const decreasePercent =
      prevValue !== null && d.numericValue < prevValue
        ? ((prevValue - d.numericValue) / prevValue) * 100
        : 0;

    const indicator =
      decreasePercent >= 10 ? '🔴 RESET!' : diff < 0 ? '⚠️ decrease' : '';

    console.log(
      `${d.timestamp.toISOString()} | ${d.numericValue.toFixed(0).padStart(6)} | diff: ${diff.toFixed(0).padStart(6)} | ${indicator}`,
    );

    prevValue = d.numericValue;
  }

  // 리셋 이벤트 테이블 확인
  console.log('\n📋 Recorded reset events:');
  const events = await prisma.meterResetEvent.findMany({
    where: { tagId: tag.id },
    orderBy: { resetTime: 'desc' },
  });

  if (events.length === 0) {
    console.log('❌ No reset events recorded');
  } else {
    events.forEach((e) => {
      console.log(
        `  ${e.resetTime.toISOString()} | ${e.valueBeforeReset} → ${e.valueAfterReset} | ${e.detectionMethod} | ${e.notes}`,
      );
    });
  }

  // 리셋 감지 쿼리 직접 실행 (최근 2분 데이터)
  console.log('\n🔍 Reset detection query (last 2 minutes):');
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

  console.log(`Found ${resets.length} resets in last 30 seconds:`);
  if (resets.length === 0) {
    console.log('⚠️  No resets detected in last 30 seconds (data too old)');
    console.log('💡  ResetDetectorService only checks last 30 seconds');
  } else {
    resets.forEach((r) => {
      console.log(
        `  ${r.timestamp.toISOString()} | ${r.previous_value} → ${r.current_value} | -${(Number(r.decrease_percent) * 100).toFixed(2)}%`,
      );
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
