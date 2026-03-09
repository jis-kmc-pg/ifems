import { useState, useMemo, useCallback } from 'react';
import { toast } from '../lib/toast';
import type { Interval } from '../types/chart';
import type { FilterItem } from '../components/ui/FilterBar';

// ── 상수 ──
const TODAY = new Date().toISOString().slice(0, 10);

const SEARCH_UNIT_OPTIONS = [
  { value: '1d', label: '일' },
  { value: '1h', label: '시' },
  { value: '15m', label: '15분' },
  { value: '5m', label: '5분' },
  { value: '1m', label: '1분' },
] as const;

const DATE_TYPE_OPTIONS = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
] as const;

// ── 유틸 ──
function toKstIso(d: Date, time: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}+09:00`;
}

// ── 줌 체인: 검색 단위부터 하위 레벨까지 ──
const ZOOM_CHAIN: Interval[] = ['1d', '1h', '15m', '5m', '1m'];

export type SearchMode = 'range' | 'specific';
export type DateType = 'month' | 'week' | 'day';

export interface UseSearchFilterOptions {
  /** 초기 검색 모드 (기본: 'specific') */
  defaultMode?: SearchMode;
  /** 초기 검색 단위 (기본: '1h') */
  defaultUnit?: Interval;
  /** 초기 날짜지정 유형 (기본: 'day') */
  defaultDateType?: DateType;
}

export interface UseSearchFilterReturn {
  searchMode: SearchMode;
  searchUnit: Interval;
  startTime: string;
  endTime: string;
  zoomLevels: Interval[];
  exportDate: string;
  filters: FilterItem[];
}

/**
 * 검색 필터 로직 훅
 *
 * 검색 모드(검색기간/날짜지정), 날짜 범위, 검색 단위, 줌 레벨 체인을
 * 관리하고 FilterBar에 전달할 filter 배열을 반환합니다.
 */
export function useSearchFilter(options?: UseSearchFilterOptions): UseSearchFilterReturn {
  const {
    defaultMode = 'specific',
    defaultUnit = '1h',
    defaultDateType = 'day',
  } = options ?? {};

  // ── 검색 모드 ──
  const [searchMode, setSearchMode] = useState<SearchMode>(defaultMode);

  // ── 검색기간 모드 ──
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);

  // ── 날짜지정 모드 ──
  const [dateType, setDateType] = useState<DateType>(defaultDateType);
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // ── 검색 단위 (공통) ──
  const [searchUnit, setSearchUnit] = useState<Interval>(defaultUnit);

  // ── 시작일 변경 (역전 보정) ──
  const handleStartDateChange = useCallback((v: string) => {
    setStartDate(v);
    if (v > endDate) {
      setEndDate(v);
      toast.warning(`시작일(${v})이 종료일 이후여서 종료일을 동일하게 설정했습니다.`);
    }
  }, [endDate]);

  // ── 종료일 변경 (역전 보정) ──
  const handleEndDateChange = useCallback((v: string) => {
    setEndDate(v);
    if (v < startDate) {
      setStartDate(v);
      toast.warning(`종료일(${v})이 시작일 이전이어서 시작일을 동일하게 설정했습니다.`);
    }
  }, [startDate]);

  // ── startTime / endTime 계산 ──
  const { startTime, endTime } = useMemo(() => {
    if (searchMode === 'range') {
      return {
        startTime: `${startDate}T00:00:00+09:00`,
        endTime: `${endDate}T23:59:59+09:00`,
      };
    }
    const d = new Date(selectedDate + 'T00:00:00');
    switch (dateType) {
      case 'month': {
        const first = new Date(d.getFullYear(), d.getMonth(), 1);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return {
          startTime: toKstIso(first, '00:00:00'),
          endTime: toKstIso(last, '23:59:59'),
        };
      }
      case 'week': {
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          startTime: toKstIso(monday, '00:00:00'),
          endTime: toKstIso(sunday, '23:59:59'),
        };
      }
      case 'day':
      default:
        return {
          startTime: `${selectedDate}T00:00:00+09:00`,
          endTime: `${selectedDate}T23:59:59+09:00`,
        };
    }
  }, [searchMode, startDate, endDate, dateType, selectedDate]);

  // ── 동적 zoomLevels ──
  const zoomLevels = useMemo(() => {
    const idx = ZOOM_CHAIN.indexOf(searchUnit);
    return idx >= 0 ? ZOOM_CHAIN.slice(idx) : (['15m', '5m', '1m'] as Interval[]);
  }, [searchUnit]);

  // ── exportFilename용 날짜 문자열 ──
  const exportDate = searchMode === 'range' ? `${startDate}_${endDate}` : selectedDate;

  // ── FilterBar filter 배열 ──
  const filters: FilterItem[] = useMemo(() => {
    const btnClass = (active: boolean) =>
      `px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[#E94560] text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`;

    const base: FilterItem[] = [
      {
        type: 'custom',
        key: 'searchMode',
        label: '',
        render: () => (
          <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setSearchMode('range')}
              className={btnClass(searchMode === 'range')}
            >
              검색기간
            </button>
            <button
              onClick={() => setSearchMode('specific')}
              className={btnClass(searchMode === 'specific')}
            >
              날짜지정
            </button>
          </div>
        ),
      },
    ];

    if (searchMode === 'range') {
      base.push(
        { type: 'date', key: 'startDate', label: '', value: startDate, onChange: handleStartDateChange },
        {
          type: 'custom', key: 'tilde', label: '',
          render: () => <span className="text-xs text-gray-500 dark:text-gray-400">~</span>,
        },
        { type: 'date', key: 'endDate', label: '', value: endDate, onChange: handleEndDateChange },
      );
    } else {
      base.push(
        {
          type: 'select', key: 'dateType', label: '', value: dateType,
          onChange: (v: string) => setDateType(v as DateType),
          options: DATE_TYPE_OPTIONS,
        },
        { type: 'date', key: 'selectedDate', label: '', value: selectedDate, onChange: setSelectedDate },
      );
    }

    base.push({
      type: 'select', key: 'searchUnit', label: '검색단위', value: searchUnit,
      onChange: (v: string) => setSearchUnit(v as Interval),
      options: SEARCH_UNIT_OPTIONS,
    });

    return base;
  }, [searchMode, startDate, endDate, dateType, selectedDate, searchUnit, handleStartDateChange, handleEndDateChange]);

  return {
    searchMode,
    searchUnit,
    startTime,
    endTime,
    zoomLevels,
    exportDate,
    filters,
  };
}
