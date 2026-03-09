import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.meterResetEvent.findMany();

  console.log('📋 Reset events:');
  events.forEach((e) => {
    console.log(`  UTC: ${e.resetTime.toISOString()}`);
    console.log(`  Local: ${e.resetTime.toString()}`);
    console.log(`  Value: ${e.valueBeforeReset} → ${e.valueAfterReset}`);
    console.log('');
  });

  // 해당 시간대의 bucket 확인
  console.log('📊 Expected bucket (UTC -9h):');
  events.forEach((e) => {
    const bucketTime = new Date(e.resetTime);
    bucketTime.setUTCMinutes(0, 0, 0); // bucket은 1분 단위
    const utcBucket = new Date(bucketTime.getTime() - 9 * 60 * 60 * 1000);
    console.log(`  Reset: ${e.resetTime.toISOString()}`);
    console.log(`  Bucket (KST): ${bucketTime.toISOString()}`);
    console.log(`  Bucket (UTC): ${utcBucket.toISOString()}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
