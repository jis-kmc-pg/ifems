import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import Modal from '../../components/ui/Modal';
import { getAlertHistory, saveAlertAction } from '../../services/alerts';
import { AlertHistoryItem } from '../../services/mock/alerts';
import { COLORS } from '../../lib/constants';
import { LINE_OPTIONS_KR as LINE_OPTIONS } from '../../lib/filter-options';
const TODAY = new Date().toISOString().slice(0, 10);
const START_STR = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    RESOLVED: 'bg-green-100 text-[#27AE60] dark:bg-green-900/30 dark:text-[#27AE60]',
  };
  const label: Record<string, string> = { ACTIVE: '발생', ACKNOWLEDGED: '인지', RESOLVED: '해소' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? ''}`}>{label[status] ?? status}</span>;
}

// 목업용 에어 누기 추이 차트 데이터
const LEAK_CHART = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  value: 12000 + Math.sin(i * 0.4) * 2000 + i * 250,
}));

export default function ALT005AirLeakHistory() {
  const [lineFilter, setLineFilter] = useState('');
  const [startDate, setStartDate] = useState(START_STR);
  const [endDate, setEndDate] = useState(TODAY);
  const [selected, setSelected] = useState<AlertHistoryItem | null>(null);
  const [action, setAction] = useState('');
  const [graphOpen, setGraphOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['alt-air-history', lineFilter],
    queryFn: () => getAlertHistory('air_leak', lineFilter || undefined),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveAlertAction(selected?.id ?? '', action),
    onSuccess: () => alert('조치사항이 저장되었습니다.'),
  });

  const rows = (data ?? []).filter((r: AlertHistoryItem) => !lineFilter || r.line === lineFilter);

  const handleSelect = (row: AlertHistoryItem) => { setSelected(row); setAction(row.action ?? ''); };

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에어 누기 이력" description="에어 누기 알림 발생 이력 및 조치사항 관리" />

      <FilterBar
        filters={[
          { type: 'date', key: 'start', label: '시작일', value: startDate, onChange: setStartDate },
          { type: 'date', key: 'end', label: '종료일', value: endDate, onChange: setEndDate },
          { type: 'select', key: 'line', label: '라인', value: lineFilter, onChange: setLineFilter, options: LINE_OPTIONS },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 이력 테이블 */}
        <div className="flex-[3] bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">알림 이력 ({rows.length}건)</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['No', '발생시각', '라인', '설비코드', '기준값(L)', '현재값(L)', '누기율', '상태'].map((h) => (
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
                      {(row.ratio - 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5">{statusBadge(row.status)}</td>
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
                  ['누기율', `+${(selected.ratio - 100).toFixed(1)}%`],
                  ['발생시각', new Date(selected.timestamp).toLocaleString('ko-KR')],
                  ['상태', statusBadge(selected.status)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-gray-500 flex-shrink-0">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setGraphOpen(true)}
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

      <Modal isOpen={graphOpen} onClose={() => setGraphOpen(false)} title={`${selected?.facilityCode} — 당일 에어 사용량 추이`} size="lg">
        <div style={{ height: 260 }}>
          <SvgBarChart
            data={LEAK_CHART}
            categoryKey="hour"
            bars={[{ dataKey: 'value', color: COLORS.energy.air }]}
            referenceLines={[{
              value: selected ? parseInt(selected.baseline) : 12000,
              color: COLORS.energy.air,
              label: '기준',
              dashed: true,
            }]}
            formatValue={(v) => `${(v / 1000).toFixed(0)}K`}
            formatTooltip={(item) => `${item.hour}: ${Number(item.value).toLocaleString()} L`}
          />
        </div>
      </Modal>
    </div>
  );
}
