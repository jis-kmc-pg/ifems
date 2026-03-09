import type { Interval, RangeDataResponse, DataPoint } from '../../types/chart';
import { getZoomLevelFromInterval } from '../../lib/chart-utils';

/**
 * Mock 데이터 생성: 구간별 데이터 (동적 차트 해상도용)
 *
 * @param facilityId - 설비 ID
 * @param startTime - 시작 시각 (ISO8601)
 * @param endTime - 종료 시각 (ISO8601)
 * @param interval - 데이터 간격
 * @param metric - 메트릭 타입
 * @returns RangeDataResponse
 */
export function generateMockRangeData(
  _facilityId: string,
  startTime: string,
  endTime: string,
  interval: Interval,
  metric: 'power' | 'air' = 'power'
): RangeDataResponse {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();

  // Interval별 초 단위 간격
  const intervalSeconds = getIntervalSeconds(interval);

  // 데이터 포인트 수 계산
  const totalPoints = Math.floor(durationMs / (intervalSeconds * 1000));

  // 데이터 생성
  const data: DataPoint[] = [];
  for (let i = 0; i < totalPoints; i++) {
    const timestamp = new Date(start.getTime() + i * intervalSeconds * 1000);
    const time = timestamp.toISOString().split('T')[1].split('.')[0]; // "HH:mm:ss" (표시용)
    const fullTimestamp = timestamp.toISOString(); // ✅ 전체 ISO8601 (API용)

    // 사인파 기반 Mock 데이터 생성 (시간에 따라 변동)
    const hour = timestamp.getHours();
    const baseValue = metric === 'power' ? 3.5 : 120.0;
    const amplitude = metric === 'power' ? 0.8 : 30.0;
    const currentValue = baseValue + amplitude * Math.sin((hour / 24) * 2 * Math.PI);

    // 약간의 랜덤 노이즈 추가
    const noise = (Math.random() - 0.5) * 0.2 * amplitude;
    const currentValue_final = parseFloat((currentValue + noise).toFixed(2));

    // 전일 데이터는 당일 대비 95% (약간 낮게)
    const prevValue = parseFloat((currentValue_final * 0.95).toFixed(2));

    // Design API 스펙에 맞게: { time, timestamp, power/air, prevPower/prevAir }
    const metricKey = metric;
    const prevMetricKey = `prev${metric.charAt(0).toUpperCase() + metric.slice(1)}` as 'prevPower' | 'prevAir';

    data.push({
      time,           // 표시용: "HH:mm:ss"
      timestamp: fullTimestamp,  // ✅ API용: "2026-03-03T05:15:00.000Z"
      [metricKey]: currentValue_final,
      [prevMetricKey]: prevValue,
    } as any);
  }

  // Metadata 생성
  const zoomLevel = getZoomLevelFromInterval(interval);

  return {
    data,
    metadata: {
      interval,
      totalPoints,
      returnedPoints: data.length,
      downsampled: false,
      zoomLevel,
    },
  };
}

/**
 * Interval 문자열을 초 단위로 변환
 */
function getIntervalSeconds(interval: Interval): number {
  switch (interval) {
    case '15m':
      return 15 * 60; // 900초
    case '1m':
      return 60;       // 60초
    case '10s':
      return 10;       // 10초
    case '1s':
      return 1;        // 1초
    default:
      return 60;
  }
}
