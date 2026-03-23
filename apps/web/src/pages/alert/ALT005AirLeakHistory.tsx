import { BarChart2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import { COLORS } from '../../lib/constants';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAlertHistory } from '../../hooks/useAlertHistory';
import { getCycleWaveformForAlert } from '../../services/alerts';
import type { AlertHistoryItem } from '../../services/mock/alerts';

export default function ALT005AirLeakHistory() {
  const {
    selected, action, setAction,
    graphOpen, openGraph, closeGraph,
    rows, refetch, handleSelect, isLoading,
    saveMutation, baseFilters,
  } = useAlertHistory({ category: 'air_leak', queryKeyPrefix: 'alt-air-history' });

  // 선택된 항목의 당일 시간별 에어 사용량 조회
  const { data: airTrend } = useQuery({
    queryKey: ['alt-air-trend-modal', selected?.id],
    queryFn: () => getCycleWaveformForAlert(selected?.id ?? ''),
    enabled: graphOpen && !!selected,
  });

  // API 데이터를 SvgBarChart 형식으로 변환
  const chartData = (airTrend ?? []).map((d: { time: string; current: number }) => ({
    hour: d.time,
    value: d.current,
  }));

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에어 누기 이력" description="에어 누기 알림 발생 이력 및 조치사항 관리" />

      <FilterBar
        filters={baseFilters}
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
                  {['No', '발생시각', '라인', '설비코드', '기준값', '현재값', '초과율', '상태'].map((h) => (
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
                    <td className="px-3 py-2.5 font-medium" style={{ color: row.ratio > 140 ? COLORS.danger : row.ratio > 120 ? COLORS.energy.power : COLORS.normal }}>
                      {row.current}
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: row.ratio > 140 ? COLORS.danger : row.ratio > 120 ? COLORS.energy.power : COLORS.normal }}>
                      +{(row.ratio - 100).toFixed(1)}%
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
                  ['기준값', selected.baseline], ['현재값', selected.current],
                  ['초과율', `+${(selected.ratio - 100).toFixed(1)}%`],
                  ['발생시각', new Date(selected.timestamp).toLocaleString('ko-KR')],
                  ['상태', <StatusBadge status={selected.status} />],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-gray-500 flex-shrink-0">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={openGraph}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[#3B82F6] text-[#E94560] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm w-fit"
              >
                <BarChart2 size={14} />
                그래프 보기
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

      <Modal isOpen={graphOpen} onClose={closeGraph} title={`${selected?.facilityCode} — 당일 에어 사용량 추이`} size="lg">
        <div style={{ height: 260 }}>
          <SvgBarChart
            data={chartData.length > 0 ? chartData : [{ hour: '-', value: 0 }]}
            categoryKey="hour"
            bars={[{ dataKey: 'value', color: COLORS.energy.air }]}
            referenceLines={airTrend && airTrend.length > 0 ? [{
              value: airTrend[0]?.prev ?? 0,
              color: COLORS.energy.air,
              label: '평균',
              dashed: true,
            }] : []}
            formatValue={(v) => `${Number(v).toFixed(0)}`}
            formatTooltip={(item) => `${item.hour}: ${Number(item.value).toFixed(1)} m³`}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">파란 막대: 시간별 에어 사용량 | 점선: 당일 평균</p>
      </Modal>
    </div>
  );
}
