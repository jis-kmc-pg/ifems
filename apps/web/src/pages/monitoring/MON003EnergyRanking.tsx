import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SortableTable, { Column } from '../../components/ui/SortableTable';
import { StatusBadge } from '../../components/ui/TrafficLight';
import { getEnergyRanking } from '../../services/monitoring';
import type { FacilityEnergy } from '../../services/mock/facilities';
import { COLORS } from '../../lib/constants';
import { LINE_ITEMS } from '../../lib/filter-options';
import { useLineFilter, useEnergyFilter } from '../../hooks/useCommonFilters';

export default function MON003EnergyRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const { energyType, filter: energyFilter } = useEnergyFilter();

  const { data = [], refetch } = useQuery({
    queryKey: ['mon-energy-ranking', line, energyType],
    queryFn: () => getEnergyRanking(line as 'block', energyType),
  });

  const isPower = energyType === 'power';
  const top10 = [...data]
    .filter((d) => isPower ? d.dailyElec > 0 : d.dailyAir > 0)
    .sort((a, b) => isPower ? b.dailyElec - a.dailyElec : b.dailyAir - a.dailyAir)
    .slice(0, 10);

  const chartData = top10.map((d) => ({
    name: d.code,
    value: isPower ? d.dailyElec : d.dailyAir / 1000,
    status: d.status,
  }));

  const rankChangeIcon = (change: number) =>
    change < 0 ? <span className="text-[#27AE60] text-xs">▲{Math.abs(change)}</span>
      : change > 0 ? <span className="text-red-500 text-xs">▼{change}</span>
      : <span className="text-gray-400 text-xs">-</span>;

  const columns: Column<FacilityEnergy>[] = [
    { key: 'rankElec', label: 'No.', width: 44, align: 'center', render: (_, __, i) => <span className="font-bold text-gray-500">{i + 1}</span> },
    { key: 'code', label: '설비명', render: (v) => <span className="font-medium text-gray-800 dark:text-white text-xs">{String(v)}</span> },
    { key: 'process', label: '공정', width: 56, align: 'center', render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
    {
      key: 'dailyElec', label: `일간(${isPower ? 'kWh' : 'KL'})`, align: 'right', sortable: true,
      render: (_, row) => <span className="font-mono text-xs">{isPower ? row.dailyElec.toFixed(1) : (row.dailyAir / 1000).toFixed(1)}</span>,
    },
    {
      key: 'weeklyElec', label: `주간(${isPower ? 'kWh' : 'KL'})`, align: 'right', sortable: true,
      render: (_, row) => <span className="font-mono text-xs text-gray-500">{isPower ? row.weeklyElec.toFixed(1) : (row.weeklyAir / 1000).toFixed(1)}</span>,
    },
    {
      key: 'rankChangeElec', label: '순위변동', width: 64, align: 'center',
      render: (_, row) => rankChangeIcon(isPower ? row.rankChangeElec : row.rankChangeAir),
    },
    { key: 'status', label: '상태', width: 72, align: 'center', render: (v) => <StatusBadge status={v as 'NORMAL'} /> },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="설비별 에너지 사용 순위" description="일간/주간 에너지 사용량 기준 순위" />

      <FilterBar
        filters={[lineFilter, energyFilter]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 순위 테이블 */}
        <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {LINE_ITEMS.find((l) => l.value === line)?.label} 라인 — {isPower ? '전력' : '에어'} 순위
            </span>
          </div>
          <SortableTable<FacilityEnergy>
            columns={columns}
            data={data.filter((d: FacilityEnergy) => isPower ? d.dailyElec > 0 : d.dailyAir > 0)}
            keyField="facilityId"
            pageSize={15}
            compact
            stickyHeader
            rowClassName={(row) => row.status === 'DANGER' ? 'row-danger' : row.status === 'WARNING' ? 'row-warning' : ''}
          />
        </div>

        {/* TOP 10 가로 막대 차트 */}
        <div className="w-80 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">TOP 10 순위</span>
          </div>
          <div className="flex-1 p-2">
            <SvgBarChart
              data={chartData}
              categoryKey="name"
              orientation="horizontal"
              bars={[{
                dataKey: 'value',
                color: (item) => item.status === 'DANGER' ? COLORS.danger : item.status === 'WARNING' ? COLORS.energy.power : COLORS.energy.air,
              }]}
              showBarLabels
              formatBarLabel={(v) => v.toFixed(1)}
              formatTooltip={(item) => `${item.name}: ${Number(item.value).toFixed(1)} ${isPower ? 'kWh' : 'KL'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
