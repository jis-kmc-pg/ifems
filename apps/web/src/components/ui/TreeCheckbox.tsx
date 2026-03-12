import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

interface TreeCheckboxProps {
  nodes: TreeNode[];
  checked: Set<string>;
  onCheckedChange: (checked: Set<string>) => void;
  expanded?: Set<string>;
  onExpandedChange?: (expanded: Set<string>) => void;
  badgeMap?: Record<string, number | string>;
  className?: string;
}

function collectAll(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...collectAll(n.children ?? [])]);
}

function NodeItem({
  node, checked, expanded, onToggle, onExpand, badgeMap,
}: {
  node: TreeNode;
  checked: Set<string>;
  expanded: Set<string>;
  onToggle: (id: string, checked: Set<string>) => void;
  onExpand: (id: string) => void;
  badgeMap?: Record<string, number | string>;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const hasChildren = (node.children ?? []).length > 0;
  const isExpanded = expanded.has(node.id);
  const isChecked = checked.has(node.id);
  const allChildIds = collectAll(node.children ?? []);
  const someChecked = allChildIds.some((id) => checked.has(id));
  const allChecked = hasChildren && allChildIds.every((id) => checked.has(id));
  const indeterminate = someChecked && !allChecked;

  // Update indeterminate state via effect instead of ref callback
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleCheck = () => {
    if (hasChildren) {
      // 그룹 노드: 빈 상태 → 펼치기만, 인더터미네이트/전체선택 → 하위 해제
      if (!someChecked && !allChecked) {
        onExpand(node.id);
        return;
      }
      const next = new Set(checked);
      next.delete(node.id);
      allChildIds.forEach((id) => next.delete(id));
      onToggle(node.id, next);
    } else {
      // 리프 노드: 토글
      const next = new Set(checked);
      if (isChecked) next.delete(node.id);
      else next.add(node.id);
      onToggle(node.id, next);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1 py-1 px-1 hover:bg-gray-50 dark:hover:bg-white/5 rounded group">
        {hasChildren ? (
          <button
            onClick={() => onExpand(node.id)}
            className="p-0.5 text-gray-400"
            aria-label={isExpanded ? '접기' : '펼치기'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <label className="flex items-center gap-1 cursor-pointer flex-1">
          <input
            id={`tree-node-${node.id}`}
            type="checkbox"
            checked={isChecked || allChecked}
            ref={checkboxRef}
            onChange={handleCheck}
            className="w-3.5 h-3.5 accent-[#E94560] cursor-pointer"
          />
          <span
            className={cn('text-xs select-none', isChecked || allChecked ? 'text-[#E94560] dark:text-white font-medium' : 'text-gray-600 dark:text-gray-300')}
          >
            {node.label}
          </span>
          {badgeMap && badgeMap[node.id] !== undefined && (
            <span className="text-[10px] text-gray-400 ml-0.5">({badgeMap[node.id]})</span>
          )}
        </label>
      </div>
      {hasChildren && isExpanded && (
        <div className="pl-5">
          {node.children!.map((child) => (
            <NodeItem key={child.id} node={child} checked={checked} expanded={expanded} onToggle={onToggle} onExpand={onExpand} badgeMap={badgeMap} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TreeCheckbox({ nodes, checked, onCheckedChange, expanded: controlledExpanded, onExpandedChange, badgeMap, className }: TreeCheckboxProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set(nodes.map((n) => n.id)));

  // Use controlled expanded if provided, otherwise use internal state
  const expanded = controlledExpanded ?? internalExpanded;

  const handleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    if (onExpandedChange) {
      onExpandedChange(next);
    } else {
      setInternalExpanded(next);
    }
  };

  return (
    <div className={cn('overflow-y-auto', className)}>
      {nodes.map((node) => (
        <NodeItem
          key={node.id}
          node={node}
          checked={checked}
          expanded={expanded}
          onToggle={(_, newChecked) => onCheckedChange(newChecked)}
          onExpand={handleExpand}
          badgeMap={badgeMap}
        />
      ))}
    </div>
  );
}
