import { ReactNode, memo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import DatePicker from './DatePicker';

export interface FilterItem {
  type: 'select' | 'date' | 'text' | 'custom';
  label: string;
  key: string;
  options?: readonly { readonly value: string; readonly label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  render?: () => ReactNode;
  width?: number;
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterItem[];
  onSearch?: () => void;
  searchLabel?: string;
  className?: string;
  extra?: ReactNode;
}

const FilterBar = memo(function FilterBar({ filters, onSearch, searchLabel = 'Search', className, extra }: FilterBarProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap bg-white dark:bg-[#16213E] border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2.5 shadow-sm mb-4', className)}>
      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-1.5" style={{ width: f.width }}>
          {f.label && (
            <label htmlFor={`filter-${f.key}`} className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{f.label}</label>
          )}
          {f.type === 'custom' && f.render?.()}
          {f.type === 'select' && (
            <select
              id={`filter-${f.key}`}
              name={f.key}
              value={f.value ?? ''}
              onChange={(e) => f.onChange?.(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560] dark:focus:ring-[#27AE60]"
            >
              {f.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          {f.type === 'date' && (
            <DatePicker
              id={`filter-${f.key}`}
              value={f.value ?? ''}
              onChange={(v) => f.onChange?.(v)}
            />
          )}
          {f.type === 'text' && (
            <input
              id={`filter-${f.key}`}
              name={f.key}
              type="text"
              placeholder={f.label}
              value={f.value ?? ''}
              onChange={(e) => f.onChange?.(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]"
            />
          )}
        </div>
      ))}
      {extra}
      {onSearch && (
        <button
          onClick={onSearch}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] hover:bg-[#C73B52] text-white text-xs rounded transition-colors ml-auto"
        >
          <Search size={12} aria-hidden="true" />
          {searchLabel}
        </button>
      )}
    </div>
  );
});

export default FilterBar;
