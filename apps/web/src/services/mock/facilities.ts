// ============================================================
// i-FEMS 목업 설비 데이터 - 화성 PT4공장 블록 라인 기준
// ============================================================
import type { LineId } from '../../lib/constants';

export type FacilityStatus = 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE';

export interface Facility {
  id: string;
  code: string;
  name: string;
  line: LineId;
  lineLabel: string;
  process: string;  // OP10, OP20 ...
  type: string;
  status: FacilityStatus;
  isProcessing: boolean; // 가공기 여부
}

// ──────────────────────────────────────────────
// 블록 라인 설비 (92개) - 화성PT4공장_TagList.xlsx 실제 데이터
// ──────────────────────────────────────────────
export const BLOCK_FACILITIES: Facility[] = [
  { id: 'hnk10-000', code: 'HNK10-000', name: 'HNK10-000', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-020', code: 'HNK10-010/020', name: 'HNK10-010/020', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-1', code: 'HNK10-010-1', name: 'HNK10-010-1', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-2', code: 'HNK10-010-2', name: 'HNK10-010-2', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-3', code: 'HNK10-010-3', name: 'HNK10-010-3', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-4', code: 'HNK10-010-4', name: 'HNK10-010-4', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-5', code: 'HNK10-010-5', name: 'HNK10-010-5', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-010-g-l', code: 'HNK10-010-G/L', name: 'HNK10-010-G/L', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-1', code: 'HNK10-020-1', name: 'HNK10-020-1', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-2', code: 'HNK10-020-2', name: 'HNK10-020-2', line: 'block', lineLabel: '블록', process: 'OP0', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-3', code: 'HNK10-020-3', name: 'HNK10-020-3', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-4', code: 'HNK10-020-4', name: 'HNK10-020-4', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-5', code: 'HNK10-020-5', name: 'HNK10-020-5', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-020-g-l', code: 'HNK10-020-G/L', name: 'HNK10-020-G/L', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-033a', code: 'HNK10-031A~033A', name: 'HNK10-031A~033A', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-1', code: 'HNK10-031A-1', name: 'HNK10-031A-1', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-2', code: 'HNK10-031A-2', name: 'HNK10-031A-2', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-3', code: 'HNK10-031A-3', name: 'HNK10-031A-3', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-4', code: 'HNK10-031A-4', name: 'HNK10-031A-4', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-5', code: 'HNK10-031A-5', name: 'HNK10-031A-5', line: 'block', lineLabel: '블록', process: 'OP10', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031a-g-l', code: 'HNK10-031A-G/L', name: 'HNK10-031A-G/L', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-1', code: 'HNK10-032A-1', name: 'HNK10-032A-1', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-2', code: 'HNK10-032A-2', name: 'HNK10-032A-2', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-3', code: 'HNK10-032A-3', name: 'HNK10-032A-3', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-4', code: 'HNK10-032A-4', name: 'HNK10-032A-4', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-5', code: 'HNK10-032A-5', name: 'HNK10-032A-5', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032a-g-l', code: 'HNK10-032A-G/L', name: 'HNK10-032A-G/L', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-1', code: 'HNK10-033A-1', name: 'HNK10-033A-1', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-2', code: 'HNK10-033A-2', name: 'HNK10-033A-2', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-3', code: 'HNK10-033A-3', name: 'HNK10-033A-3', line: 'block', lineLabel: '블록', process: 'OP20', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-4', code: 'HNK10-033A-4', name: 'HNK10-033A-4', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-5', code: 'HNK10-033A-5', name: 'HNK10-033A-5', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033a-g-l', code: 'HNK10-033A-G/L', name: 'HNK10-033A-G/L', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-033b', code: 'HNK10-031B~033B', name: 'HNK10-031B~033B', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-1', code: 'HNK10-031B-1', name: 'HNK10-031B-1', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-2', code: 'HNK10-031B-2', name: 'HNK10-031B-2', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-3', code: 'HNK10-031B-3', name: 'HNK10-031B-3', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-4', code: 'HNK10-031B-4', name: 'HNK10-031B-4', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-5', code: 'HNK10-031B-5', name: 'HNK10-031B-5', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-031b-g-l', code: 'HNK10-031B-G/L', name: 'HNK10-031B-G/L', line: 'block', lineLabel: '블록', process: 'OP30', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-1', code: 'HNK10-032B-1', name: 'HNK10-032B-1', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-2', code: 'HNK10-032B-2', name: 'HNK10-032B-2', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-3', code: 'HNK10-032B-3', name: 'HNK10-032B-3', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-4', code: 'HNK10-032B-4', name: 'HNK10-032B-4', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-5', code: 'HNK10-032B-5', name: 'HNK10-032B-5', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-032b-g-l', code: 'HNK10-032B-G/L', name: 'HNK10-032B-G/L', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-1', code: 'HNK10-033B-1', name: 'HNK10-033B-1', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-2', code: 'HNK10-033B-2', name: 'HNK10-033B-2', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-3', code: 'HNK10-033B-3', name: 'HNK10-033B-3', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-4', code: 'HNK10-033B-4', name: 'HNK10-033B-4', line: 'block', lineLabel: '블록', process: 'OP40', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-5', code: 'HNK10-033B-5', name: 'HNK10-033B-5', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-033b-g-l', code: 'HNK10-033B-G/L', name: 'HNK10-033B-G/L', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-040', code: 'HNK10-040', name: 'HNK10-040', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-045', code: 'HNK10-045', name: 'HNK10-045', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-050', code: 'HNK10-050', name: 'HNK10-050', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-ohc-1', code: 'HNK10-OHC#1', name: 'HNK10-OHC#1', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-060', code: 'HNK10-060', name: 'HNK10-060', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-ohc-2', code: 'HNK10-OHC#2', name: 'HNK10-OHC#2', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-070', code: 'HNK10-070', name: 'HNK10-070', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-071', code: 'HNK10-071', name: 'HNK10-071', line: 'block', lineLabel: '블록', process: 'OP50', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-ohc-3-4-5', code: 'HNK10-OHC#3,4,5', name: 'HNK10-OHC#3,4,5', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-in', code: 'HNK10-080-IN', name: 'HNK10-080-IN', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-1', code: 'HNK10-080-1', name: 'HNK10-080-1', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-2', code: 'HNK10-080-2', name: 'HNK10-080-2', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-3', code: 'HNK10-080-3', name: 'HNK10-080-3', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-4', code: 'HNK10-080-4', name: 'HNK10-080-4', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-meas', code: 'HNK10-080-MEAS', name: 'HNK10-080-MEAS', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-080-g-l', code: 'HNK10-080-G/L', name: 'HNK10-080-G/L', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-090-in', code: 'HNK10-090-IN', name: 'HNK10-090-IN', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-090-1', code: 'HNK10-090-1', name: 'HNK10-090-1', line: 'block', lineLabel: '블록', process: 'OP60', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-090-2', code: 'HNK10-090-2', name: 'HNK10-090-2', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-090-3', code: 'HNK10-090-3', name: 'HNK10-090-3', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-090-g-l', code: 'HNK10-090-G/L', name: 'HNK10-090-G/L', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-095', code: 'HNK10-095', name: 'HNK10-095', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-100', code: 'HNK10-100', name: 'HNK10-100', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-101', code: 'HNK10-101', name: 'HNK10-101', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-110-1', code: 'HNK10-110-1', name: 'HNK10-110-1', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-110-2', code: 'HNK10-110-2', name: 'HNK10-110-2', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-110-3', code: 'HNK10-110-3', name: 'HNK10-110-3', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-110-4', code: 'HNK10-110-4', name: 'HNK10-110-4', line: 'block', lineLabel: '블록', process: 'OP70', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-110-g-l', code: 'HNK10-110-G/L', name: 'HNK10-110-G/L', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-115-1', code: 'HNK10-115-1', name: 'HNK10-115-1', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-115-2', code: 'HNK10-115-2', name: 'HNK10-115-2', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-115-3', code: 'HNK10-115-3', name: 'HNK10-115-3', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-115-g-l', code: 'HNK10-115-G/L', name: 'HNK10-115-G/L', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-115-c', code: 'HNK10-115-C', name: 'HNK10-115-C', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-120', code: 'HNK10-120', name: 'HNK10-120', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-125', code: 'HNK10-125', name: 'HNK10-125', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-130', code: 'HNK10-130', name: 'HNK10-130', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-140', code: 'HNK10-140', name: 'HNK10-140', line: 'block', lineLabel: '블록', process: 'OP80', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-집중쿨런트-시스템', code: 'HNK10-집중쿨런트 시스템', name: 'HNK10-집중쿨런트 시스템', line: 'block', lineLabel: '블록', process: 'OP90', type: 'MC', status: 'NORMAL', isProcessing: true },
  { id: 'hnk10-plc-r-c', code: 'HNK10-PLC R/C', name: 'HNK10-PLC R/C', line: 'block', lineLabel: '블록', process: 'OP90', type: 'MC', status: 'NORMAL', isProcessing: true },
];

// ──────────────────────────────────────────────
// 에너지 사용량 데이터 (설비별)
// ──────────────────────────────────────────────
export interface FacilityEnergy {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  dailyElec: number;    // kWh
  weeklyElec: number;   // kWh
  dailyAir: number;     // L
  weeklyAir: number;    // L
  prevDailyElec: number;
  prevDailyAir: number;
  rankElec: number;
  rankAir: number;
  rankChangeElec: number; // + 하락, - 상승
  rankChangeAir: number;
  status: FacilityStatus;
  isProcessing: boolean;
}

export const BLOCK_ENERGY_DATA: FacilityEnergy[] = [
  { facilityId: 'f005', code: 'HNK10-020', name: 'HNK10-020', process: 'OP20', dailyElec: 892.4, weeklyElec: 5844.1, dailyAir: 418300, weeklyAir: 2731200, prevDailyElec: 810.2, prevDailyAir: 395000, rankElec: 1, rankAir: 1, rankChangeElec: 0, rankChangeAir: 0, status: 'DANGER', isProcessing: true },
  { facilityId: 'f002', code: 'HNK10-010', name: 'HNK10-010', process: 'OP10', dailyElec: 742.1, weeklyElec: 4912.3, dailyAir: 385200, weeklyAir: 2488100, prevDailyElec: 731.8, prevDailyAir: 381000, rankElec: 2, rankAir: 2, rankChangeElec: 0, rankChangeAir: 1, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f007', code: 'HNK10-030', name: 'HNK10-030', process: 'OP30', dailyElec: 638.9, weeklyElec: 4201.7, dailyAir: 312400, weeklyAir: 2031600, prevDailyElec: 648.1, prevDailyAir: 308000, rankElec: 3, rankAir: 3, rankChangeElec: 1, rankChangeAir: -1, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f012', code: 'HNK10-080', name: 'HNK10-080', process: 'UTL', dailyElec: 521.3, weeklyElec: 3488.4, dailyAir: 0, weeklyAir: 0, prevDailyElec: 498.7, prevDailyAir: 0, rankElec: 4, rankAir: 0, rankChangeElec: -1, rankChangeAir: 0, status: 'WARNING', isProcessing: false },
  { facilityId: 'f003', code: 'HNK10-010-1', name: 'HNK10-010-1', process: 'OP10', dailyElec: 418.6, weeklyElec: 2741.8, dailyAir: 298100, weeklyAir: 1946200, prevDailyElec: 425.3, prevDailyAir: 302000, rankElec: 5, rankAir: 4, rankChangeElec: 0, rankChangeAir: 0, status: 'WARNING', isProcessing: true },
  { facilityId: 'f008', code: 'HNK10-040', name: 'HNK10-040', process: 'OP40', dailyElec: 387.2, weeklyElec: 2541.3, dailyAir: 271500, weeklyAir: 1781200, prevDailyElec: 371.8, prevDailyAir: 265000, rankElec: 6, rankAir: 5, rankChangeElec: 1, rankChangeAir: 1, status: 'WARNING', isProcessing: true },
  { facilityId: 'f009', code: 'HNK10-050', name: 'HNK10-050', process: 'OP50', dailyElec: 312.4, weeklyElec: 2041.8, dailyAir: 248700, weeklyAir: 1621400, prevDailyElec: 318.9, prevDailyAir: 241000, rankElec: 7, rankAir: 6, rankChangeElec: -1, rankChangeAir: -1, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f004', code: 'HNK10-010-2', name: 'HNK10-010-2', process: 'OP10', dailyElec: 284.7, weeklyElec: 1871.9, dailyAir: 221300, weeklyAir: 1448100, prevDailyElec: 279.4, prevDailyAir: 218000, rankElec: 8, rankAir: 7, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f010', code: 'HNK10-060', name: 'HNK10-060', process: 'OP60', dailyElec: 241.8, weeklyElec: 1581.6, dailyAir: 184200, weeklyAir: 1201800, prevDailyElec: 248.3, prevDailyAir: 188000, rankElec: 9, rankAir: 8, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f006', code: 'HNK10-020-1', name: 'HNK10-020-1', process: 'OP20', dailyElec: 198.3, weeklyElec: 1298.4, dailyAir: 162400, weeklyAir: 1061200, prevDailyElec: 191.7, prevDailyAir: 158000, rankElec: 10, rankAir: 9, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: true },
  { facilityId: 'f011', code: 'HNK10-070', name: 'HNK10-070', process: 'UTL', dailyElec: 148.6, weeklyElec: 971.3, dailyAir: 0, weeklyAir: 0, prevDailyElec: 152.4, prevDailyAir: 0, rankElec: 11, rankAir: 0, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: false },
  { facilityId: 'f001', code: 'HNK10-000', name: 'HNK10-000', process: 'OP00', dailyElec: 87.4, weeklyElec: 571.8, dailyAir: 0, weeklyAir: 0, prevDailyElec: 84.1, prevDailyAir: 0, rankElec: 12, rankAir: 0, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: false },
  { facilityId: 'f013', code: 'HNK10-090', name: 'HNK10-090', process: 'UTL', dailyElec: 64.2, weeklyElec: 421.4, dailyAir: 0, weeklyAir: 0, prevDailyElec: 61.8, prevDailyAir: 0, rankElec: 13, rankAir: 0, rankChangeElec: 0, rankChangeAir: 0, status: 'NORMAL', isProcessing: false },
];

// ──────────────────────────────────────────────
// 전력 품질 데이터
// ──────────────────────────────────────────────
export interface PowerQualityData {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  phaseA: number;          // R상 전류 (A)
  phaseB: number;          // S상 전류 (A)
  phaseC: number;          // T상 전류 (A)
  unbalanceRate: number;   // 불평형률(%) — (MAX-MIN)/AVG×100
  unbalanceLimit: number;  // 기준값(%)
  powerFactor: number;     // 평균 역률(%)
  minPowerFactor: number;  // 최저 역률(%)
  powerFactorLimit: number;
  status: FacilityStatus;
  unbalanceStatus: FacilityStatus;
  powerFactorStatus: FacilityStatus;
  rankUnbalance: number;
  rankPowerFactor: number;
}

export const POWER_QUALITY_DATA: PowerQualityData[] = [
  { facilityId: 'f005', code: 'HNK10-020', name: 'HNK10-020', process: 'OP20', phaseA: 52.3, phaseB: 50.1, phaseC: 43.8, unbalanceRate: 8.4, unbalanceLimit: 5.0, powerFactor: 78.2, minPowerFactor: 72.1, powerFactorLimit: 90, status: 'DANGER', unbalanceStatus: 'DANGER', powerFactorStatus: 'DANGER', rankUnbalance: 1, rankPowerFactor: 1 },
  { facilityId: 'f012', code: 'HNK10-080', name: 'HNK10-080', process: 'UTL', phaseA: 48.5, phaseB: 45.2, phaseC: 44.7, unbalanceRate: 6.1, unbalanceLimit: 5.0, powerFactor: 82.4, minPowerFactor: 78.3, powerFactorLimit: 90, status: 'DANGER', unbalanceStatus: 'WARNING', powerFactorStatus: 'DANGER', rankUnbalance: 2, rankPowerFactor: 2 },
  { facilityId: 'f003', code: 'HNK10-010-1', name: 'HNK10-010-1', process: 'OP10', phaseA: 61.2, phaseB: 59.8, phaseC: 58.3, unbalanceRate: 4.8, unbalanceLimit: 5.0, powerFactor: 86.1, minPowerFactor: 82.5, powerFactorLimit: 90, status: 'WARNING', unbalanceStatus: 'NORMAL', powerFactorStatus: 'WARNING', rankUnbalance: 3, rankPowerFactor: 3 },
  { facilityId: 'f008', code: 'HNK10-040', name: 'HNK10-040', process: 'OP40', phaseA: 55.0, phaseB: 53.5, phaseC: 52.7, unbalanceRate: 4.2, unbalanceLimit: 5.0, powerFactor: 87.8, minPowerFactor: 84.2, powerFactorLimit: 90, status: 'WARNING', unbalanceStatus: 'NORMAL', powerFactorStatus: 'WARNING', rankUnbalance: 4, rankPowerFactor: 4 },
  { facilityId: 'f002', code: 'HNK10-010', name: 'HNK10-010', process: 'OP10', phaseA: 70.1, phaseB: 69.3, phaseC: 68.0, unbalanceRate: 3.1, unbalanceLimit: 5.0, powerFactor: 91.2, minPowerFactor: 88.7, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 5, rankPowerFactor: 5 },
  { facilityId: 'f007', code: 'HNK10-030', name: 'HNK10-030', process: 'OP30', phaseA: 58.4, phaseB: 57.6, phaseC: 56.8, unbalanceRate: 2.8, unbalanceLimit: 5.0, powerFactor: 92.1, minPowerFactor: 89.4, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 6, rankPowerFactor: 6 },
  { facilityId: 'f009', code: 'HNK10-050', name: 'HNK10-050', process: 'OP50', phaseA: 45.3, phaseB: 44.8, phaseC: 44.3, unbalanceRate: 2.3, unbalanceLimit: 5.0, powerFactor: 93.4, minPowerFactor: 91.2, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 7, rankPowerFactor: 7 },
  { facilityId: 'f004', code: 'HNK10-010-2', name: 'HNK10-010-2', process: 'OP10', phaseA: 63.5, phaseB: 63.0, phaseC: 62.3, unbalanceRate: 1.9, unbalanceLimit: 5.0, powerFactor: 94.8, minPowerFactor: 92.6, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 8, rankPowerFactor: 8 },
  { facilityId: 'f010', code: 'HNK10-060', name: 'HNK10-060', process: 'OP60', phaseA: 40.2, phaseB: 39.9, phaseC: 39.6, unbalanceRate: 1.4, unbalanceLimit: 5.0, powerFactor: 95.3, minPowerFactor: 93.8, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 9, rankPowerFactor: 9 },
  { facilityId: 'f006', code: 'HNK10-020-1', name: 'HNK10-020-1', process: 'OP20', phaseA: 51.0, phaseB: 50.7, phaseC: 50.4, unbalanceRate: 1.1, unbalanceLimit: 5.0, powerFactor: 96.1, minPowerFactor: 94.5, powerFactorLimit: 90, status: 'NORMAL', unbalanceStatus: 'NORMAL', powerFactorStatus: 'NORMAL', rankUnbalance: 10, rankPowerFactor: 10 },
];

// ──────────────────────────────────────────────
// 에어 누기 데이터
// ──────────────────────────────────────────────
export interface AirLeakData {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  baseline: number;       // 기준유량 (L/min, SET-002 설정)
  avgFlow: number;        // 평균유량 (L/min)
  maxFlow: number;        // 최대유량 (L/min)
  nonProdMinutes: number; // 비생산시간 (분)
  exceedMinutes: number;  // 초과시간 (분)
  leakRate: number;       // 누기율 (%)
  nonProdUsage: number;   // 비생산 에어사용량 (L)
  baselineUsage: number;  // 기준 에어사용량 (L)
  excessUsage: number;    // 초과 에어사용량 (L)
  estimatedCost: number;  // 추정 누기비용 (원)
  status: FacilityStatus;
  rank: number;
}

export const AIR_LEAK_DATA: AirLeakData[] = [
  { facilityId: 'f002', code: 'HNK10-010', name: 'HNK10-010', process: 'OP10', baseline: 12000, avgFlow: 17840, maxFlow: 24100, nonProdMinutes: 480, exceedMinutes: 234, leakRate: 48.7, nonProdUsage: 8563200, baselineUsage: 5760000, excessUsage: 2803200, estimatedCost: 1401600, status: 'DANGER', rank: 1 },
  { facilityId: 'f007', code: 'HNK10-030', name: 'HNK10-030', process: 'OP30', baseline: 10500, avgFlow: 14210, maxFlow: 19800, nonProdMinutes: 480, exceedMinutes: 169, leakRate: 35.3, nonProdUsage: 6820800, baselineUsage: 5040000, excessUsage: 1780800, estimatedCost: 890400, status: 'DANGER', rank: 2 },
  { facilityId: 'f008', code: 'HNK10-040', name: 'HNK10-040', process: 'OP40', baseline: 9800, avgFlow: 12841, maxFlow: 17200, nonProdMinutes: 480, exceedMinutes: 149, leakRate: 31.0, nonProdUsage: 6163680, baselineUsage: 4704000, excessUsage: 1459680, estimatedCost: 729840, status: 'WARNING', rank: 3 },
  { facilityId: 'f003', code: 'HNK10-010-1', name: 'HNK10-010-1', process: 'OP10', baseline: 11000, avgFlow: 13981, maxFlow: 18500, nonProdMinutes: 480, exceedMinutes: 130, leakRate: 27.1, nonProdUsage: 6710880, baselineUsage: 5280000, excessUsage: 1430880, estimatedCost: 715440, status: 'WARNING', rank: 4 },
  { facilityId: 'f005', code: 'HNK10-020', name: 'HNK10-020', process: 'OP20', baseline: 13500, avgFlow: 16812, maxFlow: 22400, nonProdMinutes: 480, exceedMinutes: 118, leakRate: 24.5, nonProdUsage: 8069760, baselineUsage: 6480000, excessUsage: 1589760, estimatedCost: 794880, status: 'WARNING', rank: 5 },
  { facilityId: 'f009', code: 'HNK10-050', name: 'HNK10-050', process: 'OP50', baseline: 8400, avgFlow: 10081, maxFlow: 13200, nonProdMinutes: 480, exceedMinutes: 96, leakRate: 20.0, nonProdUsage: 4838880, baselineUsage: 4032000, excessUsage: 806880, estimatedCost: 403440, status: 'WARNING', rank: 6 },
  { facilityId: 'f004', code: 'HNK10-010-2', name: 'HNK10-010-2', process: 'OP10', baseline: 9200, avgFlow: 10832, maxFlow: 14100, nonProdMinutes: 480, exceedMinutes: 85, leakRate: 17.7, nonProdUsage: 5199360, baselineUsage: 4416000, excessUsage: 783360, estimatedCost: 391680, status: 'NORMAL', rank: 7 },
  { facilityId: 'f006', code: 'HNK10-020-1', name: 'HNK10-020-1', process: 'OP20', baseline: 8600, avgFlow: 9884, maxFlow: 12800, nonProdMinutes: 480, exceedMinutes: 72, leakRate: 14.9, nonProdUsage: 4744320, baselineUsage: 4128000, excessUsage: 616320, estimatedCost: 308160, status: 'NORMAL', rank: 8 },
  { facilityId: 'f010', code: 'HNK10-060', name: 'HNK10-060', process: 'OP60', baseline: 7200, avgFlow: 8064, maxFlow: 10500, nonProdMinutes: 480, exceedMinutes: 58, leakRate: 12.0, nonProdUsage: 3870720, baselineUsage: 3456000, excessUsage: 414720, estimatedCost: 207360, status: 'NORMAL', rank: 9 },
  { facilityId: 'f012', code: 'HNK10-080', name: 'HNK10-080', process: 'UTL', baseline: 5500, avgFlow: 6050, maxFlow: 7800, nonProdMinutes: 480, exceedMinutes: 48, leakRate: 10.0, nonProdUsage: 2904000, baselineUsage: 2640000, excessUsage: 264000, estimatedCost: 132000, status: 'NORMAL', rank: 10 },
];

// ──────────────────────────────────────────────
// 에너지 비교 데이터 (전월/전년 대비)
// ──────────────────────────────────────────────
export interface EnergyAlertData {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  prevMonthChangeElec: number;  // 전월 대비 전력(%)
  prevYearChangeElec: number;   // 전년 대비 전력(%)
  prevMonthChangeAir: number;   // 전월 대비 에어(%)
  prevYearChangeAir: number;    // 전년 대비 에어(%)
  elecStatus: FacilityStatus;
  airStatus: FacilityStatus;
}

export const ENERGY_ALERT_DATA: EnergyAlertData[] = [
  { facilityId: 'f005', code: 'HNK10-020', name: 'HNK10-020', process: 'OP20', prevMonthChangeElec: 18.4, prevYearChangeElec: 24.1, prevMonthChangeAir: 12.3, prevYearChangeAir: 18.7, elecStatus: 'DANGER', airStatus: 'WARNING' },
  { facilityId: 'f003', code: 'HNK10-010-1', name: 'HNK10-010-1', process: 'OP10', prevMonthChangeElec: 15.2, prevYearChangeElec: 19.8, prevMonthChangeAir: 8.4, prevYearChangeAir: 12.1, elecStatus: 'DANGER', airStatus: 'WARNING' },
  { facilityId: 'f012', code: 'HNK10-080', name: 'HNK10-080', process: 'UTL', prevMonthChangeElec: 12.8, prevYearChangeElec: 16.4, prevMonthChangeAir: -2.1, prevYearChangeAir: 4.8, elecStatus: 'WARNING', airStatus: 'NORMAL' },
  { facilityId: 'f008', code: 'HNK10-040', name: 'HNK10-040', process: 'OP40', prevMonthChangeElec: 10.1, prevYearChangeElec: 14.2, prevMonthChangeAir: 6.8, prevYearChangeAir: 9.4, elecStatus: 'WARNING', airStatus: 'NORMAL' },
  { facilityId: 'f002', code: 'HNK10-010', name: 'HNK10-010', process: 'OP10', prevMonthChangeElec: 4.2, prevYearChangeElec: 8.1, prevMonthChangeAir: 3.1, prevYearChangeAir: 5.8, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
  { facilityId: 'f007', code: 'HNK10-030', name: 'HNK10-030', process: 'OP30', prevMonthChangeElec: -2.8, prevYearChangeElec: 4.9, prevMonthChangeAir: -1.4, prevYearChangeAir: 3.2, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
  { facilityId: 'f009', code: 'HNK10-050', name: 'HNK10-050', process: 'OP50', prevMonthChangeElec: -4.1, prevYearChangeElec: 2.1, prevMonthChangeAir: -3.8, prevYearChangeAir: 1.9, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
  { facilityId: 'f004', code: 'HNK10-010-2', name: 'HNK10-010-2', process: 'OP10', prevMonthChangeElec: -1.8, prevYearChangeElec: 3.4, prevMonthChangeAir: -0.9, prevYearChangeAir: 2.7, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
  { facilityId: 'f010', code: 'HNK10-060', name: 'HNK10-060', process: 'OP60', prevMonthChangeElec: -5.2, prevYearChangeElec: -1.8, prevMonthChangeAir: -4.1, prevYearChangeAir: -2.3, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
  { facilityId: 'f006', code: 'HNK10-020-1', name: 'HNK10-020-1', process: 'OP20', prevMonthChangeElec: -3.4, prevYearChangeElec: 1.2, prevMonthChangeAir: -2.6, prevYearChangeAir: 0.8, elecStatus: 'NORMAL', airStatus: 'NORMAL' },
];
