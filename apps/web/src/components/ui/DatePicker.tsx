import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;            // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({ value, onChange, id, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateStr(value || new Date().toISOString().slice(0, 10));
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 캘린더 열 때 현재 선택된 날짜의 월로 이동
  const handleOpen = useCallback(() => {
    const p = parseDateStr(value || new Date().toISOString().slice(0, 10));
    setViewYear(p.year);
    setViewMonth(p.month);
    setOpen((prev) => !prev);
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (day: number) => {
    onChange(toDateStr(viewYear, viewMonth, day));
    setOpen(false);
  };

  // 달력 그리드 생성
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const today = new Date().toISOString().slice(0, 10);

  // 표시 텍스트
  const displayText = value
    ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`
    : '날짜 선택';

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {/* 트리거 버튼 */}
      <button
        id={id}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 hover:border-[#E94560] dark:hover:border-[#27AE60] focus:outline-none focus:ring-1 focus:ring-[#E94560] dark:focus:ring-[#27AE60] transition-colors cursor-pointer whitespace-nowrap"
      >
        <Calendar size={12} className="text-gray-400 dark:text-gray-500" />
        {displayText}
      </button>

      {/* 캘린더 드롭다운 */}
      {open && (
        <div
          ref={calendarRef}
          className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-[260px] select-none"
        >
          {/* 헤더: < 2026년 03월 > */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {viewYear}년 {pad(viewMonth + 1)}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`text-center text-[10px] font-medium py-1 ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - firstDay + 1;
              const isValid = day >= 1 && day <= daysInMonth;
              if (!isValid) {
                return <div key={i} className="p-1" />;
              }

              const dateStr = toDateStr(viewYear, viewMonth, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === today;
              const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`
                    p-1 text-xs rounded-md transition-colors text-center leading-6
                    ${isSelected
                      ? 'bg-[#E94560] text-white font-semibold'
                      : isToday
                        ? 'bg-[#E94560]/10 text-[#E94560] dark:text-[#E94560] font-medium ring-1 ring-[#E94560]/30'
                        : isSunday
                          ? 'text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          : isSaturday
                            ? 'text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* 오늘 버튼 */}
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                onChange(toDateStr(t.getFullYear(), t.getMonth(), t.getDate()));
                setOpen(false);
              }}
              className="text-[11px] text-[#E94560] hover:text-[#C73B52] font-medium transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
