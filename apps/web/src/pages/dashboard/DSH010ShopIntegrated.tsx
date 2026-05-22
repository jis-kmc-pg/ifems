import { useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';

// HMGMA Slide 27 — Shop별 통합 사용량
//   KPI 4종 (Electricity/Gas/Air/Water) + Elec Usage by use 도넛 + Weekly 막대

const SHOPS = ['Press','Stamping','Welding','Paint','Assembly','VPC','CC','UT'];
const USAGE_BY_USE = [
  { label: 'manufacture', pct: 46, color: '#3B82F6' },
  { label: 'heatcool',    pct: 33, color: '#EC4899' },
  { label: 'utility',     pct: 13, color: '#F97316' },
  { label: 'lighting',    pct:  4, color: '#FDB813' },
  { label: 'maintenance', pct:  2, color: '#06B6D4' },
  { label: 'outlet',      pct:  1, color: '#9333EA' },
  { label: 'charge',      pct:  1, color: '#7F8C8D' },
];

export default function DSH010ShopIntegrated() {
  const [shop, setShop] = useState('Press');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Shop 통합 사용량"
        description="Shop별 Electricity/Gas/Air/Water KPI + 용도별 사용량 + Standby Power 추이"
        breadcrumbs={[{ label: '대시보드' }, { label: 'Shop·리포트' }, { label: 'Shop 통합 사용량' }]}
        actions={
          <select
            value={shop}
            onChange={e => setShop(e.target.value)}
            className="px-3 py-1.5 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          >
            {SHOPS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Electricity (vs 전일 102%)" value="15.15" unit="MWh" change={2} inverseChange />
        <KpiCard label="Gas (vs 전일 0%)"           value="0"     unit="Sft³" change={-100} inverseChange />
        <KpiCard label="Air (vs 전일 102%)"         value="142.5" unit="kft³" change={2} inverseChange />
        <KpiCard label="Water (vs 전일 86%)"        value="1.14"  unit="kgal" change={-14} inverseChange />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Elec Usage by use 도넛 (CSS 기반) */}
        <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Elec Usage by use</div>
          <div className="flex items-center gap-4">
            <div className="relative w-40 h-40 flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(${USAGE_BY_USE
                    .map((u, i, arr) => {
                      const start = arr.slice(0, i).reduce((s, x) => s + x.pct, 0);
                      return `${u.color} ${start}% ${start + u.pct}%`;
                    }).join(',')})`,
                }}
              />
              <div className="absolute inset-6 bg-white dark:bg-[#16213E] rounded-full flex flex-col items-center justify-center">
                <div className="text-xl font-bold">15.15</div>
                <div className="text-[10px] text-gray-500">MWh</div>
              </div>
            </div>
            <div className="flex-1 space-y-1 text-xs">
              {USAGE_BY_USE.map(u => (
                <div key={u.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: u.color }} />
                    <span>{u.label}</span>
                  </div>
                  <span className="font-mono text-gray-500">{u.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Standby Power 막대 */}
        <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Weekly Standby Power Usage</div>
          <div className="space-y-2 text-xs">
            {['05-26','05-27','05-28','05-29','05-30','05-31','06-01'].map((d, i) => {
              const active = [6.4, 9.9, 9.8, 0.8, 0, 0, 0][i];
              const standby = [3.0, 4.9, 5.4, 0.8, 0, 0, 0][i];
              const max = 12;
              return (
                <div key={d}>
                  <div className="flex justify-between mb-0.5">
                    <span className="font-mono">{d}</span>
                    <span className="font-mono text-gray-500">{active.toFixed(1)}/{standby.toFixed(1)} MWh</span>
                  </div>
                  <div className="flex gap-0.5 h-3 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    <div style={{ width: `${(active / max) * 100}%`, background: '#86EFAC' }} />
                    <div style={{ width: `${(standby / max) * 100}%`, background: '#EC4899' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-3 text-[11px]">
            <span><span className="inline-block w-3 h-2 bg-[#86EFAC] mr-1" />Active Power</span>
            <span><span className="inline-block w-3 h-2 bg-[#EC4899] mr-1" />Standby</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. tag_data_raw 활성화 후 실시간 집계 연동 가능.
      </div>
    </div>
  );
}
