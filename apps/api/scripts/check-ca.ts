import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:1@localhost:5432/ifems?schema=public',
});

async function main() {
  // 1. CA 정의 확인
  const cas = await prisma.$queryRawUnsafe<Array<{ view_name: string; view_definition: string }>>(`
    SELECT view_name, view_definition
    FROM timescaledb_information.continuous_aggregates;
  `);

  for (const ca of cas) {
    const hasOldCol = ca.view_definition.includes('numericValue');
    const hasNewCol = ca.view_definition.includes('value');
    console.log(`\n=== ${ca.view_name} ===`);
    console.log(`  numericValue 참조: ${hasOldCol ? '⚠️ YES' : '✅ NO'}`);
    console.log(`  value 참조: ${hasNewCol ? '✅ YES' : '❌ NO'}`);
    if (hasOldCol) {
      console.log(`  DEFINITION:\n${ca.view_definition.substring(0, 500)}`);
    }
  }

  // 2. 최근 데이터 확인
  const recent = await prisma.$queryRawUnsafe<Array<{ name: string; cnt: bigint; latest: Date }>>(`
    SELECT 'tag_data_raw' as name, COUNT(*) as cnt, MAX(timestamp) as latest FROM tag_data_raw WHERE timestamp >= NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT 'cagg_trend_10sec', COUNT(*), MAX(bucket) FROM cagg_trend_10sec WHERE bucket >= NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT 'cagg_usage_1min', COUNT(*), MAX(bucket) FROM cagg_usage_1min WHERE bucket >= NOW() - INTERVAL '1 hour';
  `);

  console.log('\n=== 최근 1시간 데이터 현황 ===');
  for (const r of recent) {
    console.log(`  ${r.name}: ${r.cnt} rows, latest: ${r.latest}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
