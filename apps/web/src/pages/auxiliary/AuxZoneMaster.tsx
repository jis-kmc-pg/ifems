import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';
import {
  getZones, createZone, updateZone, deleteZone,
  ZONE_TYPES, ZONE_TYPE_LABEL,
  type Zone, type ZoneType, type CreateZoneInput,
} from '../../services/auxiliary';

type FormState = {
  code: string;
  name: string;
  zoneType: ZoneType;
  areaSqm: string;
  parentCode: string;
};

const EMPTY: FormState = {
  code: '',
  name: '',
  zoneType: 'PRODUCTION',
  areaSqm: '',
  parentCode: '',
};

export default function AuxZoneMaster() {
  const qc = useQueryClient();
  const modal = useModalState(['edit', 'delete'] as const);
  const [selected, setSelected] = useState<Zone | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['aux', 'zones'],
    queryFn: () => getZones(true),
  });

  const zoneByCode = useMemo(() => {
    const m = new Map<string, Zone>();
    zones.forEach(z => m.set(z.code, z));
    return m;
  }, [zones]);

  const parentOptions = useMemo(
    () => zones.filter(z => !selected || z.id !== selected.id),
    [zones, selected],
  );

  const createMut = useMutation({
    mutationFn: (input: CreateZoneInput) => createZone(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aux', 'zones'] });
      modal.close('edit');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Zone> }) => updateZone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aux', 'zones'] });
      modal.close('edit');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aux', 'zones'] });
      modal.close('delete');
      setSelected(null);
    },
  });

  const columns: Column<Zone>[] = [
    { key: 'code', label: '肄붾뱶', sortable: true },
    { key: 'name', label: '?대쫫', sortable: true },
    {
      key: 'zoneType',
      label: '?좏삎',
      sortable: true,
      render: (_v, row) => (
        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
          {ZONE_TYPE_LABEL[row.zoneType] ?? row.zoneType}
        </span>
      ),
    },
    {
      key: 'parentId',
      label: '?곸쐞',
      render: (_v, row) => {
        if (!row.parentId) return <span className="text-gray-400">??/span>;
        const parent = zones.find(z => z.id === row.parentId);
        return <span className="text-xs">{parent?.code ?? row.parentId.slice(0, 8)}</span>;
      },
    },
    {
      key: 'areaSqm',
      label: '硫댁쟻(??',
      sortable: true,
      render: (_v, row) => row.areaSqm != null ? row.areaSqm.toLocaleString() : <span className="text-gray-400">??/span>,
    },
    {
      key: 'isActive',
      label: '?곹깭',
      render: (_v, row) => (
        <span className={row.isActive ? 'text-[#27AE60]' : 'text-gray-400'}>
          {row.isActive ? '?쒖꽦' : '鍮꾪솢??}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '?묒뾽',
      render: (_v, row) => (
        <div className="flex gap-2">
          <button onClick={() => onEdit(row)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Edit size={16} className="text-[#E94560]" />
          </button>
          <button onClick={() => onDelete(row)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Trash2 size={16} className="text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  const onAdd = () => {
    setSelected(null);
    setForm(EMPTY);
    modal.open('edit');
  };

  const onEdit = (z: Zone) => {
    setSelected(z);
    const parent = z.parentId ? zones.find(p => p.id === z.parentId) : undefined;
    setForm({
      code: z.code,
      name: z.name,
      zoneType: z.zoneType,
      areaSqm: z.areaSqm != null ? String(z.areaSqm) : '',
      parentCode: parent?.code ?? '',
    });
    modal.open('edit');
  };

  const onDelete = (z: Zone) => {
    setSelected(z);
    modal.open('delete');
  };

  const onSave = () => {
    if (!form.code.trim() || !form.name.trim()) {
      alert('肄붾뱶? ?대쫫???낅젰?섏꽭??');
      return;
    }
    const areaSqm = form.areaSqm.trim() ? Number(form.areaSqm) : undefined;
    const parentId = form.parentCode ? zoneByCode.get(form.parentCode)?.id : undefined;

    if (selected) {
      updateMut.mutate({
        id: selected.id,
        data: {
          name: form.name,
          zoneType: form.zoneType,
          areaSqm: areaSqm ?? null,
          parentId: parentId ?? null,
        } as Partial<Zone>,
      });
    } else {
      createMut.mutate({
        code: form.code,
        name: form.name,
        zoneType: form.zoneType,
        areaSqm,
        parentId,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="怨듦컙 留덉뒪??(Zones)"
        description="i-FEMS 遺??ㅻ퉬??怨듦컙 ?⑥쐞 (怨듭옣 > ??> 痢?> 議?. bems ?ㅽ궎留? fems.zones"
        breadcrumbs={[{ label: '遺??ㅻ퉬' }, { label: '?ㅼ젙' }, { label: '怨듦컙 留덉뒪?? }]}
        actions={
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] text-white text-sm rounded hover:bg-[#d63854] transition-colors"
          >
            <Plus size={16} /> Zone 異붽?
          </button>
        }
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">遺덈윭?ㅻ뒗 以?..</div>
      ) : (
        <SortableTable data={zones} columns={columns} pageSize={20} />
      )}

      {/* edit modal */}
      <Modal
        isOpen={modal.isOpen.edit}
        onClose={() => modal.close('edit')}
        title={selected ? `Zone ?섏젙: ${selected.code}` : 'Zone 異붽?'}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">肄붾뱶 *</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm(s => ({ ...s, code: e.target.value }))}
              disabled={!!selected}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-700"
              placeholder="HW4-PROD-E"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">?대쫫 *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              placeholder="5踰??쇱씤 ?묒뾽??
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">?좏삎 *</label>
            <select
              value={form.zoneType}
              onChange={e => setForm(s => ({ ...s, zoneType: e.target.value as ZoneType }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              {ZONE_TYPES.map(t => (
                <option key={t} value={t}>{ZONE_TYPE_LABEL[t]} ({t})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">硫댁쟻(??</label>
            <input
              type="number"
              value={form.areaSqm}
              onChange={e => setForm(s => ({ ...s, areaSqm: e.target.value }))}
              min={0} step={0.1}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              placeholder="1500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">?곸쐞 Zone</label>
            <select
              value={form.parentCode}
              onChange={e => setForm(s => ({ ...s, parentCode: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">(?놁쓬)</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.code}>{p.code} ??{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => modal.close('edit')}
              className="px-3 py-1.5 border rounded text-sm dark:border-gray-600 dark:text-gray-200"
            >
              痍⑥냼
            </button>
            <button
              onClick={onSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-3 py-1.5 bg-[#E94560] text-white rounded text-sm hover:bg-[#d63854] disabled:opacity-50"
            >
              {selected ? '?섏젙' : '異붽?'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={modal.isOpen.delete}
        onClose={() => modal.close('delete')}
        onConfirm={() => selected && deleteMut.mutate(selected.id)}
        title="Zone ??젣"
        message={selected ? `'${selected.code} ??${selected.name}' ????젣?좉퉴?? 留ㅽ븨???ㅻ퉬??zoneId??NULL濡??댁젣?⑸땲??` : ''}
        confirmText="??젣"
        confirmVariant="danger"
      />
    </div>
  );
}
