import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import SortableTable, { type Column } from '../../components/ui/SortableTable';

// HMGMA Slide 29 — Energy Report
//   CO2/Working Hours/Production Amount/Unit/Electricity/Gas/Water/Air KPI
//   + Monthly/Daily 사용량 + Power Energy by use

interface MonthlyRow { period: string; usage: string; cost: string; }
interface UseRateRow { use: string; usage: string; rate: string; }

const MONTHLY: MonthlyRow[] = [
  { period: 'JAN', usage: '?', cost: '?' },
  { period: 'FEB', usage: '?', cost: '?' },
  { period: 'MAR', usage: '?', cost: '?' },
  { period: 'APR', usage: '?', cost: '?' },
  { period: 'Total', usage: '1,740,153,221,745.4', cost: '?' },
];

const USE_BY_RATE: UseRateRow[] = [
  { use: 'Total',       usage: '1,740,153,221,745.4', rate: '100%' },
  { use: 'Lighting',    usage: '842,217',             rate: '13%' },
  { use: 'HVAC',        usage: '623,983',             rate: '?'  },
  { use: 'Equipment',   usage: '233,973',             rate: '?'  },
  { use: 'Outlet',      usage: '...',                 rate: '?'  },
];

export default function DSH011EnergyReport() {
  const monthlyCols: Column<MonthlyRow>[] = [
    { key: 'period', label: 'Period', sortable: true },
    { key: 'usage',  label: 'Usage', sortable: true, render: (_,r) => <span className="font-mono">{r.usage}</span> },
    { key: 'cost',   label: 'Cost ($)', sortable: true, render: (_,r) => <span className="font-mono">{r.cost}</span> },
  ];
  const useCols: Column<UseRateRow>[] = [
    { key: 'use',   label: 'Use', sortable: true },
    { key: 'usage', label: 'Usage', sortable: true, render: (_,r) => <span className="font-mono">{r.usage}</span> },
    { key: 'rate',  label: 'Rate %', sortable: true, render: (_,r) => <span className="font-mono">{r.rate}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="에너지 리포트"
        description="CO₂ / Working Hours / 생산량 / 단위 / Utility KPI + 월/일 사용량 표"
        breadcrumbs={[{ label: '대시보드' }, { label: 'Shop·리포트' }, { label: '에너지 리포트' }]}
      />

      {/* 상단 KPI 8종 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="CO₂ plan / PERF"     value="2,559" unit="kCO₂" />
        <KpiCard label="Working Hours"        value="199.85" unit="hrs" />
        <KpiCard label="Production Amount"    value="15,191" unit="EA" />
        <KpiCard label="Unit (kWh/EA)"        value="662.53" unit="kWh/EA" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Electricity"          value="10.06" unit="MWh" />
        <KpiCard label="Gas"                  value="0"     unit="kSft³" />
        <KpiCard label="Water"                value="16.85" unit="kgal" />
        <KpiCard label="Air"                  value="142.5" unit="kft³" />
      </div>

      {/* 표 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Monthly Energy Usage</div>
          <SortableTable data={MONTHLY} columns={monthlyCols} pageSize={10} />
        </div>
        <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Power Energy by Use</div>
          <SortableTable data={USE_BY_RATE} columns={useCols} pageSize={10} />
        </div>
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        ※ 데모 데이터. 운영 시 cagg_usage_1d 또는 별도 보고서 집계 API 연결.
      </div>
    </div>
  );
}
