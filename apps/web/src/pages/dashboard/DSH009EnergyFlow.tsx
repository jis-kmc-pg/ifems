import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Zap, Flame, Droplet, Wind } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';
import {
  getEnergyFlows, createEnergyFlow, updateEnergyFlow, deleteEnergyFlow,
  SOURCE_TYPES, SOURCE_TYPE_LABEL, SOURCE_TYPE_COLOR,
  type EnergyFlow, type SourceType, type CreateEnergyFlowInput,
} from '../../services/auxiliary';

// 슬라이드 5페이지 (Integration Flow Chart) 컨셉:
//  Supply Energy (전기/가스/수도) + Convert Energy (공기)
//        ↓
//  Shop별 카드 (Stamping/Welding/Paint/Head/Assembly/VPC/CC/UT)
//        ↓ (선택)
//  세부 분기 (Boiler/2F/3F, PW/IW, Booth/Canteen 등)

const SOURCE_ICONS: Record<SourceType, React.FC<{ size?: number }>> = {
  ELECTRICITY: Zap, GAS: Flame, WATER: Droplet, AIR: Wind,
};

type FormState = {
  sourceType: SourceType;
  targetShop: string;
  branchLabel: string;
  value: string;
  unit: string;
  color: string;
  order: string;
};

const EMPTY_FORM: FormState = {
  sourceType: 'ELECTRICITY',
  targetShop: '',
  branchLabel: '',
  value: '',
  unit: '',
  color: '',
  order: '0',
};

function ShopBranchLine({ flow }: { flow: EnergyFlow }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-gray-500 dark:text-gray-400 truncate">
        {flow.branchLabel ?? <span className="italic text-gray-400">대표</span>}
      </span>
      <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">
        {flow.value != null ? flow.value.toLocaleString() : '—'}
        {flow.unit ? <span className="text-gray-400 ml-1">{flow.unit}</span> : null}
      </span>
    </div>
  );
}

export default function DSH009EnergyFlow() {
  const qc = useQueryClient();
  const modal = useModalState(['edit', 'delete'] as const);
  const [selected, setSelected] = useState<EnergyFlow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ['aux', 'energy-flows'],
    queryFn: () => getEnergyFlows(false),
  });

  // 그룹화: sourceType → shop → flows[]
  const grouped = useMemo(() => {
    const m = new Map<SourceType, Map<string, EnergyFlow[]>>();
    for (const t of SOURCE_TYPES) m.set(t, new Map());
    for (const f of flows) {
      const s = m.get(f.sourceType)!;
      const arr = s.get(f.targetShop) ?? [];
      arr.push(f);
      s.set(f.targetShop, arr);
    }
    return m;
  }, [flows]);

  // 모든 Shop 이름 unique (열 헤더용)
  const allShops = useMemo(() => {
    const set = new Set<string>();
    flows.forEach(f => set.add(f.targetShop));
    return Array.from(set).sort();
  }, [flows]);

  // sourceType별 합계 (Supply/Convert 헤더용)
  const sourceTotals = useMemo(() => {
    const m: Record<SourceType, { total: number; unit: string | null }> = {
      ELECTRICITY: { total: 0, unit: null }, GAS: { total: 0, unit: null },
      WATER: { total: 0, unit: null }, AIR: { total: 0, unit: null },
    };
    for (const f of flows) {
      if (f.value != null) m[f.sourceType].total += f.value;
      if (!m[f.sourceType].unit && f.unit) m[f.sourceType].unit = f.unit;
    }
    return m;
  }, [flows]);

  const createMut = useMutation({
    mutationFn: (input: CreateEnergyFlowInput) => createEnergyFlow(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'energy-flows'] }); modal.close('edit'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EnergyFlow> }) =>
      updateEnergyFlow(id, data as never),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'energy-flows'] }); modal.close('edit'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEnergyFlow(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aux', 'energy-flows'] }); modal.close('delete'); setSelected(null); },
  });

  const onAdd = () => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, color: SOURCE_TYPE_COLOR.ELECTRICITY });
    modal.open('edit');
  };

  const onEdit = (f: EnergyFlow) => {
    setSelected(f);
    setForm({
      sourceType: f.sourceType,
      targetShop: f.targetShop,
      branchLabel: f.branchLabel ?? '',
      value: f.value != null ? String(f.value) : '',
      unit: f.unit ?? '',
      color: f.color ?? '',
      order: String(f.order),
    });
    modal.open('edit');
  };

  const onDelete = (f: EnergyFlow) => { setSelected(f); modal.open('delete'); };

  const onSave = () => {
    if (!form.targetShop.trim()) { alert('대상 Shop을 입력하세요.'); return; }
    const payload = {
      targetShop:  form.targetShop.trim(),
      branchLabel: form.branchLabel.trim() || undefined,
      value:       form.value.trim() ? Number(form.value) : undefined,
      unit:        form.unit.trim() || undefined,
      color:       form.color.trim() || undefined,
      order:       form.order.trim() ? parseInt(form.order, 10) : 0,
    };
    if (selected) {
      updateMut.mutate({ id: selected.id, data: payload as Partial<EnergyFlow> });
    } else {
      createMut.mutate({ sourceType: form.sourceType, ...payload });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="에너지 흐름도"
        description="공급/변환 에너지(Electricity/Gas/Water/Air) → Shop → 세부분기 매핑. 사용자가 직접 추가·수정·삭제 가능"
        breadcrumbs={[{ label: '대시보드' }, { label: '에너지 흐름·추이' }, { label: '에너지 흐름도' }]}
        actions={
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] text-white text-sm rounded hover:bg-[#d63854]"
          >
            <Plus size={16} /> 매핑 추가
          </button>
        }
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {/* Supply/Convert 헤더 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOURCE_TYPES.map(t => {
              const Icon = SOURCE_ICONS[t];
              const color = SOURCE_TYPE_COLOR[t];
              const total = sourceTotals[t];
              const isConvert = t === 'AIR';
              return (
                <div
                  key={t}
                  className="rounded-lg p-4 text-white shadow-md"
                  style={{ background: color }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={18} />
                    <span className="text-xs uppercase opacity-80">
                      {isConvert ? 'Convert' : 'Supply'}
                    </span>
                  </div>
                  <div className="font-semibold">{SOURCE_TYPE_LABEL[t]}</div>
                  <div className="text-xl font-bold mt-1">
                    {total.total > 0 ? total.total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                    {total.unit ? <span className="text-xs ml-1 opacity-80">{total.unit}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shop별 그리드 — 각 Shop 카드에 4개 sourceType 흐름 */}
          {allShops.length === 0 ? (
            <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-400 text-sm">
              매핑된 흐름이 없습니다. <strong className="text-[#E94560]">"매핑 추가"</strong> 버튼으로 시작하세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {allShops.map(shop => (
                <div
                  key={shop}
                  className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                    {shop}
                  </div>
                  {SOURCE_TYPES.map(t => {
                    const arr = grouped.get(t)!.get(shop) ?? [];
                    if (arr.length === 0) return null;
                    const color = SOURCE_TYPE_COLOR[t];
                    return (
                      <div key={t} className="mb-2 last:mb-0">
                        <div className="flex items-center gap-1 text-[11px] font-semibold mb-1" style={{ color }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          {SOURCE_TYPE_LABEL[t]}
                        </div>
                        <div className="pl-3 border-l-2" style={{ borderColor: color }}>
                          {arr.map(f => (
                            <div key={f.id} className="group flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <ShopBranchLine flow={f} />
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={() => onEdit(f)} className="p-0.5">
                                  <Edit size={12} className="text-[#E94560]" />
                                </button>
                                <button onClick={() => onDelete(f)} className="p-0.5">
                                  <Trash2 size={12} className="text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* edit modal */}
      <Modal
        isOpen={modal.isOpen.edit}
        onClose={() => modal.close('edit')}
        title={selected ? `흐름 수정` : '흐름 매핑 추가'}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">에너지 종류 *</label>
            <select
              value={form.sourceType}
              onChange={e => {
                const st = e.target.value as SourceType;
                setForm(s => ({ ...s, sourceType: st, color: s.color || SOURCE_TYPE_COLOR[st] }));
              }}
              disabled={!!selected}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 disabled:opacity-60"
            >
              {SOURCE_TYPES.map(t => (
                <option key={t} value={t}>{SOURCE_TYPE_LABEL[t]} ({t})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">대상 Shop *</label>
            <input
              type="text"
              list="shop-list"
              value={form.targetShop}
              onChange={e => setForm(s => ({ ...s, targetShop: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              placeholder="Stamping / Paint / Assembly..."
            />
            <datalist id="shop-list">
              {allShops.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">세부 분기 (선택)</label>
            <input
              type="text"
              value={form.branchLabel}
              onChange={e => setForm(s => ({ ...s, branchLabel: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              placeholder="Boiler / 2F / PW / IW (공란=대표 흐름)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">값</label>
              <input
                type="number" step="0.01"
                value={form.value}
                onChange={e => setForm(s => ({ ...s, value: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
                placeholder="11.45"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">단위</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(s => ({ ...s, unit: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
                placeholder="MWh / kSft³ / kgal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">색 (#hex)</label>
              <input
                type="text"
                value={form.color}
                onChange={e => setForm(s => ({ ...s, color: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 font-mono"
                placeholder="#FDB813"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">순서</label>
              <input
                type="number"
                value={form.order}
                onChange={e => setForm(s => ({ ...s, order: e.target.value }))}
                className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => modal.close('edit')} className="px-3 py-1.5 border rounded text-sm dark:border-gray-600 dark:text-gray-200">취소</button>
            <button
              onClick={onSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-3 py-1.5 bg-[#E94560] text-white rounded text-sm hover:bg-[#d63854] disabled:opacity-50"
            >
              {selected ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={modal.isOpen.delete}
        onClose={() => modal.close('delete')}
        onConfirm={() => selected && deleteMut.mutate(selected.id)}
        title="흐름 매핑 삭제"
        message={
          selected
            ? `${SOURCE_TYPE_LABEL[selected.sourceType]} → ${selected.targetShop}${selected.branchLabel ? ' / ' + selected.branchLabel : ''} 매핑을 삭제할까요?`
            : ''
        }
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
