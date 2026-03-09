import { ReactNode, useState, memo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Column<T> {
  key: keyof T | string;
  label: ReactNode;
  width?: number | string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => ReactNode;
  className?: string;
  /** 컬럼 헤더 마우스 오버 시 표시할 설명 tooltip */
  tooltip?: string;
  /** 같은 값의 연속 행을 rowSpan으로 병합할 키 (data[row][mergeKey]) */
  mergeKey?: string;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  pageSize?: number;
  className?: string;
  onRowClick?: (row: T) => void;
  selectedRow?: T | null;
  rowClassName?: (row: T) => string;
  stickyHeader?: boolean;
  compact?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

type SortOrder = 'asc' | 'desc' | null;

export default function SortableTable<T extends Record<string, any>>({
  columns, data, keyField, pageSize, className, onRowClick, selectedRow, rowClassName, stickyHeader, compact = false, loading = false, emptyMessage = '데이터가 없습니다.',
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [page, setPage] = useState(1);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortOrder === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  let sorted = [...data];
  if (sortKey && sortOrder) {
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }

  const totalPages = pageSize ? Math.ceil(sorted.length / pageSize) : 1;
  const paged = pageSize ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  const py = compact ? 'py-1.5' : 'py-2.5';
  const px = 'px-3';

  // mergeKey가 있는 컬럼의 rowSpan 계산
  const hasMerge = columns.some((c) => c.mergeKey);
  const mergeSpans: Map<string, number[]> = new Map();
  if (hasMerge) {
    for (const col of columns) {
      if (!col.mergeKey) continue;
      const colKey = String(col.key);
      const spans: number[] = new Array(paged.length).fill(0);
      let i = 0;
      while (i < paged.length) {
        const val = String(paged[i][col.mergeKey as string] ?? '');
        let j = i + 1;
        while (j < paged.length && String(paged[j][col.mergeKey as string] ?? '') === val) j++;
        spans[i] = j - i; // first row of group gets the span
        // rest stay 0 (skip)
        i = j;
      }
      mergeSpans.set(colKey, spans);
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="bg-gray-50 dark:bg-[#16213E] border-b border-gray-200 dark:border-gray-700">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    px, py, 'text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-white/5',
                    col.className,
                  )}
                  style={{ width: col.width }}
                  title={col.tooltip}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  onKeyDown={(e) => col.sortable && (e.key === 'Enter' || e.key === ' ') && handleSort(String(col.key))}
                  tabIndex={col.sortable ? 0 : undefined}
                  role={col.sortable ? 'button' : undefined}
                  aria-sort={sortKey === String(col.key) ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                    {col.label}
                    {col.sortable && (
                      <span className="text-gray-400" aria-hidden="true">
                        {sortKey === String(col.key) ? (
                          sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2" />
                  로딩 중...
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const isSelected = selectedRow === row;
                const extraClass = rowClassName?.(row) ?? '';
                return (
                  <tr
                    key={keyField ? String(row[keyField as string]) : i}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-700/50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : onRowClick
                        ? 'hover:bg-gray-50 dark:hover:bg-white/5'
                        : '',
                      extraClass,
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => {
                      const colKey = String(col.key);
                      const val = row[colKey];
                      // mergeKey 처리: span=0이면 이전 행에서 병합됨 → 렌더링 skip
                      const spans = mergeSpans.get(colKey);
                      if (spans) {
                        if (spans[i] === 0) return null;
                        return (
                          <td
                            key={colKey}
                            rowSpan={spans[i] > 1 ? spans[i] : undefined}
                            className={cn(
                              px, py,
                              'text-gray-800 dark:text-gray-200 align-top border-r border-gray-100 dark:border-gray-700/30',
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                              col.className,
                            )}
                            style={{ width: col.width }}
                          >
                            {col.render ? col.render(val, row, i) : String(val ?? '-')}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={colKey}
                          className={cn(
                            px, py,
                            'text-gray-800 dark:text-gray-200',
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                            col.className,
                          )}
                          style={{ width: col.width }}
                        >
                          {col.render ? col.render(val, row, i) : String(val ?? '-')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} / {data.length}건
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              이전
            </button>
            <span className="px-3 py-1 text-xs font-medium">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
