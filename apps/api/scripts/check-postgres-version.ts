/**
 * PostgreSQL 버전 확인 스크립트
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPostgresVersion() {
  try {
    console.log('🔍 PostgreSQL 버전 확인 중...\n');

    // PostgreSQL 버전 확인
    const versionResult = await prisma.$queryRaw<any[]>`SELECT version();`;
    const versionString = versionResult[0]?.version || 'Unknown';

    console.log('📦 PostgreSQL 버전:');
    console.log(`   ${versionString}\n`);

    // 버전 파싱
    const match = versionString.match(/PostgreSQL (\d+)\.(\d+)/);
    if (match) {
      const majorVersion = parseInt(match[1]);
      const minorVersion = parseInt(match[2]);

      console.log(`✅ 주 버전: PostgreSQL ${majorVersion}`);
      console.log(`   부 버전: ${majorVersion}.${minorVersion}\n`);

      // TimescaleDB 다운로드 링크 안내
      console.log('📥 TimescaleDB 다운로드 링크:');
      console.log(`   https://github.com/timescale/timescaledb/releases`);
      console.log(`   파일명: timescaledb-postgresql-${majorVersion}-windows-amd64.zip\n`);

      // PostgreSQL 설치 경로 안내
      console.log('📂 예상 PostgreSQL 설치 경로:');
      console.log(`   C:\\Program Files\\PostgreSQL\\${majorVersion}\\`);
      console.log(`   DLL 복사 위치: C:\\Program Files\\PostgreSQL\\${majorVersion}\\lib\\`);
      console.log(`   설정 파일: C:\\Program Files\\PostgreSQL\\${majorVersion}\\data\\postgresql.conf\n`);
    }

    // 현재 extensions 확인
    console.log('🔌 현재 설치된 Extensions:');
    const extensions = await prisma.$queryRaw<any[]>`
      SELECT extname, extversion
      FROM pg_extension
      ORDER BY extname;
    `;

    if (extensions.length > 0) {
      extensions.forEach((ext) => {
        const checkMark = ext.extname === 'timescaledb' ? '✅' : '  ';
        console.log(`   ${checkMark} ${ext.extname} (v${ext.extversion})`);
      });
    } else {
      console.log('   (기본 extensions만 설치됨)');
    }

    // TimescaleDB 설치 여부 확인
    const hasTimescaleDB = extensions.some((ext) => ext.extname === 'timescaledb');
    if (hasTimescaleDB) {
      console.log('\n✅ TimescaleDB가 이미 설치되어 있습니다!');
      console.log('   다음 명령어를 실행하세요: pnpm db:timescale');
    } else {
      console.log('\n⚠️  TimescaleDB가 설치되지 않았습니다.');
      console.log('   설치 가이드를 따라 진행하세요: scripts/install-timescaledb-guide.md');
    }

    console.log('\n' + '─'.repeat(70));
    console.log('📋 설치 단계 요약:');
    console.log('─'.repeat(70));
    console.log('1. TimescaleDB ZIP 파일 다운로드');
    console.log('2. timescaledb.dll 파일을 PostgreSQL lib 폴더에 복사');
    console.log('3. postgresql.conf 파일 수정:');
    console.log(`   shared_preload_libraries = 'timescaledb'`);
    console.log('4. PostgreSQL 서비스 재시작 (services.msc)');
    console.log('5. Extension 활성화:');
    console.log(`   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);
    console.log('6. 하이퍼테이블 설정:');
    console.log(`   pnpm db:timescale`);
    console.log('─'.repeat(70));
  } catch (error) {
    console.error('❌ 확인 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkPostgresVersion()
  .then(() => {
    console.log('\n🎉 버전 확인 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 실행 실패:', error);
    process.exit(1);
  });
