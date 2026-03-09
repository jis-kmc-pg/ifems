import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Upload, Download, RefreshCw, History, UploadCloud } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar, { type FilterItem } from '../../components/ui/FilterBar';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import CascadeSelect from '../../components/ui/CascadeSelect';
import {
  getTagList,
  createTag,
  updateTag,
  deleteTag,
  getFacilityMasterList,
  uploadTagBulk,
  downloadTagBulkTemplate,
  reassignTags,
  getTagReassignmentHistory,
  type Tag,
  type Facility,
  type BulkUploadResult,
  type TagReassignmentLog,
} from '../../services/settings';
import { MEASURE_TYPE_OPTIONS, TAG_CATEGORY_OPTIONS as CATEGORY_OPTIONS, TAG_ENERGY_TYPE_OPTIONS as ENERGY_TYPE_OPTIONS } from '../../lib/filter-options';

const MEASURE_TYPE_LABELS: Record<string, string> = {
  INSTANTANEOUS: '순시',
  CUMULATIVE: '적산',
  DISCRETE: '이산',
};

const CATEGORY_LABELS: Record<string, string> = {
  ENERGY: '에너지',
  QUALITY: '품질',
  ENVIRONMENT: '환경',
  OPERATION: '운전',
  CONTROL: '제어',
};

export default function SET012TagMaster() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facilityFilter, setFacilityFilter] = useState('');
  const [measureTypeFilter, setMeasureTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [energyTypeFilter, setEnergyTypeFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<Tag>>({});
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResult | null>(null);
  const [reassignData, setReassignData] = useState({ targetFacilityId: '', reason: '' });
  const [reassignmentHistory, setReassignmentHistory] = useState<TagReassignmentLog[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: ['facility-master'],
    queryFn: getFacilityMasterList,
  });

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tag-list', facilityFilter, measureTypeFilter, categoryFilter, energyTypeFilter, searchText],
    queryFn: () =>
      getTagList({
        facilityId: facilityFilter || undefined,
        measureType: measureTypeFilter || undefined,
        category: categoryFilter || undefined,
        energyType: energyTypeFilter || undefined,
        search: searchText || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-list'] });
      setEditModalOpen(false);
      alert('태그가 추가되었습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tag> }) => updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-list'] });
      setEditModalOpen(false);
      alert('태그 정보가 수정되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-list'] });
      setDeleteConfirmOpen(false);
      setSelectedTag(null);
      alert('태그가 삭제되었습니다.');
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (file: File) => uploadTagBulk(file),
    onSuccess: (result) => {
      setBulkUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['tag-list'] });
    },
    onError: (error: any) => {
      alert(`업로드 실패: ${error.response?.data?.message || error.message}`);
      setBulkUploadModalOpen(false);
    },
  });

  const reassignMutation = useMutation({
    mutationFn: (data: { tagIds: string[]; targetFacilityId: string; reason?: string }) =>
      reassignTags(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tag-list'] });
      setReassignModalOpen(false);
      setSelectedTags([]);
      alert(`재할당 완료: 성공 ${result.success}개, 실패 ${result.failed}개`);
    },
    onError: (error: any) => {
      alert(`재할당 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const columns: Column<Tag>[] = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedTags.length === tags.length && tags.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedTags(tags.map((t: Tag) => t.id));
            } else {
              setSelectedTags([]);
            }
          }}
          className="w-4 h-4 rounded border-gray-600 bg-gray-700"
        />
      ),
      render: (_val, row) => (
        <input
          type="checkbox"
          checked={selectedTags.includes(row.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedTags([...selectedTags, row.id]);
            } else {
              setSelectedTags(selectedTags.filter((id) => id !== row.id));
            }
          }}
          className="w-4 h-4 rounded border-gray-600 bg-gray-700"
        />
      ),
      width: 40,
    },
    { key: 'tagName', label: '태그명', sortable: true, width: 200 },
    { key: 'displayName', label: '표시명', sortable: true, width: 150 },
    {
      key: 'facilityCode',
      label: '설비',
      render: (_val, row) => (
        <span className="text-gray-300 text-xs">
          {row.factoryCode}/{row.lineCode}/{row.facilityCode}
        </span>
      ),
      width: 150,
    },
    {
      key: 'measureType',
      label: '측정방식',
      render: (_val, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${
          row.measureType === 'CUMULATIVE' ? 'bg-[#27AE60]/20 text-[#27AE60]' :
          row.measureType === 'DISCRETE' ? 'bg-[#F39C12]/20 text-[#F39C12]' :
          'bg-[#E94560]/20 text-[#E94560]'
        }`}>
          {MEASURE_TYPE_LABELS[row.measureType] || row.measureType}
        </span>
      ),
    },
    {
      key: 'category',
      label: '용도',
      render: (_val, row) => (
        <span className="px-2 py-0.5 text-xs rounded bg-[#2E86DE]/10 text-[#2E86DE]">
          {CATEGORY_LABELS[row.category] || row.category}
        </span>
      ),
    },
    {
      key: 'energyType',
      label: '에너지',
      render: (_val, row) => row.energyType ? (
        <span className={`px-2 py-0.5 text-xs rounded ${
          row.energyType === 'elec' ? 'bg-[#FDB813]/20 text-[#FDB813]' :
          row.energyType === 'air' ? 'bg-[#2E86DE]/20 text-[#2E86DE]' :
          row.energyType === 'gas' ? 'bg-[#E74C3C]/20 text-[#E74C3C]' :
          'bg-[#F39C12]/20 text-[#F39C12]'
        }`}>
          {row.energyType === 'elec' ? '전력' : row.energyType === 'air' ? '에어' : row.energyType === 'gas' ? '가스' : '태양광'}
        </span>
      ) : <span className="text-gray-500">-</span>,
    },
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
            onClick={() => handleViewHistory(row)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="재할당 이력"
          >
            <History size={16} className="text-[#E74C3C]" />
          </button>
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
      label: '설비',
      key: 'facility',
      options: [
        { value: '', label: '전체 설비' },
        ...facilities.map((f: Facility) => ({ value: f.id, label: `${f.code} (${f.name})` })),
      ],
      value: facilityFilter,
      onChange: setFacilityFilter,
      width: 180,
    },
    {
      type: 'select',
      label: '측정방식',
      key: 'measureType',
      options: MEASURE_TYPE_OPTIONS,
      value: measureTypeFilter,
      onChange: setMeasureTypeFilter,
      width: 120,
    },
    {
      type: 'select',
      label: '용도',
      key: 'category',
      options: CATEGORY_OPTIONS,
      value: categoryFilter,
      onChange: setCategoryFilter,
      width: 110,
    },
    {
      type: 'select',
      label: '에너지',
      key: 'energyType',
      options: ENERGY_TYPE_OPTIONS,
      value: energyTypeFilter,
      onChange: setEnergyTypeFilter,
      width: 110,
    },
    {
      type: 'text',
      label: '검색',
      key: 'search',
      value: searchText,
      onChange: setSearchText,
      width: 200,
    },
  ];

  const handleAdd = () => {
    setSelectedTag(null);
    setFormData({ isActive: true, order: 0, measureType: 'INSTANTANEOUS', category: 'ENERGY' } as any);
    setEditModalOpen(true);
  };

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setFormData(tag);
    setEditModalOpen(true);
  };

  const handleDelete = (tag: Tag) => {
    setSelectedTag(tag);
    setDeleteConfirmOpen(true);
  };

  const handleSave = () => {
    if (!formData.facilityId || !formData.tagName || !formData.displayName) {
      alert('설비, 태그명, 표시명을 모두 입력해주세요.');
      return;
    }

    if (selectedTag) {
      updateMutation.mutate({ id: selectedTag.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDownloadTemplate = () => {
    downloadTagBulkTemplate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploadResult(null);
    setBulkUploadModalOpen(true);
    bulkUploadMutation.mutate(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check file extension
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      alert('Excel 또는 CSV 파일만 업로드 가능합니다.');
      return;
    }

    setBulkUploadResult(null);
    setBulkUploadModalOpen(true);
    bulkUploadMutation.mutate(file);
  };

  const handleReassign = () => {
    if (selectedTags.length === 0) {
      alert('재할당할 태그를 선택해주세요.');
      return;
    }
    setReassignData({ targetFacilityId: '', reason: '' });
    setReassignModalOpen(true);
  };

  const handleReassignConfirm = () => {
    if (!reassignData.targetFacilityId) {
      alert('대상 설비를 선택해주세요.');
      return;
    }
    reassignMutation.mutate({
      tagIds: selectedTags,
      targetFacilityId: reassignData.targetFacilityId,
      reason: reassignData.reason || undefined,
    });
  };

  const handleViewHistory = async (tag: Tag) => {
    setSelectedTag(tag);
    try {
      const history = await getTagReassignmentHistory(tag.id);
      setReassignmentHistory(history);
      setHistoryModalOpen(true);
    } catch (error: any) {
      alert(`이력 조회 실패: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="태그 마스터"
        description="태그 정보를 등록하고 관리합니다"
        breadcrumbs={[
          { label: '설정', path: '/settings' },
          { label: '태그 마스터', path: '/settings/tag' },
        ]}
      />

      <FilterBar filters={filters} />

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          총 <span className="text-[#E94560] font-bold">{tags.length.toLocaleString()}</span>개 태그
          {selectedTags.length > 0 && (
            <span className="ml-2 text-[#E94560]">
              ({selectedTags.length}개 선택됨)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-[#E74C3C] hover:bg-[#C73B52] text-white rounded-lg transition-colors text-sm"
          >
            <Download size={16} />
            템플릿 다운로드
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] hover:bg-[#C73B52] text-white rounded-lg transition-colors text-sm"
          >
            <Upload size={16} />
            일괄 업로드
          </button>
          <button
            onClick={handleReassign}
            disabled={selectedTags.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#F39C12] hover:bg-[#E67E22] text-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCw size={16} />
            선택 재할당
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white rounded-lg transition-colors text-sm"
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-[#E94560] bg-[#E94560] bg-opacity-10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800 hover:bg-gray-750'
          }
        `}
      >
        <div className="flex items-center justify-center gap-3">
          <UploadCloud
            size={24}
            className={isDragging ? 'text-[#E94560]' : 'text-gray-400'}
          />
          <p className={`text-sm font-medium ${isDragging ? 'text-[#E94560]' : 'text-gray-300'}`}>
            {isDragging ? '파일을 여기에 놓으세요' : 'Excel/CSV 파일을 드래그하거나 클릭하여 업로드'}
          </p>
          <span className="text-xs text-gray-400">(.xlsx, .xls, .csv)</span>
        </div>
      </div>

      <SortableTable<Tag>
        data={tags}
        columns={columns}
        loading={isLoading}
        emptyMessage="등록된 태그가 없습니다"
        pageSize={50}
      />

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedTag ? '태그 수정' : '태그 추가'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              설비 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.facilityId || ''}
              onChange={(e) => setFormData({ ...formData, facilityId: e.target.value })}
              disabled={!!selectedTag}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="">설비 선택</option>
              {facilities.map((f: Facility) => (
                <option key={f.id} value={f.id}>
                  {f.code} - {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              태그명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.tagName || ''}
              onChange={(e) => setFormData({ ...formData, tagName: e.target.value })}
              disabled={!!selectedTag}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              placeholder="예: HNK10_010_1_POWER_1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              표시명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.displayName || ''}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="예: 전력 사용량"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                측정방식 <span className="text-red-400">*</span>
              </label>
              <select
                value={(formData as any).measureType || 'INSTANTANEOUS'}
                onChange={(e) => setFormData({ ...formData, measureType: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="INSTANTANEOUS">순시값 (특정 시점 즉시 측정)</option>
                <option value="CUMULATIVE">적산값 (시간에 따라 누적)</option>
                <option value="DISCRETE">이산값 (0/1, 유한 상태)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                용도 <span className="text-red-400">*</span>
              </label>
              <select
                value={(formData as any).category || 'ENERGY'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="ENERGY">에너지 (전력/에어/가스)</option>
                <option value="QUALITY">품질 (불평형률/역률/고조파)</option>
                <option value="ENVIRONMENT">환경 (온도/습도/압력)</option>
                <option value="OPERATION">운전 (가동/정지/가동시간)</option>
                <option value="CONTROL">제어 (목표온도/설정압력)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">에너지 유형</label>
              <select
                value={formData.energyType || ''}
                onChange={(e) => setFormData({ ...formData, energyType: e.target.value as any || null })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">없음</option>
                <option value="elec">전력</option>
                <option value="air">에어</option>
                <option value="gas">가스</option>
                <option value="solar">태양광</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">단위</label>
              <input
                type="text"
                value={formData.unit || ''}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="예: kWh, L"
              />
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
              className="flex-1 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white rounded-lg transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setEditModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
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
        onConfirm={() => selectedTag && deleteMutation.mutate(selectedTag.id)}
        title="태그 삭제"
        message={`"${selectedTag?.displayName} (${selectedTag?.tagName})" 태그를 삭제하시겠습니까?`}
        confirmText="삭제"
        confirmVariant="danger"
      />

      {/* 일괄 업로드 결과 모달 */}
      <Modal
        isOpen={bulkUploadModalOpen}
        onClose={() => setBulkUploadModalOpen(false)}
        title="일괄 업로드 결과"
      >
        <div className="space-y-4">
          {bulkUploadMutation.isPending ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]"></div>
              <p className="mt-4 text-gray-300">업로드 처리 중...</p>
            </div>
          ) : bulkUploadResult ? (
            <>
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-xs text-gray-400">총 행</div>
                  <div className="text-xl font-semibold text-white">{bulkUploadResult.total}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">성공</div>
                  <div className="text-xl font-semibold text-[#27AE60]">{bulkUploadResult.success}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">실패</div>
                  <div className="text-xl font-semibold text-red-400">{bulkUploadResult.failed}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">경고</div>
                  <div className="text-xl font-semibold text-[#F39C12]">{bulkUploadResult.warnings}</div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">행</th>
                      <th className="px-3 py-2 text-left">상태</th>
                      <th className="px-3 py-2 text-left">메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkUploadResult.results.map((result, idx) => (
                      <tr key={idx} className="border-t border-gray-700">
                        <td className="px-3 py-2">{result.row}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            result.status === 'success' ? 'bg-[#E94560] hover:bg-[#C73B52]/20 text-[#27AE60]' :
                            result.status === 'error' ? 'bg-red-900/20 text-red-400' :
                            'bg-[#F39C12]/20 text-[#F39C12]'
                          }`}>
                            {result.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-300">
                          {result.message || (result.errors && result.errors.join(', ')) || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => setBulkUploadModalOpen(false)}
                className="w-full px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white rounded-lg transition-colors"
              >
                확인
              </button>
            </>
          ) : null}
        </div>
      </Modal>

      {/* 재할당 모달 */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="태그 재할당"
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-400">선택된 태그</div>
            <div className="text-lg font-semibold text-white">{selectedTags.length}개</div>
          </div>

          <CascadeSelect
            value={reassignData.targetFacilityId}
            onChange={(facilityId) => setReassignData({ ...reassignData, targetFacilityId: facilityId })}
            label={<>대상 설비 <span className="text-red-400">*</span></>}
            placeholder="설비를 선택하세요"
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">재할당 사유</label>
            <textarea
              value={reassignData.reason}
              onChange={(e) => setReassignData({ ...reassignData, reason: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="재할당 사유를 입력하세요"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleReassignConfirm}
              disabled={reassignMutation.isPending}
              className="flex-1 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] hover:bg-[#C73B52] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {reassignMutation.isPending ? '처리 중...' : '재할당'}
            </button>
            <button
              onClick={() => setReassignModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      {/* 재할당 이력 모달 */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`재할당 이력 - ${selectedTag?.displayName}`}
      >
        <div className="space-y-4">
          {reassignmentHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-400">재할당 이력이 없습니다</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">일시</th>
                    <th className="px-3 py-2 text-left">이전 설비</th>
                    <th className="px-3 py-2 text-left">이후 설비</th>
                    <th className="px-3 py-2 text-left">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {reassignmentHistory.map((log) => (
                    <tr key={log.id} className="border-t border-gray-700">
                      <td className="px-3 py-2 text-gray-300">
                        {new Date(log.reassignedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 text-gray-300">{log.fromFacilityCode || log.fromFacilityId}</td>
                      <td className="px-3 py-2 text-gray-300">{log.toFacilityCode || log.toFacilityId}</td>
                      <td className="px-3 py-2 text-gray-400">{log.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => setHistoryModalOpen(false)}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </Modal>
    </div>
  );
}
