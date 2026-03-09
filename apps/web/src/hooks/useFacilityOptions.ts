import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFacilityTree } from '../services/analysis';
import type { TreeNode } from '../components/ui/TreeCheckbox';

export interface FacilityOption {
  value: string;
  label: string;
}

/** 트리에서 leaf 노드만 추출 → 드롭다운 옵션 배열 */
function extractLeafOptions(nodes: TreeNode[]): FacilityOption[] {
  const options: FacilityOption[] = [];
  function walk(node: TreeNode) {
    if (node.children?.length) {
      node.children.forEach(walk);
    } else {
      options.push({ value: node.id, label: node.label });
    }
  }
  nodes.forEach(walk);
  return options;
}

/**
 * 라인 그룹 ID → 해당 그룹 첫 번째 leaf 설비코드 매핑
 * 예: { all: 'HNK10_000', block: 'HNK10_010', head: 'HNK20_010', ... }
 */
function extractLineToFacility(nodes: TreeNode[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const root of nodes) {
    if (!root.children?.length) continue;
    // 'all' = 전체 트리의 첫 번째 leaf
    const allLeaves = extractLeafOptions([root]);
    if (allLeaves.length > 0) {
      map['all'] = allLeaves[0].value;
    }
    // 각 라인 그룹의 첫 번째 leaf
    for (const lineGroup of root.children) {
      const lineLeaves = extractLeafOptions([lineGroup]);
      if (lineLeaves.length > 0) {
        map[lineGroup.id] = lineLeaves[0].value;
      }
    }
  }
  return map;
}

/**
 * 설비 트리 API에서 설비 목록을 가져와서 사용하기 편한 형태로 제공
 *
 * @returns options - 전체 leaf 설비 드롭다운 옵션
 * @returns lineToFacility - 라인 그룹 ID → 첫 번째 설비코드 매핑
 * @returns defaultFacilityId - 첫 번째 설비코드 (기본값용)
 * @returns tree - 원본 트리 데이터
 * @returns isLoading - 로딩 상태
 */
export function useFacilityOptions() {
  const { data: tree, isLoading } = useQuery({
    queryKey: ['facility-tree'],
    queryFn: getFacilityTree,
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo<FacilityOption[]>(
    () => (tree ? extractLeafOptions(tree) : []),
    [tree],
  );

  const lineToFacility = useMemo<Record<string, string>>(
    () => (tree ? extractLineToFacility(tree) : {}),
    [tree],
  );

  const defaultFacilityId = options[0]?.value ?? '';

  return { options, lineToFacility, defaultFacilityId, tree, isLoading };
}
