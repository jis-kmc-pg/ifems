import { useMemo, useEffect, useCallback } from 'react';
import { useDynamicResolution } from './useDynamicResolution';
import { lineDetailPowerSeries, lineDetailAirSeries } from '../lib/chart-series';
import type { Interval } from '../types/chart';
import type { TrendSeries } from '../components/charts/TrendChart';

// ──────────────────────────────────────────────
// 전력+에어 2차트 공통 훅 (MON-002 완성형 기준)
//
// useDynamicResolution ×2 + 줌 동기화 + 핸들러를 캡슐화.
// MON-002, DSH-001, DSH-002 팝업에서 공통 사용.
// ──────────────────────────────────────────────

interface UsePowerAirChartsOptions {
  initialInterval: Interval;
  startTime: string;
  endTime: string;
  /** 엔터티 식별자 — 하나만 지정 (우선순위: factory > line > facility) */
  factoryCode?: string;
  lineCode?: string;
  facilityId?: string;
  enabled: boolean;
  zoomLevels?: Interval[];
  /** 현재 시각선 표시 여부 (MON-002에서 사용) */
  showCurrentTime?: boolean;
}

interface PowerAirChartsReturn {
  // ─── 전력 ───
  power: ReturnType<typeof useDynamicResolution>;
  // ─── 에어 ───
  air: ReturnType<typeof useDynamicResolution>;
  // ─── 핸들러 ───
  handlePan: (direction: 'left' | 'right') => void;
  handleReset: () => void;
  // ─── 시리즈 ───
  powerSeries: TrendSeries[];
  airSeries: TrendSeries[];
  // ─── 현재 시각 (showCurrentTime=true 일 때만 유효) ───
  currentTime: string | undefined;
}

export function usePowerAirCharts(options: UsePowerAirChartsOptions): PowerAirChartsReturn {
  const {
    initialInterval,
    startTime,
    endTime,
    factoryCode,
    lineCode,
    facilityId,
    enabled,
    zoomLevels,
    showCurrentTime = false,
  } = options;

  // 엔터티 식별 props (spread 용)
  const entityProps = useMemo(() => {
    if (factoryCode) return { factoryCode };
    if (lineCode) return { lineCode };
    return { facilityId: facilityId ?? '' };
  }, [factoryCode, lineCode, facilityId]);

  // ─── useDynamicResolution × 2 ───
  const power = useDynamicResolution({
    initialInterval,
    startTime,
    endTime,
    ...entityProps,
    metric: 'power',
    enabled,
    zoomLevels,
  });

  const air = useDynamicResolution({
    initialInterval,
    startTime,
    endTime,
    ...entityProps,
    metric: 'air',
    enabled,
    zoomLevels,
  });

  // ─── 줌 동기화: 전력 차트 → 에어 차트 ───
  const powerInterval = power.currentInterval;
  const powerZoomedRange = power.zoomedTimeRange;
  useEffect(() => {
    if (!enabled) return;
    air.setManualInterval(powerInterval);
    air.setManualTimeRange(powerZoomedRange);
  }, [enabled, powerInterval, powerZoomedRange]);

  // ─── 핸들러 ───
  const handlePan = useCallback((direction: 'left' | 'right') => {
    power.handlePan(direction);
  }, [power.handlePan]);

  const handleReset = useCallback(() => {
    power.reset();
    air.reset();
  }, [power.reset, air.reset]);

  // ─── 시리즈 (메모이제이션) ───
  const powerSeries = useMemo(() => lineDetailPowerSeries(), []);
  const airSeries = useMemo(() => lineDetailAirSeries(), []);

  // ─── 현재 시각 (선택적) ───
  const currentTime = useMemo(() => {
    if (!showCurrentTime) return undefined;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return powerInterval === '1s' || powerInterval === '10s'
      ? `${hh}:${mm}:${ss}`
      : `${hh}:${mm}`;
  }, [showCurrentTime, powerInterval]);

  return {
    power,
    air,
    handlePan,
    handleReset,
    powerSeries,
    airSeries,
    currentTime,
  };
}
