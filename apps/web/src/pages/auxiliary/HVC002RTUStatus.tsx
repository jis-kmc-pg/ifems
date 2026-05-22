import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';

// HMGMA Slide 18, 28 — RTU 평면도 상태
// Shop 선택 시 해당 floor의 RTU들을 평면도 위 카드로 표시

const SHOPS = ['Press','Stamping','Welding','Paint','Assembly'];
const RTUS = [
  { code: 'RTU-1', temp: 25, pct: 21, status: 'COOL', x: 22, y: 22 },
  { code: 'RTU-2', temp: 25, pct: 12, status: 'COOL', x: 36, y: 38 },
  { code: 'RTU-3', temp: 25, pct: 13, status: 'COOL', x: 70, y: 33 },
  { code: 'RTU-4', temp: 25, pct: 25, status: 'COOL', x: 14, y: 60 },
  { code: 'RTU-5', temp: 25, pct: 123,status: 'HEAT', x: 38, y: 60 },
  { code: 'RTU-6', temp: 25, pct: 42, status: 'COOL', x: 53, y: 60 },
  { code: 'RTU-7', temp: 25, pct: 123,status: 'HEAT', x: 78, y: 60 },
];
const TEMP_SENSORS = [
  { temp: 60, x: 50, y: 24 },
  { temp: 64, x: 73, y: 73 },
];

const STATUS_COLOR: Record<string, string> = {
  COOL: '#3B82F6', HEAT: '#E94560', ON: '#27AE60', OFF: '#7F8C8D',
};

export default function HVC002RTUStatus() {
  const [shop, setShop] = useState('Press');
  const [floor, setFloor] = useState('1f');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="RTU 평면도 상태"
        description="Shop floor 평면도 + RTU 상태 (COOL/HEAT/ON/OFF) + TEMP 센서 위치"
        breadcrumbs={[{ label: '부대설비' }, { label: '공조' }, { label: 'RTU 평면도 상태' }]}
        actions={
          <div className="flex gap-2">
            <select value={shop} onChange={e => setShop(e.target.value)} className="px-2 py-1 border rounded text-xs">
              {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={floor} onChange={e => setFloor(e.target.value)} className="px-2 py-1 border rounded text-xs">
              <option value="1f">1F</option><option value="2f">2F</option><option value="3f">3F</option>
            </select>
          </div>
        }
      />

      {/* 범례 */}
      <div className="flex gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FDB813]" />Existing TEMP Sensor</span>
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-2 rounded" style={{ background: c }} /> {k}
          </span>
        ))}
      </div>

      {/* 평면도 */}
      <div className="bg-gray-50 dark:bg-[#0F1419] rounded-lg border border-gray-200 dark:border-gray-700 relative" style={{ minHeight: 480 }}>
        <div className="absolute top-2 left-3 text-xs text-gray-400">{floor.toUpperCase()}</div>
        {RTUS.map(r => (
          <div
            key={r.code}
            className="absolute rounded shadow-md p-2 text-[10px] min-w-[80px] text-white"
            style={{ top: `${r.y}%`, left: `${r.x}%`, background: STATUS_COLOR[r.status] }}
          >
            <div className="font-bold">{r.code}</div>
            <div className="font-mono">🌡 {r.temp}°F · {r.pct}%</div>
          </div>
        ))}
        {TEMP_SENSORS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#FDB813] text-white p-1 text-[10px] font-mono shadow"
            style={{ top: `${s.y}%`, left: `${s.x}%` }}
          >
            🌡 {s.temp}°F
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. Shop/floor 정의 + RTU 좌표 + 실시간 상태 태그 연결 시 정식 운영.
      </div>
    </div>
  );
}
