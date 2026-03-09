import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import ChartCard from '../../components/ui/ChartCard';
import TrendChart, { TrendSeries } from '../../components/charts/TrendChart';
import { getCycleList, getCycleWaveformData } from '../../services/analysis';
import { COLORS, SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { getIntervalForZoomRatio, formatInterval } from '../../lib/chart-utils';
import { normalizeToRelativeTime, mergeOverlayData } from '../../lib/cycle-utils';
import { useFacilityOptions } from '../../hooks/useFacilityOptions';
import type { Interval } from '../../types/chart';

type CycleItem = { id: string; label: string; energy: number; similarity: number; status: 'normal' | 'anomaly' };
type WavePoint = { sec: number; value: number };

function cycleStatusBadge(status: string) {
  return status === 'anomaly'
    ? <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs font-medium">이상</span>
    : <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-[#27AE60] dark:text-[#27AE60] rounded text-xs font-medium">정상</span>;
}

export default function ANL003CycleAnalysis() {
  const { options: facilityOptions, defaultFacilityId } = useFacilityOptions();
  const [facility1, setFacility1] = useState('');
  const [facility2, setFacility2] = useState('');

  // API에서 설비 목록 로드 시 기본값 설정
  useEffect(() => {
    if (facilityOptions.length > 0) {
      if (!facility1) setFacility1(facilityOptions[0]?.value ?? '');
      if (!facility2) setFacility2(facilityOptions[1]?.value ?? facilityOptions[0]?.value ?? '');
    }
  }, [facilityOptions, facility1, facility2]);
  const [selectedCycle1, setSelectedCycle1] = useState('c001');
  const [selectedCycle2, setSelectedCycle2] = useState('c002');

  // Dynamic Resolution: interval 상태 관리
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-003'] || '10s') as Interval;
  const maxDepth = SCREEN_MAX_DEPTH['ANL-003'] || 3;
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);
  const [isZooming, setIsZooming] = useState(false);

  const { data: cycles } = useQuery({
    queryKey: ['anl-cycles', facility1],
    queryFn: () => getCycleList(facility1),
  });

  // 기준 파형 (interval 적용)
  const { data: waveRef, isLoading: loadingRef } = useQuery({
    queryKey: ['anl-wave-ref', currentInterval],
    queryFn: () => getCycleWaveformData('ref', true, currentInterval), // interval 파라미터 추가
  });

  // 비교1 파형 (interval 적용)
  const { data: wave1, isLoading: loading1 } = useQuery({
    queryKey: ['anl-wave1', selectedCycle1, currentInterval],
    queryFn: () => getCycleWaveformData(selectedCycle1, false, currentInterval), // interval 파라미터 추가
    enabled: !!selectedCycle1,
  });

  // 비교2 파형 (interval 적용)
  const { data: wave2, isLoading: loading2 } = useQuery({
    queryKey: ['anl-wave2', selectedCycle2, currentInterval],
    queryFn: () => getCycleWaveformData(selectedCycle2, false, currentInterval), // interval 파라미터 추가
    enabled: !!selectedCycle2,
  });

  // Zoom 핸들러: zoomRatio에 따라 interval 자동 전환
  const handleZoomChange = useCallback(
    (zoomRatio: number) => {
      setIsZooming(true);

      // getIntervalForZoomRatio 사용하여 새 interval 계산 (maxDepth 제약 적용)
      const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval, maxDepth);

      if (newInterval !== currentInterval) {
        console.log(
          `[ANL-003] Interval 전환: ${formatInterval(currentInterval)} → ${formatInterval(newInterval)} (ratio: ${(zoomRatio * 100).toFixed(1)}%, maxDepth: ${maxDepth})`
        );
        setCurrentInterval(newInterval);
      }

      // 500ms 후 isZooming 해제
      setTimeout(() => setIsZooming(false), 500);
    },
    [currentInterval, initialInterval, maxDepth]
  );

  // 오버레이: ref + cycle1 + cycle2 (cycle-utils 사용)
  const overlayData = useMemo(() => {
    // Backend 응답 데이터를 TimeSeriesPoint 형식으로 가정
    // waveRef, wave1, wave2는 실제 API 연동 시 timestamp 포함 예정
    // Mock 데이터는 WavePoint[] 형식이므로 변환 필요
    const startTime = new Date().toISOString(); // Mock 데이터의 시작 시간 (API 연동 시 실제 시간 사용)

    // Mock 데이터를 TimeSeriesPoint 형식으로 변환
    const refData = (waveRef ?? []).map((pt: WavePoint) => ({
      timestamp: new Date(Date.now() + pt.sec * 1000).toISOString(),
      value: pt.value,
    }));

    const cmp1Data = (wave1 ?? []).map((pt: WavePoint) => ({
      timestamp: new Date(Date.now() + pt.sec * 1000).toISOString(),
      value: pt.value,
    }));

    const cmp2Data = (wave2 ?? []).map((pt: WavePoint) => ({
      timestamp: new Date(Date.now() + pt.sec * 1000).toISOString(),
      value: pt.value,
    }));

    // 정규화: 절대 시간 → 상대 시간 (0초부터 시작)
    const normalizedRef = normalizeToRelativeTime(refData, startTime, currentInterval);
    const normalizedCmp1 = normalizeToRelativeTime(cmp1Data, startTime, currentInterval);
    const normalizedCmp2 = normalizeToRelativeTime(cmp2Data, startTime, currentInterval);

    // 오버레이 데이터 병합
    const merged = mergeOverlayData(normalizedRef, normalizedCmp1, normalizedCmp2);

    // TrendChart 형식으로 변환
    return merged.map((pt) => ({
      sec: pt.sec,
      ref: pt.refValue,
      cycle1: pt.compare1Value,
      cycle2: pt.compare2Value,
    }));
  }, [waveRef, wave1, wave2, currentInterval]);

  const cycleRows: CycleItem[] = cycles ?? [];

  // TrendChart series 설정
  const series: TrendSeries[] = useMemo(
    () => [
      {
        key: 'ref',
        label: '기준 파형',
        color: 'rgba(156,163,175,0.7)',
        type: 'line' as const,
        width: 1.5,
      },
      {
        key: 'cycle1',
        label: `비교1 (${selectedCycle1})`,
        color: COLORS.energy.power,
        type: 'line' as const,
        width: 2,
      },
      {
        key: 'cycle2',
        label: `비교2 (${selectedCycle2})`,
        color: COLORS.energy.air,
        type: 'line' as const,
        width: 2,
      },
    ],
    [selectedCycle1, selectedCycle2]
  );

  const isLoading = loadingRef || loading1 || loading2 || isZooming;

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="싸이클 분석"
        description={`설비별 싸이클 목록 → 파형 오버레이 비교 (기준/비교1/비교2) | 동적 해상도: ${formatInterval(currentInterval)} (maxDepth: ${maxDepth})`}
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 설비1 + 싸이클 목록 (좌) */}
        <div className="w-52 flex-shrink-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <select
              value={facility1}
              onChange={(e) => setFacility1(e.target.value)}
              className="w-full text-sm bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="text-xs text-amber-500 font-medium mt-1.5">비교 싸이클 1</div>
          </div>
          <div className="flex-1 overflow-auto">
            {cycleRows.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCycle1(c.id)}
                className={`px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
                  selectedCycle1 === c.id ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-l-amber-400' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.label}</span>
                  {cycleStatusBadge(c.status)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.energy.toFixed(2)} kWh | 유사도 {c.similarity.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 오버레이 차트 (중) - Dynamic Resolution 적용 */}
        <ChartCard
          title="싸이클 파형 오버레이"
          subtitle={`기준(회색) / 비교1(노란) / 비교2(파란) | 해상도: ${formatInterval(currentInterval)}`}
          className="flex-1 min-h-0"
          chartId="anl003-wave"
          exportData={overlayData}
          exportFilename="싸이클분석"
          minHeight={0}
        >
          {overlayData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              데이터 로딩 중...
            </div>
          ) : (
            <TrendChart
              data={overlayData}
              series={series}
              xKey="sec"
              yLabel="kW"
              syncKey="anl003"
              showLegend={true}
              onZoomChange={handleZoomChange}
              isLoading={isLoading}
              loadingMessage={`현재 해상도: ${formatInterval(currentInterval)}`}
            />
          )}
        </ChartCard>

        {/* 설비2 + 싸이클 목록 (우) */}
        <div className="w-52 flex-shrink-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <select
              value={facility2}
              onChange={(e) => setFacility2(e.target.value)}
              className="w-full text-sm bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="text-xs text-[#E94560] font-medium mt-1.5">비교 싸이클 2</div>
          </div>
          <div className="flex-1 overflow-auto">
            {cycleRows.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCycle2(c.id)}
                className={`px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
                  selectedCycle2 === c.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-400' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.label}</span>
                  {cycleStatusBadge(c.status)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.energy.toFixed(2)} kWh | 유사도 {c.similarity.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
