import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import FilterBar from '../../components/ui/FilterBar';
import TreeCheckbox from '../../components/ui/TreeCheckbox';
import TrendChart, { TrendSeries } from '../../components/charts/TrendChart';
import { getFacilityTree } from '../../services/analysis';
import { COLORS, SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { useDynamicResolution } from '../../hooks/useDynamicResolution';
import { formatInterval } from '../../lib/chart-utils';
import { useFacilityOptions } from '../../hooks/useFacilityOptions';
import type { Interval } from '../../types/chart';

const TODAY = new Date().toISOString().slice(0, 10);

const CHART_COLORS = [
  COLORS.energy.air, COLORS.chart.purple, COLORS.chart.orange, COLORS.chart.cyan,
];

// 설비 데이터를 불평형/역률로 변환
function toQualityData(raw: { time: string; current: number }[]) {
  return raw.map((pt) => ({
    time: pt.time,
    imbalance: Math.max(0, Math.min(10, (pt.current / 30) * 8 + Math.sin(parseInt(pt.time) * 0.5) * 1.2)),
    powerFactor: Math.min(100, Math.max(82, 95 - (pt.current / 30) * 5 + Math.cos(parseInt(pt.time) * 0.3) * 2)),
  }));
}

export default function ANL005PowerQualityAnalysis() {
  const { options: facilityOptions } = useFacilityOptions();
  const [date, setDate] = useState(TODAY);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['plant', 'block']));
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // API에서 설비 목록 로드 시 기본 선택값 설정 (최대 2개)
  useEffect(() => {
    if (facilityOptions.length > 0 && !defaultsApplied) {
      const defaults = facilityOptions.slice(0, 2).map(o => o.value);
      setSelectedIds(new Set(defaults));
      setDefaultsApplied(true);
    }
  }, [facilityOptions, defaultsApplied]);

  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-005'] || '15m') as Interval;
  const { data: tree } = useQuery({ queryKey: ['anl-facility-tree'], queryFn: getFacilityTree });

  // 선택된 설비 (최대 4개)
  const leafIds = Array.from(selectedIds).filter((id) => !['plant', 'block', 'head', 'crank', 'assembly'].includes(id));
  const maxSelected = leafIds.slice(0, 4);

  const startTime = useMemo(() => `${date}T00:00:00+09:00`, [date]);
  const endTime = useMemo(() => `${date}T23:59:59+09:00`, [date]);

  // 고정 배열로 Hook 호출 (Rules of Hooks 준수, 최대 4개)
  const dynamicQuery0 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: maxSelected[0] || '',
    metric: 'power',
    enabled: !!maxSelected[0],
    maxDepth: SCREEN_MAX_DEPTH['ANL-005'],
  });
  const dynamicQuery1 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: maxSelected[1] || '',
    metric: 'power',
    enabled: !!maxSelected[1],
    maxDepth: SCREEN_MAX_DEPTH['ANL-005'],
  });
  const dynamicQuery2 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: maxSelected[2] || '',
    metric: 'power',
    enabled: !!maxSelected[2],
    maxDepth: SCREEN_MAX_DEPTH['ANL-005'],
  });
  const dynamicQuery3 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: maxSelected[3] || '',
    metric: 'power',
    enabled: !!maxSelected[3],
    maxDepth: SCREEN_MAX_DEPTH['ANL-005'],
  });

  const dynamicQueries = [dynamicQuery0, dynamicQuery1, dynamicQuery2, dynamicQuery3];
  const currentInterval = dynamicQueries[0]?.currentInterval ?? initialInterval;
  const anyLoading = dynamicQueries.some(q => q.isLoading);

  // 데이터 병합
  const { imbalanceData, powerFactorData } = useMemo(() => {
    const baseData = dynamicQueries[0]?.data ?? [];
    const imb = baseData.map((pt: any, i: number) => {
      const row: Record<string, number | string> = { time: pt.time };
      maxSelected.forEach((id, idx) => {
        const raw = dynamicQueries[idx]?.data?.map((d: any) => ({ time: d.time, current: d.power ?? 0 })) ?? [];
        if (raw.length > 0) {
          const q = toQualityData(raw);
          row[id + '_imb'] = q[i]?.imbalance ?? 0;
        }
      });
      return row;
    });
    const pf = baseData.map((pt: any, i: number) => {
      const row: Record<string, number | string> = { time: pt.time };
      maxSelected.forEach((id, idx) => {
        const raw = dynamicQueries[idx]?.data?.map((d: any) => ({ time: d.time, current: d.power ?? 0 })) ?? [];
        if (raw.length > 0) {
          const q = toQualityData(raw);
          row[id + '_pf'] = q[i]?.powerFactor ?? 0;
        }
      });
      return row;
    });
    return { imbalanceData: imb, powerFactorData: pf };
  }, [dynamicQueries, maxSelected]);

  // KPI: 첫 번째 선택 설비 기준
  const firstQuality = useMemo(() => {
    const raw = dynamicQueries[0]?.data?.map((d: any) => ({ time: d.time, current: d.power ?? 0 })) ?? [];
    return raw.length > 0 ? toQualityData(raw) : [];
  }, [dynamicQueries]);

  const avgImbalance = firstQuality.length ? firstQuality.reduce((s, p) => s + p.imbalance, 0) / firstQuality.length : 0;
  const avgPf = firstQuality.length ? firstQuality.reduce((s, p) => s + p.powerFactor, 0) / firstQuality.length : 0;
  const maxImbalance = firstQuality.length ? Math.max(...firstQuality.map((p) => p.imbalance)) : 0;
  const abnormalCount = firstQuality.filter((p) => p.imbalance > 5 || p.powerFactor < 90).length;

  // 불평형률 차트 series
  const imbalanceSeries: TrendSeries[] = useMemo(
    () => maxSelected.map((id, idx) => ({
      key: `${id}_imb`,
      label: id,
      color: CHART_COLORS[idx],
      type: 'line' as const,
      width: 1.5,
    })),
    [maxSelected]
  );

  // 역률 차트 series
  const powerFactorSeries: TrendSeries[] = useMemo(
    () => maxSelected.map((id, idx) => ({
      key: `${id}_pf`,
      label: id,
      color: CHART_COLORS[idx],
      type: 'line' as const,
      width: 1.5,
    })),
    [maxSelected]
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="전력 품질 분석"
        description={`설비별 불평형률 / 역률 분석 | 해상도: ${formatInterval(currentInterval)}`}
      />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="평균 불평형률" value={avgImbalance.toFixed(2)} unit="%" inverseChange />
        <KpiCard label="최대 불평형률" value={maxImbalance.toFixed(2)} unit="%" inverseChange />
        <KpiCard label="평균 역률" value={avgPf.toFixed(1)} unit="%" />
        <KpiCard label="기준 초과 시간" value={abnormalCount} unit="회" inverseChange />
      </div>

      <div className="flex items-center gap-3">
        <FilterBar
          filters={[{ type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate }]}
          className="mb-0 flex-1"
        />
        <DynamicZoomBar
          isZoomed={dynamicQueries[0]?.isZoomed ?? false}
          currentInterval={currentInterval}
          zoomedTimeRange={dynamicQueries[0]?.zoomedTimeRange ?? null}
          panState={dynamicQueries[0]?.panState ?? { canLeft: false, canRight: false }}
          onPan={(dir) => dynamicQueries.forEach(q => q.handlePan(dir))}
          onReset={() => dynamicQueries.forEach(q => q.reset())}
        />
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 설비 트리 */}
        <div className="w-52 flex-shrink-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">설비 선택 (최대 4개)</div>
            <div className="text-xs text-gray-400 mt-0.5">{maxSelected.length}/4 선택됨</div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {tree && (
              <TreeCheckbox
                nodes={tree}
                checked={selectedIds}
                onCheckedChange={(next) => {
                  const leafIds = Array.from(next).filter((id) => !['plant', 'block', 'head', 'crank', 'assembly'].includes(id));
                  if (leafIds.length <= 4) setSelectedIds(next);
                }}
                expanded={expanded}
                onExpandedChange={setExpanded}
              />
            )}
          </div>
          {/* 선택된 설비 범례 */}
          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5 flex-shrink-0">
            {maxSelected.map((id, idx) => (
              <div key={id} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[idx] }} />
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 차트 2개 */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* 불평형률 */}
          <ChartCard
            title="전압 불평형률 (%)"
            subtitle="임계: 5% (IEC 기준)"
            className="flex-1 min-h-0"
            chartId="anl005-imbalance"
            exportData={imbalanceData}
            exportFilename="전력품질_불평형률"
            minHeight={0}
          >
            {imbalanceData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {anyLoading ? '데이터 로딩 중...' : '설비를 선택하세요'}
              </div>
            ) : (
              <TrendChart
                data={imbalanceData}
                series={imbalanceSeries}
                xKey="time"
                yLabel="%"
                syncKey="anl005"
                showLegend={true}
                onZoomChange={dynamicQueries[0] ? dynamicQueries[0].handleZoom : undefined}
                isLoading={anyLoading}
                loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
                anomalies={dynamicQueries[0] ? dynamicQueries[0].anomalies : undefined}
              />
            )}
          </ChartCard>

          {/* 역률 */}
          <ChartCard
            title="역률 (%)"
            subtitle="기준: 90% 이상 유지"
            className="flex-1 min-h-0"
            chartId="anl005-pf"
            exportData={powerFactorData}
            exportFilename="전력품질_역률"
            minHeight={0}
          >
            {powerFactorData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {anyLoading ? '데이터 로딩 중...' : '설비를 선택하세요'}
              </div>
            ) : (
              <TrendChart
                data={powerFactorData}
                series={powerFactorSeries}
                xKey="time"
                yLabel="%"
                syncKey="anl005"
                showLegend={true}
                onZoomChange={dynamicQueries[0] ? dynamicQueries[0].handleZoom : undefined}
                isLoading={anyLoading}
                loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
              />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
