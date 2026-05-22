import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';
import {
  getLightingRelays, createLightingRelay, updateLightingRelay, deleteLightingRelay,
  getZones, type LightingRelay,
} from '../../services/auxiliary';

// SET-022 조명 Relay 마스터
//   facilityId(LIGHTING)·zoneId 선택 + ratedW / fixtureCount / fixtureType / 태그 ID

type Form = {
  facilityId: string; zoneId: string; code: string; name: string;
  ratedW: string; fixtureCount: string; fixtureType: string;
  onOffTagId: string; powerTagId: string; order: string;
};
const EMPTY: Form = { facilityId: '', zoneId: '', code: '', name: '', ratedW: '', fixtureCount: '', fixtureType: 'LED', onOffTagId: '', powerTagId: '', order: '0' };

export default function SET022LightingRelayMaster() {
  const qc = useQueryClient();
  const modal = useModalState(['edit', 'delete'] as const);
  const [selected, setSelected] = useState<LightingRelay | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: relays = [], isLoading } = useQuery({ queryKey: ['aux', 'relays'], queryFn: () => getLightingRelays() });
  const { data: zones = [] } = useQuery({ queryKey: ['aux', 'zones'], queryFn: () => getZones(false) });

  const lightingZones = useMemo(() => zones.filter(z => z.lightingCount && z.lightingCount > 0), [zones]);

  const createMut = useMutation({
    mutationFn: (d: any) => createLightingRelay(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'relays'] }); modal.close('edit'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLightingRelay(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'relays'] }); modal.close('edit'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLightingRelay(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'relays'] }); modal.close('delete'); setSelected(null); },
  });

  const cols: Column<LightingRelay>[] = [
    { key: 'code', label: '코드', sortable: true },
    { key: 'name', label: '이름', sortable: true },
    { key: 'zoneCode', label: 'Zone', sortable: true, render: (_, r) => <span className="font-mono text-xs">{r.zoneCode ?? '—'}</span> },
    { key: 'facilityCode', label: '소속 Facility', render: (_, r) => <span className="font-mono text-xs">{r.facilityCode ?? '—'}</span> },
    { key: 'ratedW', label: '정격 W', sortable: true, render: (_, r) => r.ratedW != null ? r.ratedW.toLocaleString() : '—' },
    { key: 'fixtureCount', label: '등기구 수', render: (_, r) => r.fixtureCount ?? '—' },
    { key: 'fixtureType', label: '타입', render: (_, r) => <span className="text-xs">{r.fixtureType ?? '—'}</span> },
    { key: 'isActive', label: '상태', render: (_, r) => <span className={r.isActive ? 'text-[#27AE60]' : 'text-gray-400'}>{r.isActive ? '활성' : '비활성'}</span> },
    { key: 'actions', label: '작업', render: (_, r) => (
      <div className="flex gap-1">
        <button onClick={() => onEdit(r)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Edit size={14} className="text-[#E94560]" /></button>
        <button onClick={() => onDelete(r)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Trash2 size={14} className="text-red-400" /></button>
      </div>
    )},
  ];

  const onEdit = (r: LightingRelay) => {
    setSelected(r);
    setForm({
      facilityId: r.facilityId, zoneId: r.zoneId ?? '', code: r.code, name: r.name,
      ratedW: r.ratedW != null ? String(r.ratedW) : '',
      fixtureCount: r.fixtureCount != null ? String(r.fixtureCount) : '',
      fixtureType: r.fixtureType ?? 'LED',
      onOffTagId: r.onOffTagId ?? '', powerTagId: r.powerTagId ?? '',
      order: String(r.order),
    });
    modal.open('edit');
  };
  const onDelete = (r: LightingRelay) => { setSelected(r); modal.open('delete'); };
  const onAdd = () => { setSelected(null); setForm(EMPTY); modal.open('edit'); };

  const onSave = () => {
    if (!form.code.trim() || !form.name.trim() || !form.facilityId) {
      alert('코드/이름/소속 facility는 필수');
      return;
    }
    const p: any = {
      facilityId: form.facilityId, zoneId: form.zoneId || undefined,
      code: form.code.trim(), name: form.name.trim(),
      ratedW: form.ratedW.trim() ? Number(form.ratedW) : undefined,
      fixtureCount: form.fixtureCount.trim() ? parseInt(form.fixtureCount, 10) : undefined,
      fixtureType: form.fixtureType.trim() || undefined,
      onOffTagId: form.onOffTagId.trim() || undefined,
      powerTagId: form.powerTagId.trim() || undefined,
      order: parseInt(form.order, 10) || 0,
    };
    if (selected) updateMut.mutate({ id: selected.id, data: p });
    else createMut.mutate(p);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="조명 Relay 마스터"
        description="LIGHTING facility 안의 개별 회로(Relay) 등록 — Zone별 ON/OFF 표시 + 스케줄 제어 + 전력 사용량의 기본 단위"
        breadcrumbs={[{ label: '설정' }, { label: '조명 (Lighting) 설정' }, { label: 'Relay 마스터' }]}
        actions={
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] text-white text-sm rounded hover:bg-[#d63854]">
            <Plus size={16} /> Relay 추가
          </button>
        }
      />
      {isLoading
        ? <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
        : <SortableTable data={relays} columns={cols} pageSize={20} />}

      <Modal isOpen={modal.isOpen.edit} onClose={() => modal.close('edit')} title={selected ? `Relay 수정: ${selected.code}` : 'Relay 추가'} size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">코드 *</label>
            <input type="text" value={form.code} onChange={e => setForm(s => ({ ...s, code: e.target.value }))} disabled={!!selected}
              placeholder="HW4-LGT-PROD-A-R1"
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">이름 *</label>
            <input type="text" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Zone</label>
            <select value={form.zoneId} onChange={e => setForm(s => ({ ...s, zoneId: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
              <option value="">(없음)</option>
              {lightingZones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">소속 Facility ID *</label>
            <input type="text" value={form.facilityId} onChange={e => setForm(s => ({ ...s, facilityId: e.target.value }))}
              placeholder="LIGHTING facility의 id (uuid)"
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs text-gray-500 mb-1">정격 W</label>
              <input type="number" value={form.ratedW} onChange={e => setForm(s => ({ ...s, ratedW: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">등기구 수</label>
              <input type="number" value={form.fixtureCount} onChange={e => setForm(s => ({ ...s, fixtureCount: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">타입</label>
              <select value={form.fixtureType} onChange={e => setForm(s => ({ ...s, fixtureType: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
                <option value="LED">LED</option><option value="FL">FL</option><option value="HID">HID</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs text-gray-500 mb-1">ON/OFF Tag ID</label>
              <input type="text" value={form.onOffTagId} onChange={e => setForm(s => ({ ...s, onOffTagId: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 font-mono text-xs" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Power Tag ID</label>
              <input type="text" value={form.powerTagId} onChange={e => setForm(s => ({ ...s, powerTagId: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 font-mono text-xs" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => modal.close('edit')} className="px-3 py-1.5 border rounded text-sm dark:border-gray-600 dark:text-gray-200">취소</button>
            <button onClick={onSave} disabled={createMut.isPending || updateMut.isPending} className="px-3 py-1.5 bg-[#E94560] text-white rounded text-sm hover:bg-[#d63854] disabled:opacity-50">
              {selected ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={modal.isOpen.delete}
        onClose={() => modal.close('delete')}
        onConfirm={() => selected && deleteMut.mutate(selected.id)}
        title="Relay 삭제"
        message={selected ? `'${selected.code} — ${selected.name}' Relay를 삭제할까요?` : ''}
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
