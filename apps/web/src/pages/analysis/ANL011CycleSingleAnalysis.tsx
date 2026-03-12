import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import TrendChart from '../../components/charts/TrendChart';
import type { TrendSeries } from '../../components/charts/TrendChart';
import CollapsibleTreePanel from '../../components/ui/CollapsibleTreePanel';
import { FACILITY_COLORS } from '../../lib/chart-series';
import { getFacilityTree, getFacilityTrendData, getCyclesInRange, getFacilityTagCounts, getCycleSteps } from '../../services/analysis';
import type { CycleRangeItem, StepItem } from '../../services/analysis';
import { cn } from '../../lib/utils';

// ── 상수 ──
const GROUP_IDS = ['plant', 'block', 'head', 'crank', 'assembly'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type TagInfo = { tagName: string; displayName: string; energyType: string; unit: string };
type TrendResult = { tags: TagInfo[]; data: Record<string, any>[] };

/** YYYY-MM-DD (로컬 타임존) */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const TODAY = toLocalDate(new Date());

/** ISO → HH:mm:ss */
function isoToHms(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
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

/** 트리에서 ID로 label 찾기 */
function findLabel(nodes: { id: string; label: string; children?: any[] }[], id: string): string | undefined {
  for (const node of nodes) {
    if (node.id === id) return node.label;
    if (node.children) {
      const found = findLabel(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** 트리에서 ID의 부모 경로(조상 ID 목록) 반환 */
function findAncestorIds(nodes: { id: string; children?: any[] }[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [];
    if (node.children) {
      const path = findAncestorIds(node.children, targetId);
      if (path !== null) return [node.id, ...path];
    }
  }
  return null;
}

const STATUS_COLORS = {
  normal: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  delayed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  anomaly: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};
const STATUS_LABELS: Record<string, string> = { normal: '정상', delayed: '지연', anomaly: '이상' };

const STEP_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function ANL011CycleSingleAnalysis() {
  const location = useLocation();
  const navState = location.state as { facilityId?: string; facilityLabel?: string; cycle?: CycleRangeItem } | null;
  const appliedNav = useRef(false);

  /* ── 설비 트리 상태 ── */
  const [checked, setChecked] = useState<Set<string>>(() =>
    navState?.facilityId ? new Set([navState.facilityId]) : new Set(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set(GROUP_IDS));

  /* ── 날짜 + 시간 범위 ── */
  const [date, setDate] = useState(() => {
    if (navState?.cycle?.startTime) return toLocalDate(new Date(navState.cycle.startTime));
    return TODAY;
  });
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(23);

  /* ── 에너지 타입 토글 ── */
  const [energyType, setEnergyType] = useState<'elec' | 'air'>('elec');

  /* ── 선택된 싸이클 ── */
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  /* ── 스텝 표시/숨김 ── */
  const [hiddenSteps, setHiddenSteps] = useState<Set<number>>(new Set());

  /* ── 싸이클 그리드 접기/펼치기 ── */
  const [gridOpen, setGridOpen] = useState(true);

  /* ── 설비 트리 데이터 ── */
  const { data: tree } = useQuery({ queryKey: ['anl-tree'], queryFn: getFacilityTree });
  const { data: elecCounts } = useQuery({ queryKey: ['picker-tag-counts', 'elec'], queryFn: () => getFacilityTagCounts('elec') });
  const { data: airCounts } = useQuery({ queryKey: ['picker-tag-counts', 'air'], queryFn: () => getFacilityTagCounts('air') });

  const tagBadgeMap = useMemo(() => {
    if (!elecCounts && !airCounts) return undefined;
    const map: Record<string, string> = {};
    const allIds = new Set([...Object.keys(elecCounts ?? {}), ...Object.keys(airCounts ?? {})]);
    for (const id of allIds) {
      const e = (elecCounts as Record<string, number> | undefined)?.[id] ?? 0;
      const a = (airCounts as Record<string, number> | undefined)?.[id] ?? 0;
      if (e > 0 || a > 0) map[id] = `⚡${e} 💨${a}`;
    }
    return map;
  }, [elecCounts, airCounts]);

  /* ── navState 설비 → 트리 부모 확장 + 스크롤 ── */
  useEffect(() => {
    if (!navState?.facilityId || !tree?.length) return;
    // 부모 그룹 찾아서 expanded에 추가
    const ancestors = findAncestorIds(tree, navState.facilityId);
    if (ancestors && ancestors.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.add(id));
        return next;
      });
    }
    // DOM 렌더 후 스크롤
    requestAnimationFrame(() => {
      const el = document.getElementById(`tree-node-${navState.facilityId}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [tree, navState?.facilityId]);

  /* ── 단일 선택 모드 ── */
  const handleCheckedChange = useCallback((next: Set<string>) => {
    const leafIds = Array.from(next).filter(id => !GROUP_IDS.includes(id));
    if (leafIds.length === 0) { setChecked(new Set()); return; }
    const prev = Array.from(checked).filter(id => !GROUP_IDS.includes(id));
    const newId = leafIds.find(id => !prev.includes(id)) ?? leafIds[leafIds.length - 1];
    setChecked(new Set([newId]));
    setSelectedCycleId(null);
    setHiddenSteps(new Set());
  }, [checked]);

  const selectedFacility = Array.from(checked).find(id => !GROUP_IDS.includes(id)) ?? '';
  const selectedLabel = selectedFacility && tree ? (findLabel(tree, selectedFacility) ?? selectedFacility) : '';

  /* ── 싸이클 목록 쿼리 ── */
  const rangeStart = `${date}T${String(startHour).padStart(2, '0')}:00:00+09:00`;
  const rangeEnd = `${date}T${String(endHour).padStart(2, '0')}:59:59+09:00`;

  const { data: cycles, isLoading: cyclesLoading } = useQuery<CycleRangeItem[]>({
    queryKey: ['anl011-cycles', selectedFacility, date, startHour, endHour],
    queryFn: () => getCyclesInRange(selectedFacility, rangeStart, rangeEnd),
    enabled: !!selectedFacility,
  });

  /* ── navigation state에서 싸이클 자동 선택 ── */
  useEffect(() => {
    if (appliedNav.current || !navState?.cycle || !cycles?.length) return;
    // ID 매칭 우선, 실패 시 startTime으로 폴백
    const match = cycles.find(c => c.id === navState.cycle!.id)
      ?? cycles.find(c => c.startTime === navState.cycle!.startTime);
    if (match) {
      setSelectedCycleId(match.id);
      appliedNav.current = true;
    }
  }, [cycles, navState]);

  /* ── 선택된 싸이클 객체 ── */
  const selectedCycle = useMemo(
    () => cycles?.find(c => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId],
  );

  /* ── 시간대별 그룹핑 ── */
  const grouped = useMemo(() => {
    if (!cycles?.length) return [];
    const map = new Map<number, CycleRangeItem[]>();
    for (const c of cycles) {
      const h = new Date(c.startTime).getHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [cycles]);

  /* ── 스텝 목록 쿼리 ── */
  const { data: steps, isLoading: stepsLoading } = useQuery<StepItem[]>({
    queryKey: ['anl011-steps', selectedCycleId],
    queryFn: () => getCycleSteps(selectedCycleId!),
    enabled: !!selectedCycleId,
  });

  /* ── 스텝 경과시간 변환 ── */
  const stepsElapsed = useMemo(() => {
    if (!steps?.length || !selectedCycle) return [];
    const cycleStartSec = isoToAbsSec(selectedCycle.startTime);
    return steps.map(s => ({
      ...s,
      elStart: isoToAbsSec(s.startTime) - cycleStartSec,
      elEnd: isoToAbsSec(s.endTime) - cycleStartSec,
    }));
  }, [steps, selectedCycle]);

  /* ── 선택된 싸이클의 트렌드 데이터 (1개 쿼리) ── */
  const { data: trendData, isLoading: trendLoading } = useQuery<TrendResult>({
    queryKey: ['anl011-trend', selectedCycle?.id, selectedCycle?.startTime, selectedCycle?.endTime, energyType],
    queryFn: () => getFacilityTrendData(selectedFacility, selectedCycle!.startTime, selectedCycle!.endTime, '1s', energyType) as Promise<TrendResult>,
    enabled: !!selectedCycle,
  });

  /* ── 차트 데이터 변환 (경과시간 기준) ── */
  const { chartData, chartSeries } = useMemo(() => {
    if (!trendData || !selectedCycle) return { chartData: [], chartSeries: [] };
    const tags = trendData.tags ?? [];
    const data = trendData.data ?? [];
    const cycleStartSec = isoToAbsSec(selectedCycle.startTime);
    const color = FACILITY_COLORS[0];
    const allSeries: TrendSeries[] = tags.map(tag => ({
      key: tag.tagName,
      label: `${tag.displayName} (${tag.unit})`,
      color,
      type: 'line' as const,
      width: 2,
    }));

    const elapsedMap = new Map<number, Record<string, any>>();
    for (const pt of data) {
      const time: string = pt.time ?? '';
      const [hh, mm, ss] = time.split(':').map(Number);
      if (isNaN(hh)) continue;
      const absSec = hh * 3600 + mm * 60 + ss;
      const elapsedSec = absSec - cycleStartSec;
      if (elapsedSec < -10 || elapsedSec > selectedCycle.duration + 10) continue;

      if (!elapsedMap.has(elapsedSec)) {
        elapsedMap.set(elapsedSec, { time: secToElapsed(elapsedSec), _sec: elapsedSec });
      }
      const row = elapsedMap.get(elapsedSec)!;
      tags.forEach(tag => {
        if (pt[tag.tagName] !== undefined) row[tag.tagName] = pt[tag.tagName];
      });
    }

    return {
      chartData: Array.from(elapsedMap.values()).sort((a, b) => a._sec - b._sec),
      chartSeries: allSeries,
    };
  }, [trendData, selectedCycle]);

  /* ── 스텝 차트: 베이스 파형(회색) + 스텝별 색 세그먼트 오버레이 ── */
  const { stepChartData, stepChartSeries } = useMemo(() => {
    if (!chartData.length || !stepsElapsed.length || !chartSeries.length) {
      return { stepChartData: [], stepChartSeries: [] };
    }

    // 1) 베이스 파형 시리즈 (회색, 얇은 선 — 항상 전구간 표시)
    const baseSeries: TrendSeries[] = chartSeries.map(orig => ({
      key: `${orig.key}__base`,
      label: `${orig.label} (베이스)`,
      color: '#9CA3AF',
      type: 'line',
      width: 1,
    }));

    // 2) 스텝 컬러 시리즈 (각 스텝 구간만 표시, 두꺼운 선)
    const visibleSteps = stepsElapsed.filter(s => !hiddenSteps.has(s.stepSeq));
    const stepSeries: TrendSeries[] = [];
    for (const step of visibleSteps) {
      const si = stepsElapsed.indexOf(step);
      const color = STEP_COLORS[si % STEP_COLORS.length];
      for (const orig of chartSeries) {
        stepSeries.push({
          key: `${orig.key}__s${step.stepSeq}`,
          label: `S${step.stepSeq} ${orig.label}`,
          color,
          type: 'line',
          width: 2,
        });
      }
    }

    const allSeries = [...baseSeries, ...stepSeries];

    const rows = chartData.map(row => {
      const sec = row._sec as number;
      const newRow: Record<string, any> = { time: row.time, _sec: sec };

      for (const orig of chartSeries) {
        newRow[`${orig.key}__base`] = row[orig.key] ?? null;
      }

      for (const step of visibleSteps) {
        const inStep = sec >= step.elStart && sec <= step.elEnd;
        for (const orig of chartSeries) {
          const stepKey = `${orig.key}__s${step.stepSeq}`;
          newRow[stepKey] = inStep ? row[orig.key] ?? null : null;
        }
      }
      return newRow;
    });

    return { stepChartData: rows, stepChartSeries: allSeries };
  }, [chartData, chartSeries, stepsElapsed, hiddenSteps]);

  const inputCls = 'text-sm bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]';

  return (
    <div className="flex flex-col gap-3 h-full">
      <PageHeader
        title="싸이클 분석"
        description="설비 선택 → 싸이클 선택 → 전력/에어 파형 분석 | 해상도: 1초"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* ═══ 좌측: 설비 트리 (CollapsibleTreePanel) ═══ */}
        <CollapsibleTreePanel
          nodes={tree ?? []}
          checked={checked}
          onCheckedChange={handleCheckedChange}
          expanded={expanded}
          onExpandedChange={setExpanded}
          badgeMap={tagBadgeMap}
          facilityCount={selectedFacility ? 1 : 0}
          maxFacilities={1}
          width={308}
          searchable
          selectedLabel={selectedLabel || undefined}
        />

        {/* ═══ 중앙: 검색조건 + 싸이클 그리드 (동일 슬라이드 패턴) ═══ */}
        <div className="flex flex-shrink-0">
          <div
            className="overflow-hidden transition-[width] duration-300"
            style={{ width: gridOpen ? 480 : 0 }}
          >
            <div className="flex flex-col gap-2 h-full" style={{ width: 480 }}>
              {/* 날짜/시간/에너지 토글 */}
              <div className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm p-3 flex-shrink-0">
                <div className="flex items-end gap-2 flex-wrap">
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">날짜</label>
                    <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedCycleId(null); }} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-1">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-0.5 block">시작</label>
                      <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={cn(inputCls, 'w-[64px]')}>
                        {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 text-sm mt-4">~</span>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-0.5 block">종료</label>
                      <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={cn(inputCls, 'w-[64px]')}>
                        {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 전력/에어 토글 */}
                <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600 mt-2 w-fit">
                  <button
                    onClick={() => setEnergyType('elec')}
                    className={`px-3 py-1 text-xs ${energyType === 'elec' ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                  >
                    전력
                  </button>
                  <button
                    onClick={() => setEnergyType('air')}
                    className={`px-3 py-1 text-xs ${energyType === 'air' ? 'bg-[#E94560] text-white' : 'bg-gray-50 dark:bg-[#0F3460] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                  >
                    에어
                  </button>
                </div>
              </div>

              {/* 싸이클 그리드 */}
              <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
                {/* 헤더 */}
                <div className="grid grid-cols-[30px_1fr_40px_40px_46px_34px] gap-1 px-3 py-2 bg-gray-50 dark:bg-[#0F3460]/50 text-[11px] text-gray-400 font-medium flex-shrink-0">
                  <span>#</span>
                  <span>시간</span>
                  <span>지속</span>
                  <span>상태</span>
                  <span>유사도</span>
                  <span>지연</span>
                </div>

                {/* 목록 */}
                <div className="flex-1 overflow-y-auto">
                  {!selectedFacility ? (
                    <div className="py-12 text-center text-sm text-gray-400">설비를 선택해 주세요</div>
                  ) : cyclesLoading ? (
                    <div className="py-12 text-center text-sm text-gray-400">싸이클 로딩 중...</div>
                  ) : !cycles?.length ? (
                    <div className="py-12 text-center text-sm text-gray-400">해당 조건에 싸이클이 없습니다</div>
                  ) : (
                    grouped.map(([hour, items]) => (
                      <div key={hour}>
                        <div className="px-3 py-1 bg-gray-50/50 dark:bg-[#0F3460]/30 text-[11px] text-gray-400 font-medium sticky top-0">
                          {String(hour).padStart(2, '0')}:00 ~ {String(hour + 1).padStart(2, '0')}:00 ({items.length}개)
                        </div>
                        {items.map(c => {
                          const isSelected = c.id === selectedCycleId;
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCycleId(c.id)}
                              className={cn(
                                'grid grid-cols-[30px_1fr_40px_40px_46px_34px] gap-1 px-3 py-1.5 text-[13px] cursor-pointer border-b border-gray-50 dark:border-gray-700/30 transition-colors',
                                isSelected
                                  ? 'bg-[#E94560]/10 dark:bg-[#E94560]/20 ring-1 ring-[#E94560]/50'
                                  : 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                              )}
                            >
                              <span className="text-gray-500 dark:text-gray-400 font-mono">#{c.cycleNumber}</span>
                              <span className="text-gray-700 dark:text-gray-200 font-mono">
                                {isoToHms(c.startTime)}~{isoToHms(c.endTime)}
                              </span>
                              <span className="text-gray-600 dark:text-gray-300 font-mono">{c.duration}s</span>
                              <span>
                                <span className={cn('px-1 py-0.5 rounded text-[11px] font-medium', STATUS_COLORS[c.status])}>
                                  {STATUS_LABELS[c.status]}
                                </span>
                              </span>
                              <span className="text-gray-600 dark:text-gray-300 font-mono">{c.similarity}%</span>
                              <span className="text-gray-500 dark:text-gray-400 font-mono">{c.delay}s</span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* 하단 정보 */}
                {cycles && cycles.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 text-right border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                    총 {cycles.length}개 싸이클 {selectedCycle && `| 선택: #${selectedCycle.cycleNumber}`}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* 그리드 토글 버튼 (항상 표시) */}
          <button
            onClick={() => setGridOpen(v => !v)}
            className="w-5 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded"
            title={gridOpen ? '싸이클 목록 접기' : '싸이클 목록 펼치기'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {gridOpen ? <polyline points="8,2 4,6 8,10" /> : <polyline points="4,2 8,6 4,10" />}
            </svg>
          </button>
        </div>

        {/* ═══ 우측: 싸이클 차트 + 스텝 차트 ═══ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* 싸이클 정보 바 */}
          {selectedCycle && (
            <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FACILITY_COLORS[0] }} />
              <span className="text-[13px] font-bold text-gray-700 dark:text-white">{selectedLabel}</span>
              <span className="text-xs text-gray-500 font-mono">#{selectedCycle.cycleNumber}</span>
              <span className="text-xs text-gray-500 font-mono">
                {isoToHms(selectedCycle.startTime)} ~ {isoToHms(selectedCycle.endTime)}
              </span>
              <span className="text-xs text-gray-500 font-mono">{selectedCycle.duration}s</span>
              <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium', STATUS_COLORS[selectedCycle.status])}>
                {STATUS_LABELS[selectedCycle.status]}
              </span>
              <span className="text-xs text-gray-500 font-mono ml-auto">유사도 {selectedCycle.similarity}%</span>
              <span className="text-xs text-gray-500 font-mono">지연 {selectedCycle.delay}s</span>
            </div>
          )}

          {/* 싸이클 차트 */}
          <ChartCard
            title={selectedCycle
              ? `싸이클 파형 — ${energyType === 'elec' ? '전력(kW)' : '에어(m³/min)'}`
              : `싸이클 파형`
            }
            subtitle="해상도: 1초 | X축: 싸이클 시작 기준 경과시간"
            className="flex-1 min-h-0"
            chartId="anl011-cycle"
            exportData={chartData}
            exportFilename="싸이클분석_파형"
            minHeight={0}
          >
            {!selectedCycle ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                좌측 그리드에서 싸이클을 선택하세요
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {trendLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
              </div>
            ) : (
              <TrendChart
                data={chartData}
                series={chartSeries}
                xKey="time"
                yLabel={energyType === 'elec' ? '순시값(kW)' : '유량(m³/min)'}
                syncKey="anl011"
                showLegend={true}
                isLoading={trendLoading}
                loadingMessage="1초 데이터 로딩 중..."
              />
            )}
          </ChartCard>

          {/* 스텝 분석 */}
          <ChartCard
            title="스텝 분석"
            subtitle={selectedCycle ? `#${selectedCycle.cycleNumber} 싸이클 — ${stepsElapsed.length}개 스텝` : '싸이클을 선택하면 스텝이 표시됩니다'}
            className="flex-1 min-h-0"
            chartId="anl011-step"
            minHeight={0}
          >
            {!selectedCycle ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                싸이클을 선택하면 스텝이 표시됩니다
              </div>
            ) : stepsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                스텝 로딩 중...
              </div>
            ) : stepsElapsed.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                이 싸이클에 스텝 데이터가 없습니다
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-3 h-full">
                {/* 스텝 타임라인 바 */}
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">스텝 타임라인 (경과시간 기준)</div>
                  <div className="flex h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                    {stepsElapsed.map((s, i) => {
                      const totalDur = selectedCycle.duration || 1;
                      const width = Math.max(0.5, ((s.elEnd - s.elStart) / totalDur) * 100);
                      const isHidden = hiddenSteps.has(s.stepSeq);
                      return (
                        <div
                          key={s.stepSeq}
                          className={cn(
                            'relative flex items-center justify-center text-[10px] font-medium overflow-hidden cursor-pointer transition-opacity',
                            isHidden ? 'opacity-30' : 'text-white hover:brightness-110',
                          )}
                          style={{ width: `${width}%`, backgroundColor: STEP_COLORS[i % STEP_COLORS.length] }}
                          title={`${isHidden ? '[숨김] ' : ''}Step ${s.stepSeq}: ${secToElapsed(s.elStart)} ~ ${secToElapsed(s.elEnd)} (${s.durationSec}s) — 클릭하여 토글`}
                          onClick={() => setHiddenSteps(prev => {
                            const next = new Set(prev);
                            if (next.has(s.stepSeq)) next.delete(s.stepSeq);
                            else next.add(s.stepSeq);
                            return next;
                          })}
                        >
                          {width > 5 && (
                            <span className={isHidden ? 'line-through text-white/60' : ''}>
                              S{s.stepSeq}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 경과시간 눈금 */}
                  <div className="relative h-3 mt-0.5">
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
                      <span
                        key={ratio}
                        className="absolute text-[9px] text-gray-400 -translate-x-1/2"
                        style={{ left: `${ratio * 100}%` }}
                      >
                        {secToElapsed(Math.round((selectedCycle.duration || 0) * ratio))}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 스텝별 색상 파형 차트 */}
                <div className="flex-1 min-h-0">
                  {stepChartData.length > 0 ? (
                    <TrendChart
                      data={stepChartData}
                      series={stepChartSeries}
                      xKey="time"
                      yLabel={energyType === 'elec' ? '순시값(kW)' : '유량(m³/min)'}
                      syncKey="anl011"
                      showLegend={false}
                      spanGaps={false}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">
                      파형 데이터 없음
                    </div>
                  )}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
