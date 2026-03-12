import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Modal from './Modal';
import TreeCheckbox, { type TreeNode } from './TreeCheckbox';
import { getFacilityTree, getCyclesInRange, getFacilityTagCounts } from '../../services/analysis';
import type { CycleRangeItem } from '../../services/analysis';
import { cn } from '../../lib/utils';

const GROUP_IDS = ['plant', 'block', 'head', 'crank', 'assembly'];

interface ExistingSeriesInfo {
  facilityId: string;
  facilityLabel: string;
  cycle: CycleRangeItem;
  color: string;
}

interface CyclePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (facilityId: string, facilityLabel: string, cycle: CycleRangeItem) => void;
  existingSeries?: ExistingSeriesInfo[];
}

/** YYYY-MM-DD (로컬 타임존) */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY = toLocalDate(new Date());

const STATUS_COLORS = {
  normal: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  delayed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  anomaly: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};
const STATUS_LABELS = { normal: '정상', delayed: '지연', anomaly: '이상' };

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** ISO → HH:mm:ss */
function isoToHms(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/** 트리 노드 재귀 필터링 */
function filterTree(nodes: TreeNode[], term: string): TreeNode[] {
  if (!term) return nodes;
  const lower = term.toLowerCase();
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const match = node.label.toLowerCase().includes(lower);
    const children = node.children ? filterTree(node.children, term) : [];
    if (match || children.length > 0) {
      acc.push({ ...node, children: children.length > 0 ? children : node.children });
    }
    return acc;
  }, []);
}

/** 트리에서 ID로 label 찾기 */
function findLabel(nodes: TreeNode[], id: string): string | undefined {
  for (const node of nodes) {
    if (node.id === id) return node.label;
    if (node.children) {
      const found = findLabel(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export default function CyclePickerModal({ isOpen, onClose, onSelect, existingSeries }: CyclePickerModalProps) {
  /* ── 설비 트리 상태 ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(GROUP_IDS));

  /* ── 날짜 + 시간 범위 상태 ── */
  const [date, setDate] = useState(TODAY);
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(23);

  /* ── 하이라이트 상태 ── */
  const [highlightCycleId, setHighlightCycleId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  /* ── 설비 트리 데이터 ── */
  const { data: tree } = useQuery({ queryKey: ['anl-tree'], queryFn: getFacilityTree });
  const { data: elecCounts } = useQuery({ queryKey: ['picker-tag-counts', 'elec'], queryFn: () => getFacilityTagCounts('elec') });
  const { data: airCounts } = useQuery({ queryKey: ['picker-tag-counts', 'air'], queryFn: () => getFacilityTagCounts('air') });
  const filteredTree = useMemo(() => filterTree(tree ?? [], searchTerm), [tree, searchTerm]);

  /* ── 전력/에어 태그 수량 뱃지 ── */
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

  /* ── 단일 선택 모드 ── */
  const handleCheckedChange = useCallback((next: Set<string>) => {
    const leafIds = Array.from(next).filter(id => !GROUP_IDS.includes(id));
    if (leafIds.length === 0) { setChecked(new Set()); return; }
    const prev = Array.from(checked).filter(id => !GROUP_IDS.includes(id));
    const newId = leafIds.find(id => !prev.includes(id)) ?? leafIds[leafIds.length - 1];
    setChecked(new Set([newId]));
  }, [checked]);

  const selectedFacility = Array.from(checked).find(id => !GROUP_IDS.includes(id)) ?? '';
  const selectedLabel = selectedFacility && tree ? (findLabel(tree, selectedFacility) ?? selectedFacility) : '';

  /* ── 시간 범위 쿼리 ── */
  const rangeStart = `${date}T${String(startHour).padStart(2, '0')}:00:00+09:00`;
  const rangeEnd = `${date}T${String(endHour).padStart(2, '0')}:59:59+09:00`;

  const { data: cycles, isLoading } = useQuery<CycleRangeItem[]>({
    queryKey: ['cycle-picker', selectedFacility, date, startHour, endHour],
    queryFn: () => getCyclesInRange(selectedFacility, rangeStart, rangeEnd),
    enabled: isOpen && !!selectedFacility,
  });

  /* ── 등록된 싸이클 ID 셋 ── */
  const existingCycleIds = useMemo(
    () => new Set(existingSeries?.map(s => s.cycle.id) ?? []),
    [existingSeries],
  );

  /* ── 하이라이트 스크롤 ── */
  useEffect(() => {
    if (highlightCycleId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 150);
    }
  }, [highlightCycleId, cycles]);

  /* ── 등록 시리즈 클릭 → 해당 싸이클로 이동 ── */
  const handleNavigateToSeries = useCallback((s: ExistingSeriesInfo) => {
    setChecked(new Set([s.facilityId]));
    setSearchTerm('');
    setExpanded(new Set(GROUP_IDS));
    const d = new Date(s.cycle.startTime);
    setDate(toLocalDate(d));
    const h = d.getHours();
    setStartHour(Math.max(0, h - 1));
    setEndHour(Math.min(23, h + 1));
    setHighlightCycleId(s.cycle.id);
  }, []);

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

  const handleSelect = (cycle: CycleRangeItem) => {
    onSelect(selectedFacility, selectedLabel, cycle);
  };

  const inputCls = 'text-sm bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="싸이클 선택" size="lg">
      {/* ── 등록된 시리즈 바로가기 ── */}
      {existingSeries && existingSeries.length > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="text-[11px] text-gray-400 mb-1.5">등록된 싸이클</div>
          <div className="flex flex-wrap gap-1.5">
            {existingSeries.map(s => (
              <button
                key={s.cycle.id}
                onClick={() => handleNavigateToSeries(s)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-600 hover:border-[#E94560] hover:bg-[#E94560]/5 dark:hover:bg-[#E94560]/10 transition-colors"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-gray-700 dark:text-gray-300">{s.facilityLabel}</span>
                <span className="text-gray-400 font-mono">#{s.cycle.cycleNumber}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* ── 좌측: 설비 트리 ── */}
        <div className="w-[240px] flex-shrink-0">
          <label className="text-[10px] text-gray-400 mb-1 block">설비</label>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="설비명 검색..."
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]"
            />
          </div>
          <div className="max-h-[380px] overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg p-1.5">
            <TreeCheckbox
              nodes={filteredTree}
              checked={checked}
              onCheckedChange={handleCheckedChange}
              expanded={expanded}
              onExpandedChange={setExpanded}
              badgeMap={tagBadgeMap}
            />
          </div>
          {selectedFacility && (
            <div className="mt-1.5 text-[10px] text-[#E94560] truncate">
              선택: {selectedLabel}
            </div>
          )}
        </div>

        {/* ── 우측: 날짜/시간 + 싸이클 목록 ── */}
        <div className="flex-1 min-w-0">
          {/* 날짜 + 시간 범위 */}
          <div className="flex items-end gap-2 mb-3 flex-wrap">
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 block">날짜</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-1">
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">시작</label>
                <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={inputCls}>
                  {HOURS.map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <span className="text-gray-400 text-sm mt-4">~</span>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">종료</label>
                <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={inputCls}>
                  {HOURS.map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:59</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 싸이클 목록 */}
          <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* 헤더 */}
            <div className="grid grid-cols-[26px_1fr_34px_36px_42px_30px] gap-1 px-3 py-2 bg-gray-50 dark:bg-[#0F3460]/50 text-[11px] text-gray-400 font-medium">
              <span>#</span>
              <span>시간</span>
              <span>지속</span>
              <span>상태</span>
              <span>유사도</span>
              <span>지연</span>
            </div>

            {/* 목록 */}
            <div className="max-h-[340px] overflow-y-auto">
              {!selectedFacility ? (
                <div className="py-12 text-center text-sm text-gray-400">설비를 선택해 주세요</div>
              ) : isLoading ? (
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
                      const isHighlight = c.id === highlightCycleId;
                      const isExisting = existingCycleIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          ref={isHighlight ? highlightRef : undefined}
                          onClick={() => handleSelect(c)}
                          className={cn(
                            'grid grid-cols-[26px_1fr_34px_36px_42px_30px] gap-1 px-3 py-1.5 text-[13px] cursor-pointer border-b border-gray-50 dark:border-gray-700/30 transition-colors',
                            isHighlight
                              ? 'bg-[#E94560]/10 dark:bg-[#E94560]/20 ring-1 ring-[#E94560]/50'
                              : isExisting
                                ? 'bg-blue-50 dark:bg-blue-900/20'
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
          </div>

          {/* 하단 정보 */}
          {cycles && cycles.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400 text-right">
              총 {cycles.length}개 싸이클 | 클릭하여 선택
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
