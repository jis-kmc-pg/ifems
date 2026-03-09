import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import TrendChart from '../../components/charts/TrendChart';
import { usePowerAirCharts } from '../../hooks/usePowerAirCharts';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { formatInterval } from '../../lib/chart-utils';
import { getLineList } from '../../services/settings';
import type { Line } from '../../services/settings';

export default function MON002LineDetail() {
  // DB에서 라인 목록 조회 (동적 탭)
  const { data: lines = [], isLoading: linesLoading } = useQuery<Line[]>({
    queryKey: ['lines'],
    queryFn: () => getLineList(),
    staleTime: 5 * 60 * 1000,
  });

  // 활성 라인: DB에서 가져온 첫 번째 라인의 code
  const [activeLineCode, setActiveLineCode] = useState<string>('');
  const activeLine = lines.find((l) => l.code === activeLineCode);

  // 라인 목록 로드 완료 시 첫 번째 라인 자동 선택
  useEffect(() => {
    if (lines.length > 0 && !activeLineCode) {
      setActiveLineCode(lines[0].code);
    }
  }, [lines, activeLineCode]);

  // ── 검색 필터 훅 ──
  const { filters, startTime, endTime, searchUnit, zoomLevels, exportDate } = useSearchFilter();

  // ── 전력+에어 2차트 공통 훅 ──
  const {
    power: dynamicPower,
    air: dynamicAir,
    handlePan,
    handleReset,
    powerSeries,
    airSeries,
    currentTime,
  } = usePowerAirCharts({
    initialInterval: searchUnit,
    startTime,
    endTime,
    lineCode: activeLineCode,
    enabled: !!activeLineCode,
    zoomLevels,
    showCurrentTime: true,
  });

  // 현재 활성 라인 이름
  const activeLineName = activeLine?.name ?? activeLineCode;

  if (linesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">라인 목록 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 타이틀 + 탭 (같은 줄) */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0 px-4 pt-4">
        {/* 왼쪽: 타이틀 */}
        <PageHeader
          title="라인별 상세 현황"
          description={`동적 해상도: ${formatInterval(dynamicPower.currentInterval)}`}
        />

        {/* 오른쪽: 라인 탭 (DB 기반 동적 생성) */}
        <div className="flex gap-1">
          {lines.map((line) => (
            <button
              key={line.id}
              onClick={() => setActiveLineCode(line.code)}
              className={`px-5 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
                activeLineCode === line.code
                  ? 'bg-white dark:bg-[#16213E] border-[#E94560] dark:border-[#27AE60] text-[#E94560] dark:text-white shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-[#16213E]'
              }`}
            >
              {line.name}
            </button>
          ))}
        </div>
      </div>

      {/* 필터바 + 줌 네비게이션 */}
      <div className="flex-shrink-0 px-4 pt-3">
        <div className="flex items-center gap-3">
          <FilterBar
            filters={filters}
            onSearch={() => {
              dynamicPower.reset();
              dynamicAir.reset();
            }}
            searchLabel="검색"
            className="mb-0"
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
      </div>

      {/* 차트 컨테이너 - 남은 공간을 두 차트가 균등 분할 */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 px-4 pt-3 pb-4">
        {/* 전력 차트 */}
        <ChartCard
          title={`전력 사용량 (kWh) — ${activeLineName}`}
          subtitle={`동적 해상도: ${formatInterval(dynamicPower.currentInterval)} • Zoom하면 자동 전환`}
          className="flex-1 min-h-0"
          chartId="mon002-power"
          exportData={dynamicPower.data}
          exportFilename={`${activeLineCode}_전력_${exportDate}`}
          minHeight={0}
        >
          <TrendChart
            data={dynamicPower.data || []}
            series={powerSeries}
            xKey="time"
            yLabel="kWh"
            syncKey="mon002"
            showLegend={true}
            currentTime={currentTime}
            onZoomChange={dynamicPower.handleZoom}
            isLoading={dynamicPower.isLoading}
            loadingMessage={`${formatInterval(dynamicPower.currentInterval)} 데이터 로딩 중...`}
            anomalies={dynamicPower.anomalies}
          />
        </ChartCard>

        {/* 에어 차트 */}
        <ChartCard
          title={`에어 사용량 (L) — ${activeLineName}`}
          subtitle={`동적 해상도: ${formatInterval(dynamicAir.currentInterval)} • Zoom하면 자동 전환`}
          className="flex-1 min-h-0"
          chartId="mon002-air"
          exportData={dynamicAir.data}
          exportFilename={`${activeLineCode}_에어_${exportDate}`}
          minHeight={0}
        >
          <TrendChart
            data={dynamicAir.data || []}
            series={airSeries}
            xKey="time"
            yLabel="L"
            syncKey="mon002"
            showLegend={true}
            currentTime={currentTime}
            onZoomChange={undefined}
            isLoading={dynamicAir.isLoading}
            loadingMessage={`${formatInterval(dynamicAir.currentInterval)} 데이터 로딩 중...`}
          />
        </ChartCard>
      </div>
    </div>
  );
}
