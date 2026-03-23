import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  const counts = await prisma.$queryRawUnsafe<any[]>(
    'SELECT type, severity, COUNT(*) as cnt FROM alerts GROUP BY type, severity ORDER BY type, severity'
  );
  console.log('=== alerts 현황 ===');
  for (const c of counts) {
    console.log('  ' + c.type + ' [' + c.severity + ']: ' + c.cnt + '건');
  }
  const total = await prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as total FROM alerts');
  console.log('  총: ' + total[0].total + '건');

  // 최근 5건 샘플
  console.log('\n=== 최근 알림 5건 ===');
  const recent = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.type, a.severity, f.code as fac_code, a.message, a."detectedAt"
    FROM alerts a
    JOIN facilities f ON a."facilityId" = f.id
    ORDER BY a."detectedAt" DESC
    LIMIT 5
  `);
  for (const r of recent) {
    console.log('  [' + r.severity + '] ' + r.fac_code + ': ' + r.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
