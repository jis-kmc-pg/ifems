import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import DynamicZoomBar from '../../components/ui/DynamicZoomBar';
import CollapsibleTreePanel from '../../components/ui/CollapsibleTreePanel';
import TrendChart from '../../components/charts/TrendChart';
import type { TrendSeries } from '../../components/charts/TrendChart';
import { FACILITY_COLORS } from '../../lib/chart-series';
import { getIntervalForZoomRatio, formatInterval } from '../../lib/chart-utils';

import { getFacilityTree, getFacilityTrendData, getFacilityTagCounts } from '../../services/analysis';
import type { Interval } from '../../types/chart';

const TODAY = new Date().toISOString().slice(0, 10);
const MAX_FACILITIES = 6;
const GROUP_IDS = ['plant', 'block', 'head', 'crank', 'assembly'];

type TagInfo = { tagName: string; displayName: string; energyType: string; unit: string };
type TrendResult = { tags: TagInfo[]; data: Record<string, any>[] };

/** HH:mm:ss 줌 범위를 특정 날짜의 ISO로 변환 (쿼리용) */
function timeRangeToIso(range: { start: string; end: string } | null, date: string) {
  if (!range) return { start: `${date}T00:00:00+09:00`, end: `${date}T23:59:59+09:00` };
  return { start: `${date}T${range.start}+09:00`, end: `${date}T${range.end}+09:00` };
}

export default function ANL006AirDetailedComparison() {
  // ── 트리 상태 ──
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['plant', 'block']));
  const { data: tree } = useQuery({ queryKey: ['anl-tree'], queryFn: getFacilityTree });
  const { data: tagCountMap } = useQuery({
    queryKey: ['anl006-tag-counts'],
    queryFn: () => getFacilityTagCounts('air'),
  });
  const facilityIds = Array.from(checked).filter(id => !GROUP_IDS.includes(id));

  // ── 설비별 날짜 상태 ──
  const [facilityDates, setFacilityDates] = useState<Record<string, string>>({});
  const getDate = (fid: string) => facilityDates[fid] ?? TODAY;
  const setDate = (fid: string, date: string) => setFacilityDates(prev => ({ ...prev, [fid]: date }));

  // ── 줌 상태 ──
  const initialInterval: Interval = '10s';
  const zoomLevels: Interval[] = ['10s', '1s'];
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);
  const [zoomedTimeRange, setZoomedTimeRange] = useState<{ start: string; end: string } | null>(null);

  // ── 6개 고정 쿼리 (Rules of Hooks 준수) ──
  const r0 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[0] ?? ''));
  const r1 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[1] ?? ''));
  const r2 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[2] ?? ''));
  const r3 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[3] ?? ''));
  const r4 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[4] ?? ''));
  const r5 = timeRangeToIso(zoomedTimeRange, getDate(facilityIds[5] ?? ''));

  const q0 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[0], r0.start, r0.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[0]!, r0.start, r0.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[0],
  });
  const q1 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[1], r1.start, r1.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[1]!, r1.start, r1.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[1],
  });
  const q2 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[2], r2.start, r2.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[2]!, r2.start, r2.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[2],
  });
  const q3 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[3], r3.start, r3.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[3]!, r3.start, r3.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[3],
  });
  const q4 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[4], r4.start, r4.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[4]!, r4.start, r4.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[4],
  });
  const q5 = useQuery<TrendResult>({
    queryKey: ['anl006', facilityIds[5], r5.start, r5.end, currentInterval],
    queryFn: () => getFacilityTrendData(facilityIds[5]!, r5.start, r5.end, currentInterval as '10s' | '1s', 'air') as Promise<TrendResult>,
    enabled: !!facilityIds[5],
  });

  const queries = [q0, q1, q2, q3, q4, q5];
  const anyLoading = queries.some(q => q.isLoading || q.isFetching);

  // ── 데이터 병합 + 시리즈 생성 ──
  const { chartData, chartSeries, facilityTags } = useMemo(() => {
    const timeMap = new Map<string, Record<string, any>>();
    const allSeries: TrendSeries[] = [];
    const allFacilityTags: Record<string, TagInfo[]> = {};
    let colorIdx = 0;

    facilityIds.forEach((fid, qIdx) => {
      const result = queries[qIdx]?.data;
      if (!result) return;

      const tags: TagInfo[] = result.tags ?? [];
      allFacilityTags[fid] = tags;

      const facilityColor = FACILITY_COLORS[qIdx % FACILITY_COLORS.length];

      tags.forEach(tag => {
        allSeries.push({
          key: `${fid}_${tag.tagName}`,
          label: `${fid} - ${tag.displayName} (${tag.unit})`,
          color: facilityColor,
          type: 'line' as const,
          width: 2,
        });
        colorIdx++;
      });

      const data: Record<string, any>[] = result.data ?? [];
      data.forEach((pt: any) => {
        if (!timeMap.has(pt.time)) {
          timeMap.set(pt.time, { time: pt.time, timestamp: pt.timestamp });
        }
        const row = timeMap.get(pt.time)!;
        tags.forEach(tag => {
          if (pt[tag.tagName] !== undefined) {
            row[`${fid}_${tag.tagName}`] = pt[tag.tagName];
          }
        });
      });
    });

    const sorted = Array.from(timeMap.values()).sort((a, b) =>
      (a.timestamp || a.time).localeCompare(b.timestamp || b.time)
    );

    return { chartData: sorted, chartSeries: allSeries, facilityTags: allFacilityTags };
  }, [queries.map(q => q.data), facilityIds]);

  // ── 줌 핸들러 ──
  const isZoomingRef = useRef(false);
  const intervalChangedRef = useRef(false);

  // zoomedTimeRange는 "HH:mm:ss" 형식으로 저장 (xLabels와 동일)
  const handleZoomRaw = useCallback((zoomRatio: number, timeRange?: { start: string; end: string }) => {
    if (isZoomingRef.current) return;
    if (intervalChangedRef.current && zoomRatio >= 0.95) {
      intervalChangedRef.current = false;
      return;
    }
    isZoomingRef.current = true;
    try {
      if (timeRange) {
        const toHms = (s: string) => s.includes('T') ? s.slice(11, 19) : s;
        const start = toHms(timeRange.start);
        const end = toHms(timeRange.end);
        if (start < end) setZoomedTimeRange({ start, end });
      }
      const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval, 2, zoomLevels);
      if (newInterval !== currentInterval) {
        setCurrentInterval(newInterval);
        intervalChangedRef.current = true;
      }
    } finally {
      isZoomingRef.current = false;
    }
  }, [currentInterval]);

  const handleZoom = useMemo(() => debounce(handleZoomRaw, 500), [handleZoomRaw]);

  // ── 팬 핸들러 (HH:mm:ss 기반 초 단위 연산) ──
  const handlePan = useCallback((direction: 'left' | 'right') => {
    if (!zoomedTimeRange) return;
    const toSec = (hms: string) => {
      const [h, m, s] = hms.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };
    const toHms = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    const startSec = toSec(zoomedTimeRange.start);
    const endSec = toSec(zoomedTimeRange.end);
    const span = endSec - startSec;

    if (span <= 0) return; // 역전된 범위 방지
    let ns: number, ne: number;
    if (direction === 'left') { ns = Math.max(0, startSec - span); ne = ns + span; }
    else { ne = Math.min(86399, endSec + span); ns = Math.max(0, ne - span); }

    if (ns < ne) setZoomedTimeRange({ start: toHms(ns), end: toHms(ne) });
  }, [zoomedTimeRange]);

  const panState = useMemo(() => {
    if (!zoomedTimeRange) return { canLeft: false, canRight: false };
    const toSec = (hms: string) => {
      const [h, m, s] = hms.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };
    return { canLeft: toSec(zoomedTimeRange.start) > 0, canRight: toSec(zoomedTimeRange.end) < 86399 };
  }, [zoomedTimeRange]);

  const isZoomed = currentInterval !== initialInterval || zoomedTimeRange !== null;
  const reset = useCallback(() => { setCurrentInterval(initialInterval); setZoomedTimeRange(null); }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="에어 상세 비교"
        description={`설비별 에어 순시값 트렌드 비교 | 해상도: ${formatInterval(currentInterval)}`}
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* ── 설비 트리 (좌) ── */}
        <CollapsibleTreePanel
          nodes={tree ?? []}
          checked={checked}
          onCheckedChange={(next) => {
            const leafIds = Array.from(next).filter(id => !GROUP_IDS.includes(id));
            if (leafIds.length <= MAX_FACILITIES) setChecked(next);
          }}
          expanded={expanded}
          onExpandedChange={setExpanded}
          badgeMap={(tagCountMap ?? {}) as Record<string, number>}
          facilityCount={facilityIds.length}
          maxFacilities={MAX_FACILITIES}
        />

        {/* ── 메인 콘텐츠 (우) ── */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {facilityIds.length === 0 ? (
            <div className="flex-shrink-0 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg px-6 py-4 flex items-center justify-center">
              <span className="text-sm text-gray-400 dark:text-gray-500">좌측 트리에서 비교할 설비를 선택해 주세요</span>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              {facilityIds.map((fid, idx) => {
                const tags = facilityTags[fid] ?? [];
                const color = FACILITY_COLORS[idx % FACILITY_COLORS.length];
                return (
                  <div
                    key={fid}
                    className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 shadow-sm min-w-[180px]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-bold text-gray-800 dark:text-white flex-1">{fid}</span>
                      <button
                        onClick={() => setChecked(prev => { const next = new Set(prev); next.delete(fid); return next; })}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        title="설비 제거"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>
                      </button>
                    </div>
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {tags.map(tag => (
                          <span
                            key={tag.tagName}
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          >
                            {tag.displayName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 mb-1.5">
                        {queries[idx]?.isLoading ? '태그 로딩...' : '태그 없음'}
                      </div>
                    )}
                    <input
                      type="date"
                      value={getDate(fid)}
                      onChange={(e) => setDate(fid, e.target.value)}
                      className="w-full text-xs bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <ChartCard
            title={facilityIds.length === 0 ? '에어 순시값 트렌드' : `에어 순시값 트렌드 (${facilityIds.length}개 설비)`}
            subtitle={`해상도: ${formatInterval(currentInterval)}`}
            className="flex-1 min-h-0"
            chartId="anl006-chart"
            exportData={chartData}
            exportFilename="에어상세비교"
            minHeight={0}
            actions={
              <DynamicZoomBar
                isZoomed={isZoomed}
                currentInterval={currentInterval}
                zoomedTimeRange={zoomedTimeRange}
                panState={panState}
                onPan={handlePan}
                onReset={reset}
              />
            }
          >
            {facilityIds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                좌측 트리에서 설비를 선택하세요 (1~{MAX_FACILITIES}개)
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {anyLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
              </div>
            ) : (
              <TrendChart
                data={chartData}
                series={chartSeries}
                xKey="time"
                yLabel="순시값(m³/min)"
                syncKey="anl006"
                showLegend={true}
                onZoomChange={handleZoom}
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
