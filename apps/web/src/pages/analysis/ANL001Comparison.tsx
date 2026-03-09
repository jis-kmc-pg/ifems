import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import TreeCheckbox from '../../components/ui/TreeCheckbox';
import FilterBar from '../../components/ui/FilterBar';
import TrendChart from '../../components/charts/TrendChart';
import { getFacilityTree } from '../../services/analysis';
import { SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { facilityComparisonSeries, FACILITY_COLORS } from '../../lib/chart-series';
import { ENERGY_TYPE_BACKEND_OPTIONS as TYPE_OPTIONS } from '../../lib/filter-options';
import { useDynamicResolution } from '../../hooks/useDynamicResolution';
import { formatInterval } from '../../lib/chart-utils';
import { useFacilityOptions } from '../../hooks/useFacilityOptions';
import type { Interval } from '../../types/chart';

const TODAY = new Date().toISOString().slice(0, 10);

export default function ANL001Comparison() {
  const { options: facilityOptions } = useFacilityOptions();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['plant', 'block']));
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // API에서 설비 목록 로드 시 기본 선택값 설정 (최대 2개)
  useEffect(() => {
    if (facilityOptions.length > 0 && !defaultsApplied) {
      const defaults = facilityOptions.slice(0, 2).map(o => o.value);
      setChecked(new Set(defaults));
      setDefaultsApplied(true);
    }
  }, [facilityOptions, defaultsApplied]);

  const [type, setType] = useState<'elec' | 'air'>('elec');
  const [date, setDate] = useState(TODAY);

  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-001'] || '15m') as Interval;

  const { data: tree } = useQuery({ queryKey: ['anl-tree'], queryFn: getFacilityTree });

  // 선택된 설비 ID (leaf만)
  const facilityIds = Array.from(checked).filter((id) => !['plant', 'block', 'head', 'crank', 'assembly'].includes(id));

  const startTime = useMemo(() => `${date}T00:00:00+09:00`, [date]);
  const endTime = useMemo(() => `${date}T23:59:59+09:00`, [date]);

  // 고정 배열로 Hook 호출 (Rules of Hooks 준수, 최대 6개)
  const dynamicQuery0 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[0] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[0],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });
  const dynamicQuery1 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[1] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[1],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });
  const dynamicQuery2 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[2] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[2],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });
  const dynamicQuery3 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[3] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[3],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });
  const dynamicQuery4 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[4] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[4],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });
  const dynamicQuery5 = useDynamicResolution({
    initialInterval, startTime, endTime,
    facilityId: facilityIds[5] || '',
    metric: type === 'elec' ? 'power' : 'air',
    enabled: !!facilityIds[5],
    maxDepth: SCREEN_MAX_DEPTH['ANL-001'],
  });

  const dynamicQueries = [dynamicQuery0, dynamicQuery1, dynamicQuery2, dynamicQuery3, dynamicQuery4, dynamicQuery5];
  const currentInterval = dynamicQueries[0]?.currentInterval ?? initialInterval;
  const anyLoading = dynamicQueries.some(q => q.isLoading);

  // 시간대 기준으로 데이터 병합 — API는 metric에 따라 { power } 또는 { air } 키 반환
  const metricKey = type === 'elec' ? 'power' : 'air';
  const chartData = useMemo(() => {
    const baseData = dynamicQueries[0]?.data ?? [];
    return baseData.map((pt: any, i: number) => {
      const row: Record<string, string | number> = { time: pt.time };
      facilityIds.forEach((id, idx) => {
        row[id] = dynamicQueries[idx]?.data?.[i]?.[metricKey] ?? 0;
      });
      return row;
    });
  }, [dynamicQueries, facilityIds, metricKey]);

  // TrendChart series 설정
  const series = useMemo(() => facilityComparisonSeries(facilityIds, 'area', 0.15), [facilityIds]);
  const unit = type === 'elec' ? 'kWh' : 'L';

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="비교 분석"
        description={`설비 비교 | 해상도: ${formatInterval(currentInterval)}`}
      />

      <div className="flex items-center gap-3">
        <FilterBar
          filters={[
            { type: 'select', key: 'type', label: '에너지 구분', value: type, onChange: (v) => setType(v as 'elec' | 'air'), options: TYPE_OPTIONS },
            { type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate },
          ]}
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
        {/* 설비 트리 (좌) */}
        <div className="w-52 flex-shrink-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">설비 선택</div>
            <div className="text-xs text-gray-400 mt-0.5">{facilityIds.length}개 선택됨 (최대 6)</div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <TreeCheckbox
              nodes={tree ?? []}
              checked={checked}
              onCheckedChange={(next) => {
                const leafIds = Array.from(next).filter((id) => !['plant', 'block', 'head', 'crank', 'assembly'].includes(id));
                if (leafIds.length <= 6) setChecked(next);
              }}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          </div>
        </div>

        {/* 차트 영역 (우) */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <ChartCard
            title={`설비별 시간대별 ${type === 'elec' ? '전력(kWh)' : '에어(L)'} 비교`}
            subtitle={`${date} — ${facilityIds.length}개 설비`}
            className="flex-1 min-h-0"
            chartId="anl001-chart"
            exportData={chartData}
            exportFilename="비교분석"
            minHeight={0}
          >
            {facilityIds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                좌측 트리에서 설비를 선택하세요 (1~6개)
              </div>
            ) : (
              <TrendChart
                data={chartData}
                series={series}
                xKey="time"
                yLabel={unit}
                syncKey="anl001"
                showLegend={true}
                onZoomChange={dynamicQueries[0] ? dynamicQueries[0].handleZoom : undefined}
                isLoading={anyLoading}
                loadingMessage={`${formatInterval(currentInterval)} 데이터 로딩 중...`}
                anomalies={dynamicQueries[0] ? dynamicQueries[0].anomalies : undefined}
              />
            )}
          </ChartCard>

          {/* 선택 설비 요약 카드 */}
          {facilityIds.length > 0 && (
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              {facilityIds.map((id, idx) => {
                const vals = dynamicQueries[idx]?.data?.map((d: any) => d[metricKey] ?? 0) ?? [];
                const total = vals.reduce((s: number, v: number) => s + v, 0);
                return (
                  <div key={id} className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center gap-2 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FACILITY_COLORS[idx % FACILITY_COLORS.length] }} />
                    <div>
                      <div className="text-xs font-bold text-gray-800 dark:text-white">{id}</div>
                      <div className="text-xs text-gray-400">
                        합계: {type === 'elec' ? `${total.toFixed(1)} kWh` : `${(total / 1000).toFixed(0)} KL`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
