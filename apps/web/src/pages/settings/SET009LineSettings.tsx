import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar, { type FilterItem } from '../../components/ui/FilterBar';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import {
  getFactoryList,
  getLineList,
  createLine,
  updateLine,
  deleteLine,
  type Line,
  type Factory,
} from '../../services/settings';

export default function SET009LineSettings() {
  const queryClient = useQueryClient();
  const [factoryFilter, setFactoryFilter] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [formData, setFormData] = useState<Partial<Line>>({});

  const { data: factories = [] } = useQuery({
    queryKey: ['factory-list'],
    queryFn: getFactoryList,
  });

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['line-list', factoryFilter],
    queryFn: () => getLineList(factoryFilter || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createLine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-list'] });
      setEditModalOpen(false);
      alert('라인이 추가되었습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Line> }) => updateLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-list'] });
      setEditModalOpen(false);
      alert('라인 정보가 수정되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-list'] });
      setDeleteConfirmOpen(false);
      setSelectedLine(null);
      alert('라인이 삭제되었습니다.');
    },
  });

  const columns: Column<Line>[] = [
    { key: 'code', label: '라인 코드', sortable: true },
    { key: 'name', label: '라인명', sortable: true },
    {
      key: 'factoryName',
      label: '공장',
      render: (_val, row) => (
        <span className="text-gray-300">
          {row.factoryName || row.factoryCode}
        </span>
      ),
    },
    { key: 'order', label: '순서', sortable: true },
    {
      key: 'isActive',
      label: '활성 상태',
      render: (_val, row) => (
        <span className={row.isActive ? 'text-[#27AE60]' : 'text-gray-400'}>
          {row.isActive ? '활성' : '비활성'}
        </span>
      ),
    },
    {
      key: 'facilityCount',
      label: '설비 수',
      render: (_val, row) => <span className="text-[#E94560]">{row.facilityCount || 0}개</span>,
    },
    {
      key: 'actions',
      label: '작업',
      render: (_val, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          >
            <Edit size={16} className="text-[#E94560]" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  const filters: FilterItem[] = [
    {
      type: 'select',
      label: '공장',
      key: 'factory',
      options: [
        { value: '', label: '전체 공장' },
        ...factories.map((f: Factory) => ({ value: f.id, label: f.name })),
      ],
      value: factoryFilter,
      onChange: setFactoryFilter,
      width: 150,
    },
  ];

  const handleAdd = () => {
    setSelectedLine(null);
    setFormData({ isActive: true, order: 0 });
    setEditModalOpen(true);
  };

  const handleEdit = (line: Line) => {
    setSelectedLine(line);
    setFormData(line);
    setEditModalOpen(true);
  };

  const handleDelete = (line: Line) => {
    setSelectedLine(line);
    setDeleteConfirmOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.factoryId) {
      alert('라인 코드, 이름, 공장을 모두 입력해주세요.');
      return;
    }

    if (selectedLine) {
      updateMutation.mutate({ id: selectedLine.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="라인 설정"
        description="라인 정보를 등록하고 관리합니다"
        breadcrumbs={[
          { label: '설정', path: '/settings' },
          { label: '라인 설정', path: '/settings/line' },
        ]}
      />

      <FilterBar filters={filters} />

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          총 <span className="text-white font-semibold">{lines.length}</span>개 라인
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] rounded-lg transition-colors"
        >
          <Plus size={18} />
          라인 추가
        </button>
      </div>

      <SortableTable<any>
        data={lines}
        columns={columns}
        loading={isLoading}
        emptyMessage="등록된 라인이 없습니다"
      />

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedLine ? '라인 수정' : '라인 추가'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              공장 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.factoryId || ''}
              onChange={(e) => setFormData({ ...formData, factoryId: e.target.value })}
              disabled={!!selectedLine}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="">공장 선택</option>
              {factories.map((f: Factory) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              라인 코드 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              disabled={!!selectedLine}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              placeholder="예: BLOCK, HEAD, CRANK"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              라인명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 블록 라인, 헤드 라인"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">순서</label>
            <input
              type="number"
              value={formData.order || 0}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive ?? true}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700"
            />
            <label htmlFor="isActive" className="text-sm text-gray-300">
              활성 상태
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] rounded-lg transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setEditModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => selectedLine && deleteMutation.mutate(selectedLine.id)}
        title="라인 삭제"
        message={`"${selectedLine?.name}" 라인을 삭제하시겠습니까?\n연결된 설비 데이터도 함께 삭제될 수 있습니다.`}
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
