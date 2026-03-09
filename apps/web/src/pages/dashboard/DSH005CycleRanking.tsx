import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { TrafficLight } from '../../components/ui/TrafficLight';
import { getCycleRanking } from '../../services/dashboard';
import { COLORS } from '../../lib/constants';
import { useLineFilter } from '../../hooks/useCommonFilters';

type CycleRow = {
  rank: number;
  code: string;
  process: string;
  cycleEnergy: number;
  cycleTime: number;
  deviation: number;
  status: 'NORMAL' | 'WARNING' | 'DANGER';
};

const TODAY = new Date().toISOString().slice(0, 10);

function statusColor(status: string) {
  if (status === 'DANGER') return COLORS.danger;
  if (status === 'WARNING') return COLORS.energy.power;
  return COLORS.normal;
}

export default function DSH005CycleRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const [date, setDate] = useState(TODAY);

  const { data, refetch } = useQuery({
    queryKey: ['dsh-cycle-ranking', line],
    queryFn: () => getCycleRanking(line === 'all' ? undefined : (line as 'block')),
  });

  const rows: CycleRow[] = data ?? [];
  const avgEnergy = rows.length ? rows.reduce((s, r) => s + r.cycleEnergy, 0) / rows.length : 0;
  const maxDev = rows.length ? Math.max(...rows.map((r) => r.deviation)) : 0;
  const abnormal = rows.filter((r) => r.status !== 'NORMAL').length;

  const columns = [
    {
      key: 'rank' as const,
      label: '순위',
      sortable: true,
      render: (v: number) => (
        <span className={`font-bold ${v <= 3 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{v}</span>
      ),
    },
    {
      key: 'status' as const,
      label: '상태',
      render: (v: CycleRow['status']) => <TrafficLight status={v} />,
    },
    { key: 'code' as const, label: '설비코드', sortable: true },
    { key: 'process' as const, label: '공정', sortable: true },
    {
      key: 'cycleEnergy' as const,
      label: '싸이클당 에너지(kWh)',
      sortable: true,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${Math.min(100, (v / 9) * 100)}%` }} />
          </div>
          <span className="text-xs font-bold w-10 text-right">{v.toFixed(2)}</span>
        </div>
      ),
    },
    { key: 'cycleTime' as const, label: '싸이클 타임(s)', sortable: true },
    {
      key: 'deviation' as const,
      label: '기준 대비 편차(%)',
      sortable: true,
      render: (v: number) => (
        <span className={`font-medium ${v >= 15 ? 'text-red-500' : v >= 10 ? 'text-amber-500' : 'text-gray-600 dark:text-gray-400'}`}>
          +{v.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클당 순위" description="설비별 싸이클 에너지 사용 순위 및 편차 분석" />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <KpiCard label="평균 싸이클 에너지" value={avgEnergy.toFixed(2)} unit="kWh" />
        <KpiCard label="최고 편차" value={maxDev.toFixed(1)} unit="%" inverseChange />
        <KpiCard label="비정상 설비" value={abnormal} unit="개" inverseChange />
      </div>

      <FilterBar
        filters={[
          lineFilter,
          { type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* 싸이클 에너지 바 차트 */}
      <ChartCard
        title="설비별 싸이클당 에너지 (kWh)"
        subtitle="높을수록 에너지 효율 저하"
        className="flex-shrink-0"
        style={{ height: 200 }}
        chartId="dsh005-bar"
        minHeight={0}
      >
        <SvgBarChart
          data={rows}
          categoryKey="code"
          orientation="horizontal"
          bars={[{
            dataKey: 'cycleEnergy',
            color: (item) => statusColor(String(item.status)),
          }]}
          domain={[0, 10]}
          formatValue={(v) => v.toFixed(1)}
          formatTooltip={(item) => `${item.code}: ${Number(item.cycleEnergy).toFixed(2)} kWh`}
        />
      </ChartCard>

      {/* 순위 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <SortableTable data={rows} columns={columns} stickyHeader compact />
      </div>
    </div>
  );
}
