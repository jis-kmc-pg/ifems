import { useState } from 'react';
import type { FilterItem } from '../components/ui/FilterBar';
import {
  LINE_OPTIONS,
  LINE_ITEMS,
  ENERGY_OPTIONS,
  ENERGY_TYPE_OPTIONS,
} from '../lib/filter-options';

/**
 * 라인 필터 훅
 *
 * 라인 셀렉터 state + FilterItem을 반환합니다.
 *
 * @example
 * const { line, filter: lineFilter } = useLineFilter();
 * // filters 배열에 lineFilter 추가
 */
export function useLineFilter(options?: {
  /** 전체 옵션 포함 여부 (default: true) */
  includeAll?: boolean;
  /** 초기값 (default: includeAll ? 'all' : 'block') */
  defaultValue?: string;
}) {
  const { includeAll = true, defaultValue } = options ?? {};
  const initial = defaultValue ?? (includeAll ? 'all' : 'block');
  const [line, setLine] = useState(initial);

  const filter: FilterItem = {
    type: 'select',
    key: 'line',
    label: '라인',
    value: line,
    onChange: setLine,
    options: includeAll ? LINE_OPTIONS : LINE_ITEMS,
  };

  return { line, setLine, filter } as const;
}

/**
 * 에너지 타입 필터 훅
 *
 * 에너지 타입 셀렉터 state + FilterItem을 반환합니다.
 *
 * @example
 * const { energyType, filter: energyFilter } = useEnergyFilter();
 * // filters 배열에 energyFilter 추가
 */
export function useEnergyFilter(options?: {
  /** 초기값 (default: 'power') */
  defaultValue?: 'power' | 'air';
  /** 상세 레이블 사용 — '전력(kWh)' vs '전력' (default: false) */
  detailed?: boolean;
}) {
  const { defaultValue = 'power', detailed = false } = options ?? {};
  const [energyType, setEnergyType] = useState<'power' | 'air'>(defaultValue);

  const filter: FilterItem = {
    type: 'select',
    key: 'energy',
    label: '에너지',
    value: energyType,
    onChange: (v: string) => setEnergyType(v as 'power' | 'air'),
    options: detailed ? ENERGY_TYPE_OPTIONS : ENERGY_OPTIONS,
  };

  return { energyType, setEnergyType, filter } as const;
}
