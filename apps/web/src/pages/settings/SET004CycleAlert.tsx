import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useSettingsTable } from '../../hooks/useSettingsTable';
import { getCycleAlertSettings, saveCycleAlertSettings, SettingRow } from '../../services/settings';
import { PROCESS_OPTIONS } from '../../lib/filter-options';

export default function SET004CycleAlert() {
  const [process, setProcess] = useState('');
  const { isLoading, dirty, saveMutation, updateRow, filterByProcess } = useSettingsTable<SettingRow>({
    queryKey: 'set-cycle-alert', fetchFn: getCycleAlertSettings, saveFn: saveCycleAlertSettings,
  });
  const filtered = filterByProcess(process);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클 알림 설정" description="설비별 싸이클 유사도 및 타임 지연 알림 임계값 설정" />

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
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5">
          <div className="font-semibold text-amber-700 dark:text-amber-300">유사도 임계값</div>
          <div className="text-amber-600 dark:text-amber-400 mt-0.5">기준 파형과 비교 싸이클의 유사도가 임계값 미만일 때 알림 발생</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-2.5">
          <div className="font-semibold text-purple-700 dark:text-purple-300">지연 허용 싸이클</div>
          <div className="text-purple-600 dark:text-[#E74C3C] mt-0.5">기준 대비 싸이클 타임 지연이 허용 횟수 초과 시 알림 발생</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">싸이클 알림 임계값 ({filtered.length}개 설비)</span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '유사도 임계(%)', '지연 허용(사이클)', '활성화'].map((h) => (
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
                          min={50}
                          max={100}
                          onChange={(e) => updateRow(row.id, 'threshold1', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                        />
                        <span className={`text-xs ${row.threshold1 < 80 ? 'text-red-500' : row.threshold1 < 90 ? 'text-amber-500' : 'text-[#27AE60]'}`}>
                          {row.threshold1 < 80 ? '위험' : row.threshold1 < 90 ? '주의' : '적정'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={row.threshold2}
                        step={1}
                        min={1}
                        max={10}
                        onChange={(e) => updateRow(row.id, 'threshold2', parseInt(e.target.value) || 1)}
                        className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                      />
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
