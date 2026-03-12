import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import SortableTable, { Column } from '../../components/ui/SortableTable';
import { StatusBadge } from '../../components/ui/TrafficLight';
import { getAirLeakRanking } from '../../services/monitoring';
import type { AirLeakData } from '../../services/mock/facilities';
import { cn } from '../../lib/utils';
import { useLineFilter } from '../../hooks/useCommonFilters';

const LEAK_LIMIT = 20; // 누기율 기준 20%

/** 멀티라인 컬럼 헤더 */
function ColHeader({ lines }: { lines: string[] }) {
  return (
    <div className="leading-tight text-center">
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

function LeakRateCell({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', value > 30 ? 'bg-red-600' : value > LEAK_LIMIT ? 'bg-[#F39C12]' : 'bg-[#27AE60]')}
          style={{ width: `${Math.min(100, value * 2)}%` }}
        />
      </div>
      <span className={cn(
        'font-mono text-xs font-semibold w-12 text-right',
        value > 30 ? 'text-red-600 dark:text-red-400' : value > LEAK_LIMIT ? 'text-amber-600 dark:text-amber-400' : 'text-[#27AE60] dark:text-[#27AE60]',
      )}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

const mono = 'font-mono text-xs';
const monoVal = `${mono} text-gray-800 dark:text-white`;
const monoDim = `${mono} text-gray-500`;
const monoRed = (v: number) => cn(`${mono} font-semibold`, v > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400');

export default function MON006AirLeak() {
  const { line, filter: lineFilter } = useLineFilter({ defaultValue: 'block' });

  const { data = [], refetch } = useQuery({
    queryKey: ['mon-air-leak', line],
    queryFn: () => getAirLeakRanking(line as 'block'),
  });

  const sorted = [...data].sort((a, b) => b.excessUsage - a.excessUsage);

  const columns: Column<AirLeakData>[] = [
    { key: 'rank', label: 'No.', width: 36, align: 'center',
      render: (_, __, i) => <span className="font-bold text-gray-400">{i + 1}</span> },
    { key: 'code', label: '설비명',
      render: (v) => <span className="font-medium text-xs text-gray-800 dark:text-white">{String(v)}</span> },
    { key: 'process', label: '공정', width: 50, align: 'center',
      render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
    {
      key: 'baseline', label: <ColHeader lines={['기준유량', '(L/min)']} />, align: 'right', sortable: true,
      tooltip: 'SET-002에서 설정한 비생산시간 허용 에어 유량',
      render: (v) => <span className={monoDim}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'avgFlow', label: <ColHeader lines={['평균유량', '(L/min)']} />, align: 'right', sortable: true,
      tooltip: '비생산시간 동안의 평균 에어 유량',
      render: (v) => <span className={monoVal}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'maxFlow', label: <ColHeader lines={['최대유량', '(L/min)']} />, align: 'right', sortable: true,
      tooltip: '비생산시간 중 최대 순간 에어 유량',
      render: (v) => <span className={monoVal}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'nonProdMinutes', label: <ColHeader lines={['비생산', '시간(분)']} />, align: 'right', sortable: true,
      tooltip: '데이터가 있는 비생산 구간의 총 시간',
      render: (v) => <span className={monoDim}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'exceedMinutes', label: <ColHeader lines={['초과', '시간(분)']} />, align: 'right', sortable: true,
      tooltip: '기준유량을 초과한 누적 시간',
      render: (v) => <span className={monoRed(Number(v))}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'leakRate', label: <ColHeader lines={['누기율', '(%)']} />, align: 'right', sortable: true,
      tooltip: '초과시간 / 비생산시간 × 100 — 기준유량 초과 지속 비율',
      render: (_, row) => <LeakRateCell value={row.leakRate} />,
    },
    {
      key: 'nonProdUsage', label: <ColHeader lines={['비생산', '에어사용량(L)']} />, align: 'right', sortable: true,
      tooltip: '비생산시간 동안 소비된 총 에어량 (순시유량 적산)',
      render: (v) => <span className={monoVal}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'baselineUsage', label: <ColHeader lines={['기준', '에어사용량(L)']} />, align: 'right', sortable: true,
      tooltip: '기준유량 × 비생산시간 — 기준대로였을 때 예상 사용량',
      render: (v) => <span className={monoDim}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'excessUsage', label: <ColHeader lines={['초과', '에어사용량(L)']} />, align: 'right', sortable: true,
      tooltip: '비생산 에어사용량 - 기준 에어사용량 = 실질 낭비량',
      render: (v) => <span className={monoRed(Number(v))}>{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'estimatedCost', label: <ColHeader lines={['추정', '누기비용(원)']} />, align: 'right', sortable: true,
      tooltip: '초과 에어사용량 × 에어 단가 — 낭비 비용 추정',
      render: (v) => <span className={monoRed(Number(v))}>{Number(v) > 0 ? `${Number(v).toLocaleString()}` : '0'}</span>,
    },
    { key: 'status', label: '상태', width: 72, align: 'center',
      tooltip: '누기율 기준 판정 (NORMAL / WARNING / DANGER)',
      render: (v) => <StatusBadge status={v as 'NORMAL'} /> },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="에어 누기 순위" description="비생산 시간대 에어 누기율 기준 설비 순위" />

      <FilterBar
        filters={[lineFilter]}
        onSearch={() => refetch()}
        className="mb-0"
      />

      <div className="flex-1 min-h-0 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">에어 누기 순위</span>
          <span className="text-xs text-gray-400">기준: 누기율 20% 이하</span>
        </div>
        <SortableTable<AirLeakData>
          columns={columns}
          data={sorted}
          keyField="facilityId"
          compact
          stickyHeader
          rowClassName={(row) =>
            row.leakRate > 30 ? 'row-danger' : row.leakRate > LEAK_LIMIT ? 'row-warning' : ''
          }
        />
      </div>
    </div>
  );
}
