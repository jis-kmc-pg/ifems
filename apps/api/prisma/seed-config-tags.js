/**
 * ConfigTag 복수 태그 매핑 시드
 *
 * 각 facility_energy_config에 대해:
 * - elec DIFF → 해당 설비의 CUMULATIVE + ENERGY + elec 태그 전부
 * - elec INTEGRAL_TRAP → 해당 설비의 INSTANTANEOUS + ENERGY + elec 태그 전부
 * - air DIFF → 해당 설비의 CUMULATIVE + ENERGY + air 태그 전부
 * - air INTEGRAL_TRAP → 해당 설비의 INSTANTANEOUS + ENERGY + air 태그 전부
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // 1. 기존 configTag 삭제
  const deleted = await p.facilityEnergyConfigTag.deleteMany();
  console.log(`기존 configTag 삭제: ${deleted.count}건`);

  // 2. 모든 config 조회 (facility + tags 포함)
  const configs = await p.facilityEnergyConfig.findMany({
    include: {
      facility: {
        include: {
          tags: {
            where: { category: 'ENERGY' },
            select: { id: true, tagName: true, measureType: true, energyType: true },
          },
        },
      },
    },
  });

  console.log(`config 수: ${configs.length}`);

  let totalCreated = 0;
  let noTagConfigs = 0;

  for (const config of configs) {
    // calcMethod에 따라 measureType 결정
    const targetMeasureType = config.calcMethod === 'DIFF' ? 'CUMULATIVE' : 'INSTANTANEOUS';

    // 해당 설비의 매칭 태그 필터
    const matchingTags = config.facility.tags.filter(
      t => t.energyType === config.energyType && t.measureType === targetMeasureType
    );

    if (matchingTags.length === 0) {
      noTagConfigs++;
      continue;
    }

    // configTag 생성
    for (let i = 0; i < matchingTags.length; i++) {
      await p.facilityEnergyConfigTag.create({
        data: {
          configId: config.id,
          tagId: matchingTags[i].id,
          isActive: true,
          order: i,
        },
      });
      totalCreated++;
    }
  }

  console.log(`\n생성 완료: ${totalCreated}건`);
  console.log(`매칭 태그 없는 config: ${noTagConfigs}건`);

  // 3. 통계
  const stats = await p.facilityEnergyConfigTag.groupBy({
    by: ['configId'],
    _count: true,
  });

  const tagCountDist = {};
  stats.forEach(s => {
    tagCountDist[s._count] = (tagCountDist[s._count] || 0) + 1;
  });
  console.log('\n태그 수별 config 분포:');
  Object.entries(tagCountDist).sort((a, b) => a[0] - b[0]).forEach(([count, configs]) => {
    console.log(`  ${count}태그: ${configs}건`);
  });

  // 4. 샘플: HNK00_010
  const sample = await p.facilityEnergyConfig.findMany({
    where: { facility: { code: 'HNK00_010' } },
    include: {
      configTags: { include: { tag: { select: { tagName: true, measureType: true } } } },
      facility: { select: { code: true, name: true } },
    },
  });
  console.log('\n=== HNK00_010 (HNK00-010 블록투입기) ===');
  sample.forEach(c => {
    console.log(
      `${c.energyType} (${c.calcMethod}):`,
      c.configTags.map(t => `${t.tag.tagName} [${t.tag.measureType}]`).join(', ')
    );
  });
}

run().then(() => p.$disconnect()).catch(e => {
  console.error(e);
  p.$disconnect();
});
