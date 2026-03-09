/**
 * Interval Enum for Dynamic Resolution API
 *
 * 8-level interval (큰 단위 → 작은 단위):
 * - ONE_MONTH (1M): 월별 집계
 * - ONE_DAY (1d): 일별 집계
 * - ONE_HOUR (1h): 시간별 집계
 * - FIFTEEN_MIN (15m): 15분 집계
 * - FIVE_MIN (5m): 5분 집계
 * - ONE_MIN (1m): 1분 집계
 * - TEN_SEC (10s): 10초 집계
 * - ONE_SEC (1s): 1초 원본
 */
export enum IntervalEnum {
  ONE_MONTH = '1M',
  ONE_DAY = '1d',
  ONE_HOUR = '1h',
  FIFTEEN_MIN = '15m',
  FIVE_MIN = '5m',
  ONE_MIN = '1m',
  TEN_SEC = '10s',
  ONE_SEC = '1s',
}

/**
 * Zoom Level type (0~3, 줌 자동전환에만 사용)
 */
export type ZoomLevel = 0 | 1 | 2 | 3;

/**
 * Interval to Zoom Level mapping
 * - 큰 단위(1M/1d/1h/5m)는 줌 자동전환 대상 아님 → 0
 */
export const INTERVAL_TO_ZOOM_LEVEL: Record<IntervalEnum, ZoomLevel> = {
  [IntervalEnum.ONE_MONTH]: 0,
  [IntervalEnum.ONE_DAY]: 0,
  [IntervalEnum.ONE_HOUR]: 0,
  [IntervalEnum.FIFTEEN_MIN]: 0,
  [IntervalEnum.FIVE_MIN]: 0,
  [IntervalEnum.ONE_MIN]: 1,
  [IntervalEnum.TEN_SEC]: 2,
  [IntervalEnum.ONE_SEC]: 3,
};

/**
 * Interval to time_bucket() string mapping
 */
export const INTERVAL_TO_BUCKET: Record<IntervalEnum, string> = {
  [IntervalEnum.ONE_MONTH]: '1 month',
  [IntervalEnum.ONE_DAY]: '1 day',
  [IntervalEnum.ONE_HOUR]: '1 hour',
  [IntervalEnum.FIFTEEN_MIN]: '15 minutes',
  [IntervalEnum.FIVE_MIN]: '5 minutes',
  [IntervalEnum.ONE_MIN]: '1 minute',
  [IntervalEnum.TEN_SEC]: '10 seconds',
  [IntervalEnum.ONE_SEC]: '1 second',
};

/**
 * cagg_usage_1min 기반 interval 여부 판별
 * (LAST-FIRST 적산차 계산 사용)
 */
export function isCaggBasedInterval(interval: IntervalEnum): boolean {
  return ['1M', '1d', '1h', '15m', '5m', '1m'].includes(interval);
}
