import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribe } from '../../lib/toast';
import type { ToastData, ToastType } from '../../lib/toast';

const ICON_MAP: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLE_MAP: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    icon: 'text-emerald-500',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-700',
    icon: 'text-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    icon: 'text-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    icon: 'text-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
  },
};

interface ToastItemProps {
  data: ToastData;
  onRemove: (id: string) => void;
}

function ToastItem({ data, onRemove }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const style = STYLE_MAP[data.type];
  const Icon = ICON_MAP[data.type];

  const handleRemove = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(data.id), 200);
  }, [data.id, onRemove]);

  useEffect(() => {
    if (data.duration <= 0) return;
    const timer = setTimeout(handleRemove, data.duration);
    return () => clearTimeout(timer);
  }, [data.duration, handleRemove]);

  return (
    <div
      className={`
        flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        min-w-[300px] max-w-[420px]
        ${style.bg} ${style.border}
        transition-all duration-200 ease-out
        ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <Icon size={16} className={`${style.icon} flex-shrink-0 mt-0.5`} />
      <span className={`text-sm flex-1 ${style.text}`}>{data.message}</span>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * 전역 Toast 컨테이너
 *
 * main.tsx 또는 App.tsx에 한 번만 마운트:
 * ```tsx
 * <ToastContainer />
 * ```
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    return subscribe((t) => {
      setToasts((prev) => [...prev, t]);
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem data={t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
