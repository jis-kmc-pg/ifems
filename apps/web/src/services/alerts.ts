import { USE_MOCK } from '../lib/constants';
import { mockDelay } from './api';
import { fetchApi, patchApi } from './service-helpers';
import {
  ALERT_STATS_KPI, ALERT_TRENDS, ALERT_HEATMAP,
  ALERT_HISTORY, CYCLE_WAVEFORM, CYCLE_ANOMALY_TYPES,
} from './mock/alerts';

export type AlertCategory = 'power_quality' | 'air_leak' | 'cycle_anomaly';

// 카테고리 → mock 키 변환
const toMockKey = (c: AlertCategory) => c === 'power_quality' ? 'powerQuality' : c === 'air_leak' ? 'airLeak' : 'cycleAnomaly';

// ALT-001~003 통계 KPI (복잡한 mock 매핑 → 유지)
export async function getAlertStatsKpi(category: AlertCategory) {
  if (USE_MOCK) return mockDelay(ALERT_STATS_KPI[toMockKey(category)]);
  return fetchApi(ALERT_STATS_KPI.powerQuality, '/alerts/stats/kpi', { category });
}

// ALT-001~003 주간 트렌드 (복잡한 mock 매핑 → 유지)
export async function getAlertTrend(category: AlertCategory) {
  if (USE_MOCK) return mockDelay(ALERT_TRENDS[toMockKey(category)]);
  return fetchApi(ALERT_TRENDS.powerQuality, '/alerts/stats/trend', { category });
}

// ALT-001 히트맵
export const getAlertHeatmap = (category: AlertCategory) =>
  fetchApi(ALERT_HEATMAP.powerQuality, '/alerts/stats/heatmap', { category });

// ALT-004~006 이력 (복잡한 mock 필터 → 유지)
export async function getAlertHistory(category: AlertCategory, line?: string, facilityCode?: string) {
  if (USE_MOCK) return mockDelay(ALERT_HISTORY.filter((h) => h.category === category));
  return fetchApi([], '/alerts/history', { category, line, facilityCode });
}

// ALT 조치사항 저장
export const saveAlertAction = (id: string, action: string) =>
  patchApi({ success: true }, `/alerts/${id}/action`, { action });

// 싸이클 파형 (이력 상세 모달)
export const getCycleWaveformForAlert = (alertId: string, interval?: string) =>
  fetchApi(CYCLE_WAVEFORM, `/alerts/${alertId}/waveform`, { interval });

// 싸이클 이상 유형별 분포 (ALT-003용)
export const getCycleAnomalyTypes = () => fetchApi(CYCLE_ANOMALY_TYPES, '/alerts/cycle-anomaly/types');
