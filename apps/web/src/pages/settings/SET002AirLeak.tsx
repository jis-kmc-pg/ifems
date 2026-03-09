import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useSettingsTable } from '../../hooks/useSettingsTable';
import {
  getAirLeakSettings, saveAirLeakSettings, SettingRow,
  getAllNonProductionSchedules, saveNonProductionSchedules,
  getProductionCalendar, createProductionCalendar, deleteProductionCalendar,
  type LineSchedule, type NonProductionScheduleItem, type ProductionCalendarEntry,
} from '../../services/settings';
import { PROCESS_OPTIONS } from '../../lib/filter-options';
import { toast } from '../../lib/toast';

const DAY_TYPE_LABELS: Record<string, string> = { weekday: '평일', saturday: '토요일', sunday: '일요일/공휴일' };
const CAL_TYPE_LABELS: Record<string, string> = { holiday: '휴일', workday: '특근', shutdown: '정기보전' };
const CAL_TYPE_COLORS: Record<string, string> = {
  holiday: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  workday: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  shutdown: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const BAR_TICKS = [0, 6, 12, 18, 24];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = (min: number) => {
  const c = Math.max(0, Math.min(min, 1410));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${c % 60 >= 15 && c % 60 < 45 ? '30' : '00'}`;
};
const snap30 = (min: number) => Math.round(min / 30) * 30;

/** 드래그로 시간 조절 가능한 인터랙티브 타임바 */
function InteractiveTimeBar({
  start, end, onStartChange, onEndChange,
}: {
  start: string; end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const onStartRef = useRef(onStartChange);
  const onEndRef = useRef(onEndChange);
  onStartRef.current = onStartChange;
  onEndRef.current = onEndChange;

  const getMinFromX = useCallback((clientX: number) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return snap30(Math.max(0, Math.min((clientX - rect.left) / rect.width, 1)) * 1440);
  }, []);

  // 드래그 로직
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const time = fromMin(getMinFromX(e.clientX));
      if (dragging === 'start') onStartRef.current(time);
      else onEndRef.current(time);
    };
    const handleUp = () => setDragging(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, [dragging, getMinFromX]);

  const sMin = toMin(start), eMin = toMin(end);
  const sPos = (sMin / 1440) * 100, ePos = (eMin / 1440) * 100;

  // 빈 공간 클릭 → 가까운 핸들 이동
  const handleBarClick = (e: React.MouseEvent) => {
    const min = getMinFromX(e.clientX);
    const time = fromMin(min);
    if (Math.abs(min - sMin) <= Math.abs(min - eMin)) onStartChange(time);
    else onEndChange(time);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* 시간 레이블 (세로 2줄) */}
      <div className="flex flex-col items-end gap-0 shrink-0 w-10">
        <span className="text-[10px] font-mono font-bold text-[#27AE60] leading-tight">{start}</span>
        <span className="text-[10px] font-mono font-bold text-[#E94560] leading-tight">{end}</span>
      </div>
      {/* 바 */}
      <div className="flex-1 pb-3">
        <div
          ref={barRef}
          className="relative h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full cursor-pointer select-none"
          onMouseDown={handleBarClick}
        >
          {/* 생산 구간 (초록) */}
          {sMin <= eMin ? (
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-gradient-to-r from-[#27AE60] to-[#2ECC71]"
              style={{ left: `${sPos}%`, width: `${ePos - sPos}%` }}
            />
          ) : (
            <>
              <div className="absolute top-0.5 bottom-0.5 left-0 rounded-l-full bg-gradient-to-r from-[#27AE60] to-[#2ECC71]" style={{ width: `${ePos}%` }} />
              <div className="absolute top-0.5 bottom-0.5 right-0 rounded-r-full bg-gradient-to-l from-[#27AE60] to-[#2ECC71]" style={{ width: `${100 - sPos}%` }} />
            </>
          )}
          {/* 시간 눈금 */}
          {BAR_TICKS.map((h) => (
            <div key={h} className="absolute top-full -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>
              <div className="w-px h-1 bg-gray-300 dark:bg-gray-600 mx-auto" />
              <span className="text-[7px] text-gray-400 block text-center leading-tight">{h}</span>
            </div>
          ))}
          {/* 시작 핸들 (초록) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-gray-100 border-[2.5px] border-[#27AE60] shadow-md z-10 transition-transform ${
              dragging === 'start' ? 'scale-125 cursor-grabbing' : 'cursor-grab hover:scale-110'
            }`}
            style={{ left: `${sPos}%` }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging('start'); }}
          />
          {/* 종료 핸들 (빨강) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-gray-100 border-[2.5px] border-[#E94560] shadow-md z-10 transition-transform ${
              dragging === 'end' ? 'scale-125 cursor-grabbing' : 'cursor-grab hover:scale-110'
            }`}
            style={{ left: `${ePos}%` }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging('end'); }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SET002AirLeak() {
  const [process, setProcess] = useState('');
  const [scheduleTab, setScheduleTab] = useState<'schedule' | 'calendar'>('schedule');
  const queryClient = useQueryClient();

  // 기존 임계값 테이블
  const { isLoading, dirty, saveMutation, updateRow, filterByProcess } = useSettingsTable<SettingRow>({
    queryKey: 'set-air', fetchFn: getAirLeakSettings, saveFn: saveAirLeakSettings,
  });
  const filtered = filterByProcess(process);

  // ─── 생산시간 스케줄 ───
  const { data: lineSchedules = [] } = useQuery<LineSchedule[]>({
    queryKey: ['non-production-schedules'],
    queryFn: getAllNonProductionSchedules,
  });

  const [editingSchedules, setEditingSchedules] = useState<Record<string, NonProductionScheduleItem[]>>({});
  const [scheduleDirty, setScheduleDirty] = useState(false);

  const getScheduleForLine = useCallback((lineId: string): NonProductionScheduleItem[] => {
    if (editingSchedules[lineId]) return editingSchedules[lineId];
    const found = lineSchedules.find((l) => l.lineId === lineId);
    // 기본값: 평일/토/일 세 행 항상 표시
    const existing = found?.schedules ?? [];
    return (['weekday', 'saturday', 'sunday'] as const).map((dt) => {
      const s = existing.find((e) => e.dayType === dt);
      return s ?? { dayType: dt, startTime: '08:00', endTime: '18:00' };
    });
  }, [editingSchedules, lineSchedules]);

  const updateSchedule = useCallback((lineId: string, dayType: string, field: 'startTime' | 'endTime', value: string) => {
    setEditingSchedules((prev) => {
      const current = prev[lineId] ?? getScheduleForLine(lineId);
      return {
        ...prev,
        [lineId]: current.map((s) => s.dayType === dayType ? { ...s, [field]: value } : s),
      };
    });
    setScheduleDirty(true);
  }, [getScheduleForLine]);

  const scheduleSaveMutation = useMutation({
    mutationFn: async () => {
      const targets = Object.entries(editingSchedules);
      for (const [lineId, schedules] of targets) {
        await saveNonProductionSchedules(lineId, schedules.map(({ dayType, startTime, endTime }) => ({ dayType, startTime, endTime })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-production-schedules'] });
      setEditingSchedules({});
      setScheduleDirty(false);
      toast.success('생산시간 스케줄이 저장되었습니다.');
    },
    onError: () => toast.error('스케줄 저장에 실패했습니다.'),
  });

  // ─── 생산 캘린더 ───
  const currentYear = new Date().getFullYear();
  const [calYear, setCalYear] = useState(currentYear);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);

  const { data: calendarEntries = [] } = useQuery<ProductionCalendarEntry[]>({
    queryKey: ['production-calendar', calYear, calMonth],
    queryFn: () => getProductionCalendar({ year: calYear, month: calMonth }),
  });

  const [newCal, setNewCal] = useState({ date: '', type: 'holiday' as string, description: '', lineId: '' });

  const addCalMutation = useMutation({
    mutationFn: () => createProductionCalendar({
      date: newCal.date,
      type: newCal.type,
      description: newCal.description || undefined,
      lineId: newCal.lineId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-calendar'] });
      setNewCal({ date: '', type: 'holiday', description: '', lineId: '' });
      toast.success('캘린더 일정이 추가되었습니다.');
    },
    onError: () => toast.error('캘린더 일정 추가에 실패했습니다.'),
  });

  const deleteCalMutation = useMutation({
    mutationFn: deleteProductionCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-calendar'] });
      toast.success('캘린더 일정이 삭제되었습니다.');
    },
    onError: () => toast.error('캘린더 일정 삭제에 실패했습니다.'),
  });

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에어 누기 설정" description="생산시간 설정 및 설비별 에어 기준값/누기율 임계값 설정" />

      {/* ── 비생산시간 설정 영역 ── */}
      <div className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex-shrink-0">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">생산시간 설정</span>
            <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 ml-3">
              {(['schedule', 'calendar'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setScheduleTab(tab)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    scheduleTab === tab
                      ? 'bg-[#E94560] text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'schedule' ? '정기 스케줄' : '캘린더 (예외)'}
                </button>
              ))}
            </div>
          </div>
          {scheduleTab === 'schedule' && (
            <button
              onClick={() => scheduleSaveMutation.mutate()}
              disabled={!scheduleDirty || scheduleSaveMutation.isPending}
              className="px-3 py-1.5 bg-[#E94560] hover:bg-[#C73B52] text-white text-xs font-medium rounded-md disabled:opacity-40"
            >
              {scheduleSaveMutation.isPending ? '저장 중...' : '스케줄 저장'}
            </button>
          )}
        </div>

        {scheduleTab === 'schedule' ? (
          /* ── 정기 스케줄 탭 ── */
          <div className="p-4 max-h-72 overflow-auto">
            <div className="space-y-0">
              {/* 헤더 */}
              <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">라인</div>
                {(['weekday', 'saturday', 'sunday'] as const).map((dt, i) => (
                  <div key={dt} className={`text-xs font-semibold text-gray-600 dark:text-gray-300 text-center${i > 0 ? ' border-l border-gray-200 dark:border-gray-700' : ''}`}>
                    {DAY_TYPE_LABELS[dt]}
                  </div>
                ))}
              </div>
              {/* 행 */}
              {lineSchedules.map((line) => {
                const schedules = getScheduleForLine(line.lineId);
                return (
                  <div key={line.lineId} className="grid grid-cols-[100px_1fr_1fr_1fr] gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 items-center">
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={`${line.lineName} (${line.lineCode})`}>
                      {line.lineName}
                      <span className="block text-[9px] text-gray-400 font-normal">{line.lineCode}</span>
                    </div>
                    {(['weekday', 'saturday', 'sunday'] as const).map((dt, i) => {
                      const s = schedules.find((sc) => sc.dayType === dt)!;
                      return (
                        <div key={dt} className={`px-1${i > 0 ? ' border-l border-gray-200 dark:border-gray-700' : ''}`}>
                          <InteractiveTimeBar
                            start={s.startTime}
                            end={s.endTime}
                            onStartChange={(v) => updateSchedule(line.lineId, dt, 'startTime', v)}
                            onEndChange={(v) => updateSchedule(line.lineId, dt, 'endTime', v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {lineSchedules.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-6">라인 데이터를 불러오는 중...</div>
            )}
          </div>
        ) : (
          /* ── 캘린더 (예외) 탭 ── */
          <div className="p-4">
            {/* 추가 폼 */}
            <div className="flex items-end gap-2 mb-3 flex-wrap">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">날짜</label>
                <input
                  type="date"
                  value={newCal.date}
                  onChange={(e) => setNewCal((p) => ({ ...p, date: e.target.value }))}
                  className="w-36 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">유형</label>
                <select
                  value={newCal.type}
                  onChange={(e) => setNewCal((p) => ({ ...p, type: e.target.value }))}
                  className="w-24 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                >
                  <option value="holiday">휴일</option>
                  <option value="workday">특근</option>
                  <option value="shutdown">정기보전</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">설명</label>
                <input
                  type="text"
                  value={newCal.description}
                  placeholder="예: 설날, 특근, 정기보전"
                  onChange={(e) => setNewCal((p) => ({ ...p, description: e.target.value }))}
                  className="w-40 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">적용 라인</label>
                <select
                  value={newCal.lineId}
                  onChange={(e) => setNewCal((p) => ({ ...p, lineId: e.target.value }))}
                  className="w-28 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                >
                  <option value="">전체 공장</option>
                  {lineSchedules.map((l) => (
                    <option key={l.lineId} value={l.lineId}>{l.lineName}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => addCalMutation.mutate()}
                disabled={!newCal.date || addCalMutation.isPending}
                className="px-3 py-1.5 bg-[#27AE60] hover:bg-[#219A52] text-white text-xs font-medium rounded-md disabled:opacity-40"
              >
                추가
              </button>
            </div>

            {/* 월 선택 + 목록 */}
            <div className="flex items-center gap-2 mb-2">
              <select
                value={calYear}
                onChange={(e) => setCalYear(Number(e.target.value))}
                className="bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={calMonth}
                onChange={(e) => setCalMonth(Number(e.target.value))}
                className="bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
              <span className="text-xs text-gray-400 ml-2">{calendarEntries.length}개 항목</span>
            </div>

            <div className="max-h-40 overflow-auto">
              {calendarEntries.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-4">등록된 예외 일정이 없습니다</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {['날짜', '유형', '설명', '적용 범위', ''].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-gray-100 dark:border-gray-700/50">
                        <td className="px-2 py-1.5 font-mono text-gray-800 dark:text-gray-200">{entry.date}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CAL_TYPE_COLORS[entry.type]}`}>
                            {CAL_TYPE_LABELS[entry.type]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{entry.description ?? '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{entry.lineName ?? '전체 공장'}</td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => deleteCalMutation.mutate(entry.id)}
                            className="text-red-500 hover:text-red-700 text-[10px]"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 기존 임계값 테이블 ── */}
      <div className="flex items-end gap-3 flex-shrink-0">
        <FilterBar
          filters={[{ type: 'select', key: 'process', label: '공정', value: process, onChange: setProcess, options: PROCESS_OPTIONS }]}
          onSearch={() => {}}
          className="mb-0 flex-1"
        />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
        >
          {saveMutation.isPending ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">에어 누기 기준값 ({filtered.length}개 설비)</span>
          <span className="ml-3 text-xs text-gray-400">비생산 기준 = 스탑 사이클 중 에어 소비량 기준값</span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '비생산 에어 기준(L)', '누기율 임계(%)', '활성화'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.code}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.process}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={row.threshold1}
                        step={100}
                        min={1000}
                        max={50000}
                        onChange={(e) => updateRow(row.id, 'threshold1', parseInt(e.target.value) || 0)}
                        className="w-24 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={row.threshold2}
                        step={5}
                        min={5}
                        max={100}
                        onChange={(e) => updateRow(row.id, 'threshold2', parseInt(e.target.value) || 0)}
                        className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <ToggleSwitch value={row.enabled} onChange={(v) => updateRow(row.id, 'enabled', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

