// ============================================================
// 알림 목업 데이터
// ============================================================
import { generateTimeSeriesData } from '../../lib/utils';

// ──────────────────────────────────────────────
// 공통: 알림 통계 KPI (종류별로 데이터만 다름)
// ──────────────────────────────────────────────
export const ALERT_STATS_KPI = {
  powerQuality: { total: 127, weekly: 23, weeklyChange: 5, resolved: 104, resolvedRate: 82 },
  airLeak: { total: 89, weekly: 18, weeklyChange: -3, resolved: 74, resolvedRate: 83 },
  cycleAnomaly: { total: 64, weekly: 12, weeklyChange: 2, resolved: 51, resolvedRate: 80 },
};

// 기간별 알림 트렌드 (최근 8주)
function makeAlertTrend(base: number) {
  const weeks = ['01/01', '01/08', '01/15', '01/22', '01/29', '02/05', '02/12', '02/19'];
  return weeks.map((week, i) => ({
    week,
    count: Math.max(0, Math.round(base + (i - 3.5) * 2 + (Math.random() - 0.5) * 4)),
  }));
}

export const ALERT_TRENDS = {
  powerQuality: makeAlertTrend(16),
  airLeak: makeAlertTrend(11),
  cycleAnomaly: makeAlertTrend(8),
};

// 설비별 알림 히트맵
export const ALERT_HEATMAP = {
  powerQuality: [
    { facility: 'HNK10-020', week1: 3, week2: 4, week3: 2, week4: 5, week5: 3, week6: 4, week7: 2, week8: 3 },
    { facility: 'HNK10-080', week1: 2, week2: 2, week3: 3, week4: 2, week5: 4, week6: 3, week7: 2, week8: 2 },
    { facility: 'HNK10-010-1', week1: 1, week2: 2, week3: 1, week4: 2, week5: 1, week6: 3, week7: 2, week8: 1 },
    { facility: 'HNK10-040', week1: 1, week2: 1, week3: 2, week4: 1, week5: 2, week6: 1, week7: 1, week8: 2 },
    { facility: 'HNK10-010', week1: 0, week2: 1, week3: 0, week4: 1, week5: 0, week6: 0, week7: 1, week8: 0 },
  ],
};

// ──────────────────────────────────────────────
// 이력 데이터 (ALT-004, 005, 006)
// ──────────────────────────────────────────────
export interface AlertHistoryItem {
  id: string;
  no: number;
  timestamp: string;
  line: string;
  facilityCode: string;
  facilityName: string;
  baseline: string;
  current: string;
  ratio: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  action?: string;
  category: 'power_quality' | 'air_leak' | 'cycle_anomaly';
}

function makeTimestamp(daysAgo: number, hour: number, minute: number) {
  const d = new Date('2026-02-19');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const ALERT_HISTORY: AlertHistoryItem[] = [
  // 전력 품질
  { id: 'a001', no: 1, timestamp: makeTimestamp(0, 8, 23), line: '블록', facilityCode: 'HNK10-020', facilityName: 'HNK10-020 OP20', baseline: '5.0%', current: '8.4%', ratio: 168.0, status: 'ACTIVE', category: 'power_quality' },
  { id: 'a002', no: 2, timestamp: makeTimestamp(0, 9, 41), line: '블록', facilityCode: 'HNK10-080', facilityName: 'HNK10-080 컴프레서', baseline: '5.0%', current: '6.1%', ratio: 122.0, status: 'ACKNOWLEDGED', action: '점검 예정', category: 'power_quality' },
  { id: 'a003', no: 3, timestamp: makeTimestamp(1, 14, 12), line: '헤드', facilityCode: 'HNK20-030', facilityName: 'HNK20-030 OP30', baseline: '5.0%', current: '5.8%', ratio: 116.0, status: 'RESOLVED', action: '3상 부하 재배분 완료', category: 'power_quality' },
  { id: 'a004', no: 4, timestamp: makeTimestamp(2, 11, 8), line: '블록', facilityCode: 'HNK10-010-1', facilityName: 'HNK10-010-1 OP10', baseline: '5.0%', current: '4.8%', ratio: 96.0, status: 'RESOLVED', action: '자연 해소', category: 'power_quality' },
  // 에어 누기
  { id: 'b001', no: 1, timestamp: makeTimestamp(0, 7, 15), line: '블록', facilityCode: 'HNK10-010', facilityName: 'HNK10-010 OP10', baseline: '12000 L', current: '17840 L', ratio: 148.7, status: 'ACTIVE', category: 'air_leak' },
  { id: 'b002', no: 2, timestamp: makeTimestamp(0, 10, 33), line: '블록', facilityCode: 'HNK10-030', facilityName: 'HNK10-030 OP30', baseline: '10500 L', current: '14210 L', ratio: 135.3, status: 'ACKNOWLEDGED', action: '배관 점검 중', category: 'air_leak' },
  { id: 'b003', no: 3, timestamp: makeTimestamp(1, 16, 44), line: '크랭크', facilityCode: 'HNK30-020', facilityName: 'HNK30-020 OP20', baseline: '9200 L', current: '12140 L', ratio: 131.9, status: 'RESOLVED', action: '피팅 교체 완료', category: 'air_leak' },
  // 싸이클 이상
  { id: 'c001', no: 1, timestamp: makeTimestamp(0, 8, 42), line: '블록', facilityCode: 'HNK10-020', facilityName: 'HNK10-020 OP20', baseline: '962.84 kW', current: '1142.1 kW', ratio: 118.6, status: 'ACTIVE', category: 'cycle_anomaly' },
  { id: 'c002', no: 2, timestamp: makeTimestamp(0, 9, 18), line: '헤드', facilityCode: 'HNK20-010', facilityName: 'HNK20-010 OP10', baseline: '847.3 kW', current: '941.8 kW', ratio: 111.2, status: 'ACKNOWLEDGED', category: 'cycle_anomaly' },
  { id: 'c003', no: 3, timestamp: makeTimestamp(1, 13, 55), line: '블록', facilityCode: 'HNK10-010', facilityName: 'HNK10-010 OP10', baseline: '831.2 kW', current: '914.4 kW', ratio: 110.0, status: 'RESOLVED', action: '기준 파형 재학습', category: 'cycle_anomaly' },
];

// 싸이클 이상 파형 데이터 (ANL-006용)
export const CYCLE_WAVEFORM = generateTimeSeriesData(1, 1, 850, 180);

// ──────────────────────────────────────────────
// 싸이클 이상 유형별 분포 (ALT-003용)
// ──────────────────────────────────────────────
export const CYCLE_ANOMALY_TYPES = [
  { name: '에너지 초과', value: 38 },
  { name: '싸이클 타임 지연', value: 15 },
  { name: '파형 이상', value: 11 },
];
