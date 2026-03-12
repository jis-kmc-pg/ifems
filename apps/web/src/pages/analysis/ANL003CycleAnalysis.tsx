import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import { Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import CyclePickerModal from '../../components/ui/CyclePickerModal';
import TrendChart from '../../components/charts/TrendChart';
import type { TrendSeries } from '../../components/charts/TrendChart';
import { FACILITY_COLORS } from '../../lib/chart-series';
import { getFacilityTrendData, getCyclesInRange } from '../../services/analysis';
import type { CycleRangeItem } from '../../services/analysis';

// ── 상수 ──
const MAX_SERIES = 4;

// ── 타입 ──
interface SeriesEntry {
  id: string;
  facilityId: string;
  facilityLabel: string;
  cycle: CycleRangeItem;
  shiftSec: number;
  shiftStep: 1 | 10;
}

type TagInfo = { tagName: string; displayName: string; energyType: string; unit: string };
type TrendResult = { tags: TagInfo[]; data: Record<string, any>[] };

let _idCounter = 0;
function genId() { return `s${++_idCounter}_${Date.now()}`; }

/** ISO → HH:mm:ss */
function isoToHms(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** ISO → MM-DD */
function isoToMd(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO → YYYY-MM-DD (로컬 타임존 기준) */
function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO → absolute seconds of day */
function isoToAbsSec(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/** 초를 0:mm:ss 형식으로 */
function secToElapsed(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `0:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** 데이터 병합 공통 함수 */
function mergeChartData(
  seriesList: SeriesEntry[],
  queryResults: (TrendResult | undefined)[],
  viewRange: { startSec: number; endSec: number } | null,
): { chartData: Record<string, any>[]; chartSeries: TrendSeries[] } {
  const elapsedMap = new Map<number, Record<string, any>>();
  const allSeries: TrendSeries[] = [];

  seriesList.forEach((entry, sIdx) => {
    const result = queryResults[sIdx];
    if (!result) return;

    const tags: TagInfo[] = result.tags ?? [];
    const color = FACILITY_COLORS[sIdx % FACILITY_COLORS.length];
    const cycleStartSec = isoToAbsSec(entry.cycle.startTime);

    tags.forEach(tag => {
      allSeries.push({
        key: `${entry.id}_${tag.tagName}`,
        label: `S${sIdx + 1}: ${entry.facilityLabel} #${entry.cycle.cycleNumber} (${isoToMd(entry.cycle.startTime)} ${isoToHms(entry.cycle.startTime)})`,
        color,
        type: 'line' as const,
        width: 2,
      });
    });

    const data: Record<string, any>[] = result.data ?? [];

    data.forEach((pt: any) => {
      const time: string = pt.time ?? '';
      const [hh, mm, ss] = time.split(':').map(Number);
      if (isNaN(hh)) return;
      const absSec = hh * 3600 + mm * 60 + ss;
      const elapsedSec = absSec - cycleStartSec + entry.shiftSec;

      if (elapsedSec < -60 || elapsedSec > entry.cycle.duration + 60) return;

      if (!elapsedMap.has(elapsedSec)) {
        elapsedMap.set(elapsedSec, { time: secToElapsed(elapsedSec), _sec: elapsedSec });
      }
      const row = elapsedMap.get(elapsedSec)!;
      const realTime = `${isoToMd(entry.cycle.startTime)} ${time}`;
      tags.forEach(tag => {
        if (pt[tag.tagName] !== undefined) {
          const sk = `${entry.id}_${tag.tagName}`;
          row[sk] = pt[tag.tagName];
          row[`${sk}__t`] = realTime;
        }
      });
    });
  });

  let sorted = Array.from(elapsedMap.values()).sort((a, b) => a._sec - b._sec);
  if (viewRange) {
    sorted = sorted.filter(d => d._sec >= viewRange.startSec && d._sec <= viewRange.endSec);
  }

  return { chartData: sorted, chartSeries: allSeries };
}

const STATUS_COLORS: Record<string, string> = {
  normal: 'text-emerald-600 dark:text-emerald-400',
  delayed: 'text-amber-600 dark:text-amber-400',
  anomaly: 'text-red-600 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = { normal: '정상', delayed: '지연', anomaly: '이상' };

export default function ANL003CycleAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── 시리즈 상태 ──
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 외부에서 전달된 싸이클 자동 추가 ──
  useEffect(() => {
    const state = location.state as { facilityId?: string; facilityLabel?: string; cycle?: CycleRangeItem } | null;
    if (state?.facilityId && state?.facilityLabel && state?.cycle) {
      setSeriesList(prev => {
        if (prev.length >= MAX_SERIES) return prev;
        // 동일 싸이클 중복 방지
        if (prev.some(s => s.cycle.id === state.cycle!.id)) return prev;
        return [...prev, {
          id: genId(),
          facilityId: state.facilityId!,
          facilityLabel: state.facilityLabel!,
          cycle: state.cycle!,
          shiftSec: 0,
          shiftStep: 1,
        }];
      });
      // state 소비 후 제거 (뒤로가기 시 재추가 방지)
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]);

  // ── 시리즈 CRUD ──
  const addSeries = useCallback((facilityId: string, facilityLabel: string, cycle: CycleRangeItem) => {
    if (seriesList.length >= MAX_SERIES) return;
    setSeriesList(prev => [...prev, {
      id: genId(), facilityId, facilityLabel, cycle,
      shiftSec: 0, shiftStep: 1,
    }]);
  }, [seriesList.length]);

  const removeSeries = useCallback((id: string) => {
    setSeriesList(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSeries = useCallback((id: string, patch: Partial<SeriesEntry>) => {
    setSeriesList(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // ── 위/아래 싸이클 이동 ──
  const queryClient = useQueryClient();
  const navigateCycle = useCallback(async (entryId: string, direction: 'up' | 'down') => {
    const entry = seriesList.find(s => s.id === entryId);
    if (!entry) return;
    const cycleDate = isoToLocalDate(entry.cycle.startTime);
    const dayStart = `${cycleDate}T00:00:00+09:00`;
    const dayEnd = `${cycleDate}T23:59:59+09:00`;
    const cycles = await queryClient.fetchQuery<CycleRangeItem[]>({
      queryKey: ['cycle-nav', entry.facilityId, cycleDate],
      queryFn: () => getCyclesInRange(entry.facilityId, dayStart, dayEnd),
      staleTime: 5 * 60 * 1000,
    });
    if (!cycles?.length) return;
    const currentIdx = cycles.findIndex(c => c.id === entry.cycle.id);
    if (currentIdx === -1) return;
    const nextIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (nextIdx < 0 || nextIdx >= cycles.length) return;
    updateSeries(entryId, { cycle: cycles[nextIdx] });
  }, [seriesList, queryClient, updateSeries]);

  // ── 8개 고정 쿼리 (전력 4 + 에어 4, Rules of Hooks) ──
  const s0 = seriesList[0]; const s1 = seriesList[1];
  const s2 = seriesList[2]; const s3 = seriesList[3];

  // 전력 (elec)
  const qE0 = useQuery<TrendResult>({
    queryKey: ['anl003-elec', s0?.cycle.id, s0?.cycle.startTime, s0?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s0!.facilityId, s0!.cycle.startTime, s0!.cycle.endTime, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s0,
  });
  const qE1 = useQuery<TrendResult>({
    queryKey: ['anl003-elec', s1?.cycle.id, s1?.cycle.startTime, s1?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s1!.facilityId, s1!.cycle.startTime, s1!.cycle.endTime, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s1,
  });
  const qE2 = useQuery<TrendResult>({
    queryKey: ['anl003-elec', s2?.cycle.id, s2?.cycle.startTime, s2?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s2!.facilityId, s2!.cycle.startTime, s2!.cycle.endTime, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s2,
  });
  const qE3 = useQuery<TrendResult>({
    queryKey: ['anl003-elec', s3?.cycle.id, s3?.cycle.startTime, s3?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s3!.facilityId, s3!.cycle.startTime, s3!.cycle.endTime, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s3,
  });

  // 에어 (air)
  const qA0 = useQuery<TrendResult>({
    queryKey: ['anl003-air', s0?.cycle.id, s0?.cycle.startTime, s0?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s0!.facilityId, s0!.cycle.startTime, s0!.cycle.endTime, '1s', 'air') as Promise<TrendResult>,
    enabled: !!s0,
  });
  const qA1 = useQuery<TrendResult>({
    queryKey: ['anl003-air', s1?.cycle.id, s1?.cycle.startTime, s1?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s1!.facilityId, s1!.cycle.startTime, s1!.cycle.endTime, '1s', 'air') as Promise<TrendResult>,
    enabled: !!s1,
  });
  const qA2 = useQuery<TrendResult>({
    queryKey: ['anl003-air', s2?.cycle.id, s2?.cycle.startTime, s2?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s2!.facilityId, s2!.cycle.startTime, s2!.cycle.endTime, '1s', 'air') as Promise<TrendResult>,
    enabled: !!s2,
  });
  const qA3 = useQuery<TrendResult>({
    queryKey: ['anl003-air', s3?.cycle.id, s3?.cycle.startTime, s3?.cycle.endTime],
    queryFn: () => getFacilityTrendData(s3!.facilityId, s3!.cycle.startTime, s3!.cycle.endTime, '1s', 'air') as Promise<TrendResult>,
    enabled: !!s3,
  });

  const elecQueries = [qE0, qE1, qE2, qE3];
  const airQueries = [qA0, qA1, qA2, qA3];
  const anyLoading = [...elecQueries, ...airQueries].some(q => q.isLoading || q.isFetching);

  // ── 싸이클 범위 계산 ──
  const cycleViewRange = useMemo<{ startSec: number; endSec: number } | null>(() => {
    if (seriesList.length === 0) return null;
    const minStart = Math.min(0, ...seriesList.map(e => e.shiftSec));
    const maxEnd = Math.max(...seriesList.map(e => e.cycle.duration + e.shiftSec));
    return { startSec: Math.floor(minStart), endSec: Math.ceil(maxEnd) + 5 };
  }, [seriesList]);

  // ── 줌 상태 (두 차트 공유) ──
  const [zoomedRange, setZoomedRange] = useState<{ startSec: number; endSec: number } | null>(null);
  const isZoomingRef = useRef(false);
  const viewRange = zoomedRange || cycleViewRange;

  const elapsedToSec = (label: string): number => {
    const parts = label.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const handleZoomRaw = useCallback((_zoomRatio: number, timeRange?: { start: string; end: string }) => {
    if (isZoomingRef.current) return;
    isZoomingRef.current = true;
    try {
      if (timeRange) {
        const startSec = elapsedToSec(timeRange.start);
        const endSec = elapsedToSec(timeRange.end);
        if (startSec < endSec) setZoomedRange({ startSec, endSec });
      }
    } finally {
      isZoomingRef.current = false;
    }
  }, []);

  const handleZoom = useMemo(() => debounce(handleZoomRaw, 300), [handleZoomRaw]);
  const resetZoom = useCallback(() => setZoomedRange(null), []);

  const handleZoomPan = useCallback((dir: 'left' | 'right') => {
    const range = zoomedRange || cycleViewRange;
    if (!range) return;
    const span = range.endSec - range.startSec;
    if (span <= 0) return;
    let ns: number, ne: number;
    if (dir === 'left') { ns = Math.max(0, range.startSec - span); ne = ns + span; }
    else { ne = range.endSec + span; ns = ne - span; }
    if (ns < ne) setZoomedRange({ startSec: ns, endSec: ne });
  }, [zoomedRange, cycleViewRange]);

  // ── 데이터 병합 (전력 / 에어 각각) ──
  const elecResults = elecQueries.map(q => q.data);
  const airResults = airQueries.map(q => q.data);

  const { chartData: elecData, chartSeries: elecSeries } = useMemo(
    () => mergeChartData(seriesList, elecResults, viewRange),
    [seriesList, elecResults, viewRange],
  );
  const { chartData: airData, chartSeries: airSeries } = useMemo(
    () => mergeChartData(seriesList, airResults, viewRange),
    [seriesList, airResults, viewRange],
  );

  // ── 줌 바 UI ──
  const zoomActions = zoomedRange ? (
    <div className="flex items-center gap-1">
      <button onClick={() => handleZoomPan('left')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 disabled:opacity-30" title="좌로 이동">
        <ChevronLeft size={14} />
      </button>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
        {secToElapsed(zoomedRange.startSec)}~{secToElapsed(zoomedRange.endSec)}
      </span>
      <button onClick={() => handleZoomPan('right')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 disabled:opacity-30" title="우로 이동">
        <ChevronRight size={14} />
      </button>
      <button onClick={resetZoom} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500" title="줌 초기화">
        <RotateCcw size={12} />
      </button>
    </div>
  ) : undefined;

  const zoomSubtitle = zoomedRange
    ? `줌: ${secToElapsed(zoomedRange.startSec)} ~ ${secToElapsed(zoomedRange.endSec)}`
    : '해상도: 1초 | X축: 싸이클 시작 기준 경과시간';

  const emptyMsg = (
    <div className="h-full flex items-center justify-center text-sm text-gray-400">
      상단 "싸이클 추가" 버튼으로 비교할 싸이클을 선택하세요
    </div>
  );
  const loadingMsg = (
    <div className="h-full flex items-center justify-center text-sm text-gray-400">
      {anyLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="싸이클 비교 분석"
        description="설비별 싸이클 선택 → 전력/에어 파형 오버레이 비교 | 해상도: 1초 | 경과시간 정렬"
      />

      {/* ── 시리즈 추가 버튼 ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setPickerOpen(true)}
          disabled={seriesList.length >= MAX_SERIES}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-[#E94560] hover:text-[#E94560] text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300"
        >
          <Plus size={14} />
          싸이클 추가 ({seriesList.length}/{MAX_SERIES})
        </button>
      </div>

      {/* ── 시리즈 카드 (2열 그리드) ── */}
      {seriesList.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
          {seriesList.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: FACILITY_COLORS[idx % FACILITY_COLORS.length] }}
              />
              <span className="text-[13px] font-bold text-gray-700 dark:text-white truncate max-w-[80px]" title={entry.facilityLabel}>
                {entry.facilityLabel}
              </span>
              {/* 싸이클 이동 */}
              <div className="flex flex-col">
                <button
                  onClick={() => navigateCycle(entry.id, 'up')}
                  className="p-0 leading-none rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="이전 싸이클"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => navigateCycle(entry.id, 'down')}
                  className="p-0 leading-none rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="다음 싸이클"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                #{entry.cycle.cycleNumber}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {isoToMd(entry.cycle.startTime)} {isoToHms(entry.cycle.startTime)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {entry.cycle.duration}s
              </span>
              <span className={`text-xs font-medium ${STATUS_COLORS[entry.cycle.status]}`}>
                {STATUS_LABELS[entry.cycle.status]}
              </span>

              {/* 오프셋 컨트롤 */}
              <div className="flex items-center gap-0 ml-auto">
                <button
                  onClick={() => updateSeries(entry.id, { shiftSec: entry.shiftSec - entry.shiftStep })}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
                  title={`-${entry.shiftStep}s`}
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-xs font-mono min-w-[32px] text-center text-gray-700 dark:text-gray-200">
                  {entry.shiftSec > 0 ? '+' : ''}{entry.shiftSec}s
                </span>
                <button
                  onClick={() => updateSeries(entry.id, { shiftSec: entry.shiftSec + entry.shiftStep })}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
                  title={`+${entry.shiftStep}s`}
                >
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* 스텝 토글 */}
              <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => updateSeries(entry.id, { shiftStep: 1 })}
                  className={`px-1.5 py-0.5 text-[11px] ${entry.shiftStep === 1 ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400'}`}
                >
                  1s
                </button>
                <button
                  onClick={() => updateSeries(entry.id, { shiftStep: 10 })}
                  className={`px-1.5 py-0.5 text-[11px] ${entry.shiftStep === 10 ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400'}`}
                >
                  10s
                </button>
              </div>

              {/* 삭제 */}
              <button
                onClick={() => removeSeries(entry.id)}
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                title="삭제"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 전력 차트 ── */}
      <ChartCard
        title={seriesList.length === 0 ? '전력 비교' : `전력 비교 (${seriesList.length}개)`}
        subtitle={zoomSubtitle}
        className="flex-1 min-h-0"
        chartId="anl003-elec"
        exportData={elecData}
        exportFilename="싸이클비교_전력"
        minHeight={0}
        actions={zoomActions}
      >
        {seriesList.length === 0 ? emptyMsg : elecData.length === 0 ? loadingMsg : (
          <TrendChart
            data={elecData}
            series={elecSeries}
            xKey="time"
            yLabel="순시값(kW)"
            syncKey="anl003"
            showLegend={true}
            onZoomChange={handleZoom}
            isLoading={anyLoading}
            loadingMessage="1초 데이터 로딩 중..."
          />
        )}
      </ChartCard>

      {/* ── 에어 차트 ── */}
      <ChartCard
        title={seriesList.length === 0 ? '에어 비교' : `에어 비교 (${seriesList.length}개)`}
        subtitle={zoomSubtitle}
        className="flex-1 min-h-0"
        chartId="anl003-air"
        exportData={airData}
        exportFilename="싸이클비교_에어"
        minHeight={0}
        actions={zoomActions}
      >
        {seriesList.length === 0 ? emptyMsg : airData.length === 0 ? loadingMsg : (
          <TrendChart
            data={airData}
            series={airSeries}
            xKey="time"
            yLabel="유량(m³/min)"
            syncKey="anl003"
            showLegend={true}
            onZoomChange={handleZoom}
            isLoading={anyLoading}
            loadingMessage="1초 데이터 로딩 중..."
          />
        )}
      </ChartCard>

      {/* ── 싸이클 선택 팝업 ── */}
      <CyclePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(fid, flabel, cycle) => {
          addSeries(fid, flabel, cycle);
          setPickerOpen(false);
        }}
        existingSeries={seriesList.map((s, idx) => ({
          facilityId: s.facilityId,
          facilityLabel: s.facilityLabel,
          cycle: s.cycle,
          color: FACILITY_COLORS[idx % FACILITY_COLORS.length],
        }))}
      />
    </div>
  );
}
