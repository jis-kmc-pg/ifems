import { USE_MOCK } from '../lib/constants';
import { mockDelay } from './api';
import { fetchApi } from './service-helpers';
import {
  FACILITY_TREE, getFacilityElecData, getFacilityAirData,
  CYCLE_LIST, getCycleWaveform, CYCLE_DELAY_INFO,
} from './mock/analysis';

// ANL-001, 005 설비 트리
export const getFacilityTree = () => fetchApi(FACILITY_TREE, '/analysis/facilities/tree');

// ANL-002 설비별 태그 수 (전력 순시)
export const getFacilityTagCounts = (energyType?: string) =>
  fetchApi({} as Record<string, number>, '/analysis/facilities/tag-counts',
    energyType ? { energyType } : undefined);

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

// ANL-009/010 시간범위 내 싸이클 목록 (타임라인용)
export interface CycleRangeItem {
  id: string;
  cycleNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
  totalEnergy: number;
  peakPower: number;
  avgPower: number;
  similarity: number;
  delay: number;
  status: 'normal' | 'delayed' | 'anomaly';
}

export const getCyclesInRange = (facilityId: string, start: string, end: string): Promise<CycleRangeItem[]> =>
  fetchApi([] as CycleRangeItem[], '/analysis/cycles/range', { facilityId, start, end });

// ANL-011 싸이클 내 스텝 목록
export interface StepItem {
  stepSeq: number;
  startTime: string;
  endTime: string;
  durationSec: number;
}

export const getCycleSteps = (materialId: string): Promise<StepItem[]> =>
  fetchApi([] as StepItem[], '/analysis/cycles/steps', { materialId });

// ANL-004 싸이클 타임 지연 정보
export const getCycleDelayInfo = (cycleId?: string) => fetchApi(CYCLE_DELAY_INFO, '/analysis/cycle/delay', { cycleId });

// ANL-002 설비별 트렌드 태그 순시값 시계열
export async function getFacilityTrendData(
  facilityId: string, startTime: string, endTime: string,
  interval: '10s' | '1s' = '10s', energyType?: string,
) {
  return fetchApi({ tags: [], data: [] }, '/analysis/facility/trend',
    { facilityId, startTime, endTime, interval, ...(energyType ? { energyType } : {}) });
}

// ANL-005 전력 품질 분석 (복잡한 mock → 유지)
export async function getPowerQualityAnalysis(facilityIds: string[], date?: string) {
  if (USE_MOCK) return mockDelay(facilityIds.map((id) => getFacilityElecData(id)));
  return fetchApi([], '/analysis/power-quality', { facilityIds, date });
}
