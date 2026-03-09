import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { getEnergyChangeTopN } from '../../services/dashboard';
import { COLORS } from '../../lib/constants';
import { TOP_N_OPTIONS } from '../../lib/filter-options';

type ChangeRow = {
  code: string;
  name: string;
  changeRate: number;
};

function changeColor(v: number) {
  if (v > 10) return COLORS.danger;
  if (v > 0) return COLORS.energy.power;
  return COLORS.chart.green;
}

function ChangeColumns(maxChange: number) {
  return [
    { key: 'code' as const, label: '설비코드', sortable: true },
    {
      key: 'changeRate' as const,
      label: '전일 대비(%)',
      sortable: true,
      render: (raw: unknown) => {
        const v = Number(raw);
        return (
          <span style={{ color: changeColor(v) }} className="font-bold">
            {v > 0 ? '+' : ''}{v.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'changeRate' as const,
      label: '변화 추이',
      render: (raw: unknown) => {
        const v = Number(raw);
        const safeMax = maxChange || 1;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative h-4">
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
              <div
                className="absolute top-1 h-2 rounded-sm"
                style={{
                  left: v < 0 ? `calc(50% + ${(v / safeMax) * 50}%)` : '50%',
                  width: `${Math.abs(v / safeMax) * 50}%`,
                  background: changeColor(v),
                }}
              />
            </div>
            <span style={{ color: changeColor(v) }} className="text-xs font-medium w-12 text-right">
              {v > 0 ? '+' : ''}{v.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
  ];
}

export default function DSH008EnergyChangeTopN() {
  const [topN, setTopN] = useState('8');

  // 전력/에어 동시 조회
  const { data: powerData, refetch: refetchPower } = useQuery({
    queryKey: ['dsh-energy-change-top', topN, 'power'],
    queryFn: () => getEnergyChangeTopN(Number(topN), 'power'),
  });
  const { data: airData, refetch: refetchAir } = useQuery({
    queryKey: ['dsh-energy-change-top', topN, 'air'],
    queryFn: () => getEnergyChangeTopN(Number(topN), 'air'),
  });

  const toRows = (raw: typeof powerData): ChangeRow[] =>
    [...(raw ?? [])].map(r => ({
      code: r.code,
      name: r.name,
      changeRate: r.prevMonthChange,
    })).sort((a, b) => b.changeRate - a.changeRate);

  const powerRows = toRows(powerData);
  const airRows = toRows(airData);

  const stats = (rows: ChangeRow[]) => {
    const inc = rows.filter(r => r.changeRate > 0).length;
    const dec = rows.filter(r => r.changeRate < 0).length;
    const max = rows.length ? Math.max(...rows.map(r => Math.abs(r.changeRate))) : 0;
    return { inc, dec, max };
  };

  const ps = stats(powerRows);
  const as_ = stats(airRows);

  const handleSearch = () => { refetchPower(); refetchAir(); };

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에너지 변화 TOP N" description="설비별 에너지 사용량 당일/전일 증감 TOP N 순위" />

      {/* 비교 기준 안내 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex-shrink-0">
        <span className="font-semibold">비교 기준:</span>
        <span>당일 00:00 ~ 현재시각 vs 전일 00:00 ~ 전일 동일시각 (동일 시간대 비교)</span>
        <span className="mx-1 text-blue-300 dark:text-blue-600">|</span>
        <span>변화율 = (당일 - 전일) / 전일 × 100%</span>
      </div>

      {/* KPI — 전력/에어 통합 */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="전력 증가" value={ps.inc} unit="개" inverseChange />
        <KpiCard label="전력 감소" value={ps.dec} unit="개" />
        <KpiCard label="에어 증가" value={as_.inc} unit="개" inverseChange />
        <KpiCard label="에어 감소" value={as_.dec} unit="개" />
      </div>

      <FilterBar
        filters={[
          { type: 'select', key: 'topN', label: 'TOP N', value: topN, onChange: setTopN, options: TOP_N_OPTIONS },
        ]}
        onSearch={handleSearch}
        className="mb-0"
      />

      {/* 바 차트 좌(전력) / 우(에어) */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0" style={{ height: 220 }}>
        <ChartCard
          title="전력 변화율 — 당일 vs 전일 (%)"
          subtitle="빨간=증가(비효율), 초록=감소(개선)"
          className="h-full"
          chartId="dsh008-power"
          exportData={powerRows}
          exportFilename="에너지변화TopN_전력"
          minHeight={0}
        >
          <SvgBarChart
            data={powerRows}
            categoryKey="code"
            bars={[{
              dataKey: 'changeRate',
              color: (item) => changeColor(Number(item.changeRate)),
            }]}
            valueUnit="%"
            referenceLines={[
              { value: 0, color: '#6b7280', dashed: false },
              { value: 10, color: COLORS.danger, dashed: true },
            ]}
            formatTooltip={(item) => `${item.code}: ${Number(item.changeRate) > 0 ? '+' : ''}${Number(item.changeRate).toFixed(1)}%`}
          />
        </ChartCard>

        <ChartCard
          title="에어 변화율 — 당일 vs 전일 (%)"
          subtitle="빨간=증가(비효율), 초록=감소(개선)"
          className="h-full"
          chartId="dsh008-air"
          exportData={airRows}
          exportFilename="에너지변화TopN_에어"
          minHeight={0}
        >
          <SvgBarChart
            data={airRows}
            categoryKey="code"
            bars={[{
              dataKey: 'changeRate',
              color: (item) => changeColor(Number(item.changeRate)),
            }]}
            valueUnit="%"
            referenceLines={[
              { value: 0, color: '#6b7280', dashed: false },
              { value: 10, color: COLORS.danger, dashed: true },
            ]}
            formatTooltip={(item) => `${item.code}: ${Number(item.changeRate) > 0 ? '+' : ''}${Number(item.changeRate).toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      {/* 테이블 좌(전력) / 우(에어) */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="overflow-auto bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">전력(kWh) 변화 상세</span>
          </div>
          <SortableTable data={powerRows} columns={ChangeColumns(ps.max)} stickyHeader compact />
        </div>
        <div className="overflow-auto bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">에어(L) 변화 상세</span>
          </div>
          <SortableTable data={airRows} columns={ChangeColumns(as_.max)} stickyHeader compact />
        </div>
      </div>
    </div>
  );
}
