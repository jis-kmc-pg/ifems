import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import { StatusBadge } from '../../components/ui/TrafficLight';
import TrendChart from '../../components/charts/TrendChart';
import {
  getOverviewKpi, getLineMiniCards, getAlarmSummary, getHourlyTrend,
} from '../../services/monitoring';
import { overviewTrendSeries } from '../../lib/chart-series';

export default function MON001Overview() {
  const { data: kpi } = useQuery({
    queryKey: ['mon-overview-kpi'],
    queryFn: getOverviewKpi,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: lines } = useQuery({
    queryKey: ['mon-line-cards'],
    queryFn: getLineMiniCards,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: alarms } = useQuery({
    queryKey: ['mon-alarms'],
    queryFn: getAlarmSummary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // 시간대별 차트 (1시간 버킷, 0~23시 고정)
  const { data: hourly, isLoading } = useQuery({
    queryKey: ['mon-hourly-trend'],
    queryFn: () => getHourlyTrend(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const hasVisibleData = useMemo(() => {
    if (!hourly || hourly.length === 0) return false;
    return hourly.some((d: any) => d.current != null || d.prev != null);
  }, [hourly]);

  const CURRENT_TIME = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const trendSeries = useMemo(() => overviewTrendSeries(), []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="모니터링 종합 현황"
        description="당일 에너지 사용량 (실시간)"
        badge="LIVE"
      />

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="전체 전력 사용량" value={kpi?.totalPower.value ?? 0} unit="kWh" change={kpi?.totalPower.change} inverseChange changeLabel="vs 전일" />
        <KpiCard label="전체 에어 사용량" value={kpi?.totalAir.value ?? 0} unit="ML" change={kpi?.totalAir.change} inverseChange changeLabel="vs 전일" />
        <KpiCard label="전력 품질 알림" value={kpi?.powerQualityAlarms.value ?? 0} unit="건" change={kpi?.powerQualityAlarms.change} inverseChange changeLabel="vs 전일" />
        <KpiCard label="에어 누기 알림" value={kpi?.airLeakAlarms.value ?? 0} unit="건" change={kpi?.airLeakAlarms.change} inverseChange changeLabel="vs 전일" />
      </div>

      {/* 라인별 미니 카드 4개 */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {(lines ?? []).map((line: any) => (
          <div key={line.id} className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800 dark:text-white">{line.label}</span>
              <div className="flex gap-1">
                <StatusBadge status={line.powerStatus} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" aria-hidden="true" /> 전력
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white">{line.power} <span className="text-xs font-normal text-gray-400">{line.powerUnit}</span></div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#E94560] inline-block" aria-hidden="true" /> 에어
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white">{line.air} <span className="text-xs font-normal text-gray-400">{line.airUnit}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단: 차트(좌) + 알림 테이블(우) */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* 시간대별 추이 차트 */}
        <ChartCard
          title="시간대별 전력/에어 사용 추이"
          subtitle="당일 막대 + 전일 영역 오버레이"
          className="flex-[3] min-h-0"
          chartId="mon001-trend"
          exportData={hourly}
          exportFilename="종합현황_시간대별추이"
          minHeight={0}
        >
          {!hasVisibleData ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
            </div>
          ) : (
            <TrendChart
              data={hourly ?? []}
              series={trendSeries}
              xKey="time"
              yLabel="kWh"
              syncKey="mon001"
              showLegend={true}
              currentTime={CURRENT_TIME}
            />
          )}
        </ChartCard>

        {/* 알림 요약 테이블 */}
        <div className="flex-[1.2] bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">라인별 알림 현황</div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#16213E]">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">라인</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">전력품질</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">에어누기</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">합계</th>
                </tr>
              </thead>
              <tbody>
                {(alarms ?? []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.line}</td>
                    <td className="px-3 py-2.5 text-center">
                      {row.powerQuality > 0 ? <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">{row.powerQuality}건</span> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.airLeak > 0 ? <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded font-medium">{row.airLeak}건</span> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-800 dark:text-white">{row.total}건</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-[#16213E] font-bold">
                  <td className="px-3 py-2.5 text-gray-700 dark:text-white">합계</td>
                  <td className="px-3 py-2.5 text-center text-red-600">{(alarms ?? []).reduce((s: number, r: any) => s + r.powerQuality, 0)}건</td>
                  <td className="px-3 py-2.5 text-center text-amber-600">{(alarms ?? []).reduce((s: number, r: any) => s + r.airLeak, 0)}건</td>
                  <td className="px-3 py-2.5 text-center text-gray-800 dark:text-white">{(alarms ?? []).reduce((s: number, r: any) => s + r.total, 0)}건</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
