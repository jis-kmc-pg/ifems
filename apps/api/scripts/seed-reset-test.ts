import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Creating RESET test data...');

  // 1. 기존 CUMULATIVE 태그 조회
  const usageTags = await prisma.tag.findMany({
    where: {
      measureType: 'CUMULATIVE',
      tagName: { startsWith: 'TEST_' },
    },
  });

  if (usageTags.length === 0) {
    console.error('❌ No TEST_CUMULATIVE tags found. Run seed-test-data.ts first.');
    return;
  }

  const tag = usageTags[0];
  console.log(`✅ Using tag: ${tag.tagName} (${tag.id})`);

  // 2. 현재 시간 기준으로 리셋 시나리오 생성
  const now = new Date();
  const baseValue = 10000; // 적산 초기값
  const resetValue = 100; // 리셋 후 값 (10% 이하)

  const testData = [];

  // 리셋 전 데이터 (30초 전 ~ 20초 전)
  for (let i = 30; i >= 20; i--) {
    testData.push({
      tagId: tag.id,
      timestamp: new Date(now.getTime() - i * 1000),
      numericValue: baseValue + (30 - i) * 10, // 점진적 증가
      quality: 'GOOD',
    });
  }

  // 🔴 리셋 발생 지점 (15초 전)
  testData.push({
    tagId: tag.id,
    timestamp: new Date(now.getTime() - 15000),
    numericValue: resetValue, // 10,300 → 100 (96% 감소 → 리셋 감지됨!)
    quality: 'GOOD',
  });

  // 리셋 후 데이터 (14초 전 ~ 현재)
  for (let i = 14; i >= 0; i--) {
    testData.push({
      tagId: tag.id,
      timestamp: new Date(now.getTime() - i * 1000),
      numericValue: resetValue + (14 - i) * 5, // 리셋 후 다시 증가
      quality: 'GOOD',
    });
  }

  // 3. 데이터 삽입
  const result = await prisma.tagDataRaw.createMany({
    data: testData,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${result.count} test data points with RESET event`);
  console.log(`📊 Before reset: ${baseValue + 100}`);
  console.log(`📉 After reset: ${resetValue} (96% decrease)`);
  console.log(`⏰ Reset timestamp: ${new Date(now.getTime() - 15000).toISOString()}`);
  console.log('');
  console.log('🔍 Wait 10 seconds and check:');
  console.log('   GET /api/test/cagg/resets?hours=1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
