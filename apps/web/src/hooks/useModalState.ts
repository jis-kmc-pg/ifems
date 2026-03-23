// ============================================================
// useModalState — 멀티 모달 상태 관리 훅
// ============================================================
//
// [목적]
//   Settings 페이지(SET007~014)에서 반복되는 모달 상태 관리 패턴을 통합.
//   기존에는 모달 하나마다 `useState<boolean>(false)` 하나씩 선언했으나,
//   이 훅을 사용하면 모든 모달 상태를 단일 Record로 관리할 수 있다.
//
// [기존 패턴 (반복 코드)]
//   const [editModalOpen, setEditModalOpen] = useState(false);
//   const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
//   const [historyOpen, setHistoryOpen] = useState(false);
//   → 모달 3개 = useState 3개 + setter 3개 = 6줄
//
// [개선된 패턴]
//   const modal = useModalState(['edit', 'delete', 'history'] as const);
//   → 1줄로 모든 모달 상태 + open/close 함수 제공
//
// [적용 페이지]
//   - SET007FacilityMaster         : ['edit', 'delete']
//   - SET008FactoryManagement      : ['edit', 'delete']
//   - SET009LineSettings           : ['edit', 'delete']
//   - SET011FacilityTypeManagement : ['edit', 'delete']
//   - SET012TagMaster              : ['edit', 'delete', 'bulkUpload', 'reassign', 'history']
//   - SET014EnergySourceConfig     : ['edit', 'history']
//
// [타입 안전성]
//   `as const` 단언으로 키를 리터럴 타입으로 좁힌다.
//   → modal.open('typo')  // TypeScript 에러
//   → modal.isOpen.edit   // 자동완성 지원
// ============================================================

import { useState, useCallback } from 'react';

/**
 * 여러 모달의 열림/닫힘 상태를 하나의 Record로 관리하는 훅
 *
 * @typeParam K - 모달 키 문자열 유니온 (예: 'edit' | 'delete')
 * @param keys - 관리할 모달 이름 배열 (`as const` 필수)
 * @returns
 *   - isOpen: 각 모달의 열림 여부 Record (예: { edit: false, delete: false })
 *   - open(key): 지정 모달 열기 (나머지는 유지)
 *   - close(key): 지정 모달 닫기 (나머지는 유지)
 *
 * @example
 * ```tsx
 * const modal = useModalState(['edit', 'delete'] as const);
 *
 * // 모달 열기
 * <button onClick={() => modal.open('edit')}>수정</button>
 *
 * // 모달 렌더
 * <Modal isOpen={modal.isOpen.edit} onClose={() => modal.close('edit')}>
 *   ...
 * </Modal>
 *
 * // 삭제 확인 모달
 * <ConfirmModal isOpen={modal.isOpen.delete} onClose={() => modal.close('delete')} />
 * ```
 */
export function useModalState<K extends string>(keys: readonly K[]) {
  // 초기 상태: 모든 모달 닫힘 (lazy initializer로 한 번만 생성)
  const [state, setState] = useState(() =>
    Object.fromEntries(keys.map((k) => [k, false])) as Record<K, boolean>,
  );

  // 특정 모달만 열기 (다른 모달 상태는 유지)
  const open = useCallback(
    (key: K) => setState((prev) => ({ ...prev, [key]: true })),
    [],
  );

  // 특정 모달만 닫기 (다른 모달 상태는 유지)
  const close = useCallback(
    (key: K) => setState((prev) => ({ ...prev, [key]: false })),
    [],
  );

  return { isOpen: state, open, close } as const;
}
