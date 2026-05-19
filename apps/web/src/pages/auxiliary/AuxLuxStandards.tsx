import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import { getLuxStandards, type LuxStandard } from '../../services/auxiliary';

export default function AuxLuxStandards() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['aux', 'lux-standards'],
    queryFn: getLuxStandards,
  });

  const columns: Column<LuxStandard>[] = [
    { key: 'zoneType', label: '영역', sortable: true },
    {
      key: 'requiredLux',
      label: '기준 조도 (lux)',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono font-semibold text-[#E94560]">
          {row.requiredLux.toLocaleString()}
        </span>
      ),
    },
    { key: 'description', label: '설명' },
    {
      key: 'reference',
      label: '출처',
      render: (_v, row) => (
        <span className="text-xs text-gray-500">{row.reference ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="작업조도 기준"
        description="KS A 3011 한국산업표준 기준 (영역별 권장 조도)"
        breadcrumbs={[{ label: '부대설비' }, { label: '설정' }, { label: '작업조도 기준' }]}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : (
        <SortableTable data={data} columns={columns} pageSize={20} />
      )}
    </div>
  );
}
