import { Cloud, Sun } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';

// HMGMA Slide 2 — 공장 평면도 + 건물별 KPI 미니카드 + 7일 날씨 + RE100
// PoC 골격: 향후 평면도 SVG + 실데이터 연결

const BUILDINGS = [
  { code: 'VPC',        label: 'VPC',        elec: 0,      water: 0,     pos: { top: '25%', left: '10%' } },
  { code: 'CC',         label: 'CC',         elec: 685.22, water: 8.9,   pos: { top: '15%', left: '50%' } },
  { code: 'STAMPING',   label: 'Stamping',   elec: 0,      water: 0.1,   air: 69.31,  pos: { top: '25%', left: '75%' } },
  { code: 'WELDING',    label: 'Welding',    elec: 715.54, water: 18.91, air: 20.53,  pos: { top: '40%', left: '60%' } },
  { code: 'PAINT',      label: 'Paint',      elec: 1.45,   gas: 21.02,   water: 1.71, air: 316.59, pos: { top: '50%', left: '45%' } },
  { code: 'ASSEMBLY',   label: 'Assembly',   elec: 707.69, water: 0,     pos: { top: '50%', left: '15%' } },
  { code: 'HEAD',       label: 'Head Office', elec: 97.14, water: 12.63, pos: { top: '75%', left: '40%' } },
  { code: 'PV',         label: 'PV',         elec: 9.23,   water: 505.33, air: 19.74, pos: { top: '75%', left: '60%' } },
];

export default function MON007FactoryMap() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="공장 평면도"
        description="공장 전체 평면도 위 건물별 KPI 미니카드 + 7일 날씨 + RE100 진행률"
        breadcrumbs={[{ label: '모니터링' }, { label: '실시간 현황' }, { label: '공장 평면도' }]}
      />

      {/* 상단 — 7일 날씨 + RE100 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="bg-[#1A1A2E] text-white rounded-lg p-3">
          <div className="text-xs opacity-70 mb-2 flex items-center gap-1"><Cloud size={14} /> 7일 날씨 예보</div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {['04.12','04.13','04.14','04.15','04.16','04.17','04.18'].map((d,i) => (
              <div key={d} className="text-center">
                <div className="opacity-80">{d}</div>
                <Sun size={20} className="mx-auto my-1 text-[#FDB813]" />
                <div className="font-mono">{73 - i}°F / {59 - i}°F</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-r from-[#16213E] to-[#1A1A2E] text-white rounded-lg p-3">
          <div className="text-xs opacity-70 mb-1">RE100 Implementation Rate</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="opacity-70 text-xs">Match</div>
              <div className="font-bold text-xl">—%</div>
            </div>
            <div>
              <div className="opacity-70 text-xs">Accumulated</div>
              <div className="font-bold text-xl">—%</div>
            </div>
          </div>
          <div className="text-[11px] opacity-60 mt-2">PV Generation + REC SWAP 연동 필요</div>
        </div>
      </div>

      {/* 평면도 영역 */}
      <div className="bg-[#0A1F0A] dark:bg-[#0A1F0A] rounded-lg relative overflow-hidden" style={{ minHeight: 500 }}>
        <div className="absolute inset-0 opacity-30"
             style={{ background: 'radial-gradient(circle, #1a3a1a 0%, #061106 80%)' }} />
        <div className="absolute top-3 left-3 text-white/60 text-xs">
          🗺 평면도 SVG는 추후 화성 PT4공장 도면 기반으로 교체 예정
        </div>
        {BUILDINGS.map(b => (
          <div
            key={b.code}
            className="absolute bg-white/90 dark:bg-[#16213E]/95 rounded shadow-md p-2 text-[11px] min-w-[140px]"
            style={{ top: b.pos.top, left: b.pos.left }}
          >
            <div className="font-bold text-gray-900 dark:text-white text-xs mb-1">{b.label}</div>
            <div className="space-y-0.5">
              {b.elec != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#FDB813]">⚡ Electricity</span>
                  <span className="font-mono">{b.elec} <span className="opacity-60">MWh</span></span>
                </div>
              )}
              {'gas' in b && (b as any).gas != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#E94560]">🔥 Gas</span>
                  <span className="font-mono">{(b as any).gas} kSft³</span>
                </div>
              )}
              {b.water != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#3B82F6]">💧 Water</span>
                  <span className="font-mono">{b.water} <span className="opacity-60">kgal</span></span>
                </div>
              )}
              {'air' in b && (b as any).air != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#27AE60]">🌬 Air</span>
                  <span className="font-mono">{(b as any).air} kft³</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. 화성 PT4공장 도면 SVG + facilities 실시간 데이터 연결 시 정식 운영.
      </div>
    </div>
  );
}
