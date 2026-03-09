import { USE_MOCK } from '../lib/constants';
import type { LineId } from '../lib/constants';
import { mockDelay, apiClient } from './api';
import { fetchApi } from './service-helpers';
import { computeOverviewKpi, computeLineMiniCards, computeHourlyTrend, computeLineDetailChart } from './mock/monitoring-computed';
import { ALARM_SUMMARY } from './mock/monitoring';
import { BLOCK_ENERGY_DATA, ENERGY_ALERT_DATA, POWER_QUALITY_DATA, AIR_LEAK_DATA } from './mock/facilities';
import type { Interval, RangeDataResponse } from '../types/chart';
import { generateMockRangeData } from './mock/range-data';

export type { LineId };
export type EnergyType = 'power' | 'air';

// Backend는 'elec' | 'air' 사용 (CLAUDE.md 규칙) → 프론트 'power' → 백엔드 'elec' 변환
const toApiType = (type: EnergyType): 'elec' | 'air' => type === 'power' ? 'elec' : 'air';

// MON-001 종합 현황
export const getOverviewKpi = () => fetchApi(computeOverviewKpi(), '/monitoring/overview/kpi');
export const getLineMiniCards = () => fetchApi(computeLineMiniCards(), '/monitoring/overview/lines');
export const getHourlyTrend = (date?: string) => fetchApi(computeHourlyTrend(), '/monitoring/overview/hourly', { date });
export const getAlarmSummary = () => fetchApi(ALARM_SUMMARY, '/monitoring/overview/alarms');

// MON-002 라인별 상세
export const getLineDetailChart = (line: string, date?: string, interval?: number) =>
  fetchApi(computeLineDetailChart(line as LineId), `/monitoring/line/${line}`, { date, interval });

// MON-003 에너지 순위
export const getEnergyRanking = (line: LineId, type: EnergyType) =>
  fetchApi(BLOCK_ENERGY_DATA, '/monitoring/energy-ranking', { line, type: toApiType(type) });

// MON-004 에너지 알림 현황
export const getEnergyAlertStatus = (line: LineId) => fetchApi(ENERGY_ALERT_DATA, '/monitoring/energy-alert', { line });

// MON-005 전력 품질 순위
export const getPowerQualityRanking = (line: LineId, startDate?: string, endDate?: string) =>
  fetchApi(POWER_QUALITY_DATA, '/monitoring/power-quality', { line, startDate, endDate });

// MON-006 에어 누기 순위
export const getAirLeakRanking = (line: LineId) => fetchApi(AIR_LEAK_DATA, '/monitoring/air-leak', { line });

/**
 * 동적 차트 해상도: 설비별 구간 데이터 조회
 *
 * @param facilityId - 설비 ID (예: "HNK10-000")
 * @param startTime - 조회 시작 시각 (ISO8601)
 * @param endTime - 조회 종료 시각 (ISO8601)
 * @param interval - 데이터 간격 ("15m" | "1m" | "10s" | "1s")
 * @param metric - 메트릭 타입 ("power" | "air")
 * @returns RangeDataResponse (data + metadata)
 */
export async function fetchRangeData(
  facilityId: string,
  startTime: string,
  endTime: string,
  interval: Interval,
  metric: EnergyType = 'power'
): Promise<RangeDataResponse> {
  if (USE_MOCK) {
    return mockDelay(
      generateMockRangeData(facilityId, startTime, endTime, interval, metric)
    );
  }

  return apiClient
    .get(`/facilities/${facilityId}/${metric}/range`, {
      params: { startTime, endTime, interval },
    })
    .then((r) => r.data);
}

/**
 * 동적 차트 해상도: 공장별 구간 데이터 조회
 *
 * 해당 공장에 속한 모든 라인·설비의 에너지 데이터를 합산하여 반환
 *
 * @param factoryCode - 공장 코드 (예: "hw4")
 * @param startTime - 조회 시작 시각 (ISO8601)
 * @param endTime - 조회 종료 시각 (ISO8601)
 * @param interval - 데이터 간격 ("15m" | "1m" | "10s" | "1s")
 * @param metric - 메트릭 타입 ("power" | "air")
 * @returns RangeDataResponse (data + metadata)
 */
export async function fetchFactoryRangeData(
  factoryCode: string,
  startTime: string,
  endTime: string,
  interval: Interval,
  metric: EnergyType = 'power'
): Promise<RangeDataResponse> {
  if (USE_MOCK) {
    return mockDelay(
      generateMockRangeData(factoryCode, startTime, endTime, interval, metric)
    );
  }

  return apiClient
    .get(`/factories/${factoryCode}/${metric}/range`, {
      params: { startTime, endTime, interval },
    })
    .then((r) => r.data);
}

/**
 * 동적 차트 해상도: 라인별 구간 데이터 조회
 *
 * 해당 라인에 속한 모든 설비의 에너지 데이터를 합산하여 반환
 *
 * @param lineCode - 라인 코드 (예: "BLOCK", "HEAD")
 * @param startTime - 조회 시작 시각 (ISO8601)
 * @param endTime - 조회 종료 시각 (ISO8601)
 * @param interval - 데이터 간격 ("15m" | "1m" | "10s" | "1s")
 * @param metric - 메트릭 타입 ("power" | "air")
 * @returns RangeDataResponse (data + metadata)
 */
export async function fetchLineRangeData(
  lineCode: string,
  startTime: string,
  endTime: string,
  interval: Interval,
  metric: EnergyType = 'power'
): Promise<RangeDataResponse> {
  if (USE_MOCK) {
    return mockDelay(
      generateMockRangeData(lineCode, startTime, endTime, interval, metric)
    );
  }

  return apiClient
    .get(`/lines/${lineCode}/${metric}/range`, {
      params: { startTime, endTime, interval },
    })
    .then((r) => r.data);
}
