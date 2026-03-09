import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2,
  Settings, Wrench, Search, Paintbrush, Zap, Box, Cog, Hammer,
  Package, HardDrive, Cpu, Activity, Monitor, Disc
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar, { type FilterItem } from '../../components/ui/FilterBar';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import {
  getFacilityTypeList,
  createFacilityType,
  updateFacilityType,
  deleteFacilityType,
  type FacilityType,
} from '../../services/settings';

const ICON_OPTIONS = [
  'Settings', 'Wrench', 'Search', 'Paintbrush', 'Zap', 'Box', 'Cog', 'Tool',
  'Package', 'HardDrive', 'Cpu', 'Activity', 'Monitor', 'Disc',
];

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Settings, Wrench, Search, Paintbrush, Zap, Box, Cog, Hammer,
  Package, HardDrive, Cpu, Activity, Monitor, Disc,
};

export default function SET011FacilityTypeManagement() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FacilityType | null>(null);
  const [formData, setFormData] = useState<Partial<FacilityType>>({});

  const { data: facilityTypes = [], isLoading } = useQuery({
    queryKey: ['facility-type-list'],
    queryFn: getFacilityTypeList,
  });

  const filteredTypes = facilityTypes.filter((type: FacilityType) => {
    if (activeFilter === 'active' && !type.isActive) return false;
    if (activeFilter === 'inactive' && type.isActive) return false;
    if (searchText && !type.name.toLowerCase().includes(searchText.toLowerCase()) &&
        !type.code.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createFacilityType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-type-list'] });
      setEditModalOpen(false);
      alert('설비 유형이 추가되었습니다.');
    },
    onError: (error: any) => {
      alert(`추가 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FacilityType> }) => updateFacilityType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-type-list'] });
      setEditModalOpen(false);
      alert('설비 유형 정보가 수정되었습니다.');
    },
    onError: (error: any) => {
      alert(`수정 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFacilityType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-type-list'] });
      setDeleteConfirmOpen(false);
      setSelectedType(null);
      alert('설비 유형이 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const columns: Column<FacilityType>[] = [
    { key: 'code', label: '코드', sortable: true, width: 120 },
    {
      key: 'name',
      label: '유형명',
      sortable: true,
      width: 150,
      render: (_val, row) => (
        <div className="flex items-center gap-2">
          {row.color && (
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: row.color }}
            />
          )}
          <span>{row.name}</span>
        </div>
      ),
    },
    { key: 'description', label: '설명', width: 250 },
    {
      key: 'icon',
      label: '아이콘',
      render: (_val, row) => (
        <span className="text-gray-400 text-xs">{row.icon || '-'}</span>
      ),
      width: 100,
    },
    {
      key: 'facilityCount',
      label: '설비 수',
      render: (_val, row) => (
        <span className="text-[#E94560] font-semibold">{row.facilityCount || 0}</span>
      ),
      width: 80,
    },
    { key: 'order', label: '순서', width: 60 },
    {
      key: 'isActive',
      label: '상태',
      render: (_val, row) => (
        <span className={row.isActive ? 'text-[#27AE60]' : 'text-gray-400'}>
          {row.isActive ? '활성' : '비활성'}
        </span>
      ),
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
      label: '상태',
      key: 'active',
      options: [
        { value: '', label: '전체' },
        { value: 'active', label: '활성' },
        { value: 'inactive', label: '비활성' },
      ],
      value: activeFilter,
      onChange: setActiveFilter,
      width: 100,
    },
    {
      type: 'text',
      label: '검색',
      key: 'search',
      placeholder: '유형명, 코드 검색...',
      value: searchText,
      onChange: setSearchText,
      width: 200,
    },
  ];

  const handleAdd = () => {
    setSelectedType(null);
    setFormData({ isActive: true, order: facilityTypes.length });
    setEditModalOpen(true);
  };

  const handleEdit = (type: FacilityType) => {
    setSelectedType(type);
    setFormData(type);
    setEditModalOpen(true);
  };

  const handleDelete = (type: FacilityType) => {
    if (type.facilityCount && type.facilityCount > 0) {
      alert(`이 유형을 사용하는 설비가 ${type.facilityCount}개 있어 삭제할 수 없습니다.`);
      return;
    }
    setSelectedType(type);
    setDeleteConfirmOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      alert('코드와 유형명을 모두 입력해주세요.');
      return;
    }

    // Color validation
    if (formData.color && !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      alert('색상은 HEX 형식이어야 합니다. (예: #3B82F6)');
      return;
    }

    if (selectedType) {
      updateMutation.mutate({ id: selectedType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const activeCount = facilityTypes.filter((t: FacilityType) => t.isActive).length;
  const inactiveCount = facilityTypes.length - activeCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="설비 유형 관리"
        description="설비 유형을 분류하고 관리합니다"
        breadcrumbs={[
          { label: '설정', path: '/settings' },
          { label: '설비 유형 관리', path: '/settings/facility-type' },
        ]}
      />

      <FilterBar filters={filters} />

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400 flex gap-4">
          <span>
            총 <span className="text-white font-semibold">{filteredTypes.length}</span>개 유형
          </span>
          <span className="text-[#27AE60]">
            활성 {activeCount}
          </span>
          <span className="text-gray-500">
            비활성 {inactiveCount}
          </span>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] rounded-lg transition-colors"
        >
          <Plus size={18} />
          유형 추가
        </button>
      </div>

      <SortableTable<FacilityType>
        data={filteredTypes}
        columns={columns}
        loading={isLoading}
        emptyMessage="등록된 설비 유형이 없습니다"
        pageSize={20}
      />

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedType ? '설비 유형 수정' : '설비 유형 추가'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              코드 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              disabled={!!selectedType}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white uppercase disabled:opacity-50"
              placeholder="예: MACHINING"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              유형명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 가공설비"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="설비 유형 설명"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">색상</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color || ''}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="#3B82F6"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                아이콘 {formData.icon && <span className="text-[#E94560] text-xs">({formData.icon})</span>}
              </label>
              <div className="grid grid-cols-7 gap-2">
                {/* 선택 안함 버튼 */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: '' })}
                  className={`p-3 rounded-lg border transition-colors ${
                    !formData.icon
                      ? 'bg-[#E94560] border-[#E94560]'
                      : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                  }`}
                  title="선택 안함"
                >
                  <span className="text-xs text-gray-400">없음</span>
                </button>
                {/* 아이콘 그리드 */}
                {ICON_OPTIONS.map((iconName) => {
                  const IconComponent = ICON_MAP[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`p-3 rounded-lg border transition-colors flex items-center justify-center ${
                        formData.icon === iconName
                          ? 'bg-[#E94560] border-[#E94560]'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                      title={iconName}
                    >
                      <IconComponent size={20} className="text-white" />
                    </button>
                  );
                })}
              </div>
            </div>
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
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? '처리 중...' : '저장'}
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
        onConfirm={() => selectedType && deleteMutation.mutate(selectedType.id)}
        title="설비 유형 삭제"
        message={`"${selectedType?.name} (${selectedType?.code})" 유형을 삭제하시겠습니까?`}
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
