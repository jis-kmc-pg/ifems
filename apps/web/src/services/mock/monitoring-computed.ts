// ============================================================
// 모니터링 연산 데이터 (RAW 데이터 기반 집계)
// RAW 시계열 태그 데이터를 집계하여 화면용 데이터 생성
// ============================================================
import {
  queryRawTags,
  aggregateByFacility,
  aggregateByHour,
  aggregateAvg,
  aggregateSum,
} from './raw-data';
import type { LineId } from '../../lib/constants';

// ──────────────────────────────────────────────
// MON-001 종합 현황 KPI (RAW 데이터 연산)
// ──────────────────────────────────────────────
export function computeOverviewKpi() {
  const now = new Date('2026-02-24T14:30:00');
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  // const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Reserved for future use

  // 최근 1시간 전력 데이터
  const powerTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-080', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['POWER'],
    hourAgo,
    now
  );

  // 최근 1시간 에어 데이터
  const airTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['AIR'],
    hourAgo,
    now
  );

  // 전일 비교용 데이터 (24시간 전 ~ 23시간 전)
  const prevDayStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const prevDayEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prevPowerTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-080', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['POWER'],
    prevDayStart,
    prevDayEnd
  );
  const prevAirTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['AIR'],
    prevDayStart,
    prevDayEnd
  );

  // 집계
  const totalPower = aggregateAvg(powerTags);
  const totalAir = aggregateSum(airTags) / 1000; // L → ML
  const prevTotalPower = aggregateAvg(prevPowerTags);
  const prevTotalAir = aggregateSum(prevAirTags) / 1000;

  // 변화율 계산
  const powerChange = prevTotalPower > 0 ? ((totalPower - prevTotalPower) / prevTotalPower) * 100 : 0;
  const airChange = prevTotalAir > 0 ? ((totalAir - prevTotalAir) / prevTotalAir) * 100 : 0;

  return {
    totalPower: { value: Math.round(totalPower), unit: 'kWh', change: Math.round(powerChange * 10) / 10, inverseChange: true },
    totalAir: { value: Math.round(totalAir * 100) / 100, unit: 'ML', change: Math.round(airChange * 10) / 10, inverseChange: true },
    powerQualityAlarms: { value: 3, unit: '건', change: 66.7, inverseChange: true },
    airLeakAlarms: { value: 5, unit: '건', change: -16.7, inverseChange: true },
  };
}

// ──────────────────────────────────────────────
// MON-001 라인별 미니 카드 (RAW 데이터 연산)
// ──────────────────────────────────────────────
export function computeLineMiniCards() {
  const now = new Date('2026-02-24T14:30:00');
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 블록 라인 설비들
  const blockFacilities = ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-010-1'];
  const blockPowerTags = queryRawTags(blockFacilities, ['POWER'], hourAgo, now);
  const blockAirTags = queryRawTags(blockFacilities, ['AIR'], hourAgo, now);

  const blockPowerByFacility = aggregateByFacility(blockPowerTags);
  const blockAirByFacility = aggregateByFacility(blockAirTags);

  const blockTotalPower = Object.values(blockPowerByFacility).reduce((a, b) => a + b, 0) / 1000; // kWh → MWh
  const blockTotalAir = Object.values(blockAirByFacility).reduce((a, b) => a + b, 0) / 1000000; // L → ML

  return [
    {
      id: 'block',
      label: '블록',
      power: Math.round(blockTotalPower * 100) / 100,
      powerUnit: 'MWh',
      air: Math.round(blockTotalAir * 100) / 100,
      airUnit: 'ML',
      powerStatus: 'NORMAL' as const,
      airStatus: 'WARNING' as const,
    },
    {
      id: 'head',
      label: '헤드',
      power: 3.51,
      powerUnit: 'MWh',
      air: 11.63,
      airUnit: 'ML',
      powerStatus: 'NORMAL' as const,
      airStatus: 'NORMAL' as const,
    },
    {
      id: 'crank',
      label: '크랭크',
      power: 1.97,
      powerUnit: 'MWh',
      air: 5.81,
      airUnit: 'ML',
      powerStatus: 'WARNING' as const,
      airStatus: 'NORMAL' as const,
    },
    {
      id: 'assembly',
      label: '조립',
      power: 0.31,
      powerUnit: 'MWh',
      air: 2.72,
      airUnit: 'ML',
      powerStatus: 'NORMAL' as const,
      airStatus: 'DANGER' as const,
    },
  ];
}

// ──────────────────────────────────────────────
// MON-001 시간대별 추이 (RAW 데이터 집계)
// ──────────────────────────────────────────────
export function computeHourlyTrend() {
  const now = new Date('2026-02-24T14:30:00');
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 당일 데이터
  const powerTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-080', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['POWER'],
    dayAgo,
    now
  );

  // 전일 데이터 (24시간 전)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const prevPowerTags = queryRawTags(
    ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-080', 'HNK10-010-1', 'HNK10-040', 'HNK10-050', 'HNK10-010-2', 'HNK10-060', 'HNK10-020-1'],
    ['POWER'],
    twoDaysAgo,
    dayAgo
  );

  // 시간대별 집계
  const hourlyData = aggregateByHour(powerTags);
  const prevHourlyData = aggregateByHour(prevPowerTags);

  // 전일 데이터를 Map으로 변환 (빠른 조회)
  const prevMap = new Map(prevHourlyData.map(d => [d.hour, d.value]));

  return hourlyData.map(({ hour, value }) => ({
    time: hour,
    current: Math.round(value * 10) / 10,
    prev: Math.round((prevMap.get(hour) ?? value * 0.95) * 10) / 10,
  }));
}

// ──────────────────────────────────────────────
// MON-002 라인별 상세 차트 (RAW 데이터 집계)
// ──────────────────────────────────────────────
export function computeLineDetailChart(line: LineId) {
  const now = new Date('2026-02-24T14:30:00');
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 라인별 설비 매핑
  const facilityMap = {
    block: ['HNK10-020', 'HNK10-010', 'HNK10-030', 'HNK10-010-1'],
    head: ['HNK20-010', 'HNK20-020', 'HNK20-030'],
    crank: ['HNK30-010', 'HNK30-020'],
    assembly: ['HNK40-010', 'HNK40-020'],
  };

  const facilities = facilityMap[line] || facilityMap.block;

  // 당일 + 전일 데이터
  const powerTags = queryRawTags(facilities, ['POWER'], dayAgo, now);
  const airTags = queryRawTags(facilities, ['AIR'], dayAgo, now);
  const prevPowerTags = queryRawTags(facilities, ['POWER'], twoDaysAgo, dayAgo);
  const prevAirTags = queryRawTags(facilities, ['AIR'], twoDaysAgo, dayAgo);

  const hourlyPower = aggregateByHour(powerTags);
  const hourlyAir = aggregateByHour(airTags);
  const prevHourlyPower = aggregateByHour(prevPowerTags);
  const prevHourlyAir = aggregateByHour(prevAirTags);

  const prevPowerMap = new Map(prevHourlyPower.map(d => [d.hour, d.value]));
  const prevAirMap = new Map(prevHourlyAir.map(d => [d.hour, d.value]));

  return {
    power: hourlyPower.map(({ hour, value }) => ({
      time: hour,
      power: Math.round(value * 10) / 10,
      prevPower: Math.round((prevPowerMap.get(hour) ?? value * 0.95) * 10) / 10,
    })),
    air: hourlyAir.map(({ hour, value }) => ({
      time: hour,
      air: Math.round(value),
      prevAir: Math.round(prevAirMap.get(hour) ?? value * 0.95),
    })),
  };
}
