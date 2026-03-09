import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useSettingsTable } from '../../hooks/useSettingsTable';
import { getEnergyAlertSettings, saveEnergyAlertSettings, SettingRow } from '../../services/settings';
import { PROCESS_OPTIONS } from '../../lib/filter-options';

export default function SET005EnergyAlert() {
  const [process, setProcess] = useState('');
  const { isLoading, dirty, saveMutation, updateRow, filterByProcess } = useSettingsTable<SettingRow>({
    queryKey: 'set-energy-alert', fetchFn: getEnergyAlertSettings, saveFn: saveEnergyAlertSettings,
  });
  const filtered = filterByProcess(process);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에너지 사용량 알림" description="설비별 에너지 사용량 전월/전년 대비 임계값 설정" />

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

      {/* 설명 */}
      <div className="flex-shrink-0 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5 text-xs">
        <div className="font-semibold text-green-700 dark:text-green-300">에너지 사용량 알림 기준</div>
        <div className="text-[#27AE60] dark:text-[#27AE60] mt-0.5">
          설비별 당월 누적 에너지가 전월 동기 대비 또는 전년 동월 대비 임계값을 초과할 때 알림이 발생합니다.
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">에너지 알림 임계값 ({filtered.length}개 설비)</span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '전월 대비 임계(%)', '전년 대비 임계(%)', '활성화'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.code}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.process}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={row.threshold1}
                          step={1}
                          min={1}
                          max={100}
                          onChange={(e) => updateRow(row.id, 'threshold1', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                        />
                        <span className="text-gray-400">%</span>
                      </div>
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
                      <ToggleSwitch value={row.enabled} onChange={(v) => updateRow(row.id, 'enabled', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
