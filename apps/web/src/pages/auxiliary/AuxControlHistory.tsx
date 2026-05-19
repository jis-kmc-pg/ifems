import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import { getControlCommands, type ControlCommand } from '../../services/auxiliary';

const SOURCE_BADGE: Record<string, string> = {
  SCHEDULE:  'bg-[#3B82F6] text-white',
  MANUAL:    'bg-[#F39C12] text-white',
  INTERLOCK: 'bg-[#9333EA] text-white',
  API:       'bg-gray-600 text-white',
};

const RESULT_BADGE: Record<string, string> = {
  SUCCESS: 'bg-[#27AE60] text-white',
  FAILED:  'bg-[#E74C3C] text-white',
  PENDING: 'bg-gray-400 text-white',
};

export default function AuxControlHistory() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['aux', 'control-commands'],
    queryFn: () => getControlCommands({ limit: 200 }),
  });

  const columns: Column<ControlCommand>[] = [
    {
      key: 'executedAt',
      label: '실행 시각',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono text-xs">
          {new Date(row.executedAt).toLocaleString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'facilityId',
      label: '설비',
      render: (_v, row) => <span className="font-mono text-xs">{row.facilityId.slice(0, 8)}</span>,
    },
    {
      key: 'command',
      label: '명령',
      render: (_v, row) => <span className="font-mono text-xs">{row.command}</span>,
    },
    {
      key: 'source',
      label: '출처',
      render: (_v, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${SOURCE_BADGE[row.source] ?? ''}`}>
          {row.source}
        </span>
      ),
    },
    {
      key: 'triggeredBy',
      label: '트리거',
      render: (_v, row) => <span className="text-xs">{row.triggeredBy}</span>,
    },
    {
      key: 'result',
      label: '결과',
      render: (_v, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${RESULT_BADGE[row.result] ?? ''}`}>
          {row.result}
        </span>
      ),
    },
    {
      key: 'errorMessage',
      label: '오류',
      render: (_v, row) => row.errorMessage
        ? <span className="text-xs text-[#E74C3C]">{row.errorMessage}</span>
        : <span className="text-gray-400">—</span>,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="제어 명령 이력"
        description="공조/조명 자동·수동 제어 명령 감사 이력 (fems.control_commands)"
        breadcrumbs={[{ label: '부대설비' }, { label: '제어 명령 이력' }]}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">불러오는 중...</div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          아직 실행된 제어 명령이 없습니다.
        </div>
      ) : (
        <SortableTable data={data} columns={columns} pageSize={30} />
      )}
    </div>
  );
}
