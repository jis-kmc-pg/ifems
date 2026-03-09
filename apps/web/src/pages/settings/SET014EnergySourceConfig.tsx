import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, AlertTriangle, CheckCircle, History, Zap, Wind, Tag, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FilterBar, { type FilterItem } from '../../components/ui/FilterBar';
import SortableTable, { type Column } from '../../components/ui/SortableTable';
import Modal from '../../components/ui/Modal';
import {
  getEnergyConfigList,
  getEnergyConfig,
  updateEnergyConfig,
  getEnergyConfigSummary,
  getEnergyConfigHistory,
  autoGenerateEnergyConfigs,
  type EnergyConfig,
  type EnergyConfigSummary,
  type EnergyConfigHistory,
  type EnergyConfigDetail,
} from '../../services/settings';

const ENERGY_TYPE_LABELS: Record<string, string> = {
  elec: '전력',
  air: '에어',
  gas: '가스',
  solar: '태양광',
};

const CALC_METHOD_LABELS: Record<string, string> = {
  DIFF: '적산 차분',
  INTEGRAL_TRAP: '순시 적분',
};

const ACTION_LABELS: Record<string, string> = {
  UPDATE: '계산방식 변경',
  TAG_ADD: '태그 추가',
  TAG_REMOVE: '태그 제거',
};

export default function SET014EnergySourceConfig() {
  const queryClient = useQueryClient();
  const [lineFilter, setLineFilter] = useState('');
  const [energyTypeFilter, setEnergyTypeFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<EnergyConfigDetail | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formCalcMethod, setFormCalcMethod] = useState('DIFF');
  const [formDescription, setFormDescription] = useState('');
  const [historyData, setHistoryData] = useState<EnergyConfigHistory[]>([]);
  const [historyConfig, setHistoryConfig] = useState<EnergyConfig | null>(null);

  const { data: configResult, isLoading } = useQuery({
    queryKey: ['energy-config-list', lineFilter, energyTypeFilter, reviewFilter, searchText],
    queryFn: () =>
      getEnergyConfigList({
        lineCode: lineFilter || undefined,
        energyType: energyTypeFilter || undefined,
        needsReview: reviewFilter === 'true' ? true : reviewFilter === 'false' ? false : undefined,
        search: searchText || undefined,
        pageSize: 10000,
      }),
  });

  const configs: EnergyConfig[] = configResult?.data || [];

  const { data: summary } = useQuery<EnergyConfigSummary>({
    queryKey: ['energy-config-summary'],
    queryFn: getEnergyConfigSummary,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateEnergyConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['energy-config-list'] });
      queryClient.invalidateQueries({ queryKey: ['energy-config-summary'] });
      setEditModalOpen(false);
      alert('에너지 소스 매핑이 수정되었습니다.');
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: autoGenerateEnergyConfigs,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['energy-config-list'] });
      queryClient.invalidateQueries({ queryKey: ['energy-config-summary'] });
      alert(`자동 생성 완료: ${result.created}개 생성, ${result.tagsMapped}개 태그 매핑 (${result.skipped}개 기존 건너뜀)`);
    },
  });

  const columns: Column<EnergyConfig>[] = [
    {
      key: 'facilityCode',
      label: '설비',
      sortable: true,
      width: 180,
      mergeKey: 'facilityId',
      render: (_val, row) => (
        <div>
          <div className="text-gray-900 dark:text-white text-sm font-medium">{row.facilityName || row.facilityCode}</div>
          <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">{row.facilityCode} · {row.lineCode}</div>
        </div>
      ),
    },
    {
      key: 'energyType',
      label: '에너지',
      render: (_val, row) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
          row.energyType === 'elec' ? 'bg-[#FDB813]/20 text-[#FDB813]' :
          row.energyType === 'air' ? 'bg-[#2E86DE]/20 text-[#2E86DE]' :
          row.energyType === 'gas' ? 'bg-[#E74C3C]/20 text-[#E74C3C]' :
          'bg-[#F39C12]/20 text-[#F39C12]'
        }`}>
          {row.energyType === 'elec' ? <Zap size={12} /> : <Wind size={12} />}
          {ENERGY_TYPE_LABELS[row.energyType] || row.energyType}
        </span>
      ),
    },
    {
      key: 'tags' as any,
      label: '소스 태그',
      width: 280,
      render: (_val, row) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1A1A2E] text-gray-700 dark:text-gray-300 font-mono">
              <Tag size={10} className="text-gray-400" />
              {t.tagName}
            </span>
          ))}
          {row.tagCount === 0 && <span className="text-gray-400 text-xs italic">미설정</span>}
        </div>
      ),
    },
    {
      key: 'tagCount' as any,
      label: '태그 수',
      sortable: true,
      width: 70,
      render: (_val, row) => (
        <span className="text-white text-sm font-semibold">{row.tagCount}</span>
      ),
    },
    {
      key: 'calcMethod',
      label: '계산방식',
      render: (_val, row) => (
        <span className={`px-2 py-0.5 text-xs rounded ${
          row.calcMethod === 'DIFF' ? 'bg-[#27AE60]/20 text-[#27AE60]' : 'bg-[#F39C12]/20 text-[#F39C12]'
        }`}>
          {CALC_METHOD_LABELS[row.calcMethod] || row.calcMethod}
        </span>
      ),
    },
    {
      key: 'needsReview',
      label: '상태',
      width: 160,
      render: (_val, row) => (
        <div className="space-y-1">
          <span className={`inline-flex items-center gap-1 text-xs ${
            row.needsReview ? 'text-[#F39C12]' : 'text-[#27AE60]'
          }`}>
            {row.needsReview ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
            {row.needsReview ? '확인 필요' : '정상'}
          </span>
          {row.calcMethod === 'INTEGRAL_TRAP' && (
            <div className={`text-xs flex items-center gap-1 ${
              row.hasCumulativeTag
                ? 'text-[#3B82F6]'
                : 'text-gray-400'
            }`}>
              {row.hasCumulativeTag
                ? `→ 적산 전환 가능 (${row.cumulativeTagCount}개)`
                : '적산 태그 없음'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'since' as any,
      label: '적용일',
      sortable: true,
      width: 100,
      render: (_val, row) => (
        <span className="text-gray-300 text-xs">
          {row.since ? new Date(row.since).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'actions' as any,
      label: '작업',
      render: (_val, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
            title="수정"
          >
            <Edit size={16} className="text-[#E94560]" />
          </button>
          <button
            onClick={() => handleViewHistory(row)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
            title="변경 이력"
          >
            <History size={16} className="text-[#E74C3C]" />
          </button>
        </div>
      ),
    },
  ];

  const filters: FilterItem[] = [
    {
      type: 'select',
      label: '라인',
      key: 'lineCode',
      options: [
        { value: '', label: '전체 라인' },
        { value: 'BLOCK', label: '블록' },
        { value: 'HEAD', label: '헤드' },
        { value: 'CRANK', label: '크랭크' },
        { value: 'ASSEMBLE', label: '조립' },
      ],
      value: lineFilter,
      onChange: setLineFilter,
      width: 120,
    },
    {
      type: 'select',
      label: '에너지',
      key: 'energyType',
      options: [
        { value: '', label: '전체' },
        { value: 'elec', label: '전력' },
        { value: 'air', label: '에어' },
      ],
      value: energyTypeFilter,
      onChange: setEnergyTypeFilter,
      width: 100,
    },
    {
      type: 'select',
      label: '상태',
      key: 'needsReview',
      options: [
        { value: '', label: '전체' },
        { value: 'true', label: '확인 필요' },
        { value: 'false', label: '정상' },
      ],
      value: reviewFilter,
      onChange: setReviewFilter,
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

  const handleEdit = async (config: EnergyConfig) => {
    try {
      const detail: EnergyConfigDetail = await getEnergyConfig(config.id);
      setSelectedConfig(detail);
      setSelectedTagIds(detail.tags.map((t) => t.id));
      setFormCalcMethod(detail.calcMethod);
      setFormDescription('');
      setEditModalOpen(true);
    } catch (error: any) {
      alert(`상세 조회 실패: ${error.message}`);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = () => {
    if (selectedTagIds.length === 0) {
      alert('최소 1개 이상의 태그를 선택해주세요.');
      return;
    }
    if (!selectedConfig) return;
    updateMutation.mutate({
      id: selectedConfig.id,
      data: {
        calcMethod: formCalcMethod,
        tagIds: selectedTagIds,
        description: formDescription || undefined,
      },
    });
  };

  const handleViewHistory = async (config: EnergyConfig) => {
    try {
      const result = await getEnergyConfigHistory({
        facilityId: config.facilityId,
        energyType: config.energyType,
      });
      setHistoryData(result?.data || []);
      setHistoryConfig(config);
      setHistoryModalOpen(true);
    } catch (error: any) {
      alert(`이력 조회 실패: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="에너지 소스 매핑"
          description="설비별 에너지 사용량 계산에 사용되는 소스 태그를 관리합니다"
          breadcrumbs={[
            { label: '설정', path: '/settings' },
            { label: '에너지 소스 매핑', path: '/settings/energy-config' },
          ]}
        />
        <button
          onClick={() => {
            if (confirm('태그 데이터를 기반으로 미설정 설비의 에너지 소스 매핑을 자동 생성합니다.\n계속하시겠습니까?')) {
              autoGenerateMutation.mutate();
            }
          }}
          disabled={autoGenerateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap mt-1"
        >
          <RefreshCw size={14} className={autoGenerateMutation.isPending ? 'animate-spin' : ''} />
          {autoGenerateMutation.isPending ? '생성 중...' : '자동 설정'}
        </button>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">전체 매핑</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">태그 {summary.totalTags}개</div>
          </div>
          <div className="bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">확인 필요</div>
            <div className={`text-2xl font-bold ${summary.needsReview > 0 ? 'text-[#F39C12]' : 'text-[#27AE60]'}`}>
              {summary.needsReview}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">순시 적분 {summary.integralCount}건</div>
          </div>
          <div className="bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">적산 전환 가능</div>
            <div className={`text-2xl font-bold ${summary.switchableCount > 0 ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
              {summary.switchableCount}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">적산 태그 보유 설비</div>
          </div>
          <div className="bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">계산방식별</div>
            <div className="flex flex-col gap-1 mt-1">
              {summary.byCalcMethod.map((g) => (
                <span key={g.calcMethod} className="text-xs text-gray-600 dark:text-gray-300">
                  {CALC_METHOD_LABELS[g.calcMethod] || g.calcMethod}: <span className="text-gray-900 dark:text-white font-semibold">{g.count}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-[#16213E] rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">에너지별</div>
            <div className="flex flex-col gap-1 mt-1">
              {summary.byEnergyType.map((g) => (
                <span key={g.energyType} className="text-xs text-gray-600 dark:text-gray-300">
                  {ENERGY_TYPE_LABELS[g.energyType] || g.energyType}: <span className="text-gray-900 dark:text-white font-semibold">{g.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <FilterBar filters={filters} />

      <div className="text-sm text-gray-500">
        총 <span className="text-[#E94560] font-bold">{configs.length.toLocaleString()}</span>개 매핑
      </div>

      <SortableTable<EnergyConfig>
        data={configs}
        columns={columns}
        loading={isLoading}
        emptyMessage="등록된 에너지 소스 매핑이 없습니다"
        pageSize={50}
      />

      {/* 수정 모달 - 태그 체크박스 방식 */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`에너지 소스 매핑 수정 - ${selectedConfig?.facilityCode} (${ENERGY_TYPE_LABELS[selectedConfig?.energyType || ''] || ''})`}
      >
        {selectedConfig && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 설비 정보 */}
            <div className="p-3 bg-gray-50 dark:bg-[#1A1A2E] rounded-lg text-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">설비</span>
                <span className="text-gray-900 dark:text-white font-mono">{selectedConfig.facilityName || selectedConfig.facilityCode}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500 dark:text-gray-400">설비코드</span>
                <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">{selectedConfig.facilityCode}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500 dark:text-gray-400">라인</span>
                <span className="text-gray-900 dark:text-white">{selectedConfig.lineName}</span>
              </div>
            </div>

            {/* 계산방식 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계산방식</label>
              <select
                value={formCalcMethod}
                onChange={(e) => setFormCalcMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#E94560]/30 focus:border-[#E94560] outline-none"
              >
                <option value="DIFF">적산 차분 (end - start)</option>
                <option value="INTEGRAL_TRAP">순시 적분 (사다리꼴)</option>
              </select>
              {formCalcMethod === 'INTEGRAL_TRAP' && (
                <div className="mt-2 p-2 bg-[#F39C12]/10 border border-[#F39C12]/30 rounded text-xs text-[#F39C12]">
                  순시 적분은 추정값입니다. 관리자 확인이 필요합니다.
                </div>
              )}
            </div>

            {/* 태그 선택 (체크박스) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                소스 태그 선택 <span className="text-gray-400 dark:text-gray-500">({selectedTagIds.length}개 선택)</span>
              </label>
              <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-[#1A1A2E]/50">
                {(selectedConfig.availableTags || []).map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  const isRecommended = (formCalcMethod === 'DIFF' && tag.measureType === 'CUMULATIVE')
                    || (formCalcMethod === 'INTEGRAL_TRAP' && tag.measureType === 'INSTANTANEOUS');
                  return (
                    <label
                      key={tag.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#E94560]/10 border border-[#E94560]/30'
                          : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTag(tag.id)}
                        className="w-4 h-4 accent-[#E94560]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 dark:text-white font-mono truncate">{tag.tagName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{tag.displayName}</div>
                      </div>
                      {isRecommended && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-[#E94560]/20 text-[#E94560] font-medium">
                          추천
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        tag.measureType === 'CUMULATIVE' ? 'bg-[#27AE60]/20 text-[#27AE60]' : 'bg-[#2E86DE]/20 text-[#2E86DE]'
                      }`}>
                        {tag.measureType === 'CUMULATIVE' ? '적산' : '순시'}
                      </span>
                      {tag.unit && <span className="text-xs text-gray-400 dark:text-gray-500">{tag.unit}</span>}
                    </label>
                  );
                })}
                {(selectedConfig.availableTags || []).length === 0 && (
                  <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
                    이 에너지 타입에 사용 가능한 태그가 없습니다
                  </div>
                )}
              </div>
            </div>

            {/* 변경 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">변경 사유</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#1A1A2E] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#E94560]/30 focus:border-[#E94560] outline-none"
                placeholder="변경 사유를 입력하세요"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || selectedTagIds.length === 0}
                className="flex-1 px-4 py-2 bg-[#E94560] hover:bg-[#C73B52] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setEditModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#1A1A2E] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 변경 이력 모달 */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`변경 이력 - ${historyConfig?.facilityCode} (${ENERGY_TYPE_LABELS[historyConfig?.energyType || ''] || ''})`}
        size="lg"
      >
        <div className="space-y-4">
          {historyData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">변경 이력이 없습니다</div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#1A1A2E]">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">일시</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">작업</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">태그</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">계산방식</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100 dark:border-gray-700/50">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.changedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          log.action === 'TAG_ADD' ? 'bg-[#27AE60]/20 text-[#27AE60]' :
                          log.action === 'TAG_REMOVE' ? 'bg-[#E74C3C]/20 text-[#E74C3C]' :
                          'bg-[#2E86DE]/20 text-[#2E86DE]'
                        }`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white text-xs font-mono">
                        {log.tagName || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {log.prevCalcMethod && (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">{CALC_METHOD_LABELS[log.prevCalcMethod]}</span>
                            <span className="text-gray-400 dark:text-gray-500">{' → '}</span>
                          </>
                        )}
                        {log.newCalcMethod && (
                          <span className="text-gray-900 dark:text-white font-medium">{CALC_METHOD_LABELS[log.newCalcMethod]}</span>
                        )}
                        {!log.prevCalcMethod && !log.newCalcMethod && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{log.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={() => setHistoryModalOpen(false)}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-[#1A1A2E] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </Modal>
    </div>
  );
}
