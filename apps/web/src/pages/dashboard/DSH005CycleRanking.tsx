import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import SortableTable from '../../components/ui/SortableTable';
import FilterBar from '../../components/ui/FilterBar';
import { TrafficLight } from '../../components/ui/TrafficLight';
import { getCycleRanking } from '../../services/dashboard';
import { useLineFilter } from '../../hooks/useCommonFilters';

type CycleRow = {
  rank: number;
  code: string;
  name: string;
  process: string;
  cycleEnergy: number | null;
  cycleTime: number | null;
  refEnergy: number | null;
  refCycleTime: number | null;
  deviation: number;
  dailyTotal: number;
  cycleCount: number;
  status: 'NORMAL' | 'WARNING' | 'DANGER';
};

const TODAY = new Date().toISOString().slice(0, 10);
const WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function DSH005CycleRanking() {
  const { line, filter: lineFilter } = useLineFilter();
  const [startDate, setStartDate] = useState(WEEK_AGO);
  const [endDate, setEndDate] = useState(TODAY);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['dsh-cycle-ranking', line, startDate, endDate],
    queryFn: () => getCycleRanking(line === 'all' ? undefined : (line as 'block'), startDate, endDate),
  });

  const rows: CycleRow[] = data ?? [];
  const validRows = rows.filter((r) => r.cycleEnergy != null);
  const avgEnergy = validRows.length ? validRows.reduce((s, r) => s + (r.cycleEnergy ?? 0), 0) / validRows.length : 0;
  const maxDev = rows.length ? Math.max(...rows.map((r) => Math.abs(r.deviation))) : 0;
  const totalCycles = rows.reduce((s, r) => s + r.cycleCount, 0);

  // 프로그레스바 도메인
  const maxEnergy = validRows.length ? Math.max(...validRows.map((r) => r.cycleEnergy ?? 0)) : 10;
  const chartDomain: [number, number] = [0, Math.ceil(maxEnergy * 1.2)];

  const columns = [
    {
      key: 'rank' as const,
      label: '순위',
      width: 50,
      sortable: true,
      render: (v: number) => (
        <span className={`font-bold ${v <= 3 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{v}</span>
      ),
    },
    {
      key: 'status' as const,
      label: '상태',
      width: 50,
      render: (v: CycleRow['status']) => <TrafficLight status={v} />,
    },
    { key: 'code' as const, label: '설비코드', sortable: true, width: 130 },
    { key: 'name' as const, label: '설비명', width: 120 },
    { key: 'process' as const, label: '공정', sortable: true, width: 60 },
    {
      key: 'cycleEnergy' as const,
      label: '싸이클 에너지',
      sortable: true,
      tooltip: '1싸이클당 평균 에너지 사용량 (kWh)',
      render: (v: number | null, row: CycleRow) => {
        if (v == null) return <span className="text-gray-400 text-xs">-</span>;
        const ref = row.refEnergy;
        const ratio = ref ? v / ref : null;
        const barColor = ratio == null ? 'bg-amber-400' : ratio > 1.15 ? 'bg-red-400' : ratio > 1.1 ? 'bg-amber-400' : 'bg-emerald-400';
        const maxVal = chartDomain[1] || 10;
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, (v / maxVal) * 100)}%` }} />
              {ref != null && (
                <div
                  className="absolute top-0 h-2 w-0.5 bg-gray-500 dark:bg-gray-300"
                  style={{ left: `${Math.min(100, (ref / maxVal) * 100)}%` }}
                  title={`기준: ${ref} kWh`}
                />
              )}
            </div>
            <span className="text-xs font-bold w-14 text-right tabular-nums">{v.toFixed(2)}</span>
          </div>
        );
      },
    },
    {
      key: 'cycleTime' as const,
      label: '싸이클 타임',
      sortable: true,
      tooltip: '1싸이클 평균 소요시간 (초)',
      width: 110,
      render: (v: number | null, row: CycleRow) => {
        if (v == null) return <span className="text-gray-400 text-xs">-</span>;
        const ref = row.refCycleTime;
        return (
          <span className="tabular-nums text-sm">
            {v}s
            {ref != null && (
              <span className="text-gray-400 text-xs ml-1">/ {ref}s</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'deviation' as const,
      label: '편차',
      sortable: true,
      tooltip: '기준 싸이클 에너지 대비 편차 (%)',
      width: 90,
      render: (v: number) => {
        const abs = Math.abs(v);
        if (abs < 0.1) return <span className="text-gray-400 text-sm">—</span>;
        const isOver = v > 0;
        const color = abs >= 15 ? 'text-red-500' : abs >= 10 ? 'text-amber-500' : isOver ? 'text-gray-600 dark:text-gray-400' : 'text-emerald-500';
        const arrow = isOver ? '▲' : '▼';
        return (
          <span className={`font-medium text-sm tabular-nums ${color}`}>
            {arrow} {isOver ? '+' : ''}{v.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'cycleCount' as const,
      label: '싸이클 수',
      sortable: true,
      tooltip: '기간 내 완료된 싸이클 횟수',
      width: 80,
      render: (v: number) => (
        <span className="text-sm tabular-nums">{v > 0 ? v.toLocaleString() : <span className="text-gray-400">-</span>}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="싸이클당 순위" description="설비별 싸이클 에너지 사용 순위 및 기준 대비 편차 분석" />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <KpiCard label="평균 싸이클 에너지" value={avgEnergy.toFixed(2)} unit="kWh" isLoading={isLoading} />
        <KpiCard label="최고 편차" value={maxDev.toFixed(1)} unit="%" inverseChange isLoading={isLoading} />
        <KpiCard label="총 싸이클 수" value={totalCycles.toLocaleString()} unit="회" isLoading={isLoading} />
      </div>

      <FilterBar
        filters={[
          lineFilter,
          { type: 'date', key: 'startDate', label: '시작일', value: startDate, onChange: setStartDate },
          { type: 'date', key: 'endDate', label: '종료일', value: endDate, onChange: setEndDate },
        ]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      {/* 순위 테이블 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <SortableTable data={rows} columns={columns} stickyHeader compact loading={isLoading} />
      </div>
    </div>
  );
}
