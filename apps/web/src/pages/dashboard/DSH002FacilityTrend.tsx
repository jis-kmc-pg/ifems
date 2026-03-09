import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import useSWR from 'swr';
import { ChevronRight } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import FilterBar from '../../components/ui/FilterBar';
import TrendChart from '../../components/charts/TrendChart';
import EnergyCard from '../../components/ui/EnergyCard';
import DetailPanel from '../../components/ui/DetailPanel';
import { usePowerAirCharts } from '../../hooks/usePowerAirCharts';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { formatInterval } from '../../lib/chart-utils';
import { fetchLineRangeData, fetchRangeData } from '../../services/monitoring';
import {
  getFactoryList,
  getHierarchy,
  type Factory,
  type HierarchyFactory,
  type HierarchyFacility,
} from '../../services/settings';

// ──────────────────────────────────────────────
// 카드 데이터 타입
// ──────────────────────────────────────────────
interface CardData {
  powerTotal: number;
  airTotal: number;
  powerSparkline: number[];
  airSparkline: number[];
  hasAnomaly: boolean;
}

export default function DSH002FacilityTrend() {
  // ─── 네비게이션 상태 ───
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);

  // ─── 공장 목록 (기본: 첫 번째 공장) ───
  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: ['factories'],
    queryFn: () => getFactoryList(),
    staleTime: 5 * 60 * 1000,
  });
  const defaultFactory = factories[0];

  // ─── 계층 구조 조회 (공장→라인→설비) ───
  const { data: hierarchy = [] } = useQuery<HierarchyFactory[]>({
    queryKey: ['hierarchy'],
    queryFn: () => getHierarchy(),
    staleTime: 5 * 60 * 1000,
  });
  const factoryHierarchy = hierarchy.find(h => h.code === defaultFactory?.code);
  const lines = factoryHierarchy?.lines ?? [];

  // ─── 검색 필터 훅 ───
  const { filters, startTime, endTime, searchUnit, zoomLevels, exportDate } = useSearchFilter();

  // ─── 검색 조건 변경 시 드릴다운 리셋 ───
  useEffect(() => {
    setSelectedLine(null);
    setSelectedFacility(null);
  }, [startTime, endTime]);

  // ──────────────────────────────────────────────
  // Level 0: 라인 카드 데이터 (Promise.all 배치)
  // ──────────────────────────────────────────────
  const lineCodes = useMemo(() => lines.map(l => l.code), [lines]);

  const { data: lineCardData, isLoading: lineDataLoading } = useSWR(
    lineCodes.length > 0
      ? `dsh002-lines:${lineCodes.join(',')}:${startTime}:${endTime}:${searchUnit}`
      : null,
    async () => {
      const results = await Promise.all(
        lineCodes.flatMap(code => [
          fetchLineRangeData(code, startTime, endTime, searchUnit, 'power'),
          fetchLineRangeData(code, startTime, endTime, searchUnit, 'air'),
        ]),
      );
      const map: Record<string, CardData> = {};
      lineCodes.forEach((code, i) => {
        const powerResp = results[i * 2];
        const airResp = results[i * 2 + 1];
        map[code] = {
          powerTotal: (powerResp.data ?? []).reduce((s: number, d: any) => s + (Number(d.power) || 0), 0),
          airTotal: (airResp.data ?? []).reduce((s: number, d: any) => s + (Number(d.air) || 0), 0),
          powerSparkline: (powerResp.data ?? []).map((d: any) => Number(d.power) || 0),
          airSparkline: (airResp.data ?? []).map((d: any) => Number(d.air) || 0),
          hasAnomaly: ((powerResp.anomalies?.length ?? 0) > 0) || ((airResp.anomalies?.length ?? 0) > 0),
        };
      });
      return map;
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // ──────────────────────────────────────────────
  // Level 1: 설비 카드 데이터 (라인 선택 시 온디맨드)
  // ──────────────────────────────────────────────
  const selectedLineObj = lines.find(l => l.code === selectedLine);
  const facilitiesInLine: HierarchyFacility[] = selectedLineObj?.facilities ?? [];
  const facilityCodes = useMemo(() => facilitiesInLine.map(f => f.code), [facilitiesInLine]);

  const { data: facilityCardData, isLoading: facilityDataLoading } = useSWR(
    selectedLine && facilityCodes.length > 0
      ? `dsh002-facilities:${facilityCodes.join(',')}:${startTime}:${endTime}:${searchUnit}`
      : null,
    async () => {
      const results = await Promise.all(
        facilityCodes.flatMap(code => [
          fetchRangeData(code, startTime, endTime, searchUnit, 'power'),
          fetchRangeData(code, startTime, endTime, searchUnit, 'air'),
        ]),
      );
      const map: Record<string, CardData> = {};
      facilityCodes.forEach((code, i) => {
        const powerResp = results[i * 2];
        const airResp = results[i * 2 + 1];
        map[code] = {
          powerTotal: (powerResp.data ?? []).reduce((s: number, d: any) => s + (Number(d.power) || 0), 0),
          airTotal: (airResp.data ?? []).reduce((s: number, d: any) => s + (Number(d.air) || 0), 0),
          powerSparkline: (powerResp.data ?? []).map((d: any) => Number(d.power) || 0),
          airSparkline: (airResp.data ?? []).map((d: any) => Number(d.air) || 0),
          hasAnomaly: ((powerResp.anomalies?.length ?? 0) > 0) || ((airResp.anomalies?.length ?? 0) > 0),
        };
      });
      return map;
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // ──────────────────────────────────────────────
  // Level 2: 상세 패널 — 전력+에어 2차트 공통 훅
  // ──────────────────────────────────────────────
  const {
    power: dynamicPower,
    air: dynamicAir,
    handlePan: handlePanelPan,
    handleReset: handlePanelReset,
    powerSeries,
    airSeries,
  } = usePowerAirCharts({
    initialInterval: searchUnit,
    startTime,
    endTime,
    facilityId: selectedFacility ?? '',
    enabled: !!selectedFacility,
    zoomLevels,
  });

  // ─── 핸들러 ───
  const handleLineClick = useCallback((lineCode: string) => {
    setSelectedLine(lineCode);
    setSelectedFacility(null);
  }, []);

  const handleFacilityClick = useCallback((facilityCode: string) => {
    setSelectedFacility(facilityCode);
  }, []);

  const handleBackToLines = useCallback(() => {
    setSelectedLine(null);
    setSelectedFacility(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedFacility(null);
  }, []);

  const handleSearch = useCallback(() => {
    setSelectedLine(null);
    setSelectedFacility(null);
  }, []);


  // ─── 라벨 ───
  const selectedLineName = selectedLineObj?.name ?? selectedLine ?? '';
  const selectedFacilityObj = facilitiesInLine.find(f => f.code === selectedFacility);
  const panelSubtitle = selectedFacilityObj
    ? `${selectedLineName}라인 > ${selectedFacilityObj.process ?? selectedFacilityObj.type}`
    : '';

  const description = selectedLine
    ? `${selectedLineName}라인 설비 현황`
    : `${defaultFactory?.name ?? ''} 라인별 에너지 현황`;

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="설비별 추이" description={description} />

      {/* 필터바 */}
      <FilterBar
        filters={filters}
        onSearch={handleSearch}
        searchLabel="검색"
        className="mb-0"
      />

      {/* 브레드크럼 */}
      {selectedLine && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 -mt-2">
          <button
            type="button"
            onClick={handleBackToLines}
            className="hover:text-[#E94560] transition-colors cursor-pointer"
          >
            전체 라인
          </button>
          <ChevronRight size={12} />
          <span className="text-gray-700 dark:text-gray-200 font-medium">
            {selectedLineName}라인
          </span>
        </div>
      )}

      {/* 카드 그리드 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedLine === null ? (
          /* ─── Level 0: 라인 카드 ─── */
          <div
            key="line-cards"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            style={{ animation: 'fadeIn 200ms ease-out' }}
          >
            {lines.map(line => {
              const d = lineCardData?.[line.code];
              return (
                <EnergyCard
                  key={line.code}
                  title={`${line.name}라인`}
                  subtitle={`설비 ${line.facilities.length}대`}
                  powerTotal={d?.powerTotal ?? 0}
                  airTotal={d?.airTotal ?? 0}
                  powerSparkline={d?.powerSparkline ?? []}
                  airSparkline={d?.airSparkline ?? []}
                  hasAnomaly={d?.hasAnomaly}
                  onClick={() => handleLineClick(line.code)}
                  isLoading={lineDataLoading}
                />
              );
            })}
          </div>
        ) : (
          /* ─── Level 1: 설비 카드 ─── */
          <div
            key={`facility-cards-${selectedLine}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
            style={{ animation: 'fadeIn 200ms ease-out' }}
          >
            {facilitiesInLine.map(facility => {
              const d = facilityCardData?.[facility.code];
              return (
                <EnergyCard
                  key={facility.code}
                  title={facility.code}
                  subtitle={facility.name}
                  powerTotal={d?.powerTotal ?? 0}
                  airTotal={d?.airTotal ?? 0}
                  powerSparkline={d?.powerSparkline ?? []}
                  airSparkline={d?.airSparkline ?? []}
                  hasAnomaly={d?.hasAnomaly}
                  onClick={() => handleFacilityClick(facility.code)}
                  isSelected={selectedFacility === facility.code}
                  isLoading={facilityDataLoading}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Level 2: 상세 사이드 패널 ─── */}
      <DetailPanel
        isOpen={!!selectedFacility}
        onClose={handleClosePanel}
        title={selectedFacility ?? ''}
        subtitle={panelSubtitle}
      >
        <div className="flex flex-col gap-4">
          {/* 줌 네비게이션 */}
          <DynamicZoomBar
            isZoomed={dynamicPower.isZoomed}
            currentInterval={dynamicPower.currentInterval}
            zoomedTimeRange={dynamicPower.zoomedTimeRange}
            panState={dynamicPower.panState}
            onPan={handlePanelPan}
            onReset={handlePanelReset}
          />

          {/* 전력 차트 */}
          <div style={{ height: 300 }}>
            <ChartCard
              title="전력 사용량 (kWh)"
              subtitle={`해상도: ${formatInterval(dynamicPower.currentInterval)}`}
              chartId="dsh002-detail-power"
              exportData={dynamicPower.data}
              exportFilename={`설비추이_전력_${selectedFacility}_${exportDate}`}
              className="h-full"
              minHeight={0}
            >
              <TrendChart
                data={dynamicPower.data || []}
                series={powerSeries}
                xKey="time"
                yLabel="kWh"
                syncKey="dsh002-detail"
                showLegend
                onZoomChange={dynamicPower.handleZoom}
                isLoading={dynamicPower.isLoading}
                loadingMessage={`${formatInterval(dynamicPower.currentInterval)} 데이터 로딩 중...`}
                anomalies={dynamicPower.anomalies}
              />
            </ChartCard>
          </div>

          {/* 에어 차트 */}
          <div style={{ height: 300 }}>
            <ChartCard
              title="에어 사용량 (L)"
              subtitle={`해상도: ${formatInterval(dynamicAir.currentInterval)}`}
              chartId="dsh002-detail-air"
              exportData={dynamicAir.data}
              exportFilename={`설비추이_에어_${selectedFacility}_${exportDate}`}
              className="h-full"
              minHeight={0}
            >
              <TrendChart
                data={dynamicAir.data || []}
                series={airSeries}
                xKey="time"
                yLabel="L"
                syncKey="dsh002-detail"
                showLegend
                onZoomChange={undefined}
                isLoading={dynamicAir.isLoading}
                loadingMessage={`${formatInterval(dynamicAir.currentInterval)} 데이터 로딩 중...`}
              />
            </ChartCard>
          </div>
        </div>
      </DetailPanel>
    </div>
  );
}
