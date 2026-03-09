const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  
  const targetDate = new Date('2026-02-26');
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const currentData = await prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM timestamp) as hour,
      SUM("powerKwh") as "totalPower"
    FROM energy_timeseries
    WHERE timestamp >= ${targetDate} AND timestamp < ${nextDay}
    GROUP BY EXTRACT(HOUR FROM timestamp)
    ORDER BY hour
  `;

  console.log('Query Result:', JSON.stringify(currentData, null, 2));
  await prisma.$disconnect();
}

test();
