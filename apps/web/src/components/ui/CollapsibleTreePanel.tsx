import { useState } from 'react';
import { Search } from 'lucide-react';
import TreeCheckbox from './TreeCheckbox';
import type { TreeNode } from './TreeCheckbox';

interface CollapsibleTreePanelProps {
  nodes: TreeNode[];
  checked: Set<string>;
  onCheckedChange: (next: Set<string>) => void;
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
  badgeMap?: Record<string, number | string>;
  facilityCount: number;
  maxFacilities: number;
  /** 패널 너비 (기본 208 = w-52) */
  width?: number;
  /** 검색바 표시 여부 */
  searchable?: boolean;
  /** 헤더 타이틀 */
  title?: string;
  /** 선택된 항목 라벨 (하단 표시) */
  selectedLabel?: string;
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

export default function CollapsibleTreePanel({
  nodes, checked, onCheckedChange, expanded, onExpandedChange,
  badgeMap, facilityCount, maxFacilities,
  width = 208,
  searchable = false,
  title = '설비 선택',
  selectedLabel,
}: CollapsibleTreePanelProps) {
  const [open, setOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNodes = searchable ? filterTree(nodes, searchTerm) : nodes;

  return (
    <div className="flex flex-shrink-0">
      <div
        className="overflow-hidden transition-[width] duration-300"
        style={{ width: open ? width : 0 }}
      >
        <div
          className="h-full bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col"
          style={{ width }}
        >
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">{title}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {facilityCount}개 선택됨 (최대 {maxFacilities})
            </div>
          </div>
          {searchable && (
            <div className="px-2 pt-2 flex-shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="설비명 검색..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto p-2">
            <TreeCheckbox
              nodes={filteredNodes}
              checked={checked}
              onCheckedChange={onCheckedChange}
              expanded={expanded}
              onExpandedChange={onExpandedChange}
              badgeMap={badgeMap}
            />
          </div>
          {selectedLabel && (
            <div className="px-3 py-1.5 text-[10px] text-[#E94560] truncate border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              선택: {selectedLabel}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-5 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded"
        title={open ? '트리 접기' : '트리 펼치기'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {open ? <polyline points="8,2 4,6 8,10" /> : <polyline points="4,2 8,6 4,10" />}
        </svg>
      </button>
    </div>
  );
}
