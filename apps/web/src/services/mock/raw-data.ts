// ============================================================
// RAW 시계열 태그 데이터 (DB 시뮬레이션)
// 실제 환경에서는 TimescaleDB에서 가져옴
// ============================================================

export interface TimeSeriesTag {
  tagId: string;           // 태그 ID (예: HNK10-020_POWER_ACTIVE)
  facilityCode: string;    // 설비 코드 (예: HNK10-020)
  tagType: 'POWER' | 'AIR' | 'VOLTAGE' | 'CURRENT' | 'POWER_FACTOR' | 'CYCLE_TIME' | 'CYCLE_ENERGY';
  timestamp: string;       // ISO 8601
  value: number;           // 측정값
  quality: 'GOOD' | 'BAD' | 'UNCERTAIN'; // 데이터 품질
  unit: string;            // 단위 (kWh, L, %, sec 등)
}

// ──────────────────────────────────────────────
// RAW 데이터 생성 유틸리티
// ──────────────────────────────────────────────

/** 특정 기간의 시계열 데이터 생성 (초 단위) */
function generateTimeSeriesTags(
  facilityCode: string,
  tagType: TimeSeriesTag['tagType'],
  unit: string,
  startDate: Date,
  endDate: Date,
  intervalSeconds: number,
  baseValue: number,
  variance: number
): TimeSeriesTag[] {
  const tags: TimeSeriesTag[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const randomFactor = (Math.random() - 0.5) * 2; // -1 ~ 1
    const value = Math.max(0, baseValue + variance * randomFactor);

    tags.push({
      tagId: `${facilityCode}_${tagType}`,
      facilityCode,
      tagType,
      timestamp: current.toISOString(),
      value: Math.round(value * 100) / 100,
      quality: Math.random() > 0.98 ? 'BAD' : 'GOOD', // 2% 불량 데이터
      unit,
    });

    current.setSeconds(current.getSeconds() + intervalSeconds);
  }

  return tags;
}

// ──────────────────────────────────────────────
// 주요 설비별 최근 1시간 RAW 데이터 (1초 간격)
// 실제 운영에서는 24시간+ 데이터가 TimescaleDB에 저장됨
// ──────────────────────────────────────────────
const now = new Date('2026-02-24T14:30:00');
const hourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 최근 1시간 (데모용)
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 최근 24시간

// 블록 라인 주요 설비 (1초 간격 RAW 데이터)
export const RAW_POWER_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'POWER', 'kWh', hourAgo, now, 1, 892.4, 45.2),
  ...generateTimeSeriesTags('HNK10-010', 'POWER', 'kWh', hourAgo, now, 1, 742.1, 38.7),
  ...generateTimeSeriesTags('HNK10-030', 'POWER', 'kWh', hourAgo, now, 1, 638.9, 32.4),
  ...generateTimeSeriesTags('HNK10-080', 'POWER', 'kWh', hourAgo, now, 1, 521.3, 26.8),
  ...generateTimeSeriesTags('HNK10-010-1', 'POWER', 'kWh', hourAgo, now, 1, 418.6, 22.1),
  ...generateTimeSeriesTags('HNK10-040', 'POWER', 'kWh', hourAgo, now, 1, 387.2, 19.8),
  ...generateTimeSeriesTags('HNK10-050', 'POWER', 'kWh', hourAgo, now, 1, 312.4, 16.4),
  ...generateTimeSeriesTags('HNK10-010-2', 'POWER', 'kWh', hourAgo, now, 1, 284.7, 14.9),
  ...generateTimeSeriesTags('HNK10-060', 'POWER', 'kWh', hourAgo, now, 1, 241.8, 12.7),
  ...generateTimeSeriesTags('HNK10-020-1', 'POWER', 'kWh', hourAgo, now, 1, 198.3, 10.4),
];

export const RAW_AIR_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'AIR', 'L', hourAgo, now, 1, 418300, 21000),
  ...generateTimeSeriesTags('HNK10-010', 'AIR', 'L', hourAgo, now, 1, 385200, 19500),
  ...generateTimeSeriesTags('HNK10-030', 'AIR', 'L', hourAgo, now, 1, 312400, 16200),
  ...generateTimeSeriesTags('HNK10-080', 'AIR', 'L', hourAgo, now, 1, 0, 0), // 비가공기
  ...generateTimeSeriesTags('HNK10-010-1', 'AIR', 'L', hourAgo, now, 1, 298100, 15400),
  ...generateTimeSeriesTags('HNK10-040', 'AIR', 'L', hourAgo, now, 1, 271500, 14100),
  ...generateTimeSeriesTags('HNK10-050', 'AIR', 'L', hourAgo, now, 1, 248700, 12900),
  ...generateTimeSeriesTags('HNK10-010-2', 'AIR', 'L', hourAgo, now, 1, 221300, 11500),
  ...generateTimeSeriesTags('HNK10-060', 'AIR', 'L', hourAgo, now, 1, 184200, 9600),
  ...generateTimeSeriesTags('HNK10-020-1', 'AIR', 'L', hourAgo, now, 1, 162400, 8400),
];

export const RAW_POWER_FACTOR_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'POWER_FACTOR', '%', hourAgo, now, 1, 78.2, 3.2),
  ...generateTimeSeriesTags('HNK10-080', 'POWER_FACTOR', '%', hourAgo, now, 1, 82.4, 2.8),
  ...generateTimeSeriesTags('HNK10-010-1', 'POWER_FACTOR', '%', hourAgo, now, 1, 86.1, 2.4),
  ...generateTimeSeriesTags('HNK10-040', 'POWER_FACTOR', '%', hourAgo, now, 1, 87.8, 2.1),
  ...generateTimeSeriesTags('HNK10-010', 'POWER_FACTOR', '%', hourAgo, now, 1, 91.2, 1.8),
  ...generateTimeSeriesTags('HNK10-030', 'POWER_FACTOR', '%', hourAgo, now, 1, 92.1, 1.6),
  ...generateTimeSeriesTags('HNK10-050', 'POWER_FACTOR', '%', hourAgo, now, 1, 93.4, 1.4),
  ...generateTimeSeriesTags('HNK10-010-2', 'POWER_FACTOR', '%', hourAgo, now, 1, 94.8, 1.2),
  ...generateTimeSeriesTags('HNK10-060', 'POWER_FACTOR', '%', hourAgo, now, 1, 95.3, 1.1),
  ...generateTimeSeriesTags('HNK10-020-1', 'POWER_FACTOR', '%', hourAgo, now, 1, 96.1, 0.9),
];

export const RAW_CYCLE_TIME_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 42, 4.2),
  ...generateTimeSeriesTags('HNK10-010', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 38, 3.8),
  ...generateTimeSeriesTags('HNK10-030', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 35, 3.5),
  ...generateTimeSeriesTags('HNK10-040', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 44, 4.4),
  ...generateTimeSeriesTags('HNK10-010-1', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 38, 3.8),
  ...generateTimeSeriesTags('HNK10-050', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 41, 4.1),
  ...generateTimeSeriesTags('HNK10-010-2', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 38, 3.8),
  ...generateTimeSeriesTags('HNK10-060', 'CYCLE_TIME', 'sec', hourAgo, now, 1, 46, 4.6),
];

export const RAW_CYCLE_ENERGY_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 8.41, 1.52),
  ...generateTimeSeriesTags('HNK10-010', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 6.83, 0.85),
  ...generateTimeSeriesTags('HNK10-030', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 5.94, 0.48),
  ...generateTimeSeriesTags('HNK10-040', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 4.21, 0.29),
  ...generateTimeSeriesTags('HNK10-010-1', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 3.87, 0.21),
  ...generateTimeSeriesTags('HNK10-050', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 3.24, 0.14),
  ...generateTimeSeriesTags('HNK10-010-2', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 2.98, 0.09),
  ...generateTimeSeriesTags('HNK10-060', 'CYCLE_ENERGY', 'kW', hourAgo, now, 1, 2.71, 0.08),
];

// ──────────────────────────────────────────────
// 일별 데이터 (집계용, 10초 간격으로 샘플링)
// ──────────────────────────────────────────────
export const RAW_DAILY_POWER_TAGS: TimeSeriesTag[] = [
  ...generateTimeSeriesTags('HNK10-020', 'POWER', 'kWh', dayAgo, now, 10, 892.4, 65.2),
  ...generateTimeSeriesTags('HNK10-010', 'POWER', 'kWh', dayAgo, now, 10, 742.1, 58.7),
  ...generateTimeSeriesTags('HNK10-030', 'POWER', 'kWh', dayAgo, now, 10, 638.9, 52.4),
  ...generateTimeSeriesTags('HNK10-080', 'POWER', 'kWh', dayAgo, now, 10, 521.3, 46.8),
  ...generateTimeSeriesTags('HNK10-010-1', 'POWER', 'kWh', dayAgo, now, 10, 418.6, 42.1),
  ...generateTimeSeriesTags('HNK10-040', 'POWER', 'kWh', dayAgo, now, 10, 387.2, 39.8),
  ...generateTimeSeriesTags('HNK10-050', 'POWER', 'kWh', dayAgo, now, 10, 312.4, 36.4),
  ...generateTimeSeriesTags('HNK10-010-2', 'POWER', 'kWh', dayAgo, now, 10, 284.7, 34.9),
  ...generateTimeSeriesTags('HNK10-060', 'POWER', 'kWh', dayAgo, now, 10, 241.8, 32.7),
  ...generateTimeSeriesTags('HNK10-020-1', 'POWER', 'kWh', dayAgo, now, 10, 198.3, 30.4),
];

// ──────────────────────────────────────────────
// RAW 데이터 조회 API (실제 DB 쿼리 시뮬레이션)
// ──────────────────────────────────────────────

/** 특정 설비의 특정 태그 타입 데이터 조회 */
export function queryRawTags(
  facilityCodes: string[],
  tagTypes: TimeSeriesTag['tagType'][],
  startTime: Date,
  endTime: Date
): TimeSeriesTag[] {
  const allTags = [
    ...RAW_POWER_TAGS,
    ...RAW_AIR_TAGS,
    ...RAW_POWER_FACTOR_TAGS,
    ...RAW_CYCLE_TIME_TAGS,
    ...RAW_CYCLE_ENERGY_TAGS,
    ...RAW_DAILY_POWER_TAGS,
  ];

  return allTags.filter(tag => {
    const tagTime = new Date(tag.timestamp);
    return (
      facilityCodes.includes(tag.facilityCode) &&
      tagTypes.includes(tag.tagType) &&
      tagTime >= startTime &&
      tagTime <= endTime &&
      tag.quality === 'GOOD' // 품질 필터링
    );
  });
}

/** 집계 함수: 평균 */
export function aggregateAvg(tags: TimeSeriesTag[]): number {
  if (tags.length === 0) return 0;
  const sum = tags.reduce((acc, tag) => acc + tag.value, 0);
  return Math.round((sum / tags.length) * 100) / 100;
}

/** 집계 함수: 합계 */
export function aggregateSum(tags: TimeSeriesTag[]): number {
  return Math.round(tags.reduce((acc, tag) => acc + tag.value, 0) * 100) / 100;
}

/** 집계 함수: 최대 */
export function aggregateMax(tags: TimeSeriesTag[]): number {
  if (tags.length === 0) return 0;
  return Math.max(...tags.map(tag => tag.value));
}

/** 집계 함수: 최소 */
export function aggregateMin(tags: TimeSeriesTag[]): number {
  if (tags.length === 0) return 0;
  return Math.min(...tags.map(tag => tag.value));
}

/** 집계 함수: 설비별 그룹화 후 합계 */
export function aggregateByFacility(tags: TimeSeriesTag[]): Record<string, number> {
  const result: Record<string, number> = {};

  tags.forEach(tag => {
    if (!result[tag.facilityCode]) {
      result[tag.facilityCode] = 0;
    }
    result[tag.facilityCode] += tag.value;
  });

  Object.keys(result).forEach(key => {
    result[key] = Math.round(result[key] * 100) / 100;
  });

  return result;
}

/** 집계 함수: 시간대별 그룹화 후 평균 */
export function aggregateByHour(tags: TimeSeriesTag[]): { hour: string; value: number }[] {
  const hourMap: Record<string, number[]> = {};

  tags.forEach(tag => {
    const hour = tag.timestamp.slice(0, 13); // YYYY-MM-DDTHH
    if (!hourMap[hour]) {
      hourMap[hour] = [];
    }
    hourMap[hour].push(tag.value);
  });

  return Object.entries(hourMap).map(([hour, values]) => ({
    hour: hour.slice(11, 13) + ':00', // HH:00
    value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
  }));
}
