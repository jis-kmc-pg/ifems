import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import Modal from '../../components/ui/Modal';
import { useModalState } from '../../hooks/useModalState';

// HMGMA Slide 22 — Lighting Status & Control (Pop-up)

const CIRCUITS = [
  { id: 'LM4001', label: 'A동 1F-1', on: true,  x: 15, y: 30 },
  { id: 'LM4002', label: 'A동 1F-2', on: false, x: 35, y: 30 },
  { id: 'LM4003', label: 'A동 1F-3', on: true,  x: 55, y: 30 },
  { id: 'LM4004', label: 'A동 1F-4', on: false, x: 75, y: 30 },
  { id: 'LM4005', label: 'A동 2F-1', on: true,  x: 25, y: 60 },
  { id: 'LM4006', label: 'A동 2F-2', on: true,  x: 50, y: 60 },
];

export default function LGT002LightingControl() {
  const modal = useModalState(['settings'] as const);
  const [selected, setSelected] = useState<typeof CIRCUITS[number] | null>(null);
  const [shop, setShop] = useState('Press');

  const onTotalKwh = 0;
  const onCount = CIRCUITS.filter(c => c.on).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="조명 제어 평면도"
        description="평면도 회로 ON/OFF 상태 + 스케줄 설정 팝업"
        breadcrumbs={[{ label: '부대설비' }, { label: '조명' }, { label: '조명 제어' }]}
        actions={
          <select value={shop} onChange={e => setShop(e.target.value)} className="px-2 py-1 border rounded text-xs">
            {['Press','Stamping','Paint','Assembly'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />

      <div className="bg-[#1A1A2E] text-white rounded-lg p-3 mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs opacity-70">Today Total Lighting Power Usage</div>
          <div className="text-2xl font-bold mt-1">{onTotalKwh} <span className="text-sm">kWh</span></div>
        </div>
        <div className="text-right text-sm">
          <div>점등 회로: <span className="font-mono font-bold text-[#FDB813]">{onCount}</span> / {CIRCUITS.length}</div>
          <div className="mt-2">
            <button
              onClick={() => { setSelected(null); modal.open('settings'); }}
              className="px-3 py-1.5 bg-[#27AE60] text-white text-xs rounded hover:bg-[#229954]"
            >
              + Schedule Settings
            </button>
          </div>
        </div>
      </div>

      {/* 평면도 */}
      <div className="bg-gray-50 dark:bg-[#0F1419] rounded-lg border border-gray-200 dark:border-gray-700 relative" style={{ minHeight: 400 }}>
        <div className="absolute top-2 left-3 text-xs text-gray-400">1F</div>
        <div className="absolute top-2 right-3 flex gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FDB813]" /> ON</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> OFF</span>
        </div>
        {CIRCUITS.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelected(c); modal.open('settings'); }}
            className="absolute rounded shadow p-2 text-[11px] hover:shadow-lg transition-shadow"
            style={{
              top: `${c.y}%`, left: `${c.x}%`,
              background: c.on ? '#FDB813' : '#7F8C8D',
              color: 'white',
            }}
          >
            <div className="font-bold">{c.id}</div>
            <div>{c.label}</div>
            <div className="text-[10px] mt-0.5">{c.on ? '● ON' : '○ OFF'}</div>
          </button>
        ))}
      </div>

      {/* Schedule Settings Modal */}
      <Modal
        isOpen={modal.isOpen.settings}
        onClose={() => modal.close('settings')}
        title={selected ? `Lighting Control Settings — ${selected.id}` : 'Lighting Control Settings'}
        size="md"
      >
        <div className="space-y-3">
          <Row label="Group" v={selected?.id ?? 'LM4001'} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">ON / OFF</label>
            <div className="flex gap-3">
              <label className="text-sm flex items-center gap-1"><input type="radio" name="onoff" /> ON</label>
              <label className="text-sm flex items-center gap-1"><input type="radio" name="onoff" defaultChecked /> OFF</label>
            </div>
          </div>
          <Row label="Period" v="2024-12-02 ~ 2024-12-02" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Days Excluded Operation</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat','Holiday'].map(d =>
                <label key={d} className="flex items-center gap-1"><input type="checkbox" /> {d}</label>
              )}
            </div>
          </div>
          <Row label="Uptime" v="17:00 ~ 23:00" />
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => modal.close('settings')} className="px-3 py-1.5 border rounded text-sm">Close</button>
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-sm">Schedule List</button>
            <button className="px-3 py-1.5 bg-[#3B82F6] text-white rounded text-sm">Save</button>
          </div>
        </div>
      </Modal>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. fems.schedule_rules (targetType=LIGHTING) + control_commands 발행 연동 시 정식 동작.
      </div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="px-3 py-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:border-gray-600 font-mono">{v}</div>
    </div>
  );
}
