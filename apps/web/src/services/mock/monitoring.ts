// ============================================================
// 모니터링 목업 데이터
// ============================================================
import { generateTimeSeriesData } from '../../lib/utils';

// ──────────────────────────────────────────────
// MON-001 종합 현황 데이터
// ──────────────────────────────────────────────
export const OVERVIEW_KPI = {
  totalPower: { value: 487, unit: 'kWh', change: 3.2, inverseChange: true },
  totalAir: { value: 23.47, unit: 'ML', change: -1.5, inverseChange: true },
  powerQualityAlarms: { value: 3, unit: '건', change: 66.7, inverseChange: true },
  airLeakAlarms: { value: 5, unit: '건', change: -16.7, inverseChange: true },
};

export const LINE_MINI_CARDS = [
  { id: 'block', label: '블록', power: 3.63, powerUnit: 'MWh', air: 3.29, airUnit: 'ML', powerStatus: 'NORMAL' as const, airStatus: 'WARNING' as const },
  { id: 'head', label: '헤드', power: 3.51, powerUnit: 'MWh', air: 11.63, airUnit: 'ML', powerStatus: 'NORMAL' as const, airStatus: 'NORMAL' as const },
  { id: 'crank', label: '크랭크', power: 1.97, powerUnit: 'MWh', air: 5.81, airUnit: 'ML', powerStatus: 'WARNING' as const, airStatus: 'NORMAL' as const },
  { id: 'assembly', label: '조립', power: 0.31, powerUnit: 'MWh', air: 2.72, airUnit: 'ML', powerStatus: 'NORMAL' as const, airStatus: 'DANGER' as const },
];

// 시간대별 추이 (24시간, 15분 단위)
export const HOURLY_TREND = generateTimeSeriesData(24, 15, 18.5, 6.2);

// 알림 요약
export const ALARM_SUMMARY = [
  { line: '블록', powerQuality: 2, airLeak: 1, total: 3 },
  { line: '헤드', powerQuality: 0, airLeak: 2, total: 2 },
  { line: '크랭크', powerQuality: 1, airLeak: 1, total: 2 },
  { line: '조립', powerQuality: 0, airLeak: 1, total: 1 },
];

// ──────────────────────────────────────────────
// MON-002 라인별 상세 차트 데이터 (15분 단위)
// ──────────────────────────────────────────────
export const LINE_DETAIL_CHART = {
  block: {
    power: generateTimeSeriesData(24, 15, 145.8, 42.3),
    air: generateTimeSeriesData(24, 15, 148000, 35000),
  },
  head: {
    power: generateTimeSeriesData(24, 15, 138.4, 38.7),
    air: generateTimeSeriesData(24, 15, 468000, 82000),
  },
  crank: {
    power: generateTimeSeriesData(24, 15, 82.1, 24.6),
    air: generateTimeSeriesData(24, 15, 234500, 58000),
  },
  assembly: {
    power: generateTimeSeriesData(24, 15, 12.9, 4.8),
    air: generateTimeSeriesData(24, 15, 109800, 28000),
  },
};
