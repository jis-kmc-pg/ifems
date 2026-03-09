// ============================================================
// 싸이클 파형 시간 정규화 유틸리티
// ============================================================
//
// 목적: 서로 다른 시간대의 싸이클 파형을 비교 가능하게 변환
// 예시: 11:00~11:20 (기준) vs 17:40~18:10 (비교)
//       → 둘 다 0초부터 시작하도록 정규화하여 오버레이
//
// ============================================================

import type { Interval } from '../types/chart';

/** Backend 응답: 실제 시간 데이터 */
export interface TimeSeriesPoint {
  timestamp: string; // ISO8601 (예: "2024-01-01T11:00:00Z")
  value: number;     // kW
}

/** Frontend 정규화 데이터: 상대 시간 (0부터 시작) */
export interface NormalizedPoint {
  sec: number;  // 상대 시간 (초)
  value: number;
}

/** 오버레이 데이터: 여러 시리즈 병합 */
export interface OverlayPoint {
  sec: number;
  refValue?: number;       // 기준 싸이클
  compare1Value?: number;  // 비교 싸이클 1
  compare2Value?: number;  // 비교 싸이클 2
}

/** 싸이클 메타데이터 (Backend 응답) */
export interface CycleMetadata {
  cycleId: string;
  startTime: string;  // ISO8601
  endTime: string;    // ISO8601
  facilityId: string;
  duration: number;   // 초
  status?: 'normal' | 'anomaly';
  energy?: number;
  similarity?: number;
}

// ============================================================
// 유틸리티 함수
// ============================================================

/** Interval을 초 단위로 변환 */
export function intervalToSeconds(interval: Interval): number {
  switch (interval) {
    case '15m': return 900;
    case '1m': return 60;
    case '10s': return 10;
    case '1s': return 1;
    default: return 60; // 기본값: 1분
  }
}

/** 절대 시간 데이터를 상대 시간(0부터 시작)으로 정규화
 *
 * @param data - Backend에서 받은 실제 시간 데이터
 * @param startTime - 싸이클 시작 시간 (ISO8601)
 * @param interval - 데이터 간격
 * @returns 0초부터 시작하는 정규화된 데이터
 *
 * @example
 * // 11:00~11:20 싸이클 데이터를 0~1200초로 변환
 * const data = [
 *   { timestamp: "2024-01-01T11:00:00Z", value: 850 },
 *   { timestamp: "2024-01-01T11:00:10Z", value: 860 },
 *   ...
 * ];
 * const normalized = normalizeToRelativeTime(data, "2024-01-01T11:00:00Z", "10s");
 * // 결과: [{ sec: 0, value: 850 }, { sec: 10, value: 860 }, ...]
 */
export function normalizeToRelativeTime(
  data: TimeSeriesPoint[],
  startTime: string,
  interval: Interval
): NormalizedPoint[] {
  if (!data || data.length === 0) return [];

  const step = intervalToSeconds(interval);

  // index 기반 상대 시간 계산 (가장 안정적인 방법)
  return data.map((point, index) => ({
    sec: index * step,  // 0, 10, 20, ... (10s) or 0, 1, 2, ... (1s)
    value: point.value,
  }));
}

/** 여러 정규화된 시리즈를 오버레이 데이터로 병합
 *
 * @param ref - 기준 싸이클 정규화 데이터
 * @param compare1 - 비교 싸이클 1 정규화 데이터
 * @param compare2 - 비교 싸이클 2 정규화 데이터
 * @returns 병합된 오버레이 데이터
 *
 * @example
 * const overlay = mergeOverlayData(refData, compare1Data, compare2Data);
 * // 결과: [
 * //   { sec: 0, refValue: 850, compare1Value: 880, compare2Value: 920 },
 * //   { sec: 10, refValue: 860, compare1Value: 890, compare2Value: 930 },
 * //   ...
 * // ]
 */
export function mergeOverlayData(
  ref?: NormalizedPoint[],
  compare1?: NormalizedPoint[],
  compare2?: NormalizedPoint[]
): OverlayPoint[] {
  // 가장 긴 시리즈 길이 찾기
  const maxLength = Math.max(
    ref?.length || 0,
    compare1?.length || 0,
    compare2?.length || 0
  );

  if (maxLength === 0) return [];

  // 오버레이 데이터 생성
  return Array.from({ length: maxLength }, (_, i) => ({
    sec: ref?.[i]?.sec || compare1?.[i]?.sec || compare2?.[i]?.sec || i * intervalToSeconds('1s'),
    refValue: ref?.[i]?.value,
    compare1Value: compare1?.[i]?.value,
    compare2Value: compare2?.[i]?.value,
  }));
}

/** 상대 시간(sec)을 사람이 읽을 수 있는 형식으로 변환
 *
 * @param sec - 상대 시간 (초)
 * @returns "5분 30초" 형식의 문자열
 *
 * @example
 * formatRelativeTime(0) // "0초"
 * formatRelativeTime(30) // "30초"
 * formatRelativeTime(90) // "1분 30초"
 * formatRelativeTime(600) // "10분 0초"
 */
export function formatRelativeTime(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }
  return `${seconds}초`;
}
