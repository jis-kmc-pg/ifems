// ============================================================
// i-FEMS 상수 정의
// ============================================================

export const APP_NAME = 'i-FEMS';
export const APP_SUBTITLE = '화성 PT4공장 설비·에너지 관리시스템';

// ──────────────────────────────────────────────
// 색상 상수 (CLAUDE.md 정책 준수)
// ──────────────────────────────────────────────
export const COLORS = {
  navy: '#1A1A2E',       // GNB 배경 (네이비 다크)
  navyLight: '#16213E',  // GNB 라이트 / 사이드바 다크 배경
  accent: '#E94560',     // 액센트 (레드)
  normal: '#27AE60',     // 정상 (초록)
  warning: '#F39C12',    // 주의 (황색)
  danger: '#E74C3C',     // 위험 (빨강)
  offline: '#7F8C8D',    // 오프라인 (회색)

  // 에너지 유형별 전용 색상 (UI-UX-GUIDELINES.md 기준)
  energy: {
    power: '#FDB813',    // 전력 전용 (노란색)
    air: '#2E86DE',      // 에어 전용 (파란색)
  },

  chart: {
    blue: '#3B82F6',     // 차트용 파랑
    green: '#27AE60',    // 정상
    amber: '#F39C12',    // 차트용 노랑
    purple: '#9333EA',   // 보라
    red: '#E74C3C',      // 현재 시각 기준선 (빨강)
    cyan: '#06B6D4',     // 시안
    pink: '#EC4899',     // 핑크
    orange: '#F97316',   // 오렌지
  },
} as const;

// ──────────────────────────────────────────────
// 다크 모드 색상 (UI-UX-GUIDELINES.md 기준)
// ──────────────────────────────────────────────
export const DARK_COLORS = {
  bgCanvas: '#0A0E27',    // 메인 캔버스 배경
  bgCard: '#16213E',      // 카드/테이블 배경
  bgSidebar: '#16213E',   // 사이드바 배경
  textPrimary: '#FFFFFF', // 주요 텍스트
  textSecondary: '#B0B0B0', // 보조 텍스트
} as const;

// ──────────────────────────────────────────────
// 라인 정보
// ──────────────────────────────────────────────
export const LINES = [
  { id: 'block', label: '블록', code: 'BLK' },
  { id: 'head', label: '헤드', code: 'HD' },
  { id: 'crank', label: '크랭크', code: 'CRK' },
  { id: 'assembly', label: '조립', code: 'ASM' },
] as const;

export type LineId = typeof LINES[number]['id'];

// ──────────────────────────────────────────────
// GNB 메뉴 구조
// ──────────────────────────────────────────────
export const GNB_MENUS = [
  { id: 'monitoring', label: '모니터링', path: '/monitoring/overview' },
  { id: 'dashboard', label: '대시보드', path: '/dashboard/energy-trend' },
  { id: 'alert', label: '알림', path: '/alert/power-quality-stats' },
  { id: 'analysis', label: '분석', path: '/analysis/comparison' },
  { id: 'settings', label: '설정', path: '/settings/factory' },
] as const;

// ──────────────────────────────────────────────
// 사이드바 메뉴 구조
// ──────────────────────────────────────────────
export const SIDEBAR_MENUS = {
  monitoring: [
    { id: 'overview', label: '종합 현황', path: '/monitoring/overview' },
    { id: 'line-detail', label: '라인별 상세', path: '/monitoring/line-detail' },
    { id: 'energy-ranking', label: '에너지 사용 순위', path: '/monitoring/energy-ranking' },
    { id: 'energy-alert', label: '에너지 알림 현황', path: '/monitoring/energy-alert' },
    { id: 'power-quality', label: '전력 품질 순위', path: '/monitoring/power-quality' },
    { id: 'air-leak', label: '에어 누기 순위', path: '/monitoring/air-leak' },
  ],
  dashboard: [
    { id: 'energy-trend', label: '에너지 사용 추이', path: '/dashboard/energy-trend' },
    { id: 'facility-trend', label: '설비별 추이', path: '/dashboard/facility-trend' },
    { id: 'usage-distribution', label: '사용량 분포', path: '/dashboard/usage-distribution' },
    { id: 'process-ranking', label: '공정별 순위', path: '/dashboard/process-ranking' },
    { id: 'cycle-ranking', label: '싸이클당 순위', path: '/dashboard/cycle-ranking' },
    { id: 'energy-change-top', label: '에너지 변화 TOP N', path: '/dashboard/energy-change-top' },
  ],
  alert: [
    { id: 'power-quality-stats', label: '전력 품질 통계', path: '/alert/power-quality-stats' },
    { id: 'air-leak-stats', label: '에어 누기 통계', path: '/alert/air-leak-stats' },
    { id: 'cycle-anomaly-stats', label: '싸이클 이상 통계', path: '/alert/cycle-anomaly-stats' },
    { id: 'power-quality-history', label: '전력 품질 이력', path: '/alert/power-quality-history' },
    { id: 'air-leak-history', label: '에어 누기 이력', path: '/alert/air-leak-history' },
    { id: 'cycle-anomaly-history', label: '싸이클 이상 이력', path: '/alert/cycle-anomaly-history' },
  ],
  analysis: [
    { id: 'comparison', label: '비교 분석', path: '/analysis/comparison' },
    { id: 'detailed-comparison', label: '상세 비교 분석', path: '/analysis/detailed-comparison' },
    { id: 'cycle', label: '싸이클 분석', path: '/analysis/cycle' },
    { id: 'cycle-delay', label: '싸이클 타임 지연', path: '/analysis/cycle-delay' },
    { id: 'power-quality', label: '전력 품질 분석', path: '/analysis/power-quality' },
  ],
  settings: [
    { id: 'factory', label: '공장 관리', path: '/settings/factory' },
    { id: 'line', label: '라인 설정', path: '/settings/line' },
    { id: 'facility-master', label: '설비 마스터 관리', path: '/settings/facility-master' },
    { id: 'facility-type', label: '설비 유형 관리', path: '/settings/facility-type' },
    { id: 'tag', label: '태그 마스터 관리', path: '/settings/tag' },
    { id: 'hierarchy', label: '태그 계층 구조', path: '/settings/hierarchy' },
    { id: 'energy-config', label: '에너지 소스 매핑', path: '/settings/energy-config' },
    { id: 'power-quality', label: '전력 품질 설정', path: '/settings/power-quality' },
    { id: 'air-leak', label: '에어 누기 설정', path: '/settings/air-leak' },
    { id: 'reference-cycle', label: '기준 싸이클 파형', path: '/settings/reference-cycle' },
    { id: 'cycle-alert', label: '싸이클 알림 설정', path: '/settings/cycle-alert' },
    { id: 'energy-alert', label: '에너지 사용량 알림', path: '/settings/energy-alert' },
    { id: 'cycle-energy-alert', label: '싸이클당 에너지 알림', path: '/settings/cycle-energy-alert' },
    { id: 'system', label: '시스템 설정', path: '/settings/system' },
  ],
} as const;

export type GnbMenuId = keyof typeof SIDEBAR_MENUS;

// ──────────────────────────────────────────────
// 환경 설정
// ──────────────────────────────────────────────
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // 기본값: true (Mock 모드)
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4500/api';

// ──────────────────────────────────────────────
// Dynamic Chart Resolution 설정
// ──────────────────────────────────────────────
/**
 * 화면별 최대 Depth 설정 (CLAUDE.md 참조)
 * - Level 1: 15m만 허용
 * - Level 2: 15m, 1m 허용
 * - Level 3: 15m, 1m, 10s, 1s 허용
 */
export const SCREEN_MAX_DEPTH: Record<string, 1 | 2 | 3> = {
  'MON-001': 2,  // 종합 현황 (15m, 1m)
  'MON-002': 3,  // 라인별 상세 — zoomLevels로 오버라이드됨
  'DSH-001': 1,  // 에너지 사용 추이 (15m)
  'DSH-002': 2,  // 설비별 추이 (15m, 1m)
  'ANL-001': 2,  // 비교 분석 (15m, 1m)
  'ANL-002': 3,  // 상세 비교 분석 (15m, 1m, 10s)
  'ANL-003': 3,  // 싸이클 분석 (10s, 1s)
  'ANL-004': 3,  // 싸이클 타임 지연 (10s, 1s)
  'ANL-005': 2,  // 전력 품질 분석 (15m, 1m)
  'ALT-004': 1,  // 전력 품질 이력 (15m)
  'ALT-006': 2,  // 싸이클 이상 이력 (15m, 10s)
  'SET-003': 3,  // 기준 싸이클 파형 (1s, 줌 비활성화)
} as const;

/**
 * 화면별 커스텀 줌 레벨 체인 (기본: ['15m','1m','10s','1s'])
 *
 * 여기에 정의된 화면은 maxDepth 대신 이 체인을 사용.
 * 체인 순서대로 줌 인 시 다음 레벨로 전환됨.
 */
export const SCREEN_ZOOM_LEVELS: Record<string, import('../types/chart').Interval[]> = {
  // MON-002: 검색 단위에 따라 동적 결정 (MON002LineDetail.tsx 내부)
} as const;

/**
 * 화면별 초기 Interval 설정
 * - 기본값: '15m' (대부분의 화면)
 * - 예외: 싸이클 분석 화면 (1초 데이터 필수)
 */
export const SCREEN_INITIAL_INTERVAL: Record<string, '15m' | '1m' | '10s' | '1s'> = {
  'ANL-003': '10s',  // 싸이클 분석 (1초부터 시작)
  'ANL-004': '10s',  // 싸이클 타임 지연 (1초부터 시작)
  'SET-003': '1s',   // 기준 싸이클 파형 (1초 고정)
  // 나머지는 기본값 '15m' 사용
} as const;
