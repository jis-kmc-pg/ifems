import type { Interval, ZoomLevel } from '../types/chart';

/**
 * Zoom ratio와 현재 interval에 따라 다음 Interval을 반환
 *
 * @param zoomRatio - 전체 범위 대비 보이는 범위 비율 (0~1)
 * @param currentInterval - 현재 interval
 * @param initialInterval - 초기 선택된 interval (접근 가능한 최대 level 결정)
 * @param maxDepth - 최대 해상도 깊이 (1: 15m만, 2: 15m+1m, 3: 15m+1m+10s+1s, 기본: 3)
 * @returns 다음 Interval
 *
 * @example
 * // 현재 1분 (Level 1), ratio=10% → 10초로 전환 (zoom in)
 * getIntervalForZoomRatio(0.1, '1m', '15m') // → "10s"
 *
 * // 현재 10초 (Level 2), ratio=50% → 현재 유지 (변화 없음)
 * getIntervalForZoomRatio(0.5, '10s', '15m') // → "10s"
 *
 * // maxDepth=1: DSH-001 (15분 고정)
 * getIntervalForZoomRatio(0.1, '15m', '15m', 1) // → "15m" (변경 없음)
 *
 * // maxDepth=2: MON-001, ANL-001 (15분 → 1분까지만)
 * getIntervalForZoomRatio(0.1, '1m', '15m', 2) // → "1m" (10초로 못 감)
 */
export function getIntervalForZoomRatio(
  zoomRatio: number,
  currentInterval: Interval,
  initialInterval?: Interval,
  maxDepth: 1 | 2 | 3 = 3,
  customLevels?: Interval[]
): Interval {
  // 입력 검증
  if (zoomRatio < 0 || zoomRatio > 1) {
    console.warn(
      `[chart-utils] Invalid zoomRatio: ${zoomRatio}. Using current interval.`
    );
    return currentInterval;
  }

  // 커스텀 레벨 체인이 있으면 그대로 사용, 없으면 기본 + maxDepth
  const levels: Interval[] = customLevels
    ?? (() => {
      const all: Interval[] = ['15m', '1m', '10s', '1s'];
      switch (maxDepth) {
        case 1: return all.slice(0, 1);
        case 2: return all.slice(0, 2);
        case 3: return all;
        default: return all;
      }
    })();

  const currentIndex = levels.indexOf(currentInterval);
  if (currentIndex === -1) return currentInterval;

  // Initial interval 제약
  const startIndex = initialInterval ? Math.max(0, levels.indexOf(initialInterval)) : 0;

  // Zoom in만 지원: ratio < 50%일 때 1단계 올림
  let targetIndex = currentIndex;
  if (zoomRatio < 0.50 && currentIndex < levels.length - 1) {
    targetIndex = currentIndex + 1;
  }

  // 범위 제약
  targetIndex = Math.max(startIndex, Math.min(levels.length - 1, targetIndex));

  return levels[targetIndex];
}

/**
 * Interval에 해당하는 Zoom Level 반환
 *
 * @param interval - Interval 값
 * @returns ZoomLevel (0~3)
 */
export function getZoomLevelFromInterval(interval: Interval): ZoomLevel {
  switch (interval) {
    case '15m':
      return 0;
    case '1m':
      return 1;
    case '10s':
      return 2;
    case '1s':
      return 3;
    default:
      return 0;
  }
}

/**
 * Interval 값을 사람이 읽기 쉬운 형식으로 변환
 *
 * @param interval - Interval 값
 * @returns 한글 표시 문자열
 */
export function formatInterval(interval: Interval): string {
  switch (interval) {
    case '1M':
      return '1개월';
    case '1d':
      return '1일';
    case '1h':
      return '1시간';
    case '15m':
      return '15분';
    case '5m':
      return '5분';
    case '1m':
      return '1분';
    case '10s':
      return '10초';
    case '1s':
      return '1초';
    default:
      return interval;
  }
}

/**
 * Zoom ratio 계산 (uPlot scale 기반)
 *
 * @param visibleMin - 현재 보이는 최소 인덱스
 * @param visibleMax - 현재 보이는 최대 인덱스
 * @param totalPoints - 전체 데이터 포인트 수
 * @returns Zoom ratio (0~1)
 */
export function calculateZoomRatio(
  visibleMin: number,
  visibleMax: number,
  totalPoints: number
): number {
  if (totalPoints === 0) return 1;

  const visibleRange = visibleMax - visibleMin;
  const ratio = visibleRange / totalPoints;

  // 0~1 범위로 제한
  return Math.max(0, Math.min(1, ratio));
}
