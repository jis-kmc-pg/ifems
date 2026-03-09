import { USE_MOCK } from '../lib/constants';
import type { LineId } from '../lib/constants';
import { mockDelay } from './api';
import { fetchApi } from './service-helpers';
import {
  ENERGY_TREND_MONTHLY, USAGE_DISTRIBUTION,
  CYCLE_RANKING, ENERGY_CHANGE_TOP,
  FACILITY_TREND_DATA, PROCESS_RANKING_DATA,
} from './mock/dashboard';
import { BLOCK_ENERGY_DATA, POWER_QUALITY_DATA, AIR_LEAK_DATA } from './mock/facilities';

export type { LineId };
export type EnergyType = 'power' | 'air';

// Backend는 'elec' | 'air' 사용 → 프론트 'power' → 백엔드 'elec' 변환
const toApiType = (type: EnergyType): 'elec' | 'air' => type === 'power' ? 'elec' : 'air';

// DSH-001 에너지 사용 추이
export const getEnergyTrend = (line?: LineId) => fetchApi(ENERGY_TREND_MONTHLY, '/dashboard/energy-trend', { line });

// DSH-002 설비별 추이
export const getFacilityTrend = (line?: LineId, facilityId?: string) =>
  fetchApi(FACILITY_TREND_DATA, '/dashboard/facility-trend', { line, facilityId });

// DSH-003 사용량 분포
export const getUsageDistribution = (line?: LineId, start?: string, end?: string) =>
  fetchApi(USAGE_DISTRIBUTION, '/dashboard/usage-distribution', { line, start, end });

// DSH-004 공정별 순위
export const getProcessRanking = (line?: LineId, type: EnergyType = 'power') =>
  fetchApi(PROCESS_RANKING_DATA, '/dashboard/process-ranking', { line, type: toApiType(type) });

// DSH-005 싸이클당 순위
export const getCycleRanking = (line?: LineId) => fetchApi(CYCLE_RANKING, '/dashboard/cycle-ranking', { line });

// DSH-006 전력 품질 순위
export const getPowerQualityRanking = (line?: LineId) => fetchApi(POWER_QUALITY_DATA, '/dashboard/power-quality-ranking', { line });

// DSH-007 에어 누기 순위
export const getAirLeakRanking = (line?: LineId) => fetchApi(AIR_LEAK_DATA, '/dashboard/air-leak-ranking', { line });

// DSH-008 에너지 변화 TOP N (복잡한 mock 로직 → 유지)
export async function getEnergyChangeTopN(topN: number = 8, type: EnergyType = 'power') {
  if (USE_MOCK) return mockDelay(ENERGY_CHANGE_TOP.slice(0, topN));
  return fetchApi(ENERGY_CHANGE_TOP, '/dashboard/energy-change-top', { topN, type: toApiType(type) });
}

// 공통: 설비 목록 (복잡한 mock 변환 → 유지)
export async function getFacilityList(line?: LineId) {
  if (USE_MOCK) return mockDelay(BLOCK_ENERGY_DATA.map((f) => ({ id: f.facilityId, code: f.code, name: f.name })));
  return fetchApi([], '/dashboard/facilities', { line });
}
