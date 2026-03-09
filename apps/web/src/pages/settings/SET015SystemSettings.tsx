import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import { getSystemSettings, saveSystemSettings, type SystemSettingValue } from '../../services/settings';
import { toast } from '../../lib/toast';

/** 시스템 설정 항목 정의 */
const SETTING_DEFS: {
  key: string;
  label: string;
  description: string;
  unit: string;
  type: 'number' | 'text';
  defaultValue: any;
  min?: number;
  step?: number;
}[] = [
  {
    key: 'air_cost_per_liter',
    label: '에어 단가',
    description: '에어 누기 비용 추정에 사용되는 L당 단가',
    unit: '원/L',
    type: 'number',
    defaultValue: 0.5,
    min: 0,
    step: 0.01,
  },
];

export default function SET015SystemSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSystemSettings,
  });

  // 서버 데이터 → 폼 초기화
  useEffect(() => {
    if (!data) return;
    const initial: Record<string, any> = {};
    for (const def of SETTING_DEFS) {
      const sv = data[def.key];
      initial[def.key] = sv?.value ?? def.defaultValue;
    }
    setForm(initial);
    setDirty(false);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (settings: Record<string, SystemSettingValue>) => saveSystemSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('시스템 설정이 저장되었습니다.');
      setDirty(false);
    },
    onError: () => toast.error('저장 실패'),
  });

  const handleSave = () => {
    const payload: Record<string, SystemSettingValue> = {};
    for (const def of SETTING_DEFS) {
      const val = def.type === 'number' ? Number(form[def.key]) : form[def.key];
      payload[def.key] = {
        value: val,
        description: data?.[def.key]?.description ?? def.description,
      };
    }
    mutation.mutate(payload);
  };

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <PageHeader title="시스템 설정" description="시스템 전역 설정 관리" />
        <div className="flex-1 flex items-center justify-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="시스템 설정" description="시스템 전역 설정 관리" />

      <div className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">설정 항목</span>
          <button
            onClick={handleSave}
            disabled={!dirty || mutation.isPending}
            className="px-4 py-1.5 rounded text-sm font-medium text-white bg-[#E94560] hover:bg-[#d63d56] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {SETTING_DEFS.map((def) => (
            <div key={def.key} className="px-6 py-4 flex items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-white">{def.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{def.description}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type={def.type}
                  value={form[def.key] ?? ''}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  min={def.min}
                  step={def.step}
                  className="w-32 px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#0F3460] text-gray-800 dark:text-white text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#E94560]"
                />
                <span className="text-xs text-gray-500 w-12">{def.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 px-1">
        설정 변경 시 해당 값을 사용하는 화면(에어 누기 순위 등)에 즉시 반영됩니다.
      </div>
    </div>
  );
}
