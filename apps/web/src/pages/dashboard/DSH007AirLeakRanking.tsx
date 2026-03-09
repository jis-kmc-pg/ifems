import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SvgBarChart from '../../components/charts/SvgBarChart';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/ui/ChartCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { TrafficLight } from '../../components/ui/TrafficLight';
import { getAirLeakRanking } from '../../services/dashboard';
import { COLORS } from '../../lib/constants';
import { cn } from '../../lib/utils';

type LeakRow = {
  facilityId: string;
  code: string;
  name: string;
  process: string;
  baseline: number;
  avgFlow: number;
  maxFlow: number;
  nonProdMinutes: number;
  exceedMinutes: number;
  leakRate: number;
  nonProdUsage: number;
  baselineUsage: number;
  excessUsage: number;
  estimatedCost: number;
  status: 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE';
  rank: number;
};

import { useLineFilter } from '../../hooks/useCommonFilters';

const TODAY = new Date().toISOString().slice(0, 10);

function leakColor(rate: number) {
  if (rate >= 30) return COLORS.danger;
  if (rate >= 20) return COLORS.energy.power;
  return COLORS.normal;
}

/** 멀티라인 컬럼 헤더 */
function ColHeader({ lines }: { lines: string[] }) {
  return (
    <div className="leading-tight text-center">
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

const mono = 'font-mono text-xs';
const monoRed = (v: number) => cn(`${mono} font-semibold`, v > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400');

export default function DSH007AirLeakRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const [date, setDate] = useState(TODAY);

  const { data, refetch } = useQuery({
    queryKey: ['dsh-air-leak-ranking', line],
    queryFn: () => getAirLeakRanking(line === 'all' ? undefined : (line as 'block')),
  });

  const rows: LeakRow[] = [...(data ?? [])].sort((a, b) => b.excessUsage - a.excessUsage);
  const top3 = rows.slice(0, 3);
  const avgLeak = rows.length ? rows.reduce((s, r) => s + r.leakRate, 0) / rows.length : 0;
  const danger = rows.filter((r) => r.status === 'DANGER').length;
  const warning = rows.filter((r) => r.status === 'WARNING').length;
  const totalExcessCost = rows.reduce((s, r) => s + r.estimatedCost, 0);

  const columns = [
    {
      key: 'rank' as const, label: '순위', sortable: true,
      render: (raw: unknown) => { const v = Number(raw); return <span className={`font-bold ${v <= 3 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>{v}</span>; },
    },
    {
      key: 'status' as const, label: '상태',
      tooltip: '누기율 기준 판정 (NORMAL / WARNING / DANGER)',
      render: (raw: unknown) => <TrafficLight status={raw as LeakRow['status']} />,
    },
    { key: 'code' as const, label: '설비코드', sortable: true },
    { key: 'process' as const, label: '공정', sortable: true },
    {
      key: 'baseline' as const, label: <ColHeader lines={['기준유량', '(L/min)']} />, sortable: true,
      tooltip: 'SET-002에서 설정한 비생산시간 허용 에어 유량',
      render: (raw: unknown) => <span className={`${mono} text-gray-500`}>{Number(raw).toLocaleString()}</span>,
    },
    {
      key: 'avgFlow' as const, label: <ColHeader lines={['평균유량', '(L/min)']} />, sortable: true,
      tooltip: '비생산시간 동안의 평균 에어 유량',
      render: (raw: unknown) => Number(raw).toLocaleString(),
    },
    {
      key: 'exceedMinutes' as const, label: <ColHeader lines={['초과', '시간(분)']} />, sortable: true,
      tooltip: '기준유량을 초과한 누적 시간',
      render: (raw: unknown) => <span className={monoRed(Number(raw))}>{Number(raw).toLocaleString()}</span>,
    },
    {
      key: 'leakRate' as const, label: <ColHeader lines={['누기율', '(%)']} />, sortable: true,
      tooltip: '초과시간 / 비생산시간 × 100',
      render: (raw: unknown) => {
        const v = Number(raw);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, v * 2)}%`, background: leakColor(v) }} />
            </div>
            <span style={{ color: leakColor(v) }} className="font-bold text-xs w-12 text-right">{v.toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      key: 'excessUsage' as const, label: <ColHeader lines={['초과', '에어사용량(L)']} />, sortable: true,
      tooltip: '비생산 에어사용량 - 기준 에어사용량 = 실질 낭비량',
      render: (raw: unknown) => <span className={monoRed(Number(raw))}>{Number(raw).toLocaleString()}</span>,
    },
    {
      key: 'estimatedCost' as const, label: <ColHeader lines={['추정', '누기비용(원)']} />, sortable: true,
      tooltip: '초과 에어사용량 × 에어 단가',
      render: (raw: unknown) => <span className={monoRed(Number(raw))}>{Number(raw).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에어 누기 순위" description="설비별 에어 누기율 순위 (비생산시간 기준)" />

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard label="평균 누기율" value={avgLeak.toFixed(1)} unit="%" inverseChange />
        <KpiCard label="위험(>=30%)" value={danger} unit="개" inverseChange />
        <KpiCard label="주의(>=20%)" value={warning} unit="개" inverseChange />
        <KpiCard label="총 추정 누기비용" value={totalExcessCost.toLocaleString()} unit="원" inverseChange />
      </div>

      <FilterBar
        filters={[
          lineFilter,
          { type: 'date', key: 'date', label: '날짜', value: date, onChange: setDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* TOP3 카드 + 차트 */}
      <div className="flex gap-3 flex-shrink-0">
        {/* TOP3 */}
        <div className="flex flex-col gap-2 w-64">
          {top3.map((r, i) => (
            <div key={r.code} className="bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 p-3 shadow-sm flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: leakColor(r.leakRate) }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800 dark:text-white truncate">{r.code}</div>
                <div className="text-xs text-gray-400">{r.process}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm" style={{ color: leakColor(r.leakRate) }}>{r.leakRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-400">{r.excessUsage.toLocaleString()}L</div>
              </div>
            </div>
          ))}
        </div>

        {/* 누기율 바 차트 */}
        <ChartCard
          title="설비별 누기율 (%)"
          subtitle="20% 이상 주의 / 30% 이상 위험"
          className="flex-1"
          style={{ height: 200 }}
          chartId="dsh007-leak"
          minHeight={0}
        >
          <SvgBarChart
            data={rows}
            categoryKey="code"
            orientation="horizontal"
            bars={[{
              dataKey: 'leakRate',
              color: (item) => leakColor(Number(item.leakRate)),
            }]}
            domain={[0, 60]}
            valueUnit="%"
            referenceLines={[
              { value: 20, color: COLORS.energy.power, label: '주의', dashed: true },
              { value: 30, color: COLORS.danger, label: '위험', dashed: true },
            ]}
            formatTooltip={(item) => `${item.code}: ${Number(item.leakRate).toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <SortableTable data={rows} columns={columns} stickyHeader compact />
      </div>
    </div>
  );
}
