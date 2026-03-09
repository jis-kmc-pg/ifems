/**
 * 테스트 데이터 생성 스크립트
 * Continuous Aggregate 테스트용
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // 1. Factory 생성
  const factory = await prisma.factory.upsert({
    where: { code: 'TEST-FACTORY' },
    update: {},
    create: {
      code: 'TEST-FACTORY',
      name: 'Test Factory',
      fullName: 'Test Factory for Continuous Aggregate',
      location: 'Test Location',
    },
  });
  console.log('✅ Factory created:', factory.code);

  // 2. Line 생성
  const line = await prisma.line.upsert({
    where: { code: 'HNK10' },
    update: {},
    create: {
      code: 'HNK10',
      name: 'HNK Line 10',
      factoryId: factory.id,
      order: 1,
    },
  });
  console.log('✅ Line created:', line.code);

  // 2. Facility 생성
  const facility = await prisma.facility.upsert({
    where: { code: 'HNK10-010' },
    update: {},
    create: {
      code: 'HNK10-010',
      name: 'HNK10-010 Test Machine',
      lineId: line.id,
      type: 'MC',
      status: 'NORMAL',
    },
  });
  console.log('✅ Facility created:', facility.code);

  // 3. Tags 생성 (CUMULATIVE, INSTANTANEOUS+ENERGY, INSTANTANEOUS+ENVIRONMENT 각 1개씩)
  const usageTag = await prisma.tag.upsert({
    where: { tagName: 'TEST_USAGE_001' },
    update: {},
    create: {
      tagName: 'TEST_USAGE_001',
      displayName: 'Test Electric Usage',
      facilityId: facility.id,
      measureType: 'CUMULATIVE',
      energyType: 'elec',
      category: 'ENERGY',
      unit: 'kWh',
    },
  });

  const trendTag = await prisma.tag.upsert({
    where: { tagName: 'TEST_TREND_001' },
    update: {},
    create: {
      tagName: 'TEST_TREND_001',
      displayName: 'Test Power Trend',
      facilityId: facility.id,
      measureType: 'INSTANTANEOUS',
      energyType: 'elec',
      category: 'ENERGY',
      unit: 'kW',
    },
  });

  const sensorTag = await prisma.tag.upsert({
    where: { tagName: 'TEST_SENSOR_001' },
    update: {},
    create: {
      tagName: 'TEST_SENSOR_001',
      displayName: 'Test Temperature Sensor',
      facilityId: facility.id,
      measureType: 'INSTANTANEOUS',
      category: 'ENVIRONMENT',
      unit: '°C',
    },
  });

  console.log('✅ Tags created:', {
    usage: usageTag.tagName,
    trend: trendTag.tagName,
    sensor: sensorTag.tagName,
  });

  // 4. 시계열 데이터 생성 (최근 10분)
  const now = new Date();
  const dataPoints: any[] = [];

  for (let i = 0; i < 600; i++) {
    // 10분 = 600초
    const timestamp = new Date(now.getTime() - i * 1000);

    // USAGE: 누적치 (증가)
    dataPoints.push({
      timestamp,
      tagId: usageTag.id,
      numericValue: 1000 + i * 0.5, // 0.5 kWh씩 증가
      quality: 'GOOD',
    });

    // TREND: 순시값 (변동)
    dataPoints.push({
      timestamp,
      tagId: trendTag.id,
      numericValue: 100 + Math.sin(i / 10) * 20, // 80~120 kW 사이 변동
      quality: 'GOOD',
    });

    // SENSOR: 온도 (변동)
    dataPoints.push({
      timestamp,
      tagId: sensorTag.id,
      numericValue: 25 + Math.random() * 5, // 25~30°C
      quality: 'GOOD',
    });
  }

  // Batch Insert
  await prisma.tagDataRaw.createMany({
    data: dataPoints,
    skipDuplicates: true,
  });

  console.log('✅ Created', dataPoints.length, 'time-series data points');
  console.log('📊 Time range: last 10 minutes');
  console.log('');
  console.log('🎯 Test IDs:');
  console.log('  - Facility ID:', facility.id);
  console.log('  - USAGE Tag ID:', usageTag.id);
  console.log('  - TREND Tag ID:', trendTag.id);
  console.log('  - SENSOR Tag ID:', sensorTag.id);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
