import { useState, useMemo, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import TrendChart from '../../components/charts/TrendChart';
import { COLORS, SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { comparisonOverlaySeries, comparisonDiffSeries } from '../../lib/chart-series';
import { useDynamicResolution } from '../../hooks/useDynamicResolution';
import { formatInterval } from '../../lib/chart-utils';
import { useFacilityOptions } from '../../hooks/useFacilityOptions';
import type { Interval } from '../../types/chart';

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

type DiffRow = { time: string; timestamp: string; origin: number; compare: number; diff: number };

export default function ANL002DetailedComparison() {
  const { options: facilityOptions, defaultFacilityId } = useFacilityOptions();
  const [cond1Facility, setCond1Facility] = useState('');
  const [cond1Date, setCond1Date] = useState(TODAY);
  const [cond2Facility, setCond2Facility] = useState('');
  const [cond2Date, setCond2Date] = useState(YESTERDAY);

  // API에서 설비 목록 로드 시 기본값 설정
  useEffect(() => {
    if (defaultFacilityId && !cond1Facility) setCond1Facility(defaultFacilityId);
    if (defaultFacilityId && !cond2Facility) setCond2Facility(defaultFacilityId);
  }, [defaultFacilityId, cond1Facility, cond2Facility]);

  const [searched, setSearched] = useState(false);
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-002'] || '15m') as Interval;

  // ISO8601 시간 변환 (KST 기준)
  const cond1StartTime = useMemo(() => `${cond1Date}T00:00:00+09:00`, [cond1Date]);
  const cond1EndTime = useMemo(() => `${cond1Date}T23:59:59+09:00`, [cond1Date]);
  const cond2StartTime = useMemo(() => `${cond2Date}T00:00:00+09:00`, [cond2Date]);
  const cond2EndTime = useMemo(() => `${cond2Date}T23:59:59+09:00`, [cond2Date]);

  // 동적 해상도 훅 (조건 1)
  const dynamicCond1 = useDynamicResolution({
    initialInterval,
    startTime: cond1StartTime,
    endTime: cond1EndTime,
    facilityId: cond1Facility,
    metric: 'power',
    enabled: searched,
    maxDepth: SCREEN_MAX_DEPTH['ANL-002'],
  });

  // 동적 해상도 훅 (조건 2)
  const dynamicCond2 = useDynamicResolution({
    initialInterval,
    startTime: cond2StartTime,
    endTime: cond2EndTime,
    facilityId: cond2Facility,
    metric: 'power',
    enabled: searched,
    maxDepth: SCREEN_MAX_DEPTH['ANL-002'],
  });

  const originData = dynamicCond1.data ?? [];
  const compareData = dynamicCond2.data ?? [];

  // 오버레이 데이터 병합
  const overlayData = useMemo(() => {
    const maxLength = Math.max(originData.length, compareData.length);
    return Array.from({ length: maxLength }, (_, i) => ({
      time: originData[i]?.time || compareData[i]?.time || `${i}`,
      timestamp: originData[i]?.timestamp || compareData[i]?.timestamp || new Date().toISOString(),
      origin: originData[i]?.power ?? 0,
      compare: compareData[i]?.power ?? 0,
      diff: (originData[i]?.power ?? 0) - (compareData[i]?.power ?? 0),
    }));
  }, [originData, compareData]);

  const rows: DiffRow[] = overlayData;
  const maxDiff = rows.length ? Math.max(...rows.map((r) => Math.abs(r.diff))) : 0;
  const isLoading = dynamicCond1.isLoading || dynamicCond2.isLoading;
  const currentInterval = dynamicCond1.currentInterval;

  const handleSearch = () => setSearched(true);

  // 차트 series 설정
  const overlaySeries = useMemo(() => comparisonOverlaySeries(cond1Facility, cond2Facility), [cond1Facility, cond2Facility]);
  const diffSeries = useMemo(() => comparisonDiffSeries(), []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="상세 비교 분석"
        description={`두 조건 비교 | 해상도: ${formatInterval(currentInterval)}`}
      />

      {/* 조건 패널 */}
      <div className="flex gap-3 flex-shrink-0">
        {/* 조건 1 */}
        <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">조건 1 (기준)</div>
          <div className="flex gap-2 items-center">
            <select
              value={cond1Facility}
              onChange={(e) => setCond1Facility(e.target.value)}
              className="flex-1 text-sm bg-white dark:bg-[#16213E] border border-amber-300 dark:border-amber-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="date"
              value={cond1Date}
              onChange={(e) => setCond1Date(e.target.value)}
              className="text-sm bg-white dark:bg-[#16213E] border border-amber-300 dark:border-amber-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* 조건 2 */}
        <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <div className="text-sm font-bold text-[#E94560] dark:text-[#E94560] mb-2">조건 2 (비교)</div>
          <div className="flex gap-2 items-center">
            <select
              value={cond2Facility}
              onChange={(e) => setCond2Facility(e.target.value)}
              className="flex-1 text-sm bg-white dark:bg-[#16213E] border border-[#E94560] dark:border-[#E94560] rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="date"
              value={cond2Date}
              onChange={(e) => setCond2Date(e.target.value)}
              className="text-sm bg-white dark:bg-[#16213E] border border-[#E94560] dark:border-[#E94560] rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* 줌 네비게이션 */}
        <DynamicZoomBar
          isZoomed={dynamicCond1.isZoomed}
          currentInterval={dynamicCond1.currentInterval}
          zoomedTimeRange={dynamicCond1.zoomedTimeRange}
          panState={dynamicCond1.panState}
          onPan={(dir) => { dynamicCond1.handlePan(dir); dynamicCond2.handlePan(dir); }}
          onReset={() => { dynamicCond1.reset(); dynamicCond2.reset(); }}
        />

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-6 py-2 bg-[#27AE60] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 self-end flex-shrink-0"
        >
          {isLoading ? '분석 중...' : '분석'}
        </button>
      </div>

      {/* 차트 영역 */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {/* 오버레이 차트 */}
        <ChartCard
          title="에너지 오버레이 비교"
          subtitle={`조건1(노란) / 조건2(파란) | 해상도: ${formatInterval(currentInterval)}`}
          className="flex-1 min-h-0"
          chartId="anl002-overlay"
          exportData={rows}
          exportFilename="상세비교분석_오버레이"
          minHeight={0}
        >
          {!searched ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              조건을 설정하고 [분석] 버튼을 클릭하세요
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
            </div>
          ) : (
            <TrendChart
              data={rows}
              series={overlaySeries}
              xKey="time"
              yLabel="kWh"
              syncKey="anl002"
              showLegend={true}
              onZoomChange={dynamicCond1.handleZoom}
              isLoading={isLoading}
              loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
              anomalies={dynamicCond1.anomalies}
            />
          )}
        </ChartCard>

        {/* 차이 차트 */}
        <ChartCard
          title="에너지 차이 분석"
          subtitle={`조건1 - 조건2 | 해상도: ${formatInterval(currentInterval)}`}
          className="flex-1 min-h-0"
          chartId="anl002-diff"
          exportData={rows}
          exportFilename="상세비교분석_차이"
          minHeight={0}
        >
          {!searched ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              조건을 설정하고 [분석] 버튼을 클릭하세요
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
            </div>
          ) : (
            <TrendChart
              data={rows}
              series={diffSeries}
              xKey="time"
              yLabel="차이(kWh)"
              syncKey="anl002"
              showLegend={true}
              onZoomChange={undefined}
              isLoading={isLoading}
              loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
            />
          )}
        </ChartCard>
      </div>

      {/* 통계 요약 */}
      {rows.length > 0 && (
        <div className="flex gap-3 flex-shrink-0">
          {[
            { label: '조건1 합계', value: `${rows.reduce((s, r) => s + r.origin, 0).toFixed(1)} kWh`, color: COLORS.energy.power },
            { label: '조건2 합계', value: `${rows.reduce((s, r) => s + r.compare, 0).toFixed(1)} kWh`, color: COLORS.energy.air },
            { label: '평균 차이', value: `${(rows.reduce((s, r) => s + r.diff, 0) / rows.length).toFixed(2)} kWh`, color: COLORS.chart.purple },
            { label: '최대 차이', value: `${maxDiff.toFixed(2)} kWh`, color: COLORS.danger },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
              <div className="text-xs text-gray-400">{s.label}</div>
              <div className="text-lg font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
