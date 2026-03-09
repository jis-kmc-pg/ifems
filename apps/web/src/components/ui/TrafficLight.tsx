import { memo } from 'react';
import { cn } from '../../lib/utils';

type Status = 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE';

interface TrafficLightProps {
  status: Status;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_LABELS: Record<Status, string> = {
  NORMAL: '정상',
  WARNING: '주의',
  DANGER: '위험',
  OFFLINE: '오프라인',
};

const DOT_COLORS: Record<Status, string> = {
  NORMAL: 'bg-[#27AE60]',
  WARNING: 'bg-[#F39C12]',
  DANGER: 'bg-[#E74C3C]',
  OFFLINE: 'bg-[#7F8C8D]',
};

const TEXT_COLORS: Record<Status, string> = {
  NORMAL: 'text-[#27AE60] dark:text-[#27AE60]',
  WARNING: 'text-[#F39C12] dark:text-[#F39C12]',
  DANGER: 'text-[#E74C3C] dark:text-[#E74C3C]',
  OFFLINE: 'text-[#7F8C8D] dark:text-[#7F8C8D]',
};

const DOT_SIZES = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
const TEXT_SIZES = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export const TrafficLight = memo(function TrafficLight({ status, showLabel = true, size = 'sm' }: TrafficLightProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('rounded-full flex-shrink-0', DOT_COLORS[status], DOT_SIZES[size])} />
      {showLabel && (
        <span className={cn('font-medium', TEXT_COLORS[status], TEXT_SIZES[size])}>
          {STATUS_LABELS[status]}
        </span>
      )}
    </div>
  );
});

/** 배지 형태 */
export const StatusBadge = memo(function StatusBadge({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    NORMAL: 'bg-[#27AE60]/20 text-[#27AE60] dark:bg-[#27AE60]/30 dark:text-[#27AE60]',
    WARNING: 'bg-[#F39C12]/20 text-[#F39C12] dark:bg-[#F39C12]/30 dark:text-[#F39C12]',
    DANGER: 'bg-[#E74C3C]/20 text-[#E74C3C] dark:bg-[#E74C3C]/30 dark:text-[#E74C3C]',
    OFFLINE: 'bg-[#7F8C8D]/20 text-[#7F8C8D] dark:bg-[#7F8C8D]/30 dark:text-[#7F8C8D]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', colors[status])}>
      <div className={cn('w-1.5 h-1.5 rounded-full', DOT_COLORS[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
});
