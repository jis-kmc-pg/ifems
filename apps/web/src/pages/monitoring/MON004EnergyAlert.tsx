import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SortableTable, { Column } from '../../components/ui/SortableTable';
import { StatusBadge } from '../../components/ui/TrafficLight';
import { getEnergyAlertStatus } from '../../services/monitoring';
import type { EnergyAlertData } from '../../services/mock/facilities';
import { cn } from '../../lib/utils';
import { useLineFilter } from '../../hooks/useCommonFilters';

const COMPARE_OPTIONS = [
  { value: 'prev_month', label: '전월 대비' },
  { value: 'prev_year', label: '전년 대비' },
  { value: 'both', label: '전월/전년' },
];

function ChangeCell({ value, limit = 10 }: { value: number; limit?: number }) {
  return (
    <span className={cn(
      'font-mono text-xs font-semibold px-1.5 py-0.5 rounded',
      value > limit * 1.5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : value > limit ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : value < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-[#27AE60]'
        : 'text-gray-600 dark:text-gray-300',
    )}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

export default function MON004EnergyAlert() {
  const { line, filter: lineFilter } = useLineFilter();
  const [compare, setCompare] = useState('prev_month');

  const { data = [], refetch } = useQuery({
    queryKey: ['mon-energy-alert', line],
    queryFn: () => getEnergyAlertStatus(line === 'all' ? 'block' : line as 'block'),
  });

  const columns: Column<EnergyAlertData>[] = [
    { key: 'code', label: 'No.', width: 40, align: 'center', render: (_, __, i) => <span className="font-bold text-gray-400">{i + 1}</span> },
    { key: 'code', label: '설비명', render: (v) => <span className="font-medium text-xs text-gray-800 dark:text-white">{String(v)}</span> },
    { key: 'process', label: '공정', width: 56, align: 'center', render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
    {
      key: 'prevMonthChangeElec', label: '전력 전월(%)', align: 'center', sortable: true,
      render: (_, row) => <ChangeCell value={row.prevMonthChangeElec} />,
    },
    {
      key: 'prevYearChangeElec', label: '전력 전년(%)', align: 'center', sortable: true,
      render: (_, row) => <ChangeCell value={row.prevYearChangeElec} />,
    },
    {
      key: 'prevMonthChangeAir', label: '에어 전월(%)', align: 'center', sortable: true,
      render: (_, row) => <ChangeCell value={row.prevMonthChangeAir} />,
    },
    {
      key: 'prevYearChangeAir', label: '에어 전년(%)', align: 'center', sortable: true,
      render: (_, row) => <ChangeCell value={row.prevYearChangeAir} />,
    },
    { key: 'elecStatus', label: '전력 상태', width: 72, align: 'center', render: (v) => <StatusBadge status={v as 'NORMAL'} /> },
    { key: 'airStatus', label: '에어 상태', width: 72, align: 'center', render: (v) => <StatusBadge status={v as 'NORMAL'} /> },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="설비별 에너지 알림 현황" description="전월/전년 대비 에너지 증감률 및 임계값 초과 현황" />

      <FilterBar
        filters={[
          lineFilter,
          { type: 'select', key: 'compare', label: '비교기간', value: compare, onChange: setCompare, options: COMPARE_OPTIONS },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> 위험 (기준 1.5배 초과)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 inline-block" /> 주의 (기준 초과)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> 감소 (개선)</div>
        <div className="text-gray-400 ml-2">기준: 전월/전년 대비 ±10% 초과 시 알림</div>
      </div>

      <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        <SortableTable<EnergyAlertData>
          columns={columns}
          data={data}
          keyField="facilityId"
          pageSize={20}
          compact
          stickyHeader
          rowClassName={(row) =>
            row.elecStatus === 'DANGER' || row.airStatus === 'DANGER' ? 'row-danger'
              : row.elecStatus === 'WARNING' || row.airStatus === 'WARNING' ? 'row-warning'
              : ''
          }
        />
      </div>
    </div>
  );
}
