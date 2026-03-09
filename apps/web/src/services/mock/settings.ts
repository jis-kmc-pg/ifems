// ============================================================
// 설정 목업 데이터
// ============================================================
import { BLOCK_FACILITIES } from './facilities';

export interface SettingRow {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  process: string;
  threshold1: number;   // 기준값 1 (역할에 따라 다름)
  threshold2: number;   // 기준값 2
  label1: string;
  label2: string;
  enabled: boolean;
}

// ──────────────────────────────────────────────
// SET-001 전력 품질 설정
// ──────────────────────────────────────────────
export const POWER_QUALITY_SETTINGS: SettingRow[] = BLOCK_FACILITIES
  .filter((f) => f.isProcessing || f.type === 'COMPRESSOR')
  .map((f) => ({
    id: `pq-${f.id}`,
    facilityId: f.id,
    code: f.code,
    name: f.name.split(' ')[0],
    process: f.process,
    threshold1: 5.0,
    threshold2: 90.0,
    label1: '불평형률 임계(%)',
    label2: '역률 기준(%)',
    enabled: true,
  }));

// ──────────────────────────────────────────────
// SET-002 에어 누기 설정
// ──────────────────────────────────────────────
const airBaselines: Record<string, [number, number]> = {
  'HNK10-010': [12000, 20],
  'HNK10-010-1': [11000, 20],
  'HNK10-010-2': [9200, 20],
  'HNK10-020': [13500, 20],
  'HNK10-020-1': [8600, 20],
  'HNK10-030': [10500, 20],
  'HNK10-040': [9800, 20],
  'HNK10-050': [8400, 20],
  'HNK10-060': [7200, 20],
};

export const AIR_LEAK_SETTINGS: SettingRow[] = BLOCK_FACILITIES
  .filter((f) => f.isProcessing)
  .map((f) => {
    const [b, t] = airBaselines[f.code] ?? [5000, 20];
    return {
      id: `al-${f.id}`,
      facilityId: f.id,
      code: f.code,
      name: f.name.split(' ')[0],
      process: f.process,
      threshold1: b,
      threshold2: t,
      label1: '비생산 에어 기준(L)',
      label2: '누기율 임계(%)',
      enabled: true,
    };
  });

// ──────────────────────────────────────────────
// SET-003 기준 싸이클 파형
// ──────────────────────────────────────────────
export interface CycleWaveformItem {
  id: string;
  code: string;
  name: string;
  process: string;
  modelCode: string;  // 기종
  registeredAt: string;
  energy: number;
  cycleTime: number;
  active: boolean;
}

export const REFERENCE_CYCLES: CycleWaveformItem[] = [
  { id: 'rw-001', code: 'HNK10-020', name: 'HNK10-020 OP20', process: 'OP20', modelCode: 'PT4-BLK-A', registeredAt: '2026-01-15', energy: 962.84, cycleTime: 42, active: true },
  { id: 'rw-002', code: 'HNK10-010', name: 'HNK10-010 OP10', process: 'OP10', modelCode: 'PT4-BLK-A', registeredAt: '2026-01-15', energy: 831.2, cycleTime: 38, active: true },
  { id: 'rw-003', code: 'HNK10-010-1', name: 'HNK10-010-1 OP10', process: 'OP10', modelCode: 'PT4-BLK-B', registeredAt: '2026-02-01', energy: 812.4, cycleTime: 38, active: true },
  { id: 'rw-004', code: 'HNK10-030', name: 'HNK10-030 OP30', process: 'OP30', modelCode: 'PT4-BLK-A', registeredAt: '2026-01-20', energy: 748.3, cycleTime: 35, active: false },
];

// ──────────────────────────────────────────────
// SET-004 싸이클 알림 설정
// ──────────────────────────────────────────────
export const CYCLE_ALERT_SETTINGS: SettingRow[] = BLOCK_FACILITIES
  .filter((f) => f.isProcessing)
  .map((f) => ({
    id: `ca-${f.id}`,
    facilityId: f.id,
    code: f.code,
    name: f.name.split(' ')[0],
    process: f.process,
    threshold1: 85.0,
    threshold2: 2,
    label1: '유사도 임계(%)',
    label2: '지연 허용(사이클)',
    enabled: true,
  }));

// ──────────────────────────────────────────────
// SET-005, 006 에너지 알림 설정
// ──────────────────────────────────────────────
export const ENERGY_ALERT_SETTINGS: SettingRow[] = BLOCK_FACILITIES
  .filter((f) => f.isProcessing)
  .map((f) => ({
    id: `ea-${f.id}`,
    facilityId: f.id,
    code: f.code,
    name: f.name.split(' ')[0],
    process: f.process,
    threshold1: 15.0,
    threshold2: 20.0,
    label1: '전월 대비 임계(%)',
    label2: '전년 대비 임계(%)',
    enabled: true,
  }));

export const CYCLE_ENERGY_ALERT_SETTINGS: SettingRow[] = BLOCK_FACILITIES
  .filter((f) => f.isProcessing)
  .map((f) => ({
    id: `cea-${f.id}`,
    facilityId: f.id,
    code: f.code,
    name: f.name.split(' ')[0],
    process: f.process,
    threshold1: 10.0,
    threshold2: 20.0,
    label1: '싸이클당 기준(kWh)',
    label2: '초과 임계(%)',
    enabled: true,
  }));
