import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import {
  getFactoryList,
  createFactory,
  updateFactory,
  deleteFactory,
  type Factory,
} from '../../services/settings';

export default function SET008FactoryManagement() {
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [formData, setFormData] = useState<Partial<Factory>>({});

  const { data: factories = [], isLoading } = useQuery({
    queryKey: ['factory-list'],
    queryFn: getFactoryList,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Factory, 'id' | 'createdAt' | 'updatedAt' | 'lineCount'>) => createFactory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-list'] });
      setEditModalOpen(false);
      alert('공장이 추가되었습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Factory> }) => updateFactory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-list'] });
      setEditModalOpen(false);
      alert('공장 정보가 수정되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFactory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-list'] });
      setDeleteConfirmOpen(false);
      setSelectedFactory(null);
      alert('공장이 삭제되었습니다.');
    },
  });

  const columns: Column<Factory>[] = [
    { key: 'code', label: '공장 코드', sortable: true },
    { key: 'name', label: '공장명', sortable: true },
    { key: 'fullName', label: '전체 이름', sortable: true },
    { key: 'location', label: '위치', sortable: true },
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
      key: 'lineCount',
      label: '라인 수',
      render: (_val, row) => <span className="text-[#E94560]">{row.lineCount || 0}개</span>,
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

  const handleAdd = () => {
    setSelectedFactory(null);
    setFormData({ isActive: true });
    setEditModalOpen(true);
  };

  const handleEdit = (factory: Factory) => {
    setSelectedFactory(factory);
    setFormData(factory);
    setEditModalOpen(true);
  };

  const handleDelete = (factory: Factory) => {
    setSelectedFactory(factory);
    setDeleteConfirmOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      alert('공장 코드와 이름을 입력해주세요.');
      return;
    }

    if (selectedFactory) {
      updateMutation.mutate({ id: selectedFactory.id, data: formData });
    } else {
      createMutation.mutate(formData as any);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="공장 관리"
        description="공장 정보를 등록하고 관리합니다"
        breadcrumbs={[
          { label: '설정', path: '/settings' },
          { label: '공장 관리', path: '/settings/factory' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          총 <span className="text-white font-semibold">{factories.length}</span>개 공장
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] rounded-lg transition-colors"
        >
          <Plus size={18} />
          공장 추가
        </button>
      </div>

      <SortableTable<any>
        data={factories}
        columns={columns}
        loading={isLoading}
        emptyMessage="등록된 공장이 없습니다"
      />

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedFactory ? '공장 수정' : '공장 추가'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              공장 코드 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              disabled={!!selectedFactory}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              placeholder="예: HW4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              공장명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 4공장"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">전체 이름</label>
            <input
              type="text"
              value={formData.fullName || ''}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 화성PT4공장"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">위치</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 경기도 화성시"
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
        onConfirm={() => selectedFactory && deleteMutation.mutate(selectedFactory.id)}
        title="공장 삭제"
        message={`"${selectedFactory?.name}" 공장을 삭제하시겠습니까?\n연결된 라인과 설비 데이터도 함께 삭제될 수 있습니다.`}
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
