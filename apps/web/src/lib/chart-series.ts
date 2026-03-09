// ============================================================
// i-FEMS 차트 시리즈 팩토리
// ============================================================
// TrendSeries 정의를 한 곳에서 관리. 색상/타입 변경 시 여기만 수정.

import { COLORS } from './constants';
import type { TrendSeries } from '../components/charts/TrendChart';

const PREV_GRAY = 'rgba(128,128,128,0.3)';

// ──────────────────────────────────────────────
// MON-001: 종합 현황 — 전일(area) + 당일(bar)
// ──────────────────────────────────────────────
export function overviewTrendSeries(): TrendSeries[] {
  return [
    { key: 'prev', label: '전일(kWh)', color: PREV_GRAY, type: 'area', fillOpacity: 0.25, width: 1 },
    { key: 'current', label: '당일 전력(kWh)', color: COLORS.energy.power, type: 'bar', fillOpacity: 1 },
  ];
}

// ──────────────────────────────────────────────
// MON-002: 라인별 상세 — 전력/에어 (area + bar)
// ──────────────────────────────────────────────
export function lineDetailPowerSeries(): TrendSeries[] {
  return [
    { key: 'prevPower', label: '전일', color: PREV_GRAY, type: 'area', fillOpacity: 0.25, width: 1 },
    { key: 'power', label: '당일', color: COLORS.energy.power, type: 'bar', fillOpacity: 1 },
  ];
}

export function lineDetailAirSeries(): TrendSeries[] {
  return [
    { key: 'prevAir', label: '전일', color: PREV_GRAY, type: 'area', fillOpacity: 0.25, width: 1 },
    { key: 'air', label: '당일', color: COLORS.energy.air, type: 'bar', fillOpacity: 1 },
  ];
}

// ──────────────────────────────────────────────
// DSH-001: 에너지 사용 추이 — 전년(line) + 당월(bar)
// ──────────────────────────────────────────────
export function energyTrendPowerSeries(): TrendSeries[] {
  return [
    { key: 'prevPower', label: '전년(kWh)', color: PREV_GRAY, type: 'line', width: 2 },
    { key: 'power', label: '당월 전력(kWh)', color: COLORS.energy.power, type: 'bar', fillOpacity: 1 },
  ];
}

export function energyTrendAirSeries(): TrendSeries[] {
  return [
    { key: 'prevAir', label: '전년(L)', color: PREV_GRAY, type: 'line', width: 2 },
    { key: 'air', label: '당월 에어(L)', color: COLORS.energy.air, type: 'bar', fillOpacity: 1 },
  ];
}

// ──────────────────────────────────────────────
// ALT-004: 전력 품질 이력 모달
// ──────────────────────────────────────────────
export function powerQualityHistorySeries(): TrendSeries[] {
  return [
    { key: 'current', label: '불평형률(%)', color: COLORS.danger, type: 'line', width: 2 },
  ];
}

// ──────────────────────────────────────────────
// ALT-006: 싸이클 이상 이력 모달 — 기준(line) + 이상(line)
// ──────────────────────────────────────────────
export function cycleWaveformComparisonSeries(): TrendSeries[] {
  return [
    { key: 'prev', label: '기준 파형(kW)', color: PREV_GRAY.replace('0.3', '0.7'), type: 'line', width: 1.5 },
    { key: 'current', label: '이상 파형(kW)', color: COLORS.chart.purple, type: 'line', width: 2 },
  ];
}

// ──────────────────────────────────────────────
// ANL-002: 상세 비교 분석
// ──────────────────────────────────────────────
export function comparisonOverlaySeries(label1: string, label2: string): TrendSeries[] {
  return [
    { key: 'origin', label: `조건1: ${label1}`, color: COLORS.energy.power, type: 'line', width: 2 },
    { key: 'compare', label: `조건2: ${label2}`, color: COLORS.energy.air, type: 'line', width: 2 },
  ];
}

export function comparisonDiffSeries(): TrendSeries[] {
  return [
    { key: 'diff', label: '차이(kWh)', color: COLORS.chart.purple, type: 'bar', fillOpacity: 0.6 },
  ];
}

// ──────────────────────────────────────────────
// 동적 설비 비교 — DSH-002, ANL-001
// ──────────────────────────────────────────────
export const FACILITY_COLORS = [
  COLORS.energy.power, COLORS.energy.air, COLORS.chart.green,
  COLORS.chart.purple, COLORS.chart.red, COLORS.chart.cyan,
];

export function facilityComparisonSeries(
  facilityIds: string[],
  type: 'line' | 'area' = 'line',
  fillOpacity?: number,
): TrendSeries[] {
  return facilityIds.map((id, idx) => ({
    key: id,
    label: id,
    color: FACILITY_COLORS[idx % FACILITY_COLORS.length],
    type,
    ...(fillOpacity !== undefined ? { fillOpacity } : {}),
    ...(type === 'line' ? { width: 2 } : {}),
  }));
}
