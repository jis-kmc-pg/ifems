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
    { key: 'zoneType', label: '?곸뿭', sortable: true },
    {
      key: 'requiredLux',
      label: '湲곗? 議곕룄 (lux)',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono font-semibold text-[#E94560]">
          {row.requiredLux.toLocaleString()}
        </span>
      ),
    },
    { key: 'description', label: '?ㅻ챸' },
    {
      key: 'reference',
      label: '異쒖쿂',
      render: (_v, row) => (
        <span className="text-xs text-gray-500">{row.reference ?? '??}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="?묒뾽議곕룄 湲곗?"
        description="KS A 3011 ?쒓뎅?곗뾽?쒖? 湲곗? (?곸뿭蹂?沅뚯옣 議곕룄)"
        breadcrumbs={[{ label: '遺??ㅻ퉬' }, { label: '?ㅼ젙' }, { label: '?묒뾽議곕룄 湲곗?' }]}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">遺덈윭?ㅻ뒗 以?..</div>
      ) : (
        <SortableTable data={data} columns={columns} pageSize={20} />
      )}
    </div>
  );
}
