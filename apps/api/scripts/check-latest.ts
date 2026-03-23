import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  const latest = await prisma.$queryRawUnsafe<Array<{ latest: Date; total: bigint }>>(`
    SELECT MAX(timestamp) as latest, COUNT(*) as total FROM tag_data_raw;
  `);
  console.log('tag_data_raw latest:', latest[0].latest, '| total:', latest[0].total.toString());

  const caLatest = await prisma.$queryRawUnsafe<Array<{ latest: Date }>>(`
    SELECT MAX(bucket) as latest FROM cagg_trend_10sec;
  `);
  console.log('cagg_trend_10sec latest:', caLatest[0].latest);
}

main().catch(console.error).finally(() => prisma.$disconnect());
