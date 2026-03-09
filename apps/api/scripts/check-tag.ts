import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tag = await prisma.tag.findFirst({
    where: { tagName: 'TEST_USAGE_001' },
  });

  console.log('Tag:', JSON.stringify(tag, null, 2));

  if (!tag) {
    console.log('❌ Tag not found');
    return;
  }

  // Recent data
  const recentData = await prisma.tagDataRaw.findMany({
    where: { tagId: tag.id },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });

  console.log('\nRecent data:');
  recentData.forEach((d) => {
    console.log(`  ${d.timestamp.toISOString()} - ${d.numericValue}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
