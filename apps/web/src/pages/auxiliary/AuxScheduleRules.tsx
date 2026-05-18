import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Power } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import { ConfirmModal } from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';
import {
  getScheduleRules, updateScheduleRule, deleteScheduleRule,
  type ScheduleRule,
} from '../../services/auxiliary';

const DOW_LABEL = ['??,'??,'??,'??,'紐?,'湲?,'??] as const;

function formatDow(dow: number[]) {
  if (dow.length === 0) return '??;
  if (dow.length === 7) return '留ㅼ씪';
  if (dow.length === 5 && [1,2,3,4,5].every(d => dow.includes(d))) return '?됱씪';
  if (dow.length === 2 && dow.includes(0) && dow.includes(6)) return '二쇰쭚';
  return dow.slice().sort().map(d => DOW_LABEL[d]).join(',');
}

const TARGET_BADGE: Record<string, string> = {
  HVAC:     'bg-[#3B82F6] text-white',
  LIGHTING: 'bg-[#F39C12] text-white',
  MIXED:    'bg-[#9333EA] text-white',
};

const ACTION_BADGE: Record<string, string> = {
  ON:       'bg-[#27AE60] text-white',
  OFF:      'bg-gray-500 text-white',
  SETPOINT: 'bg-[#06B6D4] text-white',
};

export default function AuxScheduleRules() {
  const qc = useQueryClient();
  const modal = useModalState(['delete'] as const);
  const [selected, setSelected] = useState<ScheduleRule | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['aux', 'schedule-rules'],
    queryFn: () => getScheduleRules(false),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateScheduleRule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aux', 'schedule-rules'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteScheduleRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aux', 'schedule-rules'] });
      modal.close('delete');
      setSelected(null);
    },
  });

  const columns: Column<ScheduleRule>[] = [
    { key: 'name', label: '猷곕챸', sortable: true },
    {
      key: 'targetType',
      label: '???,
      sortable: true,
      render: (_v, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${TARGET_BADGE[row.targetType] ?? ''}`}>
          {row.targetType}
        </span>
      ),
    },
    {
      key: 'targetScope',
      label: '踰붿쐞',
      render: (_v, row) => <span className="text-xs">{row.targetScope}</span>,
    },
    {
      key: 'dayOfWeek',
      label: '?붿씪',
      render: (_v, row) => <span className="text-xs font-mono">{formatDow(row.dayOfWeek)}</span>,
    },
    {
      key: 'startTime',
      label: '?쒓컙?',
      render: (_v, row) =>
        row.startTime || row.endTime ? (
          <span className="font-mono text-xs">{row.startTime ?? '--:--'} ~ {row.endTime ?? '--:--'}</span>
        ) : (
          <span className="text-gray-400">?꾩씪</span>
        ),
    },
    {
      key: 'action',
      label: '?숈옉',
      render: (_v, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${ACTION_BADGE[row.action] ?? ''}`}>
          {row.action}
        </span>
      ),
    },
    {
      key: 'priority',
      label: '?곗꽑?쒖쐞',
      sortable: true,
      render: (_v, row) => <span className="text-xs font-mono">{row.priority}</span>,
    },
    {
      key: 'enabled',
      label: '?곹깭',
      render: (_v, row) => (
        <button
          onClick={() => toggleMut.mutate({ id: row.id, enabled: !row.enabled })}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
            row.enabled
              ? 'bg-[#27AE60]/20 text-[#27AE60]'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
          }`}
        >
          <Power size={12} />
          {row.enabled ? 'ON' : 'OFF'}
        </button>
      ),
    },
    {
      key: 'actions',
      label: '?묒뾽',
      render: (_v, row) => (
        <button
          onClick={() => { setSelected(row); modal.open('delete'); }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <Trash2 size={16} className="text-red-400" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="?댁쟾 ?ㅼ?以?猷?
        description="怨듭“/議곕챸 ?먮룞 ON쨌OFF쨌SETPOINT 猷??붿쭊 (fems.schedule_rules)"
        breadcrumbs={[{ label: '遺??ㅻ퉬' }, { label: '?ㅼ젙' }, { label: '?ㅼ?以?猷? }]}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">遺덈윭?ㅻ뒗 以?..</div>
      ) : (
        <SortableTable data={data} columns={columns} pageSize={20} />
      )}

      <ConfirmModal
        isOpen={modal.isOpen.delete}
        onClose={() => modal.close('delete')}
        onConfirm={() => selected && deleteMut.mutate(selected.id)}
        title="?ㅼ?以?猷???젣"
        message={selected ? `'${selected.name}' 猷곗쓣 ??젣?좉퉴??` : ''}
        confirmText="??젣"
        confirmVariant="danger"
      />
    </div>
  );
}
