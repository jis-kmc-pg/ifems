import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { debounce } from 'lodash-es';
import type {
  Interval,
  DynamicResolutionOptions,
  RangeDataResponse,
} from '../types/chart';
import { getIntervalForZoomRatio, formatInterval } from '../lib/chart-utils';
import { fetchRangeData, fetchLineRangeData, fetchFactoryRangeData } from '../services/monitoring';

/**
 * 동적 차트 해상도 Hook
 *
 * Zoom 이벤트에 따라 자동으로 interval을 선택하고 데이터를 재요청합니다.
 * facilityId 또는 lineCode 중 하나를 지정합니다.
 *
 * @example
 * // 설비 기반
 * const { data, ... } = useDynamicResolution({
 *   initialInterval: '15m', startTime, endTime,
 *   facilityId: 'HNK10-000', metric: 'power',
 * });
 *
 * // 라인 기반 (라인 소속 전체 설비 합산)
 * const { data, ... } = useDynamicResolution({
 *   initialInterval: '15m', startTime, endTime,
 *   lineCode: 'BLOCK', metric: 'power',
 * });
 *
 * // 공장 기반 (공장 소속 전체 라인·설비 합산)
 * const { data, ... } = useDynamicResolution({
 *   initialInterval: '15m', startTime, endTime,
 *   factoryCode: 'hw4', metric: 'power',
 * });
 */
export function useDynamicResolution(options: DynamicResolutionOptions) {
  const {
    initialInterval,
    startTime,
    endTime,
    facilityId,
    lineCode,
    factoryCode,
    metric,
    enabled = true,
    maxDepth = 3,
    zoomLevels,
  } = options;

  // 엔터티 식별자 (factoryCode > lineCode > facilityId 우선순위)
  const entityId = factoryCode || lineCode || facilityId || '';
  const entityType = factoryCode ? 'factory' : lineCode ? 'line' : 'facility';

  // 현재 interval 상태
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);

  // ✅ 확대된 시간 범위 (API 요청 최적화용)
  const [zoomedTimeRange, setZoomedTimeRange] = useState<{ start: string; end: string } | null>(null);

  // Zoom 진행 중 플래그 (무한 루프 방지)
  const isZoomingRef = useRef(false);

  // Interval 변경 직후 플래그 (자동 리셋 무시)
  const intervalChangedRef = useRef(false);

  // ✅ initialInterval 변경 시 자동 동기화 (검색단위 변경 → 줌 리셋)
  useEffect(() => {
    setCurrentInterval(initialInterval);
    setZoomedTimeRange(null);
  }, [initialInterval]);

  // ✅ API 요청 시간 범위: 확대된 범위가 있으면 사용, 없으면 전체 범위
  const apiStartTime = zoomedTimeRange?.start ?? startTime;
  const apiEndTime = zoomedTimeRange?.end ?? endTime;

  // SWR 캐시 키 (entityType + entityId + interval + 구간별로 독립 캐싱)
  const swrKey = useMemo(() => {
    if (!enabled || !entityId) return null;
    return `range-data:${entityType}:${entityId}:${metric}:${apiStartTime}:${apiEndTime}:${currentInterval}`;
  }, [enabled, entityType, entityId, metric, apiStartTime, apiEndTime, currentInterval]);

  // SWR fetcher: entityType에 따라 적절한 API 호출
  const fetcher = useCallback(() => {
    if (entityType === 'factory') {
      return fetchFactoryRangeData(entityId, apiStartTime, apiEndTime, currentInterval, metric);
    }
    if (entityType === 'line') {
      return fetchLineRangeData(entityId, apiStartTime, apiEndTime, currentInterval, metric);
    }
    return fetchRangeData(entityId, apiStartTime, apiEndTime, currentInterval, metric);
  }, [entityType, entityId, apiStartTime, apiEndTime, currentInterval, metric]);

  // SWR로 데이터 페칭
  const { data, error, isValidating, mutate } = useSWR<RangeDataResponse>(
    swrKey,
    fetcher,
    {
      dedupingInterval: 60000,       // 1분간 중복 요청 무시
      revalidateOnFocus: false,      // 포커스 시 재검증 안 함
      revalidateOnReconnect: false,  // 재연결 시 재검증 안 함
      shouldRetryOnError: true,      // 에러 시 재시도
      errorRetryCount: 3,            // 최대 3회 재시도
      keepPreviousData: true,        // 이전 데이터 유지 (깜박임 방지)
      onError: (err) => {
        console.error('[useDynamicResolution] API Error:', err);
      },
    }
  );

  /**
   * Zoom 이벤트 핸들러 (디바운싱 적용)
   *
   * @param zoomRatio - 전체 범위 대비 보이는 범위 비율 (0~1)
   * @param timeRange - 확대된 시간 범위 (옵션)
   */
  const handleZoom = useCallback(
    (zoomRatio: number, timeRange?: { start: string; end: string }) => {
      // 무한 루프 방지
      if (isZoomingRef.current) {
        console.warn('[useDynamicResolution] Zoom in progress, skipping');
        return;
      }

      // Interval 변경 직후 자동 리셋 무시 (ratio가 95% 이상일 때)
      if (intervalChangedRef.current && zoomRatio >= 0.95) {
        console.log(
          `[useDynamicResolution] Ignoring auto-reset after interval change (ratio: ${(zoomRatio * 100).toFixed(1)}%)`
        );
        intervalChangedRef.current = false; // 플래그 해제
        return;
      }

      isZoomingRef.current = true;

      try {
        // 새로운 interval 계산 (현재 interval 기준, zoomLevels 또는 maxDepth 제약 적용)
        const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval, maxDepth, zoomLevels);

        // ✅ 확대된 시간 범위 저장 (API 요청 최적화)
        if (timeRange) {
          setZoomedTimeRange(timeRange);
          console.log(
            `[useDynamicResolution] 확대 범위 저장: ${timeRange.start} ~ ${timeRange.end}`
          );
        }

        // interval 변경이 필요한 경우에만 업데이트
        if (newInterval !== currentInterval) {
          console.log(
            `[useDynamicResolution] Interval 전환: ${formatInterval(currentInterval)} → ${formatInterval(newInterval)} (ratio: ${(zoomRatio * 100).toFixed(1)}%, maxDepth: ${maxDepth})`
          );
          setCurrentInterval(newInterval);

          // Interval 변경 플래그 설정 (다음 zoom 이벤트에서 자동 리셋 무시)
          intervalChangedRef.current = true;
        }
      } finally {
        isZoomingRef.current = false;
      }
    },
    [currentInterval, initialInterval, maxDepth, zoomLevels]
  );

  /**
   * 디바운싱된 Zoom 핸들러 (500ms 지연)
   */
  const debouncedHandleZoom = useMemo(
    () => debounce(handleZoom, 500),
    [handleZoom]
  );

  /**
   * 리셋: 초기 interval로 복귀
   */
  const reset = useCallback(() => {
    console.log(
      `[useDynamicResolution] Reset: ${formatInterval(currentInterval)} → ${formatInterval(initialInterval)}`
    );
    setCurrentInterval(initialInterval);
    setZoomedTimeRange(null); // ✅ 확대 범위 초기화 (전체 범위로 복귀)
    mutate(); // SWR 캐시 재검증
  }, [currentInterval, initialInterval, mutate]);

  /**
   * 수동 interval 변경 (드롭다운에서 사용)
   */
  const setManualInterval = useCallback((interval: Interval) => {
    setCurrentInterval(interval);
  }, []);

  /**
   * 외부에서 확대 시간 범위 설정 (차트 간 동기화용)
   */
  const setManualTimeRange = useCallback((range: { start: string; end: string } | null) => {
    setZoomedTimeRange(range);
  }, []);

  /**
   * 줌 상태 여부 (초기 interval에서 변경되었거나 시간 범위가 좁혀졌을 때)
   */
  const isZoomed = currentInterval !== initialInterval || zoomedTimeRange !== null;

  /**
   * 좌우 이동: 확대된 시간 범위를 유지하면서 시간축 이동
   * TrendChart 내부 pan과 동일하게 보이는 범위 100%만큼 이동
   */
  const handlePan = useCallback((direction: 'left' | 'right') => {
    if (!zoomedTimeRange) return;

    const rangeStartMs = new Date(zoomedTimeRange.start).getTime();
    const rangeEndMs = new Date(zoomedTimeRange.end).getTime();
    const spanMs = rangeEndMs - rangeStartMs;

    const dayStartMs = new Date(startTime).getTime();
    const dayEndMs = new Date(endTime).getTime();

    let newStartMs: number, newEndMs: number;
    if (direction === 'left') {
      newStartMs = Math.max(dayStartMs, rangeStartMs - spanMs);
      newEndMs = newStartMs + spanMs;
    } else {
      newEndMs = Math.min(dayEndMs, rangeEndMs + spanMs);
      newStartMs = newEndMs - spanMs;
    }

    const toIso = (ms: number) => {
      const d = new Date(ms);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+09:00`;
    };

    setZoomedTimeRange({ start: toIso(newStartMs), end: toIso(newEndMs) });
  }, [zoomedTimeRange, startTime, endTime]);

  /**
   * 좌우 이동 가능 여부 (경계 도달 시 비활성)
   */
  const panState = useMemo(() => {
    if (!zoomedTimeRange) return { canLeft: false, canRight: false };
    const rangeStartMs = new Date(zoomedTimeRange.start).getTime();
    const rangeEndMs = new Date(zoomedTimeRange.end).getTime();
    const dayStartMs = new Date(startTime).getTime();
    const dayEndMs = new Date(endTime).getTime();
    return {
      canLeft: rangeStartMs > dayStartMs,
      canRight: rangeEndMs < dayEndMs,
    };
  }, [zoomedTimeRange, startTime, endTime]);

  // M-01: Toast notification on API error (Design Section 6.3)
  useEffect(() => {
    if (error && enabled) {
      const errorMessage = error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      alert(`[동적 해상도 오류] ${errorMessage}`);
    }
  }, [error, enabled]);

  return {
    // 데이터
    data: data?.data ?? [],
    metadata: data?.metadata,
    anomalies: data?.anomalies ?? [],

    // 상태
    currentInterval,
    zoomedTimeRange,
    isZoomed,
    isLoading: isValidating,
    isError: !!error,
    error,

    // 줌 네비게이션
    handlePan,
    panState,

    // 액션
    handleZoom: debouncedHandleZoom,
    reset,
    setManualInterval,
    setManualTimeRange,
  };
}
