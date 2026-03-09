import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useSWR from 'swr';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import FilterBar from '../../components/ui/FilterBar';
import TrendChart from '../../components/charts/TrendChart';
import { usePowerAirCharts } from '../../hooks/usePowerAirCharts';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { useLineFilter } from '../../hooks/useCommonFilters';
import { formatInterval } from '../../lib/chart-utils';
import { fetchFactoryRangeData, fetchLineRangeData } from '../../services/monitoring';
import { getFactoryList } from '../../services/settings';
import type { Factory } from '../../services/settings';

export default function DSH001EnergyTrend() {
  // 공장 목록 조회 (기본: 첫 번째 공장)
  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: ['factories'],
    queryFn: () => getFactoryList(),
    staleTime: 5 * 60 * 1000,
  });
  const defaultFactoryCode = factories[0]?.code ?? '';

  const { line, filter: lineFilter } = useLineFilter();

  // 검색 필터 훅
  const { filters: searchFilters, startTime, endTime, searchUnit, zoomLevels, exportDate } = useSearchFilter();

  // 라인 필터 추가 (useSearchFilter 결과에 라인 셀렉트 삽입)
  const filters = useMemo(() => [
    lineFilter,
    ...searchFilters,
  ], [lineFilter, searchFilters]);

  // ── 전력+에어 2차트 공통 훅 ──
  const {
    power: dynamicPower,
    air: dynamicAir,
    handlePan,
    handleReset,
    powerSeries,
    airSeries,
  } = usePowerAirCharts({
    initialInterval: searchUnit,
    startTime,
    endTime,
    ...(line === 'all'
      ? { factoryCode: defaultFactoryCode }
      : { lineCode: line }),
    enabled: line === 'all' ? !!defaultFactoryCode : true,
    zoomLevels,
  });

  const currentInterval = dynamicPower.currentInterval || searchUnit;

  // KPI용 별도 데이터 조회 (검색 범위 고정 — 줌 영향 없음)
  const kpiEntityId = line === 'all' ? defaultFactoryCode : line;
  const kpiEnabled = line === 'all' ? !!defaultFactoryCode : true;
  const kpiFetcher = (metric: 'power' | 'air') => () =>
    line === 'all'
      ? fetchFactoryRangeData(kpiEntityId, startTime, endTime, searchUnit, metric)
      : fetchLineRangeData(kpiEntityId, startTime, endTime, searchUnit, metric);

  const { data: kpiPowerResp } = useSWR(
    kpiEnabled ? `kpi:power:${line === 'all' ? 'factory' : 'line'}:${kpiEntityId}:${startTime}:${endTime}:${searchUnit}` : null,
    kpiFetcher('power'),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );
  const { data: kpiAirResp } = useSWR(
    kpiEnabled ? `kpi:air:${line === 'all' ? 'factory' : 'line'}:${kpiEntityId}:${startTime}:${endTime}:${searchUnit}` : null,
    kpiFetcher('air'),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // KPI 집계 (검색 범위 기준 — 줌과 무관, API가 문자열 반환 시 Number 변환)
  const totalPower = useMemo(
    () => (kpiPowerResp?.data ?? []).reduce((s: number, d: any) => s + (Number(d.power) || 0), 0),
    [kpiPowerResp],
  );
  const totalAir = useMemo(
    () => (kpiAirResp?.data ?? []).reduce((s: number, d: any) => s + (Number(d.air) || 0), 0),
    [kpiAirResp],
  );

  const lineLabel = line === 'all' ? '전체' : LINE_OPTIONS.find(o => o.value === line)?.label ?? line;

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="에너지 사용 추이"
        description={`${lineLabel} 시간대별 에너지 추이 | 해상도: ${formatInterval(currentInterval)}`}
      />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <KpiCard label="당일 누적 전력" value={totalPower} unit="kWh" />
        <KpiCard label="당일 누적 에어" value={Math.round(totalAir / 1000)} unit="KL" />
        <KpiCard label="전력 피크월" value={2} unit="월" />
      </div>

      {/* 필터바 + 줌 네비게이션 */}
      <div className="flex items-center gap-3">
        <FilterBar
          filters={filters}
          onSearch={handleReset}
          searchLabel="검색"
          className="mb-0 flex-1"
        />
        <DynamicZoomBar
          isZoomed={dynamicPower.isZoomed}
          currentInterval={dynamicPower.currentInterval}
          zoomedTimeRange={dynamicPower.zoomedTimeRange}
          panState={dynamicPower.panState}
          onPan={handlePan}
          onReset={handleReset}
        />
      </div>

      {/* 전력 추이 차트 */}
      <ChartCard
        title={`전력 사용량 (kWh) — ${lineLabel}`}
        subtitle={`동적 해상도: ${formatInterval(currentInterval)} • Zoom하면 자동 전환`}
        className="flex-1 min-h-0"
        chartId="dsh001-power"
        exportData={dynamicPower.data}
        exportFilename={`에너지추이_전력_${exportDate}`}
        minHeight={0}
      >
        <TrendChart
          data={dynamicPower.data || []}
          series={powerSeries}
          xKey="time"
          yLabel="kWh"
          syncKey="dsh001"
          showLegend={true}
          onZoomChange={dynamicPower.handleZoom}
          isLoading={dynamicPower.isLoading}
          loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
          anomalies={dynamicPower.anomalies}
        />
      </ChartCard>

      {/* 에어 추이 차트 */}
      <ChartCard
        title={`에어 사용량 (L) — ${lineLabel}`}
        subtitle={`동적 해상도: ${formatInterval(dynamicAir.currentInterval)} • Zoom하면 자동 전환`}
        className="flex-1 min-h-0"
        chartId="dsh001-air"
        exportData={dynamicAir.data}
        exportFilename={`에너지추이_에어_${exportDate}`}
        minHeight={0}
      >
        <TrendChart
          data={dynamicAir.data || []}
          series={airSeries}
          xKey="time"
          yLabel="L"
          syncKey="dsh001"
          showLegend={true}
          onZoomChange={undefined}
          isLoading={dynamicAir.isLoading}
          loadingMessage={`${formatInterval(dynamicAir.currentInterval)} 데이터 로딩 중...`}
        />
      </ChartCard>
    </div>
  );
}
