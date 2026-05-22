import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';
import { getSites, createSite, updateSite, deleteSite, type Site } from '../../services/settings';

type Form = { code: string; name: string; fullName: string; address: string; order: string };
const EMPTY: Form = { code: '', name: '', fullName: '', address: '', order: '0' };

export default function SET016SiteMaster() {
  const qc = useQueryClient();
  const modal = useModalState(['edit', 'delete'] as const);
  const [selected, setSelected] = useState<Site | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data = [], isLoading } = useQuery({ queryKey: ['sites'], queryFn: getSites });

  const createMut = useMutation({
    mutationFn: (d: { code: string; name: string; fullName?: string; address?: string; order?: number }) => createSite(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); modal.close('edit'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Site> }) => updateSite(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); modal.close('edit'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); modal.close('delete'); setSelected(null); },
  });

  const cols: Column<Site>[] = [
    { key: 'code', label: '코드', sortable: true },
    { key: 'name', label: '이름', sortable: true },
    { key: 'fullName', label: '전체 이름' },
    { key: 'address', label: '주소' },
    { key: 'factoryCount', label: '공장 수', render: (_, r) => <span className="text-[#E94560] font-semibold">{r.factoryCount ?? 0}</span> },
    { key: 'isActive', label: '상태', render: (_, r) => <span className={r.isActive ? 'text-[#27AE60]' : 'text-gray-400'}>{r.isActive ? '활성' : '비활성'}</span> },
    { key: 'actions', label: '작업', render: (_, r) => (
      <div className="flex gap-1">
        <button onClick={() => onEdit(r)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Edit size={14} className="text-[#E94560]" /></button>
        <button onClick={() => onDelete(r)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Trash2 size={14} className="text-red-400" /></button>
      </div>
    )},
  ];

  const onAdd = () => { setSelected(null); setForm(EMPTY); modal.open('edit'); };
  const onEdit = (s: Site) => {
    setSelected(s);
    setForm({ code: s.code, name: s.name, fullName: s.fullName ?? '', address: s.address ?? '', order: String(s.order) });
    modal.open('edit');
  };
  const onDelete = (s: Site) => { setSelected(s); modal.open('delete'); };
  const onSave = () => {
    if (!form.code.trim() || !form.name.trim()) { alert('코드와 이름은 필수입니다.'); return; }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      fullName: form.fullName.trim() || undefined,
      address: form.address.trim() || undefined,
      order: parseInt(form.order, 10) || 0,
    };
    if (selected) updateMut.mutate({ id: selected.id, data: payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="사이트 관리"
        description="사이트(지리·법인 단위) 마스터 — 1 site 안에 N개 공장(Factory)이 소속됨"
        breadcrumbs={[{ label: '설정' }, { label: '사이트·공장·라인·설비' }, { label: '사이트 관리' }]}
        actions={
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] text-white text-sm rounded hover:bg-[#d63854]">
            <Plus size={16} /> 사이트 추가
          </button>
        }
      />
      {isLoading
        ? <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
        : <SortableTable data={data} columns={cols} pageSize={20} />}

      <Modal isOpen={modal.isOpen.edit} onClose={() => modal.close('edit')} title={selected ? `사이트 수정: ${selected.code}` : '사이트 추가'} size="md">
        <div className="space-y-3">
          <Field label="코드 *" v={form.code} disabled={!!selected} onChange={v => setForm(s => ({ ...s, code: v }))} placeholder="hwasung" />
          <Field label="이름 *" v={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} placeholder="화성 사업장" />
          <Field label="전체 이름" v={form.fullName} onChange={v => setForm(s => ({ ...s, fullName: v }))} placeholder="화성PT4 사업장" />
          <Field label="주소" v={form.address} onChange={v => setForm(s => ({ ...s, address: v }))} placeholder="경기도 화성시" />
          <Field label="순서" v={form.order} onChange={v => setForm(s => ({ ...s, order: v }))} type="number" />
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
        title="사이트 삭제"
        message={selected ? `'${selected.code} — ${selected.name}'을 삭제할까요? (소속 공장은 보존되며 siteId가 NULL이 됩니다)` : ''}
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}

function Field({ label, v, onChange, disabled, placeholder, type = 'text' }:
  { label: string; v: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={v} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-700" />
    </div>
  );
}
