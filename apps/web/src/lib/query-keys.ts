// ============================================================
// QueryKeyFactory (qk) — TanStack Query 키 중앙 관리
// ============================================================
//
// [목적]
//   프로젝트 전역에서 사용되는 TanStack Query 캐시 키를 한 곳에서 관리.
//   문자열 리터럴 직접 사용 시 발생하는 오타, 불일치, invalidation 누락을
//   방지하고, 키 변경 시 단일 수정 지점을 보장한다.
//
// [해결하는 문제점]
//   기존:
//     useQuery({ queryKey: ['line-list', factoryFilter], ... })
//     queryClient.invalidateQueries({ queryKey: ['line-list'] })
//   → 'line-list' 오타 시 캐시 불일치, invalidation 실패
//
//   개선:
//     useQuery({ queryKey: qk.settings.lineList(factoryFilter), ... })
//     queryClient.invalidateQueries({ queryKey: qk.settings.lineList._def })
//   → 타입 안전, 자동완성, 단일 수정 지점
//
// [구조]
//   qk.{모듈}.{키이름}()    → 캐시 조회용 전체 키 (파라미터 포함)
//   qk.{모듈}.{키이름}._def → 무효화용 접두사 키 (파라미터 없는 베이스)
//
// [Object.assign 패턴 설명]
//   함수와 정적 프로퍼티(_def)를 동시에 가지려면 Object.assign 사용:
//   `qk.settings.lineList('HW4')`  → ['line-list', 'HW4']  (조회)
//   `qk.settings.lineList._def`    → ['line-list']          (무효화)
//
// [적용 현황]
//   - SET009LineSettings : factoryList, lineList (최초 적용)
//   - 나머지 페이지는 점진적 적용 예정
//
// [모듈별 키 분류]
//   settings : 공장/라인/설비/태그/에너지 설정 관련
//   alert    : 알림 이력/통계/파형 관련
//   analysis : 분석 트리/태그수/트렌드 관련
//   monitoring : 모니터링 개요/라인상세 관련
// ============================================================

export const qk = {
  // ── Settings (설정 관련 쿼리 키) ──
  settings: {
    /** 공장 목록 조회 */
    factoryList: Object.assign(
      () => ['factory-list'] as const,
      { _def: ['factory-list'] as const },
    ),

    /**
     * 라인 목록 조회
     * @param factoryFilter - 공장 코드 필터 (없으면 전체)
     * 무효화 시 _def 사용하면 모든 factoryFilter 조합이 무효화됨
     */
    lineList: Object.assign(
      (factoryFilter?: string) => ['line-list', factoryFilter] as const,
      { _def: ['line-list'] as const },
    ),

    /** 설비 마스터 목록 */
    facilityMaster: Object.assign(
      () => ['facility-master'] as const,
      { _def: ['facility-master'] as const },
    ),

    /** 설비 유형 목록 */
    facilityTypeList: Object.assign(
      () => ['facility-type-list'] as const,
      { _def: ['facility-type-list'] as const },
    ),

    /**
     * 태그 목록 조회
     * @param filters - 가변 필터 (라인, 설비, 에너지타입 등)
     */
    tagList: Object.assign(
      (...filters: string[]) => ['tag-list', ...filters] as const,
      { _def: ['tag-list'] as const },
    ),

    /**
     * 에너지 설정 조회
     * @param filters - 가변 필터
     */
    energyConfig: Object.assign(
      (...filters: string[]) => ['energy-config', ...filters] as const,
      { _def: ['energy-config'] as const },
    ),
  },

  // ── Alert (알림 관련 쿼리 키) ──
  alert: {
    /**
     * 알림 이력 조회 (ALT004/005/006)
     * @param prefix - 카테고리별 접두사 (예: 'alt-pq-history')
     * @param lineFilter - 라인 필터
     */
    history: (prefix: string, lineFilter?: string) => [prefix, lineFilter] as const,

    /**
     * 파형 데이터 조회 (알림 상세 그래프)
     * @param prefix - 카테고리별 접두사
     * @param id - 알림 항목 ID
     * @param interval - 조회 간격
     */
    waveform: (prefix: string, id?: string, interval?: string) => [prefix, id, interval] as const,

    /** 알림 통계 KPI (ALT001/002/003) */
    statsKpi: (category: string) => [`alt-${category}-kpi`] as const,

    /** 알림 추이 (ALT001/002/003) */
    trend: (category: string) => [`alt-${category}-trend`] as const,
  },

  // ── Analysis (분석 관련 쿼리 키) ──
  analysis: {
    /** 설비 트리 데이터 (ANL 공통 사이드바) */
    facilityTree: () => ['anl-tree'] as const,

    /**
     * 태그 개수 조회 (분석 페이지 설비별)
     * @param screenId - 화면 ID (예: 'anl002')
     * @param energyType - 에너지 타입 ('elec' | 'air')
     */
    tagCounts: (screenId: string, energyType: string) => [`${screenId}-tag-counts`, energyType] as const,

    /**
     * 트렌드 데이터 조회 (분석 페이지 차트)
     * @param screenId - 화면 ID
     * @param facilityId - 설비 코드
     * @param rest - 추가 파라미터 (날짜, 간격 등)
     */
    trendData: (screenId: string, facilityId: string, ...rest: string[]) => [screenId, facilityId, ...rest] as const,
  },

  // ── Monitoring (모니터링 관련 쿼리 키) ──
  monitoring: {
    /**
     * 종합 현황 (MON-001)
     * @param line - 라인 코드 (빈문자열 = 전체)
     */
    overview: (line: string) => ['mon-overview', line] as const,

    /**
     * 라인 상세 (MON-002)
     * @param line - 라인 코드
     * @param facility - 설비 코드
     */
    lineDetail: (line: string, facility: string) => ['mon-line-detail', line, facility] as const,
  },
} as const;
