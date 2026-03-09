import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function refreshAllData() {
  console.log('=== Continuous Aggregate 전체 데이터 집계 ===\n');

  try {
    // 1. 데이터 범위 확인
    console.log('1️⃣ 데이터 범위 확인...');
    const range = await prisma.$queryRaw<any[]>`
      SELECT
        MIN(timestamp) as min_time,
        MAX(timestamp) as max_time
      FROM tag_data_raw;
    `;

    if (range.length > 0) {
      console.log(`   최소: ${range[0].min_time}`);
      console.log(`   최대: ${range[0].max_time}\n`);

      // 2. 전체 데이터 집계
      console.log('2️⃣ 전체 데이터 집계 중 (시간이 걸릴 수 있습니다)...');
      const refreshStart = Date.now();

      await prisma.$executeRaw`
        CALL refresh_continuous_aggregate('energy_usage_1min',
          ${range[0].min_time}::timestamp,
          ${range[0].max_time}::timestamp);
      `;

      const refreshEnd = Date.now();
      console.log(`   ✅ 집계 완료! (${refreshEnd - refreshStart}ms)\n`);
    }

    // 3. 집계 결과 확인
    console.log('3️⃣ 집계 결과 확인...');
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        line_code,
        COUNT(*) as total_rows,
        MIN(bucket) as min_bucket,
        MAX(bucket) as max_bucket
      FROM energy_usage_1min
      GROUP BY line_code
      ORDER BY line_code;
    `;

    console.log('   집계된 데이터:\n');
    stats.forEach((s) => {
      console.log(`   ${s.line_code}: ${s.total_rows} rows`);
      console.log(`     범위: ${new Date(s.min_bucket).toISOString().slice(0, 19)} ~ ${new Date(s.max_bucket).toISOString().slice(0, 19)}`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

refreshAllData().catch(console.error);
