// ============================================================
// Settings 테이블 공통 훅
// SET-001~006 설정 페이지의 CRUD 패턴을 한 곳에서 관리
// ============================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from '../lib/toast';

interface UseSettingsTableOptions<T> {
  queryKey: string;
  fetchFn: () => Promise<T[]>;
  saveFn: (rows: T[]) => Promise<unknown>;
  successMessage?: string;
}

export function useSettingsTable<T extends { id: string; process?: string }>({
  queryKey,
  fetchFn,
  saveFn,
  successMessage = '설정이 저장되었습니다.',
}: UseSettingsTableOptions<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: fetchedRows, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchFn,
  });

  useEffect(() => {
    if (fetchedRows && Array.isArray(fetchedRows)) {
      setRows(fetchedRows);
    }
  }, [fetchedRows]);

  const saveMutation = useMutation({
    mutationFn: () => saveFn(rows),
    onSuccess: () => { toast.success(successMessage); setDirty(false); },
    onError: () => toast.error('설정 저장에 실패했습니다.'),
  });

  const updateRow = (id: string, field: keyof T, value: number | boolean) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const filterByProcess = (process: string) =>
    rows.filter((r) => !process || r.process === process);

  return {
    rows,
    isLoading,
    dirty,
    saveMutation,
    updateRow,
    filterByProcess,
  };
}
