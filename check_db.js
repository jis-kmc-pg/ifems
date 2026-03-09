const { PrismaClient } = require('./apps/api/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('=== 현재 DB 상태 확인 ===\n');

  // 전체 설비 개수
  const totalCount = await prisma.facility.count();
  console.log('총 설비 개수:', totalCount);

  // 라인별 개수
  const byLine = await prisma.facility.groupBy({
    by: ['line'],
    _count: true,
    orderBy: { line: 'asc' },
  });

  console.log('\n=== 라인별 설비 개수 ===');
  byLine.forEach(item => {
    console.log(`${item.line}: ${item._count} 개`);
  });

  // Type별 개수
  const byType = await prisma.facility.groupBy({
    by: ['type'],
    _count: true,
  });

  console.log('\n=== Type별 설비 개수 ===');
  byType.forEach(item => {
    console.log(`${item.type || 'NULL'}: ${item._count} 개`);
  });

  // 각 라인의 설비 코드 샘플 (첫 5개씩)
  console.log('\n=== 라인별 설비 코드 샘플 (첫 5개) ===');
  for (const line of ['BLOCK', 'HEAD', 'CRANK', 'ASSEMBLE']) {
    const facilities = await prisma.facility.findMany({
      where: { line },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
      take: 5,
    });

    console.log(`\n${line}:`);
    facilities.forEach(f => console.log(`  ${f.code}: ${f.name}`));
  }

  await prisma.$disconnect();
}

checkDatabase().catch(console.error);
