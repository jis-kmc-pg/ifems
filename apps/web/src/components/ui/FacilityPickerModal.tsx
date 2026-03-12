import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Modal from './Modal';
import TreeCheckbox, { type TreeNode } from './TreeCheckbox';
import { getFacilityTree, getFacilityTagCounts } from '../../services/analysis';

const GROUP_IDS = ['plant', 'block', 'head', 'crank', 'assembly'];

interface FacilityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (facilityId: string, facilityLabel: string) => void;
  energyType: 'elec' | 'air';
  /** 빠른 추가용 기존 설비 목록 */
  existingFacilities?: { id: string; label: string }[];
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

export default function FacilityPickerModal({
  isOpen, onClose, onSelect, energyType, existingFacilities,
}: FacilityPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['plant', 'block', 'head', 'crank', 'assembly']));

  const { data: tree } = useQuery({ queryKey: ['anl-tree'], queryFn: getFacilityTree });
  const { data: tagCountMap } = useQuery({
    queryKey: ['picker-tag-counts', energyType],
    queryFn: () => getFacilityTagCounts(energyType),
  });

  const filteredTree = useMemo(() => filterTree(tree ?? [], searchTerm), [tree, searchTerm]);

  // 단일 선택 모드: 새 체크 시 이전 선택 해제
  const handleCheckedChange = useCallback((next: Set<string>) => {
    const leafIds = Array.from(next).filter(id => !GROUP_IDS.includes(id));
    if (leafIds.length === 0) {
      setChecked(new Set());
      return;
    }
    // 가장 최근 추가된 것만 유지
    const prev = Array.from(checked).filter(id => !GROUP_IDS.includes(id));
    const newId = leafIds.find(id => !prev.includes(id)) ?? leafIds[leafIds.length - 1];
    setChecked(new Set([newId]));
  }, [checked]);

  const selectedId = Array.from(checked).find(id => !GROUP_IDS.includes(id));

  const handleConfirm = () => {
    if (!selectedId || !tree) return;
    const label = findLabel(tree, selectedId) ?? selectedId;
    onSelect(selectedId, label);
    handleReset();
  };

  const handleQuickAdd = (fac: { id: string; label: string }) => {
    onSelect(fac.id, fac.label);
    handleReset();
  };

  const handleReset = () => {
    setChecked(new Set());
    setSearchTerm('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title="설비 선택" size="md">
      {/* 빠른 추가: 기존 설비 */}
      {existingFacilities && existingFacilities.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">기존 설비 빠른 추가</div>
          <div className="flex flex-wrap gap-1.5">
            {existingFacilities.map(fac => (
              <button
                key={fac.id}
                onClick={() => handleQuickAdd(fac)}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 dark:border-gray-600 hover:bg-[#E94560] hover:text-white hover:border-[#E94560] text-gray-700 dark:text-gray-300 transition-colors"
              >
                {fac.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700 mt-3 mb-3" />
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">다른 설비 선택</div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="설비명 검색..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#0F3460] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#E94560]"
          autoFocus
        />
      </div>

      {/* 트리 */}
      <div className="max-h-[40vh] overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg p-2">
        <TreeCheckbox
          nodes={filteredTree}
          checked={checked}
          onCheckedChange={handleCheckedChange}
          expanded={expanded}
          onExpandedChange={setExpanded}
          badgeMap={(tagCountMap ?? {}) as Record<string, number>}
        />
      </div>

      {/* 선택 표시 + 버튼 */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {selectedId ? `선택: ${findLabel(tree ?? [], selectedId) ?? selectedId}` : '설비를 선택해 주세요'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-4 py-2 text-xs rounded bg-[#E94560] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            확인
          </button>
        </div>
      </div>
    </Modal>
  );
}
