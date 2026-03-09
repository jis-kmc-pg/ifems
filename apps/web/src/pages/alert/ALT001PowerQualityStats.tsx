import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import FilterBar from '../../components/ui/FilterBar';
import { getAlertStatsKpi, getAlertTrend, getAlertHeatmap } from '../../services/alerts';
import { COLORS } from '../../lib/constants';
import { PERIOD_OPTIONS } from '../../lib/filter-options';
import { useLineFilter } from '../../hooks/useCommonFilters';

const WEEKS = ['week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'week8'];
const WEEK_LABELS = ['1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주'];

function heatColor(v: number) {
  if (v >= 5) return 'bg-red-600 text-white';
  if (v >= 3) return 'bg-amber-400 text-white';
  if (v >= 1) return 'bg-yellow-200 text-gray-800';
  return 'bg-gray-50 dark:bg-gray-800 text-gray-400';
}

export default function ALT001PowerQualityStats() {
  const { line, filter: lineFilter } = useLineFilter();
  const [period, setPeriod] = useState('8w');

  const { data: kpi } = useQuery({
    queryKey: ['alt-pq-kpi'],
    queryFn: () => getAlertStatsKpi('power_quality'),
    refetchInterval: 10000,
    staleTime: 5000,
  });
  const { data: trend } = useQuery({
    queryKey: ['alt-pq-trend'],
    queryFn: () => getAlertTrend('power_quality'),
    refetchInterval: 10000,
    staleTime: 5000,
  });
  const { data: heatmap } = useQuery({
    queryKey: ['alt-pq-heatmap'],
    queryFn: () => getAlertHeatmap('power_quality'),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="전력 품질 통계" description="불평형률/역률 기준 초과 알림 통계 (8주)" />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="누적 알림" value={kpi?.total ?? 0} unit="건" />
        <KpiCard label="주간 알림" value={kpi?.weekly ?? 0} unit="건" change={kpi?.weeklyChange} inverseChange changeLabel="vs 전주" />
        <KpiCard label="조치 완료" value={kpi?.resolved ?? 0} unit="건" />
        <KpiCard label="조치율" value={kpi?.resolvedRate ?? 0} unit="%" />
      </div>

      <FilterBar
        filters={[
          { type: 'select', key: 'period', label: '기간', value: period, onChange: setPeriod, options: PERIOD_OPTIONS },
          lineFilter,
        ]}
        onSearch={() => {}}
        className="mb-0"
      />

      {/* 하단: 트렌드 + 히트맵 */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* 주간 트렌드 */}
        <ChartCard
          title="주간 전력 품질 알림 추이"
          subtitle="최근 8주 발생 건수"
          className="flex-[1.5]"
          chartId="alt001-trend"
          exportData={trend}
          exportFilename="전력품질_주간트렌드"
          minHeight={0}
        >
          <SvgBarChart
            data={trend ?? []}
            categoryKey="week"
            bars={[{ dataKey: 'count', color: COLORS.danger }]}
            formatTooltip={(item) => `${item.week}: ${item.count}건`}
          />
        </ChartCard>

        {/* 설비별 히트맵 */}
        <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">설비별 발생 현황 (히트맵)</div>
            <div className="text-xs text-gray-400 mt-0.5">주차별 알림 건수</div>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-gray-600 dark:text-gray-300 py-1 pr-3 min-w-[100px]">설비</th>
                  {WEEK_LABELS.map((w) => (
                    <th key={w} className="text-center font-semibold text-gray-600 dark:text-gray-300 py-1 w-10">{w}</th>
                  ))}
                  <th className="text-center font-semibold text-gray-600 dark:text-gray-300 py-1 w-12">합계</th>
                </tr>
              </thead>
              <tbody>
                {(heatmap ?? []).map((row: Record<string, unknown>, i: number) => {
                  const total = WEEKS.reduce((s, w) => s + ((row[w] as number) ?? 0), 0);
                  return (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700/50">
                      <td className="py-1.5 pr-3 font-medium text-gray-800 dark:text-gray-200">{String(row.facility)}</td>
                      {WEEKS.map((w) => {
                        const v = (row[w] as number) ?? 0;
                        return (
                          <td key={w} className="text-center py-0.5 px-0.5">
                            <span className={`inline-block w-8 h-6 rounded text-xs leading-6 font-medium ${heatColor(v)}`}>
                              {v > 0 ? v : ''}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center font-bold text-gray-800 dark:text-white">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* 범례 */}
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
              <span className="inline-block w-6 h-4 rounded bg-gray-50 dark:bg-gray-800 border" /> 0건
              <span className="inline-block w-6 h-4 rounded bg-yellow-200" /> 1~2건
              <span className="inline-block w-6 h-4 rounded bg-amber-400" /> 3~4건
              <span className="inline-block w-6 h-4 rounded bg-red-600" /> 5건+
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
