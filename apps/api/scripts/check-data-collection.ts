/**
 * 데이터 수집 상태 확인 스크립트
 * TagDataRaw에 1초 단위로 데이터가 적재되는지 실시간 모니터링
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDataCollection() {
  try {
    console.log('📊 데이터 수집 상태 확인 시작...\n');

    // 1. 전체 데이터 개수
    const totalCount = await prisma.tagDataRaw.count();
    console.log(`📦 총 데이터 개수: ${totalCount.toLocaleString()}개\n`);

    // 2. 최근 10초간 데이터
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentCount = await prisma.tagDataRaw.count({
      where: {
        timestamp: { gte: tenSecondsAgo },
      },
    });
    console.log(`🕒 최근 10초 데이터: ${recentCount.toLocaleString()}개`);

    // 3. 태그별 데이터 수집 현황
    const tagStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(DISTINCT tag_id) as tag_count,
        COUNT(*) as total_records,
        MIN(timestamp) as first_timestamp,
        MAX(timestamp) as last_timestamp
      FROM tag_data_raw
      WHERE timestamp >= NOW() - INTERVAL '1 minute';
    `;

    if (tagStats.length > 0) {
      const stat = tagStats[0];
      console.log(`\n📈 최근 1분 통계:`);
      console.log(`   - 수집 중인 태그: ${stat.tag_count}개`);
      console.log(`   - 총 레코드: ${stat.total_records.toLocaleString()}개`);
      console.log(`   - 첫 데이터: ${stat.first_timestamp}`);
      console.log(`   - 마지막 데이터: ${stat.last_timestamp}`);
    }

    // 4. 태그 타입별 분포
    const typeStats = await prisma.$queryRaw<any[]>`
      SELECT
        t.tag_type,
        COUNT(*) as count,
        MAX(tdr.timestamp) as last_collected
      FROM tag_data_raw tdr
      JOIN "Tag" t ON tdr.tag_id = t.id
      WHERE tdr.timestamp >= NOW() - INTERVAL '1 minute'
      GROUP BY t.tag_type
      ORDER BY count DESC;
    `;

    if (typeStats.length > 0) {
      console.log(`\n🏷️  태그 타입별 수집 현황 (최근 1분):`);
      typeStats.forEach((stat) => {
        console.log(`   - ${stat.tag_type}: ${stat.count.toLocaleString()}개`);
      });
    }

    // 5. 샘플 데이터 (최근 5개)
    const sampleData = await prisma.$queryRaw<any[]>`
      SELECT
        tdr.timestamp,
        t.tag_name,
        t.tag_type,
        t.energy_type,
        tdr.numeric_value,
        tdr.quality
      FROM tag_data_raw tdr
      JOIN "Tag" t ON tdr.tag_id = t.id
      ORDER BY tdr.timestamp DESC
      LIMIT 5;
    `;

    if (sampleData.length > 0) {
      console.log(`\n📝 샘플 데이터 (최근 5개):`);
      sampleData.forEach((row, idx) => {
        console.log(`   ${idx + 1}. [${row.timestamp.toISOString()}] ${row.tag_name}`);
        console.log(`      타입: ${row.tag_type} | 에너지: ${row.energy_type || 'N/A'}`);
        console.log(`      값: ${row.numeric_value?.toFixed(2)} | 품질: ${row.quality}`);
      });
    }

    // 6. 1초 단위 수집 확인
    console.log(`\n⏱️  실시간 수집 모니터링 (5초간)...`);
    for (let i = 0; i < 5; i++) {
      const beforeCount = await prisma.tagDataRaw.count();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const afterCount = await prisma.tagDataRaw.count();
      const diff = afterCount - beforeCount;

      if (diff > 0) {
        console.log(`   ${i + 1}초: +${diff}개 레코드 ✅`);
      } else {
        console.log(`   ${i + 1}초: 변화 없음 ⚠️`);
      }
    }

    // 7. TimescaleDB 하이퍼테이블 상태 확인
    try {
      const hypertableInfo = await prisma.$queryRaw<any[]>`
        SELECT
          hypertable_name,
          num_chunks,
          compression_enabled
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'tag_data_raw';
      `;

      if (hypertableInfo.length > 0) {
        console.log(`\n🗄️  TimescaleDB 하이퍼테이블 상태:`);
        console.log(`   - Hypertable: ✅`);
        console.log(`   - Chunks: ${hypertableInfo[0].num_chunks}개`);
        console.log(`   - 압축: ${hypertableInfo[0].compression_enabled ? '활성화' : '비활성화'}`);
      } else {
        console.log(`\n⚠️  TimescaleDB 하이퍼테이블 미설정`);
        console.log(`   → pnpm tsx scripts/setup-timescaledb.ts 실행 필요`);
      }
    } catch (error) {
      console.log(`\n⚠️  TimescaleDB extension이 설치되지 않았습니다.`);
      console.log(`   → pnpm tsx scripts/setup-timescaledb.ts 실행 필요`);
    }

    console.log('\n✅ 데이터 수집 상태 확인 완료!');
  } catch (error) {
    console.error('❌ 확인 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkDataCollection()
  .then(() => {
    console.log('\n🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
