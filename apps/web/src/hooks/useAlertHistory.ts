// ============================================================
// useAlertHistory — 알림 이력 페이지 공통 훅
// ============================================================
//
// [목적]
//   ALT004(전력품질), ALT005(에어누기), ALT006(사이클이상) 이력 페이지에서
//   동일하게 반복되는 필터 UI 상태, 데이터 조회, 행 선택, 조치 저장 로직을
//   하나의 훅으로 통합하여 코드 중복을 제거한다.
//
// [적용 페이지]
//   - ALT004PowerQualityHistory : category='power_quality'
//   - ALT005AirLeakHistory      : category='air_leak'
//   - ALT006CycleAnomalyHistory : category='cycle_anomaly'
//
// [반환값]
//   lineFilter, startDate, endDate  — FilterBar에 바인딩할 필터 상태
//   selected, action, setAction     — 선택된 행 + 조치사항 텍스트
//   graphOpen, openGraph, closeGraph — 그래프 모달 열기/닫기
//   rows                            — 라인 필터가 적용된 데이터 배열
//   refetch                         — 수동 데이터 재조회 트리거
//   handleSelect                    — 행 클릭 시 선택 + 조치내용 세팅
//   saveMutation                    — 조치사항 저장 mutation
//   baseFilters                     — FilterBar에 그대로 넘길 FilterItem[]
//
// [확장 방법 — ALT006 예시]
//   ALT006은 추가로 statusFilter(상태 필터)가 필요하므로:
//   1) rows를 `rows: baseRows`로 별칭 디스트럭처링
//   2) 로컬에서 statusFilter useState 추가
//   3) baseRows에 statusFilter 적용 → 최종 rows 도출
//   4) baseFilters 뒤에 statusFilter 항목을 스프레드로 추가
//      `const filters = [...baseFilters, statusFilterItem]`
// ============================================================

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAlertHistory, saveAlertAction } from '../services/alerts';
import type { AlertHistoryItem } from '../services/mock/alerts';
import { LINE_OPTIONS_KR as LINE_OPTIONS } from '../lib/filter-options';
import type { FilterItem } from '../components/ui/FilterBar';

// ── 기본 날짜 범위: 오늘 기준 7일 전 ~ 오늘 ──

/** 오늘 날짜 문자열 (YYYY-MM-DD) */
const TODAY = new Date().toISOString().slice(0, 10);

/** 7일 전 날짜 문자열 (YYYY-MM-DD) — 기본 시작일 */
const START_STR = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
})();

// ── 타입 정의 ──

/** 알림 카테고리 — 백엔드 API 파라미터와 일치해야 함 */
type AlertCategory = 'power_quality' | 'air_leak' | 'cycle_anomaly';

/** 훅 초기화 옵션 */
interface UseAlertHistoryOptions {
  /** 알림 분류 (power_quality / air_leak / cycle_anomaly) */
  category: AlertCategory;
  /** TanStack Query 캐시 키의 접두사 (예: 'alt-pq-history') */
  queryKeyPrefix: string;
}

/**
 * ALT004/005/006 공통 알림 이력 훅
 *
 * 3개 이력 페이지에서 공통으로 사용하는 상태와 로직을 통합:
 * - 라인/날짜 필터 상태 (FilterBar 바인딩용)
 * - getAlertHistory() 데이터 조회 (useQuery)
 * - 행 선택 + 조치사항 저장 (useMutation)
 * - 그래프 모달 열기/닫기
 *
 * @param options.category - 알림 분류 (API 파라미터)
 * @param options.queryKeyPrefix - TanStack Query 키 접두사 (캐시 분리용)
 * @returns 필터 상태, 데이터, 핸들러, mutation 등의 번들
 *
 * @example
 * ```tsx
 * // ALT004PowerQualityHistory.tsx
 * const { rows, baseFilters, selected, handleSelect, ... } =
 *   useAlertHistory({ category: 'power_quality', queryKeyPrefix: 'alt-pq-history' });
 *
 * return (
 *   <>
 *     <FilterBar filters={baseFilters} />
 *     <SortableTable data={rows} onRowClick={handleSelect} />
 *   </>
 * );
 * ```
 */
export function useAlertHistory({ category, queryKeyPrefix }: UseAlertHistoryOptions) {
  // ── 필터 상태 ──
  const [lineFilter, setLineFilter] = useState('');       // 라인 선택 (빈문자열 = 전체)
  const [startDate, setStartDate] = useState(START_STR);  // 조회 시작일
  const [endDate, setEndDate] = useState(TODAY);           // 조회 종료일

  // ── 선택/조치 상태 ──
  const [selected, setSelected] = useState<AlertHistoryItem | null>(null); // 현재 선택된 행
  const [action, setAction] = useState('');    // 조치사항 텍스트 (textarea 바인딩)
  const [graphOpen, setGraphOpen] = useState(false); // 그래프 모달 표시 여부

  // ── 데이터 조회 (TanStack Query) ──
  // lineFilter가 변경될 때마다 자동 재조회 (queryKey에 포함)
  const { data, refetch, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, lineFilter],
    queryFn: () => getAlertHistory(category, lineFilter || undefined),
  });

  // ── 조치사항 저장 Mutation ──
  const saveMutation = useMutation({
    mutationFn: () => saveAlertAction(selected?.id ?? '', action),
    onSuccess: () => alert('조치사항이 저장되었습니다.'),
  });

  // ── 라인 필터 적용된 데이터 ──
  // API에서 전체 데이터를 받아온 뒤 클라이언트 측에서 필터링
  const rows = (data ?? []).filter(
    (r: AlertHistoryItem) => !lineFilter || r.line === lineFilter,
  );

  // ── 행 선택 핸들러 (useCallback으로 렌더 최적화) ──
  // 행 클릭 시 해당 행의 데이터로 selected 세팅 + 기존 조치내용 로드
  const handleSelect = useCallback((row: AlertHistoryItem) => {
    setSelected(row);
    setAction(row.action ?? '');
  }, []);

  // ── FilterBar에 바인딩할 기본 필터 항목 ──
  // ALT006 등에서 추가 필터 필요 시 [...baseFilters, 추가항목] 형태로 확장
  const baseFilters: FilterItem[] = [
    { type: 'date', key: 'start', label: '시작일', value: startDate, onChange: setStartDate },
    { type: 'date', key: 'end', label: '종료일', value: endDate, onChange: setEndDate },
    { type: 'select', key: 'line', label: '라인', value: lineFilter, onChange: setLineFilter, options: LINE_OPTIONS },
  ];

  // ── 그래프 모달 열기/닫기 (안정 참조) ──
  const closeGraph = useCallback(() => setGraphOpen(false), []);
  const openGraph = useCallback(() => setGraphOpen(true), []);

  return {
    // 필터 상태
    lineFilter, startDate, endDate,
    // 선택/조치 상태
    selected, action, setAction,
    // 그래프 모달
    graphOpen, openGraph, closeGraph,
    // 데이터
    rows, refetch, handleSelect, isLoading,
    // Mutation
    saveMutation,
    // FilterBar 바인딩
    baseFilters,
  } as const;
}
