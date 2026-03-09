import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 실시간 리셋 시뮬레이션
 * - 10초마다 데이터 생성
 * - 30초 후 리셋 발생 (96% 감소)
 * - ResetDetectorService가 자동 감지하는지 확인
 */
async function main() {
  console.log('🚀 Starting real-time reset simulation...\n');

  // 1. 테스트 태그 조회
  const tag = await prisma.tag.findFirst({
    where: { tagName: 'TEST_USAGE_001' },
  });

  if (!tag) {
    console.error('❌ TEST_USAGE_001 tag not found');
    return;
  }

  console.log(`✅ Using tag: ${tag.tagName} (${tag.id})\n`);

  let currentValue = 10000; // 초기 적산값
  let counter = 0;

  // 2. 10초마다 데이터 생성
  const interval = setInterval(async () => {
    counter++;
    const timestamp = new Date();

    // 3회차에 리셋 발생 (30초 후)
    if (counter === 3) {
      currentValue = 100; // 10,020 → 100 (리셋!)
      console.log(`🔴 [${counter}] RESET! ${timestamp.toISOString()} | Value: ${currentValue}`);
    } else {
      currentValue += 10; // 적산 증가
      console.log(`📊 [${counter}] ${timestamp.toISOString()} | Value: ${currentValue}`);
    }

    // 데이터 삽입
    await prisma.tagDataRaw.create({
      data: {
        tagId: tag.id,
        timestamp,
        numericValue: currentValue,
        quality: 'GOOD',
      },
    });

    // 6회차 이후 종료 (60초)
    if (counter >= 6) {
      clearInterval(interval);
      console.log('\n✅ Simulation completed!');
      console.log('🔍 Check reset events:');
      console.log('   curl http://localhost:4001/api/test/cagg/resets?hours=1');
      await prisma.$disconnect();
      process.exit(0);
    }
  }, 10000); // 10초마다

  console.log('⏱️  Generating data every 10 seconds...');
  console.log('⏱️  Reset will occur at 30 seconds (3rd data point)');
  console.log('⏱️  Total duration: 60 seconds (6 data points)\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
