// ============================================================
// i-FEMS 필터 옵션 상수 (모든 드롭다운에서 공통 사용)
// ============================================================
// 변경 시 이 파일 하나만 수정하면 전체 반영

// ──────────────────────────────────────────────
// 라인 옵션
// ──────────────────────────────────────────────

/** 라인 목록 (전체 없음) — MON-003, MON-005, MON-006 */
export const LINE_ITEMS = [
  { value: 'block', label: '블록' },
  { value: 'head', label: '헤드' },
  { value: 'crank', label: '크랭크' },
  { value: 'assembly', label: '조립' },
] as const;

/** 라인 + 전체('all') — DSH, ALT 통계, MON-004 */
export const LINE_OPTIONS = [
  { value: 'all', label: '전체' },
  ...LINE_ITEMS,
] as const;

/** 라인 + 전체('') — ALT 이력 (영문 코드) */
export const LINE_OPTIONS_EMPTY = [
  { value: '', label: '전체' },
  ...LINE_ITEMS,
] as const;

/** 라인 + 전체('') 한국어 값 — ALT 이력 (004, 005, 006) */
export const LINE_OPTIONS_KR = [
  { value: '', label: '전체' },
  { value: '블록', label: '블록' },
  { value: '헤드', label: '헤드' },
  { value: '크랭크', label: '크랭크' },
] as const;

// ──────────────────────────────────────────────
// 공정 옵션
// ──────────────────────────────────────────────

/** 공정 옵션 — SET-001~007 */
export const PROCESS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'OP10', label: 'OP10' },
  { value: 'OP20', label: 'OP20' },
  { value: 'OP30', label: 'OP30' },
  { value: 'OP40', label: 'OP40' },
] as const;

// ──────────────────────────────────────────────
// 에너지 타입 옵션
// ──────────────────────────────────────────────

/** 에너지 타입 (Frontend 키) — DSH-002, DSH-004, DSH-008 */
export const ENERGY_TYPE_OPTIONS = [
  { value: 'power', label: '전력(kWh)' },
  { value: 'air', label: '에어(L)' },
] as const;

/** 에너지 타입 (Backend 키) — ANL-001 */
export const ENERGY_TYPE_BACKEND_OPTIONS = [
  { value: 'elec', label: '전력(kWh)' },
  { value: 'air', label: '에어(L)' },
] as const;

/** 에너지 타입 (라벨만 간단) — MON-003 */
export const ENERGY_OPTIONS = [
  { value: 'power', label: '전력' },
  { value: 'air', label: '에어' },
] as const;

// ──────────────────────────────────────────────
// 기간 옵션
// ──────────────────────────────────────────────

/** 알림 통계 기간 — ALT-001, ALT-002, ALT-003 */
export const PERIOD_OPTIONS = [
  { value: '4w', label: '최근 4주' },
  { value: '8w', label: '최근 8주' },
  { value: '3m', label: '최근 3개월' },
] as const;

// ──────────────────────────────────────────────
// TOP N 옵션
// ──────────────────────────────────────────────

/** TOP N 선택 — DSH-008 */
export const TOP_N_OPTIONS = [
  { value: '5', label: 'TOP 5' },
  { value: '8', label: 'TOP 8' },
  { value: '10', label: 'TOP 10' },
  { value: '15', label: 'TOP 15' },
] as const;

// ──────────────────────────────────────────────
// 상태 옵션
// ──────────────────────────────────────────────

/** 알림 상태 — ALT-006 */
export const ALERT_STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ACTIVE', label: '발생' },
  { value: 'ACKNOWLEDGED', label: '인지' },
  { value: 'RESOLVED', label: '해소' },
] as const;

/** 싸이클 분석 상태 — ANL-004 */
export const CYCLE_STATUS_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '이상', label: '이상' },
  { value: '정상', label: '정상' },
  { value: '분석전', label: '분석전' },
] as const;

/** 설비 상태 — SET-007 */
export const FACILITY_STATUS_OPTIONS = [
  { value: 'NORMAL', label: '정상' },
  { value: 'WARNING', label: '경고' },
  { value: 'DANGER', label: '위험' },
  { value: 'OFFLINE', label: '오프라인' },
] as const;

// ──────────────────────────────────────────────
// 설비 유형 옵션
// ──────────────────────────────────────────────

/** 설비 유형 필터 — SET-007 */
export const FACILITY_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'MAIN', label: 'MAIN' },
  { value: 'MC', label: 'MC (가공기)' },
  { value: 'COOLING', label: 'COOLING' },
  { value: 'COMPRESSOR', label: 'COMPRESSOR' },
  { value: 'DUST', label: 'DUST (집진기)' },
] as const;

// ──────────────────────────────────────────────
// 태그 관리 옵션
// ──────────────────────────────────────────────

/** 측정 유형 — SET-012 */
export const MEASURE_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'INSTANTANEOUS', label: '순시값' },
  { value: 'CUMULATIVE', label: '적산값' },
  { value: 'DISCRETE', label: '이산값' },
] as const;

/** 태그 카테고리 — SET-012 */
export const TAG_CATEGORY_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ENERGY', label: '에너지' },
  { value: 'QUALITY', label: '품질' },
  { value: 'ENVIRONMENT', label: '환경' },
  { value: 'OPERATION', label: '운전' },
  { value: 'CONTROL', label: '제어' },
] as const;

/** 에너지 타입 필터 (태그 관리) — SET-012 */
export const TAG_ENERGY_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'elec', label: '전력' },
  { value: 'air', label: '에어' },
  { value: 'gas', label: '가스' },
  { value: 'solar', label: '태양광' },
] as const;

// ──────────────────────────────────────────────
// 비교 옵션
// ──────────────────────────────────────────────

/** 비교 기준 — DSH-008 */
export const COMPARE_OPTIONS = [
  { value: 'prevMonth', label: '전월 대비' },
  { value: 'prevYear', label: '전년 대비' },
] as const;
