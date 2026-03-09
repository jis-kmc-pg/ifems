/**
 * 마스터 데이터 임포트 스크립트
 * Tag/화성PT4공장_TagList.xlsx 파일에서 Factory, Line, Facility, Tag 데이터를 임포트
 */
import { PrismaClient } from '@prisma/client';
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
  DEPTH: string | number;
  ORDER: string | number;
  USE_YN: string | number;
  TAG_TYPE: string;
  ENERGY_TYPE: string;
  TYPE: string;
  DATA_TYPE: string;
  MEASURE_TYPE?: string;
  CATEGORY?: string;
}

async function importMasterData() {
  try {
    console.log('📂 엑셀 파일 읽기...');
    const excelPath = path.join(process.cwd(), '../../Tag/화성PT4공장_TagList.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { range: 8 });

    console.log(`✅ ${data.length}개 행 읽기 완료`);

    // 1. Factory 생성
    console.log('\n🏭 Factory 생성 중...');
    const factoryCode = data[0]?.PLANT_CODE || 'hw4';
    const factoryName = data[0]?.GROUP_NAME || '4공장';

    const factory = await prisma.factory.upsert({
      where: { code: factoryCode },
      update: {},
      create: {
        code: factoryCode,
        name: factoryName,
        fullName: '화성 PT4공장',
        location: '경기도 화성시',
        isActive: true,
      },
    });
    console.log(`✅ Factory 생성: ${factory.name} (ID: ${factory.id})`);

    // 2. Line 생성 (DEPTH=1)
    console.log('\n📍 Line 생성 중...');
    const lineRows = data.filter((row) => {
      const depth = typeof row.DEPTH === 'string' ? parseInt(row.DEPTH) : row.DEPTH;
      return depth === 1 && row.GROUP_CODE && row.GROUP_NAME;
    });

    const lineMap = new Map<string, string>(); // code -> id

    for (const lineRow of lineRows) {
      const line = await prisma.line.upsert({
        where: { code: lineRow.GROUP_CODE },
        update: {},
        create: {
          code: lineRow.GROUP_CODE,
          name: lineRow.GROUP_NAME,
          factoryId: factory.id,
          order: typeof lineRow.ORDER === 'string' ? parseInt(lineRow.ORDER) : lineRow.ORDER,
          isActive: true,
        },
      });
      lineMap.set(lineRow.GROUP_CODE, line.id);
      console.log(`  ✅ Line: ${line.name} (${line.code})`);
    }

    // 3. FacilityType 생성
    console.log('\n🏷️ FacilityType 생성 중...');
    const facilityTypes = [
      { code: 'MACHINE', name: '기계설비', description: '생산 라인 기계설비' },
      { code: 'UTILITY', name: '유틸리티', description: '컴프레서, 쿨링타워 등' },
      { code: 'SENSOR', name: '센서', description: '계측 센서' },
    ];

    const typeMap = new Map<string, string>();
    for (const typeData of facilityTypes) {
      const type = await prisma.facilityType.upsert({
        where: { code: typeData.code },
        update: {},
        create: typeData,
      });
      typeMap.set(typeData.code, type.id);
      console.log(`  ✅ FacilityType: ${type.name}`);
    }

    // 4. Facility 생성 (DEPTH=2)
    console.log('\n🏢 Facility 생성 중...');
    const facilityRows = data.filter((row) => {
      const depth = typeof row.DEPTH === 'string' ? parseInt(row.DEPTH) : row.DEPTH;
      return depth === 2 && row.GROUP_CODE && row.GROUP_NAME;
    });

    const facilityMap = new Map<string, string>(); // code -> id

    for (const facilityRow of facilityRows) {
      const lineId = lineMap.get(facilityRow.P_GROUP_CODE);
      if (!lineId) {
        console.warn(`  ⚠️ Line not found for facility: ${facilityRow.GROUP_NAME}`);
        continue;
      }

      const facility = await prisma.facility.upsert({
        where: { code: facilityRow.GROUP_CODE },
        update: {},
        create: {
          code: facilityRow.GROUP_CODE,
          name: facilityRow.GROUP_NAME,
          lineId,
          typeId: typeMap.get('MACHINE')!, // 기본 타입
          type: 'MC', // Machine
        },
      });
      facilityMap.set(facilityRow.GROUP_CODE, facility.id);
      console.log(`  ✅ Facility: ${facility.name} (${facility.code})`);
    }

    // 5. Tag 생성 (DEPTH=3)
    console.log('\n🏷️ Tag 생성 중...');
    const tagRows = data.filter((row) => {
      const depth = typeof row.DEPTH === 'string' ? parseInt(row.DEPTH) : row.DEPTH;
      return depth === 3 && row.TAG_NAME && row.TAG_TYPE;
    });

    console.log(`  📊 ${tagRows.length}개 태그 생성 시작...`);

    // measureType/category 매핑 함수
    const getMeasureTypeAndCategory = (tagType: string, dataType: string) => {
      const mapping: Record<string, { measureType: string; category: string }> = {
        'TREND_T': { measureType: 'INSTANTANEOUS', category: 'ENERGY' },
        'TREND_Q': { measureType: 'INSTANTANEOUS', category: 'QUALITY' },
        'USAGE_T': { measureType: 'CUMULATIVE', category: 'ENERGY' },
        'SENSOR_T': { measureType: 'INSTANTANEOUS', category: 'ENVIRONMENT' },
      };
      const key = `${tagType}_${dataType}`;
      return mapping[key] || { measureType: 'INSTANTANEOUS', category: 'ENERGY' };
    };

    let createdCount = 0;
    for (const tagRow of tagRows) {
      const facilityId = facilityMap.get(tagRow.P_GROUP_CODE);
      if (!facilityId) {
        console.warn(`  ⚠️ Facility not found for tag: ${tagRow.TAG_NAME}`);
        continue;
      }

      const dataTypeValue = tagRow.DATA_TYPE === 'Q' ? 'Q' : 'T';
      const { measureType, category } = getMeasureTypeAndCategory(tagRow.TAG_TYPE, dataTypeValue);

      await prisma.tag.upsert({
        where: { tagName: tagRow.TAG_NAME },
        update: {},
        create: {
          tagName: tagRow.TAG_NAME,
          displayName: tagRow.TAG_NAME,
          facilityId,
          measureType: measureType as any,
          energyType: (tagRow.ENERGY_TYPE as any) || null,
          category: category as any,
          unit: tagRow.ENERGY_TYPE === 'elec'
            ? (tagRow.TAG_TYPE === 'USAGE' ? 'kWh' : 'kW')
            : (tagRow.TAG_TYPE === 'USAGE' ? 'm³' : 'm³/min'),
          isActive: true,
        },
      });

      createdCount++;
      if (createdCount % 100 === 0) {
        console.log(`  📝 ${createdCount}개 태그 생성 완료...`);
      }
    }

    console.log(`✅ 총 ${createdCount}개 태그 생성 완료`);

    // 6. 통계 출력
    console.log('\n📊 데이터베이스 통계:');
    const stats = {
      factories: await prisma.factory.count(),
      lines: await prisma.line.count(),
      facilities: await prisma.facility.count(),
      tags: await prisma.tag.count(),
    };

    console.log(`  - Factory: ${stats.factories}개`);
    console.log(`  - Line: ${stats.lines}개`);
    console.log(`  - Facility: ${stats.facilities}개`);
    console.log(`  - Tag: ${stats.tags}개`);

    console.log('\n✅ 마스터 데이터 임포트 완료!');
  } catch (error) {
    console.error('❌ 임포트 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
importMasterData()
  .then(() => {
    console.log('\n🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
