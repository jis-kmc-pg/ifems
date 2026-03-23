import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import TrendChart from '../../components/charts/TrendChart';
import { getCycleWaveformForAlert } from '../../services/alerts';
import { COLORS, SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import { cycleWaveformComparisonSeries } from '../../lib/chart-series';
import { getIntervalForZoomRatio, formatInterval } from '../../lib/chart-utils';
import type { Interval } from '../../types/chart';
import { ALERT_STATUS_OPTIONS as STATUS_OPTIONS } from '../../lib/filter-options';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAlertHistory } from '../../hooks/useAlertHistory';
import type { AlertHistoryItem } from '../../services/mock/alerts';

export default function ALT006CycleAnomalyHistory() {
  const [statusFilter, setStatusFilter] = useState('');

  const {
    selected, action, setAction,
    graphOpen, openGraph, closeGraph,
    rows: baseRows, refetch, handleSelect, isLoading,
    saveMutation, baseFilters,
  } = useAlertHistory({ category: 'cycle_anomaly', queryKeyPrefix: 'alt-cycle-history' });

  // ALT006 추가 필터: 상태
  const rows = statusFilter
    ? baseRows.filter((r) => r.status === statusFilter)
    : baseRows;

  const filters = [
    ...baseFilters,
    { type: 'select' as const, key: 'status', label: '상태', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
  ];

  // Dynamic Resolution for modal chart
  const initialInterval = (SCREEN_INITIAL_INTERVAL['ALT-006'] || '15m') as Interval;
  const maxDepth = SCREEN_MAX_DEPTH['ALT-006'] || 2;
  const [currentInterval, setCurrentInterval] = useState<Interval>(initialInterval);

  const { data: waveform } = useQuery({
    queryKey: ['alt-cycle-waveform', selected?.id, currentInterval],
    queryFn: () => getCycleWaveformForAlert(selected?.id ?? '', currentInterval),
    enabled: graphOpen && !!selected,
  });

  const handleZoomChange = useCallback((zoomRatio: number) => {
    const newInterval = getIntervalForZoomRatio(zoomRatio, currentInterval, initialInterval, maxDepth);
    if (newInterval !== currentInterval) {
      setCurrentInterval(newInterval);
    }
  }, [currentInterval, initialInterval, maxDepth]);

  // 차트 series 설정 (팩토리 사용)
  const series = useMemo(() => cycleWaveformComparisonSeries(), []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클 이상 이력" description="싸이클 시간/파형 이상 알림 이력 및 조치사항 관리" />

      <FilterBar
        filters={filters}
        onSearch={() => refetch()}
        className="mb-0"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 이력 테이블 */}
        <div className="flex-[3] bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">알림 이력 ({rows.length}건)</span>
          </div>
          <div className="flex-1 overflow-auto relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#16213E]/60 backdrop-blur-[1px] z-10">
                <Spinner size="md" message="알림 이력 조회 중..." />
              </div>
            )}
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['No', '발생시각', '라인', '설비코드', '기준시간', '실제시간', '비율', '상태'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: AlertHistoryItem, i: number) => (
                  <tr
                    key={row.id}
                    onClick={() => handleSelect(row)}
                    className={`border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
                      selected?.id === row.id ? 'bg-[#27AE60]/10 dark:bg-[#27AE60]/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.line}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.facilityCode}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.baseline}</td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: Math.abs(row.ratio - 100) > 15 ? COLORS.danger : Math.abs(row.ratio - 100) > 8 ? COLORS.energy.power : COLORS.normal }}>
                      {row.current}
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: Math.abs(row.ratio - 100) > 15 ? COLORS.danger : Math.abs(row.ratio - 100) > 8 ? COLORS.energy.power : COLORS.normal }}>
                      {row.ratio > 100 ? '+' : ''}{(row.ratio - 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 상세 패널 */}
        <div className="flex-[2] bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">상세 정보</span>
          </div>
          {selected ? (
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
              <div className="space-y-2">
                {[
                  ['라인', selected.line], ['설비명', selected.facilityName],
                  ['기준시간', selected.baseline], ['실제시간', selected.current],
                  ['편차', `${selected.ratio > 100 ? '+' : ''}${(selected.ratio - 100).toFixed(1)}%`],
                  ['발생시각', new Date(selected.timestamp).toLocaleString('ko-KR')],
                  ['상태', <StatusBadge status={selected.status} />],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-gray-500 flex-shrink-0">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={openGraph}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[#E74C3C] text-[#E74C3C] hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm w-fit"
              >
                <BarChart2 size={14} />
                파형 그래프 보기
              </button>
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-semibold text-gray-800 dark:text-white">조치사항</label>
                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="조치사항을 입력하세요..."
                  className="flex-1 resize-none bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60] min-h-[100px]"
                />
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-[#27AE60] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 self-end"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">좌측에서 항목을 선택하세요</div>
          )}
        </div>
      </div>

      {/* 파형 모달 */}
      <Modal
        isOpen={graphOpen}
        onClose={() => {
          closeGraph();
          setCurrentInterval(initialInterval);
        }}
        title={`${selected?.facilityCode} — 싸이클 파형 비교 (${formatInterval(currentInterval)})`}
        size="xl"
      >
        <div style={{ height: 280 }}>
          <TrendChart
            data={waveform ?? []}
            series={series}
            xKey="time"
            yLabel="kW"
            showLegend={true}
            onZoomChange={handleZoomChange}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">회색: 기준 파형 | 보라: 이상 발생 파형 (maxDepth: {maxDepth}, 줌 기능 지원)</p>
      </Modal>
    </div>
  );
}
