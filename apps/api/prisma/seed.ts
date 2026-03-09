// i-FEMS Database Seed Script
// 화성 PT4공장 Tag List Excel 파일에서 데이터를 읽어 DB에 삽입

import { PrismaClient, FacilityStatus, MeasureType, TagCategory, EnergyType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExcelRow {
  PLANT_CODE: string;
  P_GROUP_CODE: string;
  P_GROUP_NAME: string;
  GROUP_CODE: string;
  GROUP_NAME: string;
  TAG_NAME: string;
  DEPTH: string;
  ORDER: string;
  USE_YN: string;
  TAG_TYPE: string;
  ENERGY_TYPE: string;
  TYPE: string;
  DATA_TYPE: string;
}

async function main() {
  console.log('🌱 i-FEMS 데이터베이스 시드 시작...\n');

  // ============================================================
  // 1. Excel 파일 읽기
  // ============================================================
  console.log('📂 Excel 파일 읽기 중...');
  const excelPath = path.join(__dirname, '../../../Tag/화성PT4공장_TagList.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets['Sheet1'];

  // 헤더 없이 배열로 읽기 (8번째 행부터 실제 데이터)
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    range: 7,
    defval: '',
  }) as any[][];

  // 헤더 수동 매핑
  const headers = [
    'PLANT_CODE',
    'P_GROUP_CODE',
    'P_GROUP_NAME',
    'GROUP_CODE',
    'GROUP_NAME',
    'TAG_NAME',
    'DEPTH',
    'ORDER',
    'USE_YN',
    'TAG_TYPE',
    'ENERGY_TYPE',
    'TYPE',
    'DATA_TYPE',
  ];

  // 객체 배열로 변환
  const data = rawData
    .map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj as ExcelRow;
    })
    .filter(
      (row) =>
        row.PLANT_CODE &&
        row.PLANT_CODE !== '공장코드' &&
        row.PLANT_CODE !== 'PLANT_CODE'
    );

  console.log(`✅ 총 ${data.length}개 행 로드 완료\n`);

  // ============================================================
  // 2. 기존 데이터 삭제 (역순으로 삭제 - FK 제약 조건 고려)
  // ============================================================
  console.log('🗑️  기존 데이터 삭제 중...');
  await prisma.energyTimeseries.deleteMany();
  await prisma.tagDataRaw.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.line.deleteMany();
  await prisma.factory.deleteMany();
  console.log('✅ 기존 데이터 삭제 완료\n');

  // ============================================================
  // 3. Factory 생성
  // ============================================================
  console.log('🏭 공장 데이터 생성 중...');
  const factory = await prisma.factory.create({
    data: {
      code: 'hw4',
      name: '4공장',
      fullName: '화성 PT4공장',
      location: '경기도 화성시',
      isActive: true,
    },
  });
  console.log(`✅ 공장 생성: ${factory.name}\n`);

  // ============================================================
  // 4. Lines 생성
  // ============================================================
  console.log('📊 라인 데이터 생성 중...');
  const lineRows = data.filter((row) => parseInt(row.DEPTH) === 1);
  const lineMap = new Map<string, string>(); // code -> id

  for (const row of lineRows) {
    const line = await prisma.line.create({
      data: {
        code: row.GROUP_CODE,
        name: row.GROUP_NAME,
        factoryId: factory.id,
        order: parseInt(row.ORDER) || 0,
        isActive: true,
      },
    });
    lineMap.set(row.GROUP_CODE, line.id);
    console.log(`  - ${line.name} (${line.code})`);
  }
  console.log(`✅ ${lineRows.length}개 라인 생성 완료\n`);

  // ============================================================
  // 5. Facilities 생성
  // ============================================================
  console.log('⚙️  설비 데이터 생성 중...');
  const facilityRows = data.filter(
    (row) => parseInt(row.DEPTH) === 2 && row.DATA_TYPE === 'G'
  );
  const facilityMap = new Map<string, string>(); // code -> id

  let facilityCount = 0;
  for (const row of facilityRows) {
    const lineId = lineMap.get(row.P_GROUP_CODE);
    if (!lineId) {
      console.warn(`  ⚠️  라인을 찾을 수 없음: ${row.P_GROUP_CODE}`);
      continue;
    }

    const facility = await prisma.facility.create({
      data: {
        code: row.GROUP_CODE,
        name: row.GROUP_NAME,
        lineId,
        type: 'MC', // 기본값
        status: FacilityStatus.NORMAL,
        isProcessing: true,
      },
    });
    facilityMap.set(row.GROUP_CODE, facility.id);
    facilityCount++;

    if (facilityCount % 50 === 0) {
      console.log(`  - ${facilityCount}/${facilityRows.length} 설비 생성 중...`);
    }
  }
  console.log(`✅ ${facilityCount}개 설비 생성 완료\n`);

  // ============================================================
  // 6. Tags 생성
  // ============================================================
  console.log('🏷️  태그 데이터 생성 중...');
  const tagRows = data.filter(
    (row) =>
      parseInt(row.DEPTH) === 3 &&
      (row.DATA_TYPE === 'T' || row.DATA_TYPE === 'Q') &&
      row.TAG_NAME
  );

  let tagCount = 0;
  let skippedTags = 0;
  const tagIds: string[] = [];

  for (const row of tagRows) {
    const facilityId = facilityMap.get(row.P_GROUP_CODE);
    if (!facilityId) {
      skippedTags++;
      continue;
    }

    // measureType 매핑 (TAG_TYPE → MeasureType)
    let measureType: MeasureType;
    switch (row.TAG_TYPE) {
      case 'USAGE':
        measureType = MeasureType.CUMULATIVE;
        break;
      case 'SENSOR':
        measureType = MeasureType.INSTANTANEOUS;
        break;
      case 'TREND':
      default:
        measureType = MeasureType.INSTANTANEOUS;
    }

    // category 매핑 (TAG_TYPE + DATA_TYPE → TagCategory)
    let category: TagCategory;
    if (row.TAG_TYPE === 'SENSOR') {
      category = TagCategory.ENVIRONMENT;
    } else if (row.DATA_TYPE === 'Q') {
      category = TagCategory.QUALITY;
    } else {
      category = TagCategory.ENERGY;
    }

    // ENERGY_TYPE 매핑
    let energyType: EnergyType | null = null;
    if (row.ENERGY_TYPE === 'elec') {
      energyType = EnergyType.elec;
    } else if (row.ENERGY_TYPE === 'air') {
      energyType = EnergyType.air;
    }

    try {
      const tag = await prisma.tag.create({
        data: {
          facilityId,
          tagName: row.TAG_NAME,
          displayName: row.GROUP_NAME || row.TAG_NAME,
          measureType,
          category,
          energyType,
          unit: energyType === EnergyType.elec ? 'kWh' : energyType === EnergyType.air ? 'm³' : null,
          order: parseInt(row.ORDER) || 0,
          isActive: row.USE_YN === '1',
        },
      });
      tagIds.push(tag.id);
      tagCount++;

      if (tagCount % 100 === 0) {
        console.log(`  - ${tagCount}/${tagRows.length} 태그 생성 중...`);
      }
    } catch (error: any) {
      // 중복 태그명 무시
      if (error.code === 'P2002') {
        skippedTags++;
      } else {
        console.error(`  ❌ 태그 생성 오류: ${row.TAG_NAME}`, error.message);
      }
    }
  }
  console.log(`✅ ${tagCount}개 태그 생성 완료 (${skippedTags}개 스킵)\n`);

  // ============================================================
  // 7. FacilityEnergyConfig 자동 생성
  // ============================================================
  console.log('⚡ 설비별 에너지 사용량 소스 매핑 생성 중...');

  const allFacilitiesWithTags = await prisma.facility.findMany({
    include: {
      tags: {
        where: { isActive: true, category: TagCategory.ENERGY },
      },
    },
  });

  let configCount = 0;
  let reviewCount = 0;

  for (const fac of allFacilitiesWithTags) {
    for (const eType of [EnergyType.elec, EnergyType.air] as const) {
      const energyTags = fac.tags.filter(t => t.energyType === eType);
      if (energyTags.length === 0) continue;

      // 적산/순시 태그 분류
      const cumulativeTags = energyTags.filter(t => t.measureType === MeasureType.CUMULATIVE);
      const instantaneousTags = energyTags.filter(t => t.measureType === MeasureType.INSTANTANEOUS);

      // calcMethod: 적산 태그 있으면 DIFF, 순시만 있으면 INTEGRAL_TRAP
      const useDiff = cumulativeTags.length > 0;
      const calcMethod = useDiff ? 'DIFF' : 'INTEGRAL_TRAP';
      const needsReview = !useDiff;
      const sourceTags = useDiff ? cumulativeTags : instantaneousTags;
      if (sourceTags.length === 0) continue;

      try {
        const config = await prisma.facilityEnergyConfig.create({
          data: {
            facilityId: fac.id,
            energyType: eType,
            calcMethod: calcMethod as any,
            needsReview,
            updatedAt: new Date(),
          },
        });
        // configTag: 복수 태그 매핑
        for (let i = 0; i < sourceTags.length; i++) {
          await prisma.facilityEnergyConfigTag.create({
            data: { configId: config.id, tagId: sourceTags[i].id, order: i },
          });
        }
        configCount++;
        if (needsReview) reviewCount++;
      } catch (error: any) {
        if (error.code !== 'P2002') {
          console.error(`  ❌ Config 생성 오류: ${fac.code}/${eType}`, error.message);
        }
      }
    }
  }

  console.log(`✅ ${configCount}개 에너지 소스 매핑 생성 완료 (⚠️ ${reviewCount}개 관리자 확인 필요)\n`);

  // ============================================================
  // 8. 데모 EnergyTimeseries 데이터 생성
  // ============================================================
  console.log('📈 데모 에너지 데이터 생성 중...');

  const facilities = await prisma.facility.findMany({
    include: { line: true },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const demoData: any[] = [];

  // 각 설비별로 오늘 데이터 생성 (1시간 단위로 24개)
  for (const facility of facilities) {
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(today);
      timestamp.setHours(hour);

      // 랜덤 데이터 생성
      const powerKwh = Math.random() * 100 + 50; // 50~150 kWh
      const airL = Math.random() * 500 + 200; // 200~700 L

      // 상태 랜덤 (대부분 NORMAL, 일부 WARNING/DANGER)
      const rand = Math.random();
      let status: FacilityStatus;
      if (rand < 0.8) status = FacilityStatus.NORMAL;
      else if (rand < 0.95) status = FacilityStatus.WARNING;
      else status = FacilityStatus.DANGER;

      demoData.push({
        facilityId: facility.id,
        timestamp,
        powerKwh,
        airL,
        status,
      });
    }
  }

  // 배치로 데이터 삽입 (1000개씩)
  const batchSize = 1000;
  for (let i = 0; i < demoData.length; i += batchSize) {
    const batch = demoData.slice(i, i + batchSize);
    await prisma.energyTimeseries.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`  - ${Math.min(i + batchSize, demoData.length)}/${demoData.length} 데이터 생성 중...`);
  }

  console.log(`✅ ${demoData.length}개 에너지 데이터 생성 완료\n`);

  // ============================================================
  // 8. 완료
  // ============================================================
  console.log('✨ 시드 완료!\n');
  console.log('📊 생성된 데이터:');
  console.log(`  - 공장: 1개`);
  console.log(`  - 라인: ${lineRows.length}개`);
  console.log(`  - 설비: ${facilityCount}개`);
  console.log(`  - 태그: ${tagCount}개`);
  console.log(`  - 에너지 데이터: ${demoData.length}개`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
