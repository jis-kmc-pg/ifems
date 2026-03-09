import { memo } from 'react';
import { cn } from '../../lib/utils';
import { COLORS } from '../../lib/constants';
import SparklineChart from '../charts/SparklineChart';

interface EnergyCardProps {
  title: string;
  subtitle?: string;
  powerTotal: number;
  airTotal: number;
  powerSparkline: number[];
  airSparkline: number[];
  hasAnomaly?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isLoading?: boolean;
}

const EnergyCard = memo(function EnergyCard({
  title,
  subtitle,
  powerTotal,
  airTotal,
  powerSparkline,
  airSparkline,
  hasAnomaly = false,
  onClick,
  isSelected = false,
  isLoading = false,
}: EnergyCardProps) {
  const borderColor = hasAnomaly ? COLORS.danger : COLORS.normal;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white dark:bg-[#16213E] rounded-lg shadow-sm',
        'border border-gray-100 dark:border-gray-700',
        'transition-all duration-150 cursor-pointer',
        'hover:shadow-md hover:scale-[1.01]',
        isSelected && 'ring-2 ring-[#E94560] shadow-md',
      )}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="p-4 flex flex-col gap-2">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0">
              {subtitle}
            </span>
          )}
        </div>

        {/* 전력 */}
        <div className="flex items-center justify-between gap-2">
          {isLoading ? (
            <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">전력</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 font-mono tabular-nums">
                  {powerTotal.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-gray-400">kWh</span>
              </div>
              <SparklineChart
                data={powerSparkline}
                color={COLORS.energy.power}
                showArea
                width={72}
                height={20}
              />
            </>
          )}
        </div>

        {/* 에어 */}
        <div className="flex items-center justify-between gap-2">
          {isLoading ? (
            <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">에어</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 font-mono tabular-nums">
                  {Math.round(airTotal / 1000).toLocaleString('ko-KR')}
                </span>
                <span className="text-[10px] text-gray-400">KL</span>
              </div>
              <SparklineChart
                data={airSparkline}
                color={COLORS.energy.air}
                showArea
                width={72}
                height={20}
              />
            </>
          )}
        </div>
      </div>
    </button>
  );
});

export default EnergyCard;
