/**
 * 전역 Toast 알림 시스템
 *
 * React 컴포넌트 외부에서도 호출 가능한 모듈 레벨 토스트.
 *
 * @example
 * import { toast } from '../lib/toast';
 * toast.success('저장되었습니다.');
 * toast.error('오류가 발생했습니다.');
 * toast.warning('시작일이 종료일 이후입니다.');
 * toast.info('데이터를 불러오는 중...');
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0이면 수동 닫기
}

type Listener = (t: ToastData) => void;

let listeners: Listener[] = [];
let idCounter = 0;

function emit(type: ToastType, message: string, duration?: number) {
  const defaultDuration = type === 'error' ? 6000 : 4000;
  const data: ToastData = {
    id: `toast-${++idCounter}`,
    type,
    message,
    duration: duration ?? defaultDuration,
  };
  listeners.forEach((fn) => fn(data));
}

/** 토스트 리스너 등록 (ToastContainer 내부에서 사용) */
export function subscribe(fn: Listener) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** 전역 toast 호출 API */
export const toast = {
  success: (message: string, duration?: number) => emit('success', message, duration),
  error: (message: string, duration?: number) => emit('error', message, duration),
  warning: (message: string, duration?: number) => emit('warning', message, duration),
  info: (message: string, duration?: number) => emit('info', message, duration),
};
