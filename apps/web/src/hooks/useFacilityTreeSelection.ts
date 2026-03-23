// ============================================================
// useFacilityTreeSelection — 설비 트리 체크박스 선택 훅
// ============================================================
//
// [목적]
//   분석(ANL) 페이지에서 반복되는 설비 트리 조회 + 체크박스 선택 + leaf ID 추출
//   로직을 하나의 훅으로 통합하여 코드 중복을 제거한다.
//
// [해결하는 반복 패턴]
//   1) getFacilityTree() API 호출 (useQuery)
//   2) checked: Set<string> 상태 관리
//   3) GROUP_IDS 배열 정의 (plant, block, head, crank, assembly)
//   4) facilityIds 계산 = checked에서 GROUP_IDS 제외
//   → 이 4개가 ANL001/002/006/007/008/011에서 동일하게 반복됨
//
// [적용 페이지]
//   - ANL002DetailedComparison     : 전력 상세 비교 (다중 설비)
//   - ANL006AirDetailedComparison  : 에어 상세 비교 (다중 설비)
//   - ANL007PeriodPowerComparison  : 기간별 전력 비교 (단일 설비)
//   - ANL008PeriodAirComparison    : 기간별 에어 비교 (단일 설비)
//
// [GROUP_IDS와 leaf 설비의 구분]
//   트리 구조에서 그룹 노드(plant, block 등)는 카테고리이며 실제 설비가 아님.
//   API 호출 시에는 leaf 노드(실제 설비 코드)만 필요하므로,
//   facilityIds = checked - GROUP_IDS 로 그룹 노드를 제외한다.
//
// [TreeCheckbox 컴포넌트와의 연동]
//   TreeCheckbox는 onChange 콜백으로 새 Set<string>을 전달하므로
//   setChecked를 그대로 바인딩하면 된다:
//   <TreeCheckbox data={tree} checked={checked} onChange={setChecked} />
// ============================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFacilityTree } from '../services/analysis';

/**
 * 트리 구조의 그룹 노드 ID 목록
 *
 * TreeCheckbox에서 "plant", "block" 같은 카테고리 노드는
 * 실제 설비가 아니므로 API 호출 시 제외해야 한다.
 * 페이지에서 TreeCheckbox의 onChange 로직에서도 이 상수를 사용하여
 * 그룹 노드 클릭 시 하위 아이템 일괄 선택/해제를 처리한다.
 */
export const GROUP_IDS = ['plant', 'block', 'head', 'crank', 'assembly'] as const;

/**
 * 설비 트리 체크박스 선택 로직 훅
 *
 * 트리 데이터 조회 + 체크박스 상태 + leaf 설비 ID 추출을 통합 제공.
 * ANL 페이지에서 트리를 통한 설비 선택 UI에 사용한다.
 *
 * @param initialChecked - 초기 체크 상태 (기본: 빈 Set → 아무것도 선택 안 됨)
 * @returns
 *   - checked: 현재 체크된 ID의 Set (그룹 노드 포함)
 *   - setChecked: Set 갱신 함수 (TreeCheckbox onChange에 바인딩)
 *   - tree: 설비 트리 데이터 (API 응답, undefined 가능)
 *   - facilityIds: 그룹 노드를 제외한 순수 설비 ID 배열 (API 호출용)
 *
 * @example
 * ```tsx
 * const { checked, setChecked, tree, facilityIds } = useFacilityTreeSelection();
 *
 * // 트리 UI 바인딩
 * <TreeCheckbox data={tree} checked={checked} onChange={setChecked} />
 *
 * // 선택된 설비로 데이터 조회
 * useQuery({
 *   queryKey: ['comparison', ...facilityIds],
 *   queryFn: () => fetchData(facilityIds),
 *   enabled: facilityIds.length > 0,
 * });
 * ```
 */
export function useFacilityTreeSelection(initialChecked?: Set<string>) {
  // 체크박스 상태: 그룹 노드 + leaf 노드 모두 포함
  const [checked, setChecked] = useState<Set<string>>(initialChecked ?? new Set());

  // 설비 트리 데이터 조회 (캐시 키: 'anl-tree')
  const { data: tree } = useQuery({
    queryKey: ['anl-tree'],
    queryFn: getFacilityTree,
  });

  /**
   * 선택된 leaf 설비 ID 목록
   *
   * checked Set에서 그룹 노드(plant, block 등)를 제외하여
   * 실제 설비 코드만 추출한다. API 호출 시 이 배열을 사용.
   * useMemo로 checked 변경 시에만 재계산.
   */
  const facilityIds = useMemo(
    () => Array.from(checked).filter((id) => !GROUP_IDS.includes(id as any)),
    [checked],
  );

  return { checked, setChecked, tree, facilityIds } as const;
}
