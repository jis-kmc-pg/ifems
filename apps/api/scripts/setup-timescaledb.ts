/**
 * TimescaleDB 하이퍼테이블 설정 스크립트
 * TagDataRaw 테이블을 시계열 데이터에 최적화된 하이퍼테이블로 변환
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTimescaleDB() {
  try {
    console.log('🚀 TimescaleDB 하이퍼테이블 설정 시작...\n');

    // 1. TimescaleDB extension 활성화
    console.log('📦 TimescaleDB extension 활성화 중...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
    console.log('✅ TimescaleDB extension 활성화 완료\n');

    // 2. 기존 데이터 확인
    console.log('📊 기존 데이터 확인 중...');
    const count = await prisma.tagDataRaw.count();
    console.log(`   - 현재 TagDataRaw 레코드: ${count}개\n`);

    // 3. TagDataRaw를 하이퍼테이블로 변환
    console.log('🔄 TagDataRaw를 하이퍼테이블로 변환 중...');

    try {
      // 이미 하이퍼테이블인지 확인
      const isHypertable = await prisma.$queryRaw<any[]>`
        SELECT * FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'tag_data_raw';
      `;

      if (isHypertable.length > 0) {
        console.log('⚠️  이미 하이퍼테이블로 설정되어 있습니다.');
      } else {
        // 하이퍼테이블 생성 (chunk_time_interval: 1일)
        await prisma.$executeRawUnsafe(`
          SELECT create_hypertable(
            'tag_data_raw',
            'timestamp',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
          );
        `);
        console.log('✅ 하이퍼테이블 변환 완료 (chunk: 1일)\n');
      }
    } catch (error: any) {
      if (error.message?.includes('already a hypertable')) {
        console.log('⚠️  이미 하이퍼테이블로 설정되어 있습니다.\n');
      } else {
        throw error;
      }
    }

    // 4. 압축 정책 설정 (7일 이전 데이터 압축)
    console.log('🗜️  데이터 압축 정책 설정 중...');
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE tag_data_raw SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'tag_id',
          timescaledb.compress_orderby = 'timestamp DESC'
        );
      `);
      console.log('✅ 압축 설정 완료 (segmentby: tag_id, orderby: timestamp)\n');

      // 자동 압축 정책 추가
      await prisma.$executeRawUnsafe(`
        SELECT add_compression_policy('tag_data_raw', INTERVAL '7 days', if_not_exists => TRUE);
      `);
      console.log('✅ 자동 압축 정책 추가 (7일 이전 데이터)\n');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  압축 정책이 이미 설정되어 있습니다.\n');
      } else {
        console.warn('⚠️  압축 정책 설정 실패 (선택 사항):', error.message);
      }
    }

    // 5. 데이터 보존 정책 설정 (90일)
    console.log('🗑️  데이터 보존 정책 설정 중...');
    try {
      await prisma.$executeRawUnsafe(`
        SELECT add_retention_policy('tag_data_raw', INTERVAL '90 days', if_not_exists => TRUE);
      `);
      console.log('✅ 데이터 보존 정책 추가 (90일 보관)\n');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  보존 정책이 이미 설정되어 있습니다.\n');
      } else {
        console.warn('⚠️  보존 정책 설정 실패 (선택 사항):', error.message);
      }
    }

    // 6. Continuous Aggregate 생성 (1분 집계)
    console.log('📈 Continuous Aggregate 설정 중...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS tag_data_1min
        WITH (timescaledb.continuous) AS
        SELECT
          time_bucket('1 minute', timestamp) AS bucket,
          tag_id,
          LAST(numeric_value, timestamp) AS last_value,
          FIRST(numeric_value, timestamp) AS first_value,
          AVG(numeric_value) AS avg_value,
          SUM(numeric_value) AS sum_value,
          COUNT(*) AS count
        FROM tag_data_raw
        WHERE numeric_value IS NOT NULL
        GROUP BY bucket, tag_id
        WITH NO DATA;
      `);
      console.log('✅ Continuous Aggregate 생성 완료 (1분 집계)\n');

      // Refresh 정책 추가
      await prisma.$executeRawUnsafe(`
        SELECT add_continuous_aggregate_policy('tag_data_1min',
          start_offset => INTERVAL '3 hours',
          end_offset => INTERVAL '1 minute',
          schedule_interval => INTERVAL '1 minute',
          if_not_exists => TRUE
        );
      `);
      console.log('✅ Continuous Aggregate 자동 갱신 정책 추가\n');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  Continuous Aggregate가 이미 존재합니다.\n');
      } else {
        console.warn('⚠️  Continuous Aggregate 생성 실패 (선택 사항):', error.message);
      }
    }

    // 7. 통계 확인
    console.log('📊 TimescaleDB 설정 통계:');
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        hypertable_name,
        num_chunks,
        compression_enabled,
        compressed_total_bytes,
        uncompressed_total_bytes
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'tag_data_raw';
    `;

    if (stats.length > 0) {
      console.log('   - Hypertable: ✅');
      console.log(`   - Chunks: ${stats[0].num_chunks}개`);
      console.log(`   - 압축: ${stats[0].compression_enabled ? '활성화' : '비활성화'}`);
    }

    console.log('\n✅ TimescaleDB 하이퍼테이블 설정 완료!');
    console.log('\n📝 다음 단계:');
    console.log('   1. pnpm dev:api → Backend 실행');
    console.log('   2. 1초마다 자동으로 데이터 수집 시작');
    console.log('   3. SELECT * FROM tag_data_1min → 1분 집계 데이터 확인');
  } catch (error) {
    console.error('❌ TimescaleDB 설정 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
setupTimescaleDB()
  .then(() => {
    console.log('\n🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
