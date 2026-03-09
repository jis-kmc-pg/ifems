import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { formatInterval } from '../../lib/chart-utils';
import type { Interval } from '../../types/chart';

interface DynamicZoomBarProps {
  isZoomed: boolean;
  currentInterval: Interval;
  zoomedTimeRange: { start: string; end: string } | null;
  panState: { canLeft: boolean; canRight: boolean };
  onPan: (direction: 'left' | 'right') => void;
  onReset: () => void;
}

/**
 * 줌 네비게이션 바
 *
 * 차트 줌 시에만 FilterBar 오른쪽에 표시.
 * FilterBar와 동일한 높이·스타일.
 * 배치: < | 1분 (00:00 ~ 00:30) | 리셋 | >
 */
export default function DynamicZoomBar({
  isZoomed,
  currentInterval,
  zoomedTimeRange,
  panState,
  onPan,
  onReset,
}: DynamicZoomBarProps) {
  if (!isZoomed) return null;

  return (
    <div className="flex items-center gap-1.5 bg-white dark:bg-[#16213E] border border-gray-100 dark:border-gray-700 rounded-lg px-3 shadow-sm flex-shrink-0 self-stretch">
      {/* 왼쪽 이동 */}
      <button
        onClick={() => onPan('left')}
        disabled={!panState.canLeft}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        title="왼쪽 이동"
      >
        <ChevronLeft size={18} />
      </button>

      {/* 해상도 + 시간 범위 */}
      <span className="text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap px-1">
        {formatInterval(currentInterval)}
        {zoomedTimeRange && (
          <span className="text-gray-400 ml-1">
            ({zoomedTimeRange.start.slice(11, 16)} ~ {zoomedTimeRange.end.slice(11, 16)})
          </span>
        )}
      </span>

      {/* 리셋 */}
      <button
        onClick={onReset}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
        title="줌 리셋"
      >
        <RotateCcw size={15} />
      </button>

      {/* 오른쪽 이동 */}
      <button
        onClick={() => onPan('right')}
        disabled={!panState.canRight}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        title="오른쪽 이동"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
