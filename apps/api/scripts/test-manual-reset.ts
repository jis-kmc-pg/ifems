import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 수동 리셋 기록 테스트
 * - 기존 데이터의 리셋 이벤트를 수동으로 기록
 * - ResetDetectorService.recordManualReset() 메서드 테스트
 */
async function main() {
  const tag = await prisma.tag.findFirst({
    where: { tagName: 'TEST_USAGE_001' },
  });

  if (!tag) {
    console.log('❌ Tag not found');
    return;
  }

  // 실제 리셋이 발생한 시점의 데이터 기록
  const resetTime = new Date('2026-03-03T04:31:06.266Z');

  console.log('📝 Recording manual reset event...\n');
  console.log(`Tag: ${tag.tagName}`);
  console.log(`Reset time: ${resetTime.toISOString()}`);
  console.log(`Before reset: 10020`);
  console.log(`After reset: 100`);

  try {
    const event = await prisma.meterResetEvent.create({
      data: {
        tagId: tag.id,
        resetTime,
        valueBeforeReset: 10020,
        valueAfterReset: 100,
        detectionMethod: 'manual',
        correctionApplied: true,
        notes: 'Manual test: 99.0% decrease',
      },
    });

    console.log('\n✅ Reset event recorded successfully!');
    console.log(`Event ID: ${event.id}`);

    // 확인
    const events = await prisma.meterResetEvent.findMany({
      where: { tagId: tag.id },
      orderBy: { resetTime: 'desc' },
    });

    console.log(`\n📋 Total reset events for this tag: ${events.length}`);
    events.forEach((e) => {
      console.log(
        `  ${e.resetTime.toISOString()} | ${e.valueBeforeReset} → ${e.valueAfterReset} | ${e.detectionMethod}`,
      );
    });

    console.log('\n🔍 Check via API:');
    console.log('   curl "http://localhost:4001/api/test/cagg/resets?hours=24"');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('\n⚠️  Reset event already exists (UNIQUE constraint)');
    } else {
      throw error;
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
