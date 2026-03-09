import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { TrafficLight } from '../../components/ui/TrafficLight';
import { getPowerQualityRanking } from '../../services/dashboard';
import { COLORS } from '../../lib/constants';

type PQRow = {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  unbalanceRate: number;
  unbalanceLimit: number;
  powerFactor: number;
  powerFactorLimit: number;
  status: 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE';
  rankUnbalance: number;
  rankPowerFactor: number;
};

import { useLineFilter } from '../../hooks/useCommonFilters';

const TODAY = new Date().toISOString().slice(0, 10);

function unbalanceColor(v: number, limit: number) {
  if (v > limit) return COLORS.danger;
  if (v > limit * 0.8) return COLORS.energy.power;
  return COLORS.normal;
}
function pfColor(v: number, limit: number) {
  if (v < limit) return COLORS.energy.power;
  return COLORS.normal;
}

export default function DSH006PowerQualityRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const [date, setDate] = useState(TODAY);

  const { data, refetch } = useQuery({
    queryKey: ['dsh-pq-ranking', line],
    queryFn: () => getPowerQualityRanking(line === 'all' ? undefined : (line as 'block')),
  });

  const rows: PQRow[] = data ?? [];
  const overLimit = rows.filter((r) => r.unbalanceRate > r.unbalanceLimit).length;
  const avgPF = rows.length ? rows.reduce((s, r) => s + r.powerFactor, 0) / rows.length : 0;
  const lowPF = rows.filter((r) => r.powerFactor < r.powerFactorLimit).length;

  const columns = [
    {
      key: 'rankUnbalance' as const,
      label: '순위',
      sortable: true,
      render: (v: number) => <span className={`font-bold ${v <= 3 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>{v}</span>,
    },
    {
      key: 'status' as const,
      label: '상태',
      render: (v: PQRow['status']) => <TrafficLight status={v} />,
    },
    { key: 'code' as const, label: '설비코드', sortable: true },
    { key: 'process' as const, label: '공정', sortable: true },
    {
      key: 'unbalanceRate' as const,
      label: '불평형률(%)',
      sortable: true,
      render: (v: number, row: PQRow) => (
        <span style={{ color: unbalanceColor(v, row.unbalanceLimit) }} className="font-medium">
          {v.toFixed(1)}% <span className="text-gray-400 text-xs">(기준 {row.unbalanceLimit}%)</span>
        </span>
      ),
    },
    {
      key: 'powerFactor' as const,
      label: '역률(%)',
      sortable: true,
      render: (v: number, row: PQRow) => (
        <span style={{ color: pfColor(v, row.powerFactorLimit) }} className="font-medium">
          {v.toFixed(1)}% <span className="text-gray-400 text-xs">(기준 {row.powerFactorLimit}%)</span>
        </span>
      ),
    },
  ];

  const sortedByUnbalance = [...rows].sort((a, b) => b.unbalanceRate - a.unbalanceRate);
  const sortedByPF = [...rows].sort((a, b) => a.powerFactor - b.powerFactor);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="전력 품질 순위" description="불평형률 / 역률 설비별 순위 (기간별)" />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <KpiCard label="기준 초과(불평형)" value={overLimit} unit="개" inverseChange />
        <KpiCard label="평균 역률" value={avgPF.toFixed(1)} unit="%" />
        <KpiCard label="역률 미달 설비" value={lowPF} unit="개" inverseChange />
      </div>

      <FilterBar
        filters={[
          lineFilter,
          { type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* 차트 2개 좌우 */}
      <div className="flex gap-3 flex-shrink-0" style={{ height: 200 }}>
        <ChartCard
          title="불평형률 순위 (%)"
          subtitle="기준선 5% 초과 시 위험"
          className="flex-1"
          chartId="dsh006-unbalance"
          minHeight={0}
        >
          <SvgBarChart
            data={sortedByUnbalance}
            categoryKey="code"
            orientation="horizontal"
            bars={[{
              dataKey: 'unbalanceRate',
              color: (item) => unbalanceColor(Number(item.unbalanceRate), Number(item.unbalanceLimit)),
            }]}
            domain={[0, 10]}
            valueUnit="%"
            referenceLines={[{ value: 5, color: COLORS.danger, dashed: true }]}
            formatTooltip={(item) => `${item.code}: ${Number(item.unbalanceRate).toFixed(1)}%`}
          />
        </ChartCard>

        <ChartCard
          title="역률 순위 (%)"
          subtitle="기준선 90% 미달 시 주의"
          className="flex-1"
          chartId="dsh006-pf"
          minHeight={0}
        >
          <SvgBarChart
            data={sortedByPF}
            categoryKey="code"
            orientation="horizontal"
            bars={[{
              dataKey: 'powerFactor',
              color: (item) => pfColor(Number(item.powerFactor), Number(item.powerFactorLimit)),
            }]}
            domain={[70, 100]}
            valueUnit="%"
            referenceLines={[{ value: 90, color: COLORS.energy.power, dashed: true }]}
            formatTooltip={(item) => `${item.code}: ${Number(item.powerFactor).toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <SortableTable data={rows} columns={columns} stickyHeader compact />
      </div>
    </div>
  );
}
