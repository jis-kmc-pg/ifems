import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';

// HMGMA Slide 19 — RTU Individual Control
//   다이어그램 (EXHAUST/RETURN/OUTSIDE/SUPPLY AIR + OA Temp/Heating/Cooling)
//   + Modes/Filter/Compressor/Discharge Temp Set

const SHOPS = ['Press','Stamping','Welding','Paint','Assembly'];

export default function HVC003RTUDetail() {
  const [shop, setShop] = useState('Press');
  const [rtu, setRtu] = useState('press_rtu_1');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="RTU 개별 제어"
        description="RTU 다이어그램 + 모드 / 필터 / 컴프레서 / 토출온도 제어"
        breadcrumbs={[{ label: '부대설비' }, { label: '공조' }, { label: 'RTU 개별 제어' }]}
        actions={
          <div className="flex gap-2">
            <select value={shop} onChange={e => setShop(e.target.value)} className="px-2 py-1 border rounded text-xs">
              {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={rtu} onChange={e => setRtu(e.target.value)} className="px-2 py-1 border rounded text-xs">
              <option value="press_rtu_1">press_rtu_1</option>
              <option value="press_rtu_2">press_rtu_2</option>
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 좌측 — RTU 다이어그램 */}
        <div className="lg:col-span-1 bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-3">1F · {rtu} Air Flow Diagram</div>
          <svg viewBox="0 0 320 220" className="w-full">
            {/* H 형태 덕트 */}
            <rect x="20"  y="20"  width="280" height="30" fill="#D1D5DB" />
            <rect x="20"  y="150" width="280" height="30" fill="#D1D5DB" />
            <rect x="150" y="50"  width="40"  height="100" fill="#D1D5DB" />
            {/* 라벨 */}
            <text x="20"  y="15"  fill="#9CA3AF" fontSize="9">EXHAUST AIR</text>
            <text x="240" y="15"  fill="#9CA3AF" fontSize="9">RETURN AIR</text>
            <text x="20"  y="200" fill="#9CA3AF" fontSize="9">OUTSIDE AIR</text>
            <text x="240" y="200" fill="#9CA3AF" fontSize="9">SUPPLY AIR</text>
            {/* 온도 */}
            <text x="35"  y="40" fontSize="10" fill="#1F2937">OA TEMP <tspan fontWeight="bold">67°F</tspan></text>
            <text x="210" y="40" fontSize="10" fill="#1F2937">DA TEMP <tspan fontWeight="bold">69°F</tspan></text>
            <text x="35"  y="170" fontSize="10" fill="#1F2937">OA Damper <tspan fontWeight="bold">0%</tspan></text>
            <text x="200" y="170" fontSize="10" fill="#1F2937">SF Speed <tspan fontWeight="bold">0 mph</tspan></text>
            <text x="200" y="183" fontSize="10" fill="#1F2937">SF FAN <tspan fontWeight="bold">OFF</tspan></text>
            {/* Heating / Cooling */}
            <rect x="155" y="80" width="30" height="15" fill="#FCA5A5" />
            <text x="155" y="110" fontSize="9" fill="#E74C3C">Heating 0%</text>
            <rect x="155" y="115" width="30" height="15" fill="#93C5FD" />
            <text x="155" y="145" fontSize="9" fill="#3B82F6">Cooling 0%</text>
          </svg>
        </div>

        {/* 우측 — Modes / Filter / Compressor / Discharge */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Section title="Modes" rows={[
            ['Occupancy',  'Occupied'],
            ['Select Mode','OFF'],
            ['Unit Status','Dirty'],
            ['ECONO. Status','Dirty'],
            ['ECONO. Min. BMS','4 %'],
            ['ECONO. Min. Active','25 %'],
          ]} />
          <Section title="Air Filter" rows={[
            ['DIFF. Pressure','0 in'],
            ['Dirty Filter Setpoint','1 in'],
          ]} />
          <Section title="Compressor" rows={[
            ['Comp 1A','OFF'], ['Comp 1B','OFF'],
            ['Comp 2A','OFF'], ['Comp 2B','OFF'],
          ]} />
          <Section title="Discharge Temp Set" rows={[
            ['Space Temp.','67 °F'],
            ['SetPoint Active','77 °F'],
            ['SetPoint BMS','73 °F'],
            ['Occupied OffSet','4 °F'],
            ['Cooling SetPoint','77 °F'],
            ['Cooling SetPoint','69 °F'],
          ]} />
        </div>
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. control_commands 발행 + BMS/DDC 게이트웨이 연동 시 실제 제어 가능.
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</div>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs border-b border-gray-100 dark:border-gray-700 last:border-0 py-1">
            <span className="text-gray-500">{k}</span>
            <span className="font-mono font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
