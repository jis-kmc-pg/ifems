const fs = require('fs');
const { PrismaClient } = require('./apps/api/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function loadTags() {
  console.log('=== 태그 데이터 적재 시작 ===\n');

  // Load extracted tags
  const tagsData = JSON.parse(fs.readFileSync('tags_extracted.json', 'utf8'));
  console.log(`추출된 태그 개수: ${tagsData.length}\n`);

  // Create facility code → ID mapping
  console.log('설비 ID 매핑 생성 중...');
  const facilities = await prisma.facility.findMany({
    select: { id: true, code: true },
  });

  const facilityMap = new Map();
  facilities.forEach(f => {
    facilityMap.set(f.code, f.id);
  });
  console.log(`매핑된 설비 개수: ${facilityMap.size}\n`);

  // Stats
  const stats = {
    total: tagsData.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // Batch insert
  console.log('태그 데이터 삽입 중...');
  const batchSize = 100;
  const batches = Math.ceil(tagsData.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, tagsData.length);
    const batch = tagsData.slice(start, end);

    console.log(`\n[${i + 1}/${batches}] Batch ${start + 1} ~ ${end} 처리 중...`);

    for (const tag of batch) {
      const facilityId = facilityMap.get(tag.facilityCode);

      if (!facilityId) {
        stats.skipped++;
        stats.errors.push({
          tagName: tag.tagName,
          reason: `Facility not found: ${tag.facilityCode}`,
        });
        continue;
      }

      try {
        await prisma.tag.create({
          data: {
            facilityId: facilityId,
            tagName: tag.tagName,
            displayName: tag.displayName,
            tagType: tag.tagType,
            energyType: tag.energyType || null,
            dataType: tag.dataType,
            unit: null, // TODO: 단위 매핑 필요
            order: tag.order,
            isActive: true,
          },
        });
        stats.inserted++;
      } catch (error) {
        stats.skipped++;
        stats.errors.push({
          tagName: tag.tagName,
          reason: error.message,
        });
      }
    }

    console.log(`  - 삽입: ${stats.inserted}, 스킵: ${stats.skipped}`);
  }

  console.log('\n=== 적재 완료 ===');
  console.log(`총 태그: ${stats.total}`);
  console.log(`삽입 성공: ${stats.inserted}`);
  console.log(`스킵: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ 오류 발생 (처음 10개):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.tagName}: ${err.reason}`);
    });

    if (stats.errors.length > 10) {
      console.log(`  ... 외 ${stats.errors.length - 10}개`);
    }
  }

  // Verification
  console.log('\n=== 검증 ===');
  const totalTags = await prisma.tag.count();
  console.log(`DB 태그 개수: ${totalTags}`);

  const byTagType = await prisma.tag.groupBy({
    by: ['tagType'],
    _count: true,
  });

  console.log('\n=== TAG_TYPE 분포 ===');
  byTagType.forEach(item => {
    console.log(`${item.tagType}: ${item._count}개`);
  });

  const byEnergyType = await prisma.tag.groupBy({
    by: ['energyType'],
    _count: true,
  });

  console.log('\n=== ENERGY_TYPE 분포 ===');
  byEnergyType.forEach(item => {
    console.log(`${item.energyType || 'NULL'}: ${item._count}개`);
  });

  // Sample tags
  const sampleTags = await prisma.tag.findMany({
    take: 10,
    include: {
      facility: {
        include: {
          line: true,
        },
      },
    },
  });

  console.log('\n=== 샘플 태그 (처음 10개) ===');
  sampleTags.forEach(tag => {
    console.log(`${tag.tagName}`);
    console.log(`  Display: ${tag.displayName}`);
    console.log(`  Facility: ${tag.facility.code} (${tag.facility.name})`);
    console.log(`  Line: ${tag.facility.line.code} (${tag.facility.line.name})`);
    console.log(`  Type: ${tag.tagType}, Energy: ${tag.energyType || 'N/A'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

loadTags().catch(error => {
  console.error('❌ 태그 적재 실패:', error);
  process.exit(1);
});
