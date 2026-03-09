import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  /** true = 증가가 나쁨 (에너지 소비, 알림 등) */
  inverseChange?: boolean;
  className?: string;
}

const KpiCard = memo(function KpiCard({
  label, value, unit, change, changeLabel = 'vs 전일', inverseChange = false, className,
}: KpiCardProps) {
  const isUp = (change ?? 0) > 0;
  const isDown = (change ?? 0) < 0;
  const isGood = inverseChange ? isDown : isUp;
  const isBad = inverseChange ? isUp : isDown;

  const badgeColor = change === undefined
    ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    : isGood
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : isBad
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-gray-100 text-gray-500';

  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={cn('bg-white dark:bg-[#16213E] rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2', className)}>
      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('ko-KR') : value}
        </span>
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit', badgeColor)}>
          <Icon size={12} />
          <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-[10px] opacity-70">{changeLabel}</span>
        </div>
      )}
    </div>
  );
});

export default KpiCard;
