import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Download, Upload, Settings2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar, { type FilterItem } from '../../components/ui/FilterBar';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/TrafficLight';
import {
  getFacilityMasterList,
  saveFacilityMaster,
  createFacilityMaster,
  deleteFacilityMaster,
  autoAssignProcess,
  type Facility,
} from '../../services/settings';
import { LINES } from '../../lib/constants';

const PROCESS_OPTIONS = [
  { value: '', label: '전체' },
  ...Array.from({ length: 26 }, (_, i) => ({
    value: `OP${i * 10}`,
    label: `OP${i * 10}`,
  })),
  { value: 'UTL', label: 'UTL (유틸리티)' },
];

const TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'MAIN', label: 'MAIN' },
  { value: 'MC', label: 'MC (가공기)' },
  { value: 'COOLING', label: 'COOLING' },
  { value: 'COMPRESSOR', label: 'COMPRESSOR' },
  { value: 'DUST', label: 'DUST (집진기)' },
  { value: 'AIR_DRY', label: 'AIR_DRY' },
];

const STATUS_OPTIONS: { value: Facility['status']; label: string }[] = [
  { value: 'NORMAL', label: '정상' },
  { value: 'WARNING', label: '경고' },
  { value: 'DANGER', label: '위험' },
  { value: 'OFFLINE', label: '오프라인' },
];

export default function SET007FacilityMaster() {
  const queryClient = useQueryClient();
  const [lineFilter, setLineFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [formData, setFormData] = useState<Partial<Facility>>({});

  const { data: facilities = [] } = useQuery({
    queryKey: ['facility-master'],
    queryFn: getFacilityMasterList,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Facility) => saveFacilityMaster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-master'] });
      setEditModalOpen(false);
      alert('설비가 저장되었습니다.');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Facility, 'id'>) => createFacilityMaster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-master'] });
      setEditModalOpen(false);
      alert('설비가 추가되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFacilityMaster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-master'] });
      setDeleteConfirmOpen(false);
      setSelectedFacility(null);
      alert('설비가 삭제되었습니다.');
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: () => autoAssignProcess(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['facility-master'] });
      alert(`공정 자동 할당 완료: ${result.updated}건 업데이트`);
    },
    onError: () => alert('공정 자동 할당 실패'),
  });

  const filters: FilterItem[] = [
    {
      type: 'select',
      label: '라인',
      key: 'line',
      options: [{ value: '', label: '전체' }, ...LINES.map((l) => ({ value: l.id, label: l.label }))],
      value: lineFilter,
      onChange: setLineFilter,
      width: 120,
    },
    {
      type: 'select',
      label: '공정',
      key: 'process',
      options: PROCESS_OPTIONS,
      value: processFilter,
      onChange: setProcessFilter,
      width: 150,
    },
    {
      type: 'select',
      label: '유형',
      key: 'type',
      options: TYPE_OPTIONS,
      value: typeFilter,
      onChange: setTypeFilter,
      width: 150,
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

  const filtered = facilities.filter((f: Facility) => {
    if (lineFilter && f.line !== lineFilter) return false;
    if (processFilter && f.process !== processFilter) return false;
    if (typeFilter && f.type !== typeFilter) return false;
    if (searchText && !f.code.toLowerCase().includes(searchText.toLowerCase()) && !f.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns: Column<Facility>[] = [
    { key: 'code', label: '설비 ID', width: 140, sortable: true },
    { key: 'name', label: '설비명', sortable: true },
    { key: 'lineLabel', label: '라인', width: 100, sortable: true, align: 'center' },
    { key: 'process', label: '공정', width: 100, sortable: true, align: 'center' },
    { key: 'type', label: '유형', width: 120, sortable: true, align: 'center' },
    {
      key: 'status',
      label: '상태',
      width: 100,
      align: 'center',
      render: (val) => <StatusBadge status={val as Facility['status']} />,
    },
    {
      key: 'isProcessing',
      label: '가공기',
      width: 80,
      align: 'center',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${val ? 'bg-blue-100 dark:bg-blue-900/30 text-[#E94560] dark:text-[#E94560]' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          {val ? '예' : '아니오'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '작업',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <div className="flex gap-1 justify-center">
          <button
            onClick={() => handleEdit(row)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            aria-label="수정"
          >
            <Edit size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            aria-label="삭제"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  const handleAdd = () => {
    setFormData({
      code: '',
      name: '',
      line: 'block',
      lineLabel: '블록',
      process: 'OP10',
      type: 'MC',
      status: 'NORMAL',
      isProcessing: true,
    });
    setSelectedFacility(null);
    setEditModalOpen(true);
  };

  const handleEdit = (facility: Facility) => {
    setFormData(facility);
    setSelectedFacility(facility);
    setEditModalOpen(true);
  };

  const handleDelete = (facility: Facility) => {
    setSelectedFacility(facility);
    setDeleteConfirmOpen(true);
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.line || !formData.process || !formData.type) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    const lineInfo = LINES.find((l) => l.id === formData.line);
    const fullData = {
      ...formData,
      lineLabel: lineInfo?.label ?? '',
      status: formData.status ?? 'NORMAL',
      isProcessing: formData.isProcessing ?? false,
    } as Facility;

    if (selectedFacility) {
      saveMutation.mutate(fullData);
    } else {
      const { id, ...createData } = fullData;
      createMutation.mutate(createData);
    }
  };

  const handleAutoAssign = () => {
    if (!confirm('설비 코드를 기반으로 공정(OP), 유형, 가공기 여부를 자동 할당합니다.\n기존 값이 덮어쓰기됩니다. 계속하시겠습니까?')) return;
    autoAssignMutation.mutate();
  };

  const handleExport = () => {
    alert('Excel 내보내기 기능은 백엔드 연동 후 사용 가능합니다.');
  };

  const handleImport = () => {
    alert('Excel 일괄 업로드 기능은 백엔드 연동 후 사용 가능합니다.');
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="설비 마스터 관리" description="설비 정보(ID, 이름, 라인, 공정, 유형)를 등록·수정·삭제합니다." />

      <FilterBar
        filters={filters}
        extra={
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleAutoAssign}
              disabled={autoAssignMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded disabled:opacity-50"
              aria-label="공정 자동 할당"
            >
              <Settings2 size={12} aria-hidden="true" />
              {autoAssignMutation.isPending ? '할당 중...' : '공정 자동 할당'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] hover:bg-[#C73B52] text-white text-xs rounded hover:opacity-90"
              aria-label="Excel 내보내기"
            >
              <Download size={12} aria-hidden="true" />
              Excel 내보내기
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs rounded hover:opacity-90"
              aria-label="Excel 일괄 업로드"
            >
              <Upload size={12} aria-hidden="true" />
              Excel 업로드
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E94560] hover:bg-[#C73B52] text-white text-xs rounded hover:opacity-90"
              aria-label="설비 추가"
            >
              <Plus size={12} aria-hidden="true" />
              설비 추가
            </button>
          </div>
        }
      />

      <div className="flex-1 bg-white dark:bg-[#16213E] rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <SortableTable columns={columns} data={filtered} keyField="id" pageSize={15} stickyHeader />
      </div>

      {/* 추가/수정 모달 */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={selectedFacility ? '설비 수정' : '설비 추가'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">설비 ID *</label>
              <input
                type="text"
                value={formData.code ?? ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="HNK10_000"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">설비명 *</label>
              <input
                type="text"
                value={formData.name ?? ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="블록 메인"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">라인 *</label>
              <select
                value={formData.line ?? 'block'}
                onChange={(e) => setFormData({ ...formData, line: e.target.value as Facility['line'] })}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              >
                {LINES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">공정 *</label>
              <select
                value={formData.process ?? 'OP10'}
                onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              >
                {PROCESS_OPTIONS.filter((p) => p.value).map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">유형 *</label>
              <select
                value={formData.type ?? 'MC'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              >
                {TYPE_OPTIONS.filter((t) => t.value).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">상태</label>
              <select
                value={formData.status ?? 'NORMAL'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Facility['status'] })}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">가공기 여부</label>
              <select
                value={formData.isProcessing ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, isProcessing: e.target.value === 'true' })}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-[#16213E] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#27AE60]"
              >
                <option value="true">예</option>
                <option value="false">아니오</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
              취소
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-sm rounded bg-[#E94560] hover:bg-[#C73B52] text-white hover:opacity-90">
              {selectedFacility ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => selectedFacility && deleteMutation.mutate(selectedFacility.id)}
        title="설비 삭제"
        message={`${selectedFacility?.code} - ${selectedFacility?.name}을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
