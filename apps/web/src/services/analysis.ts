import { USE_MOCK } from '../lib/constants';
import { mockDelay } from './api';
import { fetchApi } from './service-helpers';
import {
  FACILITY_TREE, getFacilityElecData, getFacilityAirData,
  CYCLE_LIST, getCycleWaveform, CYCLE_DELAY_INFO,
} from './mock/analysis';

// ANL-001, 005 설비 트리
export const getFacilityTree = () => fetchApi(FACILITY_TREE, '/analysis/facilities/tree');

// ANL-001 설비별 당일 시간대별 데이터 (복잡한 mock 분기 → 유지)
export async function getFacilityHourlyData(facilityId: string, type: 'elec' | 'air', date?: string) {
  if (USE_MOCK) return mockDelay(type === 'elec' ? getFacilityElecData(facilityId) : getFacilityAirData(facilityId));
  return fetchApi([], '/analysis/facility/hourly', { facilityId, type, date });
}

// ANL-002 상세 비교 분석 (복잡한 mock 연산 → 유지)
export async function getDetailedComparison(cond1: { facilityId: string; date: string }, cond2: { facilityId: string; date: string }) {
  if (USE_MOCK) {
    const d1 = getFacilityElecData(cond1.facilityId);
    const d2 = getFacilityElecData(cond2.facilityId);
    const diff = d1.map((pt, i) => ({
      time: pt.time,
      timestamp: pt.timestamp,
      origin: pt.current,
      compare: d2[i]?.current ?? 0,
      diff: pt.current - (d2[i]?.current ?? 0)
    }));
    return mockDelay(diff);
  }
  return fetchApi([], '/analysis/comparison/detailed', {
    facilityId: cond1.facilityId, date: cond1.date, facilityId2: cond2.facilityId, date2: cond2.date,
  });
}

// ANL-003 싸이클 목록
export const getCycleList = (facilityId?: string) => fetchApi(CYCLE_LIST, '/analysis/cycles', { facilityId });

// ANL-003 싸이클 파형 (복잡한 mock 함수 호출 → 유지)
export async function getCycleWaveformData(cycleId: string, isReference = false, interval: '15m' | '1m' | '10s' | '1s' = '10s') {
  if (USE_MOCK) return mockDelay(getCycleWaveform(cycleId, isReference, interval));
  return fetchApi([], '/analysis/cycle/waveform', { cycleId, isReference, interval });
}

// ANL-004 싸이클 타임 지연 정보
export const getCycleDelayInfo = (cycleId?: string) => fetchApi(CYCLE_DELAY_INFO, '/analysis/cycle/delay', { cycleId });

// ANL-005 전력 품질 분석 (복잡한 mock → 유지)
export async function getPowerQualityAnalysis(facilityIds: string[], date?: string) {
  if (USE_MOCK) return mockDelay(facilityIds.map((id) => getFacilityElecData(id)));
  return fetchApi([], '/analysis/power-quality', { facilityIds, date });
}
