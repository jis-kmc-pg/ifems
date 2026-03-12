import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import { Plus, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import FacilityPickerModal from '../../components/ui/FacilityPickerModal';
import TrendChart from '../../components/charts/TrendChart';
import type { TrendSeries } from '../../components/charts/TrendChart';
import { FACILITY_COLORS } from '../../lib/chart-series';
import CycleTimelinePanel from '../../components/ui/CycleTimelinePanel';
import { getFacilityTrendData, getCyclesInRange } from '../../services/analysis';
import type { CycleRangeItem } from '../../services/analysis';

// ── 상수 ──
const MAX_SERIES = 4;
const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_HOUR = new Date().getHours();
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00~${String(i + 1).padStart(2, '0') === '24' ? '24' : String(i + 1).padStart(2, '0')}:00`,
}));

// ── 타입 ──
interface SeriesEntry {
  id: string;
  facilityId: string;
  facilityLabel: string;
  date: string;
  hourSlot: number;
  shiftSec: number;
  shiftStep: 1 | 10;
}

type TagInfo = { tagName: string; displayName: string; energyType: string; unit: string };
type TrendResult = { tags: TagInfo[]; data: Record<string, any>[] };

let _idCounter = 0;
function genId() { return `s${++_idCounter}_${Date.now()}`; }

/** 시리즈별 API 시간 범위 계산 (shiftSec 반영: 시프트만큼 fetch 윈도우 이동) */
function getTimeRange(entry: SeriesEntry) {
  // shiftSec=-10 → 08:00:10~09:00:10 fetch → elapsed 0~3600 빈틈 없음
  const startTotalSec = entry.hourSlot * 3600 - entry.shiftSec;
  const endTotalSec = startTotalSec + 3600;

  const toIso = (totalSec: number) => {
    let dayOff = 0, s = totalSec;
    while (s < 0) { s += 86400; dayOff--; }
    while (s >= 86400) { s -= 86400; dayOff++; }
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    let date = entry.date;
    if (dayOff !== 0) {
      const d = new Date(entry.date + 'T00:00:00');
      d.setDate(d.getDate() + dayOff);
      date = d.toISOString().slice(0, 10);
    }
    return `${date}T${hh}:${mm}:${ss}+09:00`;
  };

  return { start: toIso(startTotalSec), end: toIso(endTotalSec) };
}

/** 초를 0:mm:ss 형식으로 */
function secToElapsed(sec: number): string {
  const s = Math.max(0, Math.min(3600, Math.round(sec)));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `0:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function ANL009AdvPowerComparison() {
  const navigate = useNavigate();

  // ── 시리즈 상태 ──
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 시리즈 CRUD ──
  const addSeries = useCallback((facilityId: string, facilityLabel: string) => {
    if (seriesList.length >= MAX_SERIES) return;
    setSeriesList(prev => [...prev, {
      id: genId(), facilityId, facilityLabel,
      date: TODAY, hourSlot: CURRENT_HOUR,
      shiftSec: 0, shiftStep: 1,
    }]);
  }, [seriesList.length]);

  const removeSeries = useCallback((id: string) => {
    setSeriesList(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSeries = useCallback((id: string, patch: Partial<SeriesEntry>) => {
    setSeriesList(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // 기존 설비 목록 (중복 제거)
  const existingFacilities = useMemo(() => {
    const map = new Map<string, string>();
    seriesList.forEach(s => map.set(s.facilityId, s.facilityLabel));
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [seriesList]);

  const handleAddClick = () => {
    if (seriesList.length === 0) {
      setPickerOpen(true);
    } else {
      setPickerOpen(true); // 빠른 추가는 FacilityPickerModal 내 existingFacilities로
    }
  };

  // ── 4개 고정 쿼리 (Rules of Hooks) ──
  const s0 = seriesList[0]; const s1 = seriesList[1];
  const s2 = seriesList[2]; const s3 = seriesList[3];

  const r0 = s0 ? getTimeRange(s0) : { start: '', end: '' };
  const r1 = s1 ? getTimeRange(s1) : { start: '', end: '' };
  const r2 = s2 ? getTimeRange(s2) : { start: '', end: '' };
  const r3 = s3 ? getTimeRange(s3) : { start: '', end: '' };

  const q0 = useQuery<TrendResult>({
    queryKey: ['anl009', s0?.facilityId, r0.start, r0.end],
    queryFn: () => getFacilityTrendData(s0!.facilityId, r0.start, r0.end, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s0,
  });
  const q1 = useQuery<TrendResult>({
    queryKey: ['anl009', s1?.facilityId, r1.start, r1.end],
    queryFn: () => getFacilityTrendData(s1!.facilityId, r1.start, r1.end, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s1,
  });
  const q2 = useQuery<TrendResult>({
    queryKey: ['anl009', s2?.facilityId, r2.start, r2.end],
    queryFn: () => getFacilityTrendData(s2!.facilityId, r2.start, r2.end, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s2,
  });
  const q3 = useQuery<TrendResult>({
    queryKey: ['anl009', s3?.facilityId, r3.start, r3.end],
    queryFn: () => getFacilityTrendData(s3!.facilityId, r3.start, r3.end, '1s', 'elec') as Promise<TrendResult>,
    enabled: !!s3,
  });

  const queries = [q0, q1, q2, q3];
  const anyLoading = queries.some(q => q.isLoading || q.isFetching);

  // ── 4개 고정 싸이클 쿼리 (시간범위 내 싸이클) ──
  const c0 = useQuery<CycleRangeItem[]>({
    queryKey: ['anl009-cyc', s0?.facilityId, r0.start, r0.end],
    queryFn: () => getCyclesInRange(s0!.facilityId, r0.start, r0.end),
    enabled: !!s0,
  });
  const c1 = useQuery<CycleRangeItem[]>({
    queryKey: ['anl009-cyc', s1?.facilityId, r1.start, r1.end],
    queryFn: () => getCyclesInRange(s1!.facilityId, r1.start, r1.end),
    enabled: !!s1,
  });
  const c2 = useQuery<CycleRangeItem[]>({
    queryKey: ['anl009-cyc', s2?.facilityId, r2.start, r2.end],
    queryFn: () => getCyclesInRange(s2!.facilityId, r2.start, r2.end),
    enabled: !!s2,
  });
  const c3 = useQuery<CycleRangeItem[]>({
    queryKey: ['anl009-cyc', s3?.facilityId, r3.start, r3.end],
    queryFn: () => getCyclesInRange(s3!.facilityId, r3.start, r3.end),
    enabled: !!s3,
  });
  const cycleQueries = [c0, c1, c2, c3];

  // 시리즈별 싸이클 데이터 (CycleTimelinePanel용)
  const seriesCycles = useMemo(() => {
    return seriesList.map((entry, idx) => ({
      seriesIdx: idx,
      facilityId: entry.facilityId,
      facilityLabel: entry.facilityLabel,
      color: FACILITY_COLORS[idx % FACILITY_COLORS.length],
      fetchStartSec: entry.hourSlot * 3600 - entry.shiftSec,
      entryId: entry.id,
      cycles: cycleQueries[idx]?.data ?? [],
    }));
  }, [seriesList, cycleQueries.map(c => c.data)]);

  // ── 줌 상태 (경과시간 초 단위) ──
  const [zoomedRange, setZoomedRange] = useState<{ startSec: number; endSec: number } | null>(null);
  const isZoomingRef = useRef(false);

  /** elapsed label "0:mm:ss" → 초 변환 */
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

  // 줌 팬 (좌/우)
  const handleZoomPan = useCallback((dir: 'left' | 'right') => {
    if (!zoomedRange) return;
    const span = zoomedRange.endSec - zoomedRange.startSec;
    if (span <= 0) return;
    let ns: number, ne: number;
    if (dir === 'left') { ns = Math.max(0, zoomedRange.startSec - span); ne = ns + span; }
    else { ne = Math.min(3600, zoomedRange.endSec + span); ns = Math.max(0, ne - span); }
    if (ns < ne) setZoomedRange({ startSec: ns, endSec: ne });
  }, [zoomedRange]);

  // ── 데이터 병합 (경과시간 + 오프셋) ──
  const { chartData, chartSeries } = useMemo(() => {
    const elapsedMap = new Map<number, Record<string, any>>();
    const allSeries: TrendSeries[] = [];

    seriesList.forEach((entry, sIdx) => {
      const result = queries[sIdx]?.data;
      if (!result) return;

      const tags: TagInfo[] = result.tags ?? [];
      const color = FACILITY_COLORS[sIdx % FACILITY_COLORS.length];
      const hourLabel = HOUR_OPTIONS[entry.hourSlot]?.label ?? '';

      tags.forEach(tag => {
        allSeries.push({
          key: `${entry.id}_${tag.tagName}`,
          label: `S${sIdx + 1}: ${entry.facilityLabel} ${tag.displayName} (${entry.date} ${hourLabel})`,
          color,
          type: 'line' as const,
          width: 2,
        });
      });

      // 시간 → 경과초 변환 (fetch 범위가 이미 shiftSec 반영됨)
      const data: Record<string, any>[] = result.data ?? [];
      // fetch 시작점: hourSlot*3600 - shiftSec (getTimeRange과 동일)
      const fetchStartSec = entry.hourSlot * 3600 - entry.shiftSec;

      data.forEach((pt: any) => {
        const time: string = pt.time ?? '';
        const [hh, mm, ss] = time.split(':').map(Number);
        if (isNaN(hh)) return;
        const absSec = hh * 3600 + mm * 60 + ss;
        const elapsedSec = absSec - fetchStartSec;

        if (elapsedSec < 0 || elapsedSec > 3600) return;

        if (!elapsedMap.has(elapsedSec)) {
          elapsedMap.set(elapsedSec, { time: secToElapsed(elapsedSec), _sec: elapsedSec });
        }
        const row = elapsedMap.get(elapsedSec)!;
        const realTime = `${entry.date.slice(5)} ${time}`;
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

    // 줌 범위 필터링
    if (zoomedRange) {
      sorted = sorted.filter(d => d._sec >= zoomedRange.startSec && d._sec <= zoomedRange.endSec);
    }

    return { chartData: sorted, chartSeries: allSeries };
  }, [seriesList, queries.map(q => q.data), zoomedRange]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="전력 상세 비교"
        description="설비별 전력 순시값 상세 비교 | 해상도: 1초 | 경과시간 정렬"
      />

      {/* ── 시리즈 추가 버튼 ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleAddClick}
          disabled={seriesList.length >= MAX_SERIES}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-[#E94560] hover:text-[#E94560] text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300"
        >
          <Plus size={14} />
          시리즈 추가 ({seriesList.length}/{MAX_SERIES})
        </button>
      </div>

      {/* ── 시리즈 행들 (2열 그리드) ── */}
      {seriesList.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
          {seriesList.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              {/* 색상 */}
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: FACILITY_COLORS[idx % FACILITY_COLORS.length] }}
              />
              <span className="text-[11px] font-bold text-gray-700 dark:text-white truncate min-w-0 max-w-[80px]" title={entry.facilityLabel}>
                {entry.facilityLabel}
              </span>

              {/* 날짜 */}
              <input
                type="date"
                value={entry.date}
                onChange={(e) => updateSeries(entry.id, { date: e.target.value })}
                className="text-[11px] bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560] w-[120px]"
              />

              {/* 시간 콤보 */}
              <select
                value={entry.hourSlot}
                onChange={(e) => updateSeries(entry.id, { hourSlot: Number(e.target.value) })}
                className="text-[11px] bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560] w-[110px]"
              >
                {HOUR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* 오프셋 컨트롤 */}
              <div className="flex items-center gap-0">
                <button
                  onClick={() => updateSeries(entry.id, { shiftSec: entry.shiftSec - entry.shiftStep })}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
                  title={`-${entry.shiftStep}s`}
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[11px] font-mono min-w-[36px] text-center text-gray-700 dark:text-gray-200">
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
                  className={`px-1.5 py-0.5 text-[10px] ${entry.shiftStep === 1 ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                >
                  1s
                </button>
                <button
                  onClick={() => updateSeries(entry.id, { shiftStep: 10 })}
                  className={`px-1.5 py-0.5 text-[10px] ${entry.shiftStep === 10 ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                >
                  10s
                </button>
              </div>

              {/* 삭제 */}
              <button
                onClick={() => removeSeries(entry.id)}
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors ml-auto"
                title="시리즈 삭제"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 차트 ── */}
      <ChartCard
        title={seriesList.length === 0 ? '전력 순시값 비교' : `전력 순시값 비교 (${seriesList.length}개 시리즈)`}
        subtitle={zoomedRange
          ? `줌: ${secToElapsed(zoomedRange.startSec)} ~ ${secToElapsed(zoomedRange.endSec)}`
          : '해상도: 1초 | X축: 경과시간'
        }
        className="flex-1 min-h-0"
        chartId="anl009-chart"
        exportData={chartData}
        exportFilename="전력상세비교"
        minHeight={0}
        actions={zoomedRange ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoomPan('left')}
              disabled={zoomedRange.startSec <= 0}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 disabled:opacity-30"
              title="좌로 이동"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
              {secToElapsed(zoomedRange.startSec)}~{secToElapsed(zoomedRange.endSec)}
            </span>
            <button
              onClick={() => handleZoomPan('right')}
              disabled={zoomedRange.endSec >= 3600}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 disabled:opacity-30"
              title="우로 이동"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={resetZoom}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
              title="줌 초기화"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        ) : undefined}
      >
        {seriesList.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            상단 "시리즈 추가" 버튼으로 비교할 설비를 추가하세요
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
            yLabel="순시값(kW)"
            syncKey="anl009"
            showLegend={true}
            onZoomChange={handleZoom}
            isLoading={anyLoading}
            loadingMessage="1초 데이터 로딩 중..."
          />
        )}
      </ChartCard>

      {/* ── 싸이클 타임라인 ── */}
      {seriesList.length > 0 && (
        <CycleTimelinePanel
          seriesCycles={seriesCycles}
          zoomedRange={zoomedRange}
          chartData={chartData}
          unit="kW"
          className="flex-shrink-0"
          onNavigateToCycleSingle={(facilityId, facilityLabel, cycle) => {
            navigate('/analysis/cycle-single', { state: { facilityId, facilityLabel, cycle } });
          }}
          onNavigateToCycleAnalysis={(facilityId, facilityLabel, cycle) => {
            navigate('/analysis/cycle', { state: { facilityId, facilityLabel, cycle } });
          }}
        />
      )}

      {/* ── 설비 선택 팝업 ── */}
      <FacilityPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id, label) => {
          addSeries(id, label);
          setPickerOpen(false);
        }}
        energyType="elec"
        existingFacilities={existingFacilities.length > 0 ? existingFacilities : undefined}
      />
    </div>
  );
}
