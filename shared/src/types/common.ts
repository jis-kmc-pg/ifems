// ============================================================
// IFEMS - 공통 타입 정의
// Intelligence Facility & Energy Management System
// 화성 PT4공장
// ============================================================

// ──────────────────────────────────────────────
// 공통 응답 타입
// ──────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ──────────────────────────────────────────────
// 설비/장비 상태 (신호등 시스템)
// ──────────────────────────────────────────────
export type FacilityStatus = 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE';

export const STATUS_COLORS: Record<FacilityStatus, string> = {
  NORMAL: '#27AE60',
  WARNING: '#F39C12',
  DANGER: '#E74C3C',
  OFFLINE: '#7F8C8D',
};

// ──────────────────────────────────────────────
// 시계열 데이터 포인트
// ──────────────────────────────────────────────
export interface TimeSeriesPoint {
  timestamp: string; // ISO 8601
  value: number;
  unit?: string;
}

// ──────────────────────────────────────────────
// 설비 정보
// ──────────────────────────────────────────────
export interface Facility {
  id: string;
  name: string;
  code: string;
  location: string;
  type: FacilityType;
  status: FacilityStatus;
  lastUpdated: string;
}

export type FacilityType =
  | 'COMPRESSOR'    // 압축기
  | 'PUMP'          // 펌프
  | 'FAN'           // 팬/블로워
  | 'MOTOR'         // 모터
  | 'CONVEYOR'      // 컨베이어
  | 'HEAT_EXCHANGER' // 열교환기
  | 'BOILER'        // 보일러
  | 'CHILLER'       // 냉동기
  | 'TRANSFORMER'   // 변압기
  | 'GENERATOR';    // 발전기

// ──────────────────────────────────────────────
// 에너지 데이터
// ──────────────────────────────────────────────
export interface EnergyData {
  facilityId: string;
  timestamp: string;
  electricityKwh: number;
  gasM3?: number;
  steamKg?: number;
  waterM3?: number;
  cost?: number;
}

// ──────────────────────────────────────────────
// 알람/이벤트
// ──────────────────────────────────────────────
export type AlarmSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlarmStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alarm {
  id: string;
  facilityId: string;
  facilityName: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  message: string;
  occurredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// ──────────────────────────────────────────────
// 동적 해상도 (Progressive Resolution)
// ──────────────────────────────────────────────

/**
 * Zoom Level (0~3)
 * - 0: 전체 뷰 (50%~100% 범위)
 * - 1: 1차 확대 (10%~50%)
 * - 2: 2차 확대 (2%~10%)
 * - 3: 최대 확대 (<2%)
 */
export type ZoomLevel = 0 | 1 | 2 | 3;

/**
 * 데이터 간격 (Interval)
 * 큰 단위 → 작은 단위 순:
 * - "1M":  1개월
 * - "1d":  1일
 * - "1h":  1시간
 * - "15m": 15분
 * - "5m":  5분
 * - "1m":  1분
 * - "10s": 10초
 * - "1s":  1초
 */
export type Interval = '1M' | '1d' | '1h' | '15m' | '5m' | '1m' | '10s' | '1s';

// ──────────────────────────────────────────────
// 에너지 / 라인 공통 타입
// ──────────────────────────────────────────────

/** 에너지 유형 */
export type EnergyType = 'elec' | 'air';

/** 라인 ID (block/head/crank/assembly) */
export type LineId = 'block' | 'head' | 'crank' | 'assembly';

// ──────────────────────────────────────────────
// 조회 파라미터
// ──────────────────────────────────────────────
export interface DateRangeQuery {
  startDate: string;
  endDate: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
