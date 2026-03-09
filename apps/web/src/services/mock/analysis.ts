// ============================================================
// 분석 목업 데이터
// ============================================================
import { generateTimeSeriesData } from '../../lib/utils';
import { TreeNode } from '../../components/ui/TreeCheckbox';

// ──────────────────────────────────────────────
// ANL-001, 005 설비 트리
// ──────────────────────────────────────────────
export const FACILITY_TREE: TreeNode[] = [
  {
    id: 'plant',
    label: '4공장',
    children: [
      {
        id: 'block',
        label: '블록',
        children: [
          { id: 'HNK10_000', label: 'HNK10_000' },
          { id: 'HNK10_010', label: 'HNK10_010' },
          { id: 'HNK10_010-1', label: 'HNK10_010-1' },
          { id: 'HNK10_010-2', label: 'HNK10_010-2' },
          { id: 'HNK10_020', label: 'HNK10_020' },
          { id: 'HNK10_020-1', label: 'HNK10_020-1' },
          { id: 'HNK10_030', label: 'HNK10_030' },
          { id: 'HNK10_040', label: 'HNK10_040' },
        ],
      },
      {
        id: 'head',
        label: '헤드',
        children: [
          { id: 'HNK20_010', label: 'HNK20_010' },
          { id: 'HNK20_020', label: 'HNK20_020' },
          { id: 'HNK20_030', label: 'HNK20_030' },
        ],
      },
      {
        id: 'crank',
        label: '크랭크',
        children: [
          { id: 'HNK30_010', label: 'HNK30_010' },
          { id: 'HNK30_020', label: 'HNK30_020' },
        ],
      },
      {
        id: 'assembly',
        label: '조립',
        children: [
          { id: 'HNK40_010', label: 'HNK40_010' },
          { id: 'HNK40_020', label: 'HNK40_020' },
        ],
      },
    ],
  },
];

// ──────────────────────────────────────────────
// ANL-001, 002 비교 분석 차트 데이터
// ──────────────────────────────────────────────
export function getFacilityElecData(facilityId: string) {
  const baseValues: Record<string, number> = {
    'HNK10_000': 4.2, 'HNK10_010': 18.4, 'HNK10_010-1': 16.8, 'HNK10_010-2': 14.2,
    'HNK10_020': 24.1, 'HNK10_020-1': 12.1, 'HNK10_030': 16.8, 'HNK10_040': 10.2,
  };
  const base = baseValues[facilityId] ?? 10;
  return generateTimeSeriesData(1, 1, base, base * 0.25);
}

export function getFacilityAirData(facilityId: string) {
  const baseValues: Record<string, number> = {
    'HNK10_010': 4820, 'HNK10_010-1': 4210, 'HNK10_010-2': 3180,
    'HNK10_020': 6480, 'HNK10_020-1': 3240, 'HNK10_030': 3920, 'HNK10_040': 3240,
  };
  const base = baseValues[facilityId] ?? 2000;
  return generateTimeSeriesData(1, 1, base, base * 0.15);
}

// ──────────────────────────────────────────────
// ANL-003 싸이클 데이터
// ──────────────────────────────────────────────
export const CYCLE_LIST = [
  { id: 'c001', label: '02/19 08:23~08:29', energy: 962.84, similarity: 96.2, status: 'normal' as const },
  { id: 'c002', label: '02/19 08:31~08:37', energy: 1012.4, similarity: 89.4, status: 'anomaly' as const },
  { id: 'c003', label: '02/19 08:39~08:45', energy: 981.2, similarity: 93.8, status: 'normal' as const },
  { id: 'c004', label: '02/19 08:47~08:53', energy: 1142.1, similarity: 57.7, status: 'anomaly' as const },
  { id: 'c005', label: '02/19 08:55~09:01', energy: 968.4, similarity: 95.1, status: 'normal' as const },
  { id: 'c006', label: '02/19 09:03~09:09', energy: 974.8, similarity: 94.6, status: 'normal' as const },
];

// 싸이클 파형 데이터 (초 단위) - interval 파라미터 지원
export function getCycleWaveform(cycleId: string, isReference = false, interval: '15m' | '1m' | '10s' | '1s' = '10s') {
  const base = isReference ? 850 : (cycleId === 'c004' ? 1050 : 880);
  const variance = isReference ? 80 : (cycleId === 'c004' ? 220 : 90);

  // interval에 따라 포인트 수와 step 결정
  const pointCount = interval === '1s' ? 3600 : 360; // 1초 간격: 3600개, 10초 간격: 360개
  const step = interval === '1s' ? 0.1 : 1; // 1초 간격: 0.1초씩, 10초 간격: 1초씩

  return Array.from({ length: pointCount }, (_, i) => ({
    sec: i * step,
    value: Math.max(0, base + Math.sin(i * 0.087) * variance * 0.8 + (Math.random() - 0.5) * variance * 0.4),
  }));
}

// ──────────────────────────────────────────────
// ANL-004 싸이클 타임 지연 분석
// ──────────────────────────────────────────────
export const CYCLE_DELAY_INFO = {
  cycleId: 'CYC-2026-0219-042',
  totalEnergy: 962.84,
  similarity: 57.71,
  delay: 1,
};

export const CYCLE_STATUS_FILTER = ['전체', '이상', '정상', '분석전'] as const;
