import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export default function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
        aria-label="모달 닫기"
        tabIndex={-1}
      />
      <div className={cn('relative bg-white dark:bg-[#16213E] rounded-xl shadow-2xl w-full', SIZES[size], className)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors" aria-label="닫기">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}

/** 확인/취소 모달 */
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = '확인', confirmVariant = 'primary' }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmText?: string; confirmVariant?: 'primary' | 'danger';
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
          취소
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={`px-4 py-2 text-sm rounded text-white hover:opacity-90 ${
            confirmVariant === 'danger' ? 'bg-red-600' : 'bg-[#27AE60]'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
