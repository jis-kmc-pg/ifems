import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { COLORS } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 상태 → 색상
export function getStatusColor(status: 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE'): string {
  const map = {
    NORMAL: COLORS.normal,
    WARNING: COLORS.warning,
    DANGER: COLORS.danger,
    OFFLINE: COLORS.offline,
  };
  return map[status];
}

// 상태 → Tailwind 클래스
export function getStatusBgClass(status: 'NORMAL' | 'WARNING' | 'DANGER' | 'OFFLINE'): string {
  const map = {
    NORMAL: 'bg-green-500',
    WARNING: 'bg-amber-500',
    DANGER: 'bg-red-500',
    OFFLINE: 'bg-gray-400',
  };
  return map[status];
}

// 증감율 → 상태
export function getChangeStatus(change: number, inverse = false): 'up' | 'down' | 'neutral' {
  if (change > 0) return inverse ? 'down' : 'up';
  if (change < 0) return inverse ? 'up' : 'down';
  return 'neutral';
}

// 숫자 포맷 (천 단위 구분)
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// 퍼센트 포맷
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// kWh 포맷
export function formatKwh(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
  return `${value.toFixed(2)} kWh`;
}

// 에어 포맷
export function formatAir(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)} ML`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} KL`;
  return `${value.toFixed(0)} L`;
}

// 날짜 포맷
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// 시간 포맷
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

// 시계열 데이터 생성 (목업용)
export function generateTimeSeriesData(
  hours: number,
  intervalMinutes: number,
  baseValue: number,
  variance: number
): Array<{ time: string; timestamp: string; current: number; prev: number }> {
  const points = (hours * 60) / intervalMinutes;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return Array.from({ length: points }, (_, i) => {
    const time = new Date(now.getTime() + i * intervalMinutes * 60000);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const timestamp = time.toISOString(); // ✅ API용 ISO8601 형식 추가
    const noise = (Math.random() - 0.5) * 2 * variance;
    const prevNoise = (Math.random() - 0.5) * 2 * variance;
    return {
      time: timeStr,          // 표시용: "HH:mm"
      timestamp,              // API용: "2026-03-03T05:15:00.000Z"
      current: Math.max(0, baseValue + noise),
      prev: Math.max(0, baseValue + prevNoise),
    };
  });
}

// 정렬 함수
export function sortBy<T>(arr: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });
}

// Excel export (placeholder)
export function exportToExcel(data: unknown[], filename: string): void {
  console.log(`[Export] ${filename}`, data);
  alert(`Excel 내보내기: ${filename}.xlsx (API 연동 후 활성화)`);
}

// 이미지 export (placeholder)
export function exportToImage(elementId: string, filename: string): void {
  console.log(`[Export Image] ${elementId} → ${filename}`);
  alert(`이미지 내보내기: ${filename}.png (API 연동 후 활성화)`);
}

/**
 * 차트 데이터 다운샘플링
 * 데이터가 maxPoints를 초과하면 균등하게 샘플링하여 렌더링 성능 향상
 * @param data 원본 데이터 배열
 * @param maxPoints 최대 데이터 포인트 수 (기본: 500)
 * @returns 다운샘플링된 데이터 배열
 */
export function downsampleChartData<T>(data: T[], maxPoints = 500): T[] {
  if (!data || data.length <= maxPoints) {
    return data;
  }

  const step = data.length / maxPoints;
  const sampled: T[] = [];

  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.floor(i * step);
    sampled.push(data[idx]);
  }

  // 마지막 데이터 포인트는 항상 포함
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled[sampled.length - 1] = data[data.length - 1];
  }

  return sampled;
}
