import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import CycleChart from '../../components/charts/CycleChart';
import { getCycleList, getCycleWaveformData, getCycleDelayInfo } from '../../services/analysis';
import { SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { CYCLE_STATUS_OPTIONS as STATUS_OPTIONS } from '../../lib/filter-options';
import { getIntervalForZoomRatio, formatInterval } from '../../lib/chart-utils';
import { useFacilityOptions } from '../../hooks/useFacilityOptions';
import type { Interval } from '../../types/chart';

type CycleItem = { id: string; label: string; energy: number; similarity: number; status: 'normal' | 'anomaly' };
type WavePoint = { sec: number; value: number };

export default function ANL004CycleDelay() {
  const { options: facilityOptions, defaultFacilityId } = useFacilityOptions();
  const [facility, setFacility] = useState('');

  // API에서 설비 목록 로드 시 기본값 설정
  useEffect(() => {
    if (defaultFacilityId && !facility) setFacility(defaultFacilityId);
  }, [defaultFacilityId, facility]);
  const [statusFilter, setStatusFilter] = useState('전체');
  const [selectedCycle, setSelectedCycle] = useState('c001');
  const [refCycle, setRefCycle] = useState('c003');

  // Dynamic Resolution: interval 상태 관리
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ANL-004'] || '10s') as Interval;
  const maxDepth = SCREEN_MAX_DEPTH['ANL-004'] || 3;
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);
  const [isZooming, setIsZooming] = useState(false);

  const { data: info } = useQuery({ queryKey: ['anl-delay-info', selectedCycle], queryFn: () => getCycleDelayInfo(selectedCycle) });
  const { data: cycles } = useQuery({ queryKey: ['anl-cycles-delay', facility], queryFn: () => getCycleList(facility) });
  const { data: waveRef, isLoading: loadingRef } = useQuery({ queryKey: ['anl-wave-ref-004', refCycle, currentInterval], queryFn: () => getCycleWaveformData(refCycle, true, currentInterval) });
  const { data: waveSel, isLoading: loadingSel } = useQuery({ queryKey: ['anl-wave-sel-004', selectedCycle, currentInterval], queryFn: () => getCycleWaveformData(selectedCycle, false, currentInterval) });

  // Zoom 핸들러: zoomRatio에 따라 interval 자동 전환
  const handleZoomChange = useCallback(
    (zoomRatio: number) => {
      setIsZooming(true);

      const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval, maxDepth);

      if (newInterval !== currentInterval) {
        console.log(
          `[ANL-004] Interval 전환: ${formatInterval(currentInterval)} → ${formatInterval(newInterval)} (ratio: ${(zoomRatio * 100).toFixed(1)}%, maxDepth: ${maxDepth})`
        );
        setCurrentInterval(newInterval);
      }

      setTimeout(() => setIsZooming(false), 500);
    },
    [currentInterval, initialInterval, maxDepth]
  );

  const rows: CycleItem[] = (cycles ?? []).filter((c: CycleItem) =>
    statusFilter === '전체' || (statusFilter === '이상' ? c.status === 'anomaly' : c.status === 'normal')
  );

  // 3개 패널용 데이터: 기준, 비교, 차이
  const panelData = (waveRef ?? []).map((pt: WavePoint, i: number) => ({
    sec: pt.sec,
    ref: pt.value,
    current: waveSel?.[i]?.value ?? 0,
    diff: (waveSel?.[i]?.value ?? 0) - pt.value,
  }));

  const isLoading = loadingRef || loadingSel || isZooming;

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클 타임 지연" description={`기준 파형 대비 비교 싸이클 타임 지연 분석 (3패널) | 동적 해상도: ${formatInterval(currentInterval)} (maxDepth: ${maxDepth})`} />

      {/* 상단 메타카드 */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="싸이클 ID" value={info?.cycleId ?? '-'} unit="" />
        <KpiCard label="총 에너지" value={info?.totalEnergy?.toFixed(2) ?? 0} unit="kWh" />
        <KpiCard label="유사도" value={info?.similarity?.toFixed(2) ?? 0} unit="%" inverseChange />
        <KpiCard label="타임 지연" value={info?.delay ?? 0} unit="싸이클" inverseChange />
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 싸이클 목록 (좌) */}
        <div id="anl004-cycle-list" className="w-52 flex-shrink-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-full">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 space-y-2">
            <select
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-auto">
            {rows.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCycle(c.id)}
                className={`px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
                  selectedCycle === c.id ? 'bg-[#27AE60]/10 dark:bg-[#27AE60]/20 border-l-2 border-l-[#27AE60]' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{c.label}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ml-1 ${c.status === 'anomaly' ? 'text-red-500' : 'text-[#27AE60]'}`}>
                    {c.similarity.toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{c.energy.toFixed(2)} kWh</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3패널 차트 */}
        <div id="anl004-chart-container" className="flex-1 flex flex-col gap-2 min-h-0 h-full">
          {/* 기준 파형 */}
          <ChartCard title="기준 파형 (kW)" subtitle={`기준 싸이클: ${refCycle} | 해상도: ${formatInterval(currentInterval)}`} className="flex-1 min-h-0" chartId="anl004-ref" minHeight={0}>
            {panelData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
              </div>
            ) : (
              <CycleChart data={panelData} type="ref" onZoomChange={handleZoomChange} />
            )}
          </ChartCard>

          {/* 비교 파형 */}
          <ChartCard title="비교 파형 (kW)" subtitle={`비교 싸이클: ${selectedCycle} | 해상도: ${formatInterval(currentInterval)}`} className="flex-1 min-h-0" chartId="anl004-cur" minHeight={0}>
            {panelData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
              </div>
            ) : (
              <CycleChart data={panelData} type="current" onZoomChange={handleZoomChange} />
            )}
          </ChartCard>

          {/* 차이 */}
          <ChartCard title="차이 (비교 - 기준, kW)" subtitle={`양수=비교 초과 / 음수=기준 초과 | 해상도: ${formatInterval(currentInterval)}`} className="flex-1 min-h-0" chartId="anl004-diff" minHeight={0}>
            {panelData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {isLoading ? '데이터 로딩 중...' : '데이터가 없습니다'}
              </div>
            ) : (
              <CycleChart data={panelData} type="diff" onZoomChange={handleZoomChange} />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
