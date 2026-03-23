import { CSSProperties, ReactNode } from 'react';
import { Download, Image } from 'lucide-react';
import { cn } from '../../lib/utils';
import { exportToExcel, exportToImage } from '../../lib/utils';
import Spinner from './Spinner';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  chartId?: string;
  exportData?: unknown[];
  exportFilename?: string;
  actions?: ReactNode;
  minHeight?: number;
  /** 로딩 중일 때 차트 영역에 블러 + 스피너 오버레이 */
  isLoading?: boolean;
  /** 로딩 메시지 (예: "에너지 데이터 조회 중...") */
  loadingText?: string;
}

export default function ChartCard({
  title, subtitle, children, className, style, chartId, exportData, exportFilename, actions, minHeight = 280,
  isLoading, loadingText,
}: ChartCardProps) {
  return (
    <div className={cn('bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col', className)} style={style}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-white">{title}</div>
          {subtitle && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {chartId && (
            <button
              onClick={() => exportToImage(chartId, exportFilename ?? title)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="이미지로 저장"
            >
              <Image size={14} aria-hidden="true" />
            </button>
          )}
          {exportData && (
            <button
              onClick={() => exportToExcel(exportData, exportFilename ?? title)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Excel로 내보내기"
            >
              <Download size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-3 overflow-hidden relative" style={{ minHeight }} id={chartId}>
        {children}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#16213E]/60 backdrop-blur-[1px] z-10 transition-opacity duration-300">
            <Spinner size="md" message={loadingText || '데이터 조회 중...'} />
          </div>
        )}
      </div>
    </div>
  );
}
