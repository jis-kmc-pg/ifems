const { PrismaClient } = require('@prisma/client');

async function cleanup() {
  const prisma = new PrismaClient();

  try {
    const result = await prisma.energyTimeseries.deleteMany();
    console.log(`✅ EnergyTimeseries 데이터 초기화 완료 (${result.count}개 레코드 삭제)`);
  } catch (error) {
    console.error('❌ 초기화 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
