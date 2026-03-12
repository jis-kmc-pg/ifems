import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { CycleRangeItem } from '../../services/analysis';

export interface SeriesCycles {
  seriesIdx: number;
  facilityId: string;
  facilityLabel: string;
  color: string;
  /** fetch 시작 절대초 (hourSlot*3600 - shiftSec) */
  fetchStartSec: number;
  /** 차트 데이터에서 이 시리즈의 태그 키 접두사 (entry.id) */
  entryId: string;
  cycles: CycleRangeItem[];
}

interface CycleTimelinePanelProps {
  seriesCycles: SeriesCycles[];
  /** 줌 범위 (null이면 0~3600 전체) */
  zoomedRange: { startSec: number; endSec: number } | null;
  /** 차트 데이터 (경과초 _sec 포함, 태그값은 entryId_tagName 키) */
  chartData?: Record<string, any>[];
  /** 단위 (kW, m³/min 등) */
  unit?: string;
  className?: string;
  /** 싸이클 분석으로 이동 콜백 */
  onNavigateToCycleSingle?: (facilityId: string, facilityLabel: string, cycle: CycleRangeItem) => void;
  /** 싸이클 비교분석으로 이동 콜백 */
  onNavigateToCycleAnalysis?: (facilityId: string, facilityLabel: string, cycle: CycleRangeItem) => void;
}

interface PopupData {
  cycle: CycleRangeItem & { elStart: number; elEnd: number };
  seriesIdx: number;
  color: string;
  facilityId: string;
  facilityLabel: string;
  entryId: string;
  x: number;
  y: number;
}

const STATUS_COLORS = {
  normal: { bg: 'bg-emerald-500/70', border: 'border-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
  delayed: { bg: 'bg-amber-500/70', border: 'border-amber-600', text: 'text-amber-600 dark:text-amber-400' },
  anomaly: { bg: 'bg-red-500/70', border: 'border-red-600', text: 'text-red-600 dark:text-red-400' },
};

const STATUS_LABELS = { normal: '정상', delayed: '지연', anomaly: '이상' };

/** 초를 mm:ss 형식으로 */
function fmtSec(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** ISO → HH:mm:ss */
function isoToHms(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** ISO → MM-DD HH:mm:ss */
function isoToDateTime(iso: string): string {
  const d = new Date(iso);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mo}-${dd} ${isoToHms(iso)}`;
}

/** chartData에서 특정 경과초 범위의 시리즈 값 집계 */
function getRawStats(
  chartData: Record<string, any>[],
  entryId: string,
  elStart: number,
  elEnd: number,
): { avg: number; peak: number; count: number } | null {
  const prefix = entryId + '_';
  let sum = 0, peak = -Infinity, count = 0;

  for (const row of chartData) {
    const sec = row._sec as number;
    if (sec < elStart || sec > elEnd) continue;

    // 해당 시리즈의 모든 태그 값 합산
    for (const key in row) {
      if (!key.startsWith(prefix)) continue;
      const v = row[key];
      if (typeof v === 'number' && !isNaN(v)) {
        sum += v;
        if (v > peak) peak = v;
        count++;
      }
    }
  }

  if (count === 0) return null;
  return { avg: Math.round(sum / count * 100) / 100, peak: Math.round(peak * 100) / 100, count };
}

export default function CycleTimelinePanel({ seriesCycles, zoomedRange, chartData, unit, className, onNavigateToCycleSingle, onNavigateToCycleAnalysis }: CycleTimelinePanelProps) {
  const viewStart = zoomedRange?.startSec ?? 0;
  const viewEnd = zoomedRange?.endSec ?? 3600;
  const viewSpan = viewEnd - viewStart;

  const [popup, setPopup] = useState<PopupData | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 팝업 닫기
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
      setPopup(null);
    }
  }, []);

  useEffect(() => {
    if (popup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [popup, handleClickOutside]);

  // 타임라인에 표시할 싸이클 → 경과초 변환
  const timelineData = useMemo(() => {
    return seriesCycles.map(sc => {
      const items = sc.cycles.map(c => {
        const cStartDt = new Date(c.startTime);
        const cEndDt = new Date(c.endTime);
        const cStartSec = cStartDt.getHours() * 3600 + cStartDt.getMinutes() * 60 + cStartDt.getSeconds();
        const cEndSec = cEndDt.getHours() * 3600 + cEndDt.getMinutes() * 60 + cEndDt.getSeconds();
        const elStart = cStartSec - sc.fetchStartSec;
        const elEnd = cEndSec - sc.fetchStartSec;
        return { ...c, elStart, elEnd };
      }).filter(c => c.elEnd > viewStart && c.elStart < viewEnd);

      return { ...sc, items };
    }).filter(sc => sc.items.length > 0);
  }, [seriesCycles, viewStart, viewEnd]);

  // 팝업 열기 시 raw 값 계산
  const popupRawStats = useMemo(() => {
    if (!popup || !chartData?.length) return null;
    return getRawStats(chartData, popup.entryId, popup.cycle.elStart, popup.cycle.elEnd);
  }, [popup, chartData]);

  const totalCycles = timelineData.reduce((n, sc) => n + sc.items.length, 0);
  if (totalCycles === 0) return null;

  const handleBarClick = (
    e: React.MouseEvent,
    cycle: CycleRangeItem & { elStart: number; elEnd: number },
    sc: typeof timelineData[0],
  ) => {
    e.stopPropagation();
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) return;
    const x = e.clientX - panelRect.left;
    const y = e.clientY - panelRect.top;
    setPopup({
      cycle,
      seriesIdx: sc.seriesIdx,
      color: sc.color,
      facilityId: sc.facilityId,
      facilityLabel: sc.facilityLabel,
      entryId: sc.entryId,
      x,
      y,
    });
  };

  const unitLabel = unit || 'kW';

  return (
    <div ref={panelRef} className={cn('bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm relative', className)}>
      {/* 헤더 */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-white">싸이클 타임라인</span>
        <span className="text-[10px] text-gray-400">({totalCycles}개)</span>
        {/* 범례 */}
        <div className="ml-auto flex items-center gap-3">
          {(['normal', 'delayed', 'anomaly'] as const).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('w-2.5 h-2.5 rounded-sm', STATUS_COLORS[s].bg)} />
              <span className="text-[10px] text-gray-400">{STATUS_LABELS[s]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 타임라인 바 */}
      <div className="px-4 py-2 space-y-1.5">
        {/* X축 눈금 */}
        <div className="relative h-4 flex items-end" style={{ marginLeft: '110px' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const sec = viewStart + viewSpan * ratio;
            return (
              <span
                key={ratio}
                className="absolute text-[9px] text-gray-400 -translate-x-1/2"
                style={{ left: `${ratio * 100}%` }}
              >
                {fmtSec(sec)}
              </span>
            );
          })}
        </div>

        {/* 시리즈별 타임라인 행 */}
        {timelineData.map(sc => (
          <div key={sc.seriesIdx} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: sc.color }}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400 w-[90px] truncate" title={sc.facilityLabel}>
              {sc.facilityLabel}
            </span>
            <div className="flex-1 relative h-5 bg-gray-50 dark:bg-[#0F3460]/50 rounded overflow-hidden">
              {sc.items.map(c => {
                const left = Math.max(0, (c.elStart - viewStart) / viewSpan) * 100;
                const right = Math.min(100, (c.elEnd - viewStart) / viewSpan * 100);
                const width = right - left;
                if (width <= 0) return null;
                const scColors = STATUS_COLORS[c.status];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'absolute top-0.5 bottom-0.5 rounded-sm border cursor-pointer hover:brightness-125 transition-[filter]',
                      scColors.bg, scColors.border,
                      popup?.cycle.id === c.id && 'ring-1 ring-white brightness-125',
                    )}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '2px' }}
                    title={`#${c.cycleNumber} ${isoToDateTime(c.startTime)} ~ ${isoToDateTime(c.endTime)} (${c.duration}s)`}
                    onClick={(e) => handleBarClick(e, c, sc)}
                  >
                    {width > 8 && (
                      <span className="text-[8px] text-white px-0.5 leading-none truncate block mt-0.5">
                        #{c.cycleNumber}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 클릭 팝업 */}
      {popup && (
        <div
          ref={popupRef}
          className="absolute z-50 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-[220px]"
          style={{
            left: Math.min(Math.max(8, popup.x - 110), (panelRef.current?.offsetWidth ?? 400) - 240),
            bottom: (panelRef.current?.offsetHeight ?? 200) - popup.y + 8,
          }}
        >
          {/* 팝업 헤더 */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: popup.color }} />
            <span className="text-xs font-semibold text-gray-700 dark:text-white">
              S{popup.seriesIdx + 1} #{popup.cycle.cycleNumber}
            </span>
            <span className={cn('text-[10px] font-medium ml-auto', STATUS_COLORS[popup.cycle.status].text)}>
              {STATUS_LABELS[popup.cycle.status]}
            </span>
            <button
              onClick={() => setPopup(null)}
              className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm leading-none"
            >
              ×
            </button>
          </div>

          {/* 팝업 내용 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <Row label="설비" value={popup.facilityLabel} />
            <Row label="시간" value={`${isoToDateTime(popup.cycle.startTime)} ~ ${isoToDateTime(popup.cycle.endTime)}`} />
            <Row label="지속시간" value={`${popup.cycle.duration}s`} />
            <Row label="지연시간" value={`${popup.cycle.delay}s`} />
            <Row label="유사도" value={`${popup.cycle.similarity}%`} />
            {popupRawStats && (
              <>
                <Row label={`평균(${unitLabel})`} value={String(popupRawStats.avg)} />
                <Row label={`피크(${unitLabel})`} value={String(popupRawStats.peak)} />
              </>
            )}
          </div>

          {/* 싸이클 분석 이동 버튼 */}
          {onNavigateToCycleSingle && (
            <button
              onClick={() => {
                onNavigateToCycleSingle(popup.facilityId, popup.facilityLabel, popup.cycle);
                setPopup(null);
              }}
              className="mt-2 w-full py-1.5 text-xs rounded bg-[#E94560] text-white hover:opacity-90 transition-opacity"
            >
              싸이클 분석으로
            </button>
          )}
          {/* 싸이클 비교분석 이동 버튼 */}
          {onNavigateToCycleAnalysis && (
            <button
              onClick={() => {
                onNavigateToCycleAnalysis(popup.facilityId, popup.facilityLabel, popup.cycle);
                setPopup(null);
              }}
              className={`${onNavigateToCycleSingle ? 'mt-1' : 'mt-2'} w-full py-1.5 text-xs rounded border border-[#E94560] text-[#E94560] hover:bg-[#E94560]/10 transition-colors`}
            >
              싸이클 비교분석으로
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-gray-700 dark:text-gray-200 font-mono">{value}</span>
    </>
  );
}
