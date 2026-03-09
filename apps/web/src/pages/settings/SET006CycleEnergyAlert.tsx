import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useSettingsTable } from '../../hooks/useSettingsTable';
import { getCycleEnergyAlertSettings, saveCycleEnergyAlertSettings, SettingRow } from '../../services/settings';
import { PROCESS_OPTIONS } from '../../lib/filter-options';

export default function SET006CycleEnergyAlert() {
  const [process, setProcess] = useState('');
  const { isLoading, dirty, saveMutation, updateRow, filterByProcess } = useSettingsTable<SettingRow>({
    queryKey: 'set-cycle-energy-alert', fetchFn: getCycleEnergyAlertSettings, saveFn: saveCycleEnergyAlertSettings,
  });
  const filtered = filterByProcess(process);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클당 에너지 알림" description="설비별 싸이클당 에너지 기준값 및 초과 임계 설정" />

      <div className="flex items-end gap-3 flex-shrink-0">
        <FilterBar
          filters={[{ type: 'select', key: 'process', label: '공정', value: process, onChange: setProcess, options: PROCESS_OPTIONS }]}
          onSearch={() => {}}
          className="mb-0 flex-1"
        />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
        >
          {saveMutation.isPending ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {/* 설명 배너 */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5">
          <div className="font-semibold text-[#E94560] dark:text-blue-300">싸이클당 기준값 (kWh)</div>
          <div className="text-[#E94560] dark:text-[#E94560] mt-0.5">해당 설비의 정상 운전 시 싸이클당 기준 에너지 소비량</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
          <div className="font-semibold text-red-700 dark:text-red-300">초과 임계 (%)</div>
          <div className="text-red-600 dark:text-red-400 mt-0.5">기준값 대비 실제 싸이클 에너지 초과율이 임계 이상일 때 알림 발생</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">싸이클 에너지 임계값 ({filtered.length}개 설비)</span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '싸이클당 기준(kWh)', '초과 임계(%)', '현재 평균(kWh)', '활성화'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  // 현재 평균 시뮬레이션 (기준 대비 ±15%)
                  const currentAvg = row.threshold1 * (1 + (Math.sin(row.facilityId.charCodeAt(0)) * 0.15));
                  const overPct = ((currentAvg - row.threshold1) / row.threshold1) * 100;
                  return (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.code}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.name}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.process}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={row.threshold1}
                          step={0.5}
                          min={1}
                          max={50}
                          onChange={(e) => updateRow(row.id, 'threshold1', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={row.threshold2}
                            step={1}
                            min={1}
                            max={100}
                            onChange={(e) => updateRow(row.id, 'threshold2', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                          />
                          <span className="text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-medium ${overPct > row.threshold2 ? 'text-red-500' : overPct > 0 ? 'text-amber-500' : 'text-[#27AE60]'}`}>
                          {currentAvg.toFixed(2)}
                          <span className="ml-1 text-xs">({overPct > 0 ? '+' : ''}{overPct.toFixed(1)}%)</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <ToggleSwitch value={row.enabled} onChange={(v) => updateRow(row.id, 'enabled', v)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
