import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Modal from '../../components/ui/Modal';
import TrendChart, { TrendSeries } from '../../components/charts/TrendChart';
import { getReferenceCycles, CycleWaveformItem } from '../../services/settings';
import { getCycleWaveformData } from '../../services/analysis';
import { COLORS, SCREEN_INITIAL_INTERVAL, SCREEN_MAX_DEPTH } from '../../lib/constants';
import type { Interval } from '../../types/chart';

// 파형 미리보기용 (등록된 기준 싸이클 파형 시뮬레이션)
// SET-003은 줌 비활성화, interval 고정 '1s' (maxDepth: 3, 줌 사용 안 함)
function useWaveformPreview(cycleId: string, enabled: boolean) {
  const fixedInterval: Interval = (SCREEN_INITIAL_INTERVAL['SET-003'] || '1s') as Interval;
  return useQuery({
    queryKey: ['ref-waveform-preview', cycleId, fixedInterval],
    queryFn: () => getCycleWaveformData(cycleId, true, fixedInterval),
    enabled,
  });
}

export default function SET003ReferenceCycle() {
  const [selected, setSelected] = useState<CycleWaveformItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // SET-003 전용: 줌 비활성화, interval 고정 (기준 파형 등록/관리용)
  const fixedInterval: Interval = (SCREEN_INITIAL_INTERVAL['SET-003'] || '1s') as Interval;
  const maxDepth = SCREEN_MAX_DEPTH['SET-003'] || 3; // 줌 사용 안 함 (고정 1s)

  const { data: cycles, isLoading } = useQuery({ queryKey: ['ref-cycles'], queryFn: getReferenceCycles });
  const { data: waveform } = useWaveformPreview(selected?.id ?? '', previewOpen && !!selected);

  const rows: CycleWaveformItem[] = cycles ?? [];

  // 차트 series 설정
  const series: TrendSeries[] = useMemo(
    () => [
      {
        key: 'value',
        label: '기준 파형',
        color: COLORS.energy.air,
        type: 'line' as const,
        width: 2,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="기준 싸이클 파형" description={`설비별 기준 싸이클 파형 등록 및 관리 | 고정 해상도: ${fixedInterval} (maxDepth: ${maxDepth}, 줌 비활성화)`} />

      {/* 안내 카드 */}
      <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
        <div className="text-sm font-medium text-[#E94560] dark:text-blue-300">기준 싸이클 파형 안내</div>
        <div className="text-xs text-[#E94560] dark:text-[#E94560] mt-1">
          설비별 정상 운전 시 수집된 싸이클 파형을 기준으로 등록합니다. 기준 파형은 싸이클 이상 감지 및 지연 분석에 사용됩니다.
          활성(Active) 상태의 파형만 분석에 적용됩니다.
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">등록된 기준 싸이클 ({rows.length}개)</span>
          <button className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            + 파형 등록
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '기종', '등록일', '에너지(kWh)', '싸이클타임(s)', '상태', '파형보기'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors ${
                      selected?.id === row.id ? 'bg-[#E94560] hover:bg-[#C73B52]/10 dark:bg-[#E94560] hover:bg-[#C73B52]/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.code}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.process}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{row.modelCode}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.registeredAt}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300">{row.energy.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.cycleTime}s</td>
                    <td className="px-3 py-2.5">
                      {row.active ? (
                        <span className="flex items-center gap-1 text-[#27AE60] dark:text-[#27AE60] font-medium">
                          <CheckCircle size={12} /> 활성
                        </span>
                      ) : (
                        <span className="text-gray-400">비활성</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(row); setPreviewOpen(true); }}
                        className="flex items-center gap-1 text-[#E94560] hover:text-[#E94560] dark:hover:text-[#E94560] transition-colors"
                      >
                        <Eye size={13} />
                        <span>보기</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 파형 미리보기 모달 */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`기준 파형 — ${selected?.code} (${selected?.process})`}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3 text-xs">
            {[
              ['기종', selected?.modelCode ?? '-'],
              ['등록일', selected?.registeredAt ?? '-'],
              ['싸이클 에너지', `${selected?.energy?.toFixed(2) ?? '-'} kWh`],
              ['싸이클 타임', `${selected?.cycleTime ?? '-'}s`],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-gray-50 dark:bg-[#16213E] rounded-lg p-2.5">
                <div className="text-gray-400 mb-1">{label}</div>
                <div className="font-semibold text-gray-800 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 220 }}>
            <TrendChart
              data={waveform ?? []}
              series={series}
              xKey="sec"
              yLabel="W"
              showLegend={false}
              onZoomChange={undefined}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
