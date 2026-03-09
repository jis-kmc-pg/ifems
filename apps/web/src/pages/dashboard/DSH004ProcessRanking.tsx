import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { getProcessRanking } from '../../services/dashboard';
import { COLORS } from '../../lib/constants';
import { useLineFilter, useEnergyFilter } from '../../hooks/useCommonFilters';

type ProcessRow = {
  process: string;
  power: number;
  air: number;
  prevPower: number;
  prevAir: number;
};
const TODAY = new Date().toISOString().slice(0, 10);

const PROCESS_COLORS: Record<string, string> = {
  OP10: COLORS.energy.air,
  OP20: COLORS.chart.cyan,
  OP30: COLORS.chart.green,
  OP40: COLORS.chart.purple,
  OP50: COLORS.chart.orange,
  OP60: COLORS.chart.pink,
  UTL: COLORS.offline,
};

export default function DSH004ProcessRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const { energyType: type, filter: energyFilter } = useEnergyFilter({ detailed: true });
  const [date, setDate] = useState(TODAY);

  const { data, refetch } = useQuery({
    queryKey: ['dsh-process-ranking', line, type],
    queryFn: () => getProcessRanking(line === 'all' ? undefined : (line as 'block'), type),
  });

  const sorted = [...(data ?? [])].sort((a: ProcessRow, b: ProcessRow) =>
    type === 'power' ? b.power - a.power : b.air - a.air
  );

  const columns = [
    { key: 'process' as const, label: '공정', sortable: true },
    {
      key: 'power' as const,
      label: '당일 전력(kWh)',
      sortable: true,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-amber-400"
              style={{ width: `${Math.min(100, (v / 1500) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium w-14 text-right">{v.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'air' as const,
      label: '당일 에어(KL)',
      sortable: true,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-[#E94560]"
              style={{ width: `${Math.min(100, (v / 950000) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium w-14 text-right">{(v / 1000).toFixed(0)}</span>
        </div>
      ),
    },
    {
      key: 'prevPower' as const,
      label: '전일 전력(kWh)',
      sortable: true,
      render: (v: number, row: ProcessRow) => {
        const diff = row.power - v;
        const pct = v ? (diff / v) * 100 : 0;
        return (
          <span className={pct > 5 ? 'text-red-500' : pct < -5 ? 'text-[#27AE60]' : 'text-gray-600 dark:text-gray-400'}>
            {v.toFixed(1)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="공정별 순위" description="공정별 에너지 사용량 순위 (당일/전일 비교)" />

      <FilterBar
        filters={[
          lineFilter,
          energyFilter,
          { type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* 스택 바 차트 */}
      <ChartCard
        title={`공정별 ${type === 'power' ? '전력(kWh)' : '에어(KL)'} 비교`}
        subtitle="당일(실선) vs 전일(패턴)"
        className="flex-shrink-0"
        style={{ height: 240 }}
        chartId="dsh004-bar"
        exportData={sorted}
        exportFilename="공정별순위"
        minHeight={0}
      >
        <SvgBarChart
          data={sorted}
          categoryKey="process"
          bars={[
            {
              dataKey: type === 'power' ? 'power' : 'air',
              color: (item) => PROCESS_COLORS[String(item.process)] ?? COLORS.energy.air,
              label: `당일 ${type === 'power' ? '전력' : '에어'}`,
            },
            {
              dataKey: type === 'power' ? 'prevPower' : 'prevAir',
              color: 'rgba(156,163,175,0.7)',
              label: '전일',
            },
          ]}
          formatValue={(v) => type === 'power' ? String(Math.round(v)) : `${(v / 1000).toFixed(0)}K`}
          formatTooltip={(item, bar) => {
            const val = Number(item[bar.dataKey]) || 0;
            return `${item.process} (${bar.label}): ${type === 'power' ? `${val.toFixed(1)} kWh` : `${(val / 1000).toFixed(0)} KL`}`;
          }}
        />
      </ChartCard>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <SortableTable
          data={sorted}
          columns={columns}
          stickyHeader
          compact
        />
      </div>
    </div>
  );
}
