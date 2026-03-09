/**
 * 동적 차트 해상도 타입 정의
 * 계층적 해상도 시스템 (Progressive Resolution)
 *
 * Interval, ZoomLevel → @ifems/shared 에서 가져와 re-export
 */
import type { Interval, ZoomLevel } from '@ifems/shared';
export type { Interval, ZoomLevel };

/**
 * 기존 DataPoint 타입 (확장)
 */
export interface DataPoint {
  time: string;        // "HH:mm:ss" 형식
  power?: number;      // 전력 (kWh)
  air?: number;        // 에어 (L)
  [key: string]: any;  // 추가 메트릭
}

/**
 * API 응답 메타데이터
 */
export interface RangeDataMetadata {
  interval: Interval;          // 실제 사용된 interval
  totalPoints: number;         // 원본 데이터 포인트 수
  returnedPoints: number;      // 반환된 포인트 수
  downsampled: boolean;        // 다운샘플링 여부
  zoomLevel: ZoomLevel;        // 추론된 Zoom Level (0~3)
}

/**
 * 이상 데이터 이벤트 (차트 시각화용)
 */
export interface AnomalyEvent {
  start: string;              // ISO8601 시작 시각
  end: string;                // ISO8601 종료 시각
  tagId: string;
  type: 'spike' | 'drop';
  maxDeviation: number;       // 최대 배율
  consecutiveMinutes: number; // 연속 분수
  replacedWith: 'lastNormal' | 'null';
}

/**
 * 구간 데이터 API 응답 타입
 */
export interface RangeDataResponse {
  data: DataPoint[];
  metadata: RangeDataMetadata;
  anomalies?: AnomalyEvent[];
}

/**
 * Zoom 상태 타입
 */
export interface ZoomState {
  zoomRatio: number;           // 전체 대비 보이는 범위 비율 (0~1)
  currentInterval: Interval;   // 현재 표시 중인 interval
  isZoomed: boolean;           // 확대 상태 여부
}

/**
 * 동적 해상도 Hook 옵션
 */
export interface DynamicResolutionOptions {
  initialInterval: Interval;   // 시작 interval ("15m" or "1m")
  startTime: string;           // 조회 시작 시각 (ISO8601)
  endTime: string;             // 조회 종료 시각 (ISO8601)
  facilityId?: string;         // 설비 ID (facilityId 또는 lineCode 또는 factoryCode 중 하나 필수)
  lineCode?: string;           // 라인 코드 (예: "BLOCK", "HEAD") — 라인별 합산 조회
  factoryCode?: string;        // 공장 코드 (예: "hw4") — 공장 전체 합산 조회
  metric: 'power' | 'air';     // 메트릭 타입
  enabled?: boolean;           // 활성화 여부 (기본: true)
  maxDepth?: 1 | 2 | 3;        // 최대 해상도 깊이 (1: 15m만, 2: 15m+1m, 3: 15m+1m+10s+1s, 기본: 3)
  zoomLevels?: Interval[];     // 커스텀 줌 레벨 체인 (예: ['15m','5m','1m']). 설정 시 maxDepth 무시
}

/**
 * Client-side Error 타입 (Design Section 6.2)
 */
export interface ClientError {
  code: string;                // 에러 코드 (예: "NETWORK_ERROR", "INVALID_INTERVAL")
  message: string;             // 사용자 친화적 에러 메시지
  timestamp: string;           // 에러 발생 시각 (ISO8601)
}
