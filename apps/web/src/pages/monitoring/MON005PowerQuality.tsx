import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SortableTable, { Column } from '../../components/ui/SortableTable';
import { StatusBadge } from '../../components/ui/TrafficLight';
import { getPowerQualityRanking } from '../../services/monitoring';
import type { PowerQualityData } from '../../services/mock/facilities';
import { cn } from '../../lib/utils';
import { useLineFilter } from '../../hooks/useCommonFilters';

function PercentCell({ value, limit, higher = false }: { value: number; limit: number; higher?: boolean }) {
  // higher=true: 높을수록 좋음(역률), higher=false: 낮을수록 좋음(불평형률)
  const isBad = higher ? value < limit : value > limit;
  const isWarning = higher ? value < limit * 1.05 : value > limit * 0.85;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className={cn(
        'font-mono text-xs font-semibold',
        isBad ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-[#27AE60] dark:text-[#27AE60]',
      )}>
        {value.toFixed(1)}%
      </span>
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
        isBad ? 'bg-red-600' : isWarning ? 'bg-[#F39C12]' : 'bg-[#27AE60]',
      )} />
    </div>
  );
}

/** 3상 전류 중 가장 높은/낮은 상을 하이라이트 */
function PhaseCell({ value, isMax, isMin }: { value: number; isMax: boolean; isMin: boolean }) {
  return (
    <span className={cn(
      'font-mono text-xs',
      isMax ? 'text-red-500 dark:text-red-400 font-semibold' : isMin ? 'text-blue-500 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-300',
    )}>
      {value.toFixed(1)}
    </span>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);

export default function MON005PowerQuality() {
  const { line, filter: lineFilter } = useLineFilter({ defaultValue: 'block' });
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);

  const { data = [], refetch } = useQuery({
    queryKey: ['mon-power-quality', line, startDate, endDate],
    queryFn: () => getPowerQualityRanking(line as 'block', startDate, endDate),
  });

  const unbalanceColumns: Column<PowerQualityData>[] = [
    { key: 'rankUnbalance', label: 'No.', width: 36, align: 'center', render: (_, __, i) => <span className="font-bold text-gray-400">{i + 1}</span> },
    { key: 'code', label: '설비명', render: (v) => <span className="font-medium text-xs">{String(v)}</span> },
    { key: 'process', label: '공정', width: 48, align: 'center', render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
    {
      key: 'phaseA', label: 'A상(A)', width: 60, align: 'right',
      render: (_, row) => {
        const max = Math.max(row.phaseA, row.phaseB, row.phaseC);
        const min = Math.min(row.phaseA, row.phaseB, row.phaseC);
        return <PhaseCell value={row.phaseA} isMax={row.phaseA === max} isMin={row.phaseA === min} />;
      },
    },
    {
      key: 'phaseB', label: 'B상(A)', width: 60, align: 'right',
      render: (_, row) => {
        const max = Math.max(row.phaseA, row.phaseB, row.phaseC);
        const min = Math.min(row.phaseA, row.phaseB, row.phaseC);
        return <PhaseCell value={row.phaseB} isMax={row.phaseB === max} isMin={row.phaseB === min} />;
      },
    },
    {
      key: 'phaseC', label: 'C상(A)', width: 60, align: 'right',
      render: (_, row) => {
        const max = Math.max(row.phaseA, row.phaseB, row.phaseC);
        const min = Math.min(row.phaseA, row.phaseB, row.phaseC);
        return <PhaseCell value={row.phaseC} isMax={row.phaseC === max} isMin={row.phaseC === min} />;
      },
    },
    {
      key: 'unbalanceLimit', label: '기준(%)', width: 56, align: 'right',
      render: (v) => <span className="text-xs text-gray-400 font-mono">{Number(v).toFixed(1)}</span>,
    },
    {
      key: 'unbalanceRate', label: '불평형률(%)', width: 88, align: 'right', sortable: true,
      render: (_, row) => <PercentCell value={row.unbalanceRate} limit={row.unbalanceLimit} />,
    },
    { key: 'unbalanceStatus', label: '상태', width: 64, align: 'center', render: (v) => <StatusBadge status={(v || 'NORMAL') as 'NORMAL'} /> },
  ];

  const powerFactorColumns: Column<PowerQualityData>[] = [
    { key: 'rankPowerFactor', label: 'No.', width: 36, align: 'center', render: (_, __, i) => <span className="font-bold text-gray-400">{i + 1}</span> },
    { key: 'code', label: '설비명', render: (v) => <span className="font-medium text-xs">{String(v)}</span> },
    { key: 'process', label: '공정', width: 48, align: 'center', render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
    {
      key: 'powerFactorLimit', label: '기준(%)', width: 56, align: 'right',
      render: (v) => <span className="text-xs text-gray-400 font-mono">{Number(v).toFixed(0)}</span>,
    },
    {
      key: 'powerFactor', label: '평균역률(%)', width: 88, align: 'right', sortable: true,
      render: (_, row) => <PercentCell value={row.powerFactor} limit={row.powerFactorLimit} higher />,
    },
    {
      key: 'minPowerFactor', label: '최저역률(%)', width: 88, align: 'right', sortable: true,
      render: (_, row) => <PercentCell value={row.minPowerFactor} limit={row.powerFactorLimit} higher />,
    },
    { key: 'powerFactorStatus', label: '상태', width: 64, align: 'center', render: (v) => <StatusBadge status={(v || 'NORMAL') as 'NORMAL'} /> },
  ];

  const sortedUnbalance = [...data].sort((a, b) => b.unbalanceRate - a.unbalanceRate);
  const sortedPowerFactor = [...data].sort((a, b) => a.powerFactor - b.powerFactor);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="전력 품질 순위" description="전력 부하 불평형률 및 역률 기준 초과 설비 순위" />

      <FilterBar
        filters={[
          lineFilter,
          { type: 'date', key: 'startDate', label: '시작일', value: startDate, onChange: setStartDate },
          { type: 'date', key: 'endDate', label: '종료일', value: endDate, onChange: setEndDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 불평형률 */}
        <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">전력 부하 불평형률 순위</span>
              <span className="text-[10px] text-gray-400">(MAX상 - MIN상) / AVG상 x 100</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-red-500">● 최대상</span>
              <span className="text-blue-500">● 최소상</span>
              <span className="text-gray-400 ml-1">기준: 5.0% 이하</span>
            </div>
          </div>
          <SortableTable<PowerQualityData>
            columns={unbalanceColumns}
            data={sortedUnbalance}
            keyField="facilityId"
            compact
            stickyHeader
            rowClassName={(row) =>
              row.unbalanceRate > row.unbalanceLimit ? 'row-danger'
                : row.unbalanceRate > row.unbalanceLimit * 0.85 ? 'row-warning'
                : ''
            }
          />
        </div>

        {/* 역률 */}
        <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">역률 순위</span>
            <span className="text-xs text-gray-400">기준: 90% 이상</span>
          </div>
          <SortableTable<PowerQualityData>
            columns={powerFactorColumns}
            data={sortedPowerFactor}
            keyField="facilityId"
            compact
            stickyHeader
            rowClassName={(row) =>
              row.powerFactor < row.powerFactorLimit ? 'row-danger'
                : row.powerFactor < row.powerFactorLimit * 1.05 ? 'row-warning'
                : ''
            }
          />
        </div>
      </div>
    </div>
  );
}
