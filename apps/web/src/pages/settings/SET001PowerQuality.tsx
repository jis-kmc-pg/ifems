import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useSettingsTable } from '../../hooks/useSettingsTable';
import { getPowerQualitySettings, savePowerQualitySettings, SettingRow } from '../../services/settings';
import { PROCESS_OPTIONS } from '../../lib/filter-options';

export default function SET001PowerQuality() {
  const [process, setProcess] = useState('');
  const { isLoading, dirty, saveMutation, updateRow, filterByProcess } = useSettingsTable<SettingRow>({
    queryKey: 'set-pq', fetchFn: getPowerQualitySettings, saveFn: savePowerQualitySettings,
  });
  const filtered = filterByProcess(process);

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="전력 품질 설정" description="설비별 전압 불평형률 및 역률 임계값 설정" />

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

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">전력 품질 임계값 ({filtered.length}개 설비)</span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-12">데이터 로딩 중...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#16213E] sticky top-0">
                <tr>
                  {['설비코드', '설비명', '공정', '불평형률 임계(%)', '역률 기준(%)', '활성화'].map((h) => (
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
                      <input
                        type="number"
                        value={row.threshold1}
                        step={0.5}
                        min={0}
                        max={20}
                        onChange={(e) => updateRow(row.id, 'threshold1', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-gray-50 dark:bg-[#16213E] border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#27AE60]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={row.threshold2}
                        step={1}
                        min={50}
                        max={100}
                        onChange={(e) => updateRow(row.id, 'threshold2', parseFloat(e.target.value) || 0)}
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
