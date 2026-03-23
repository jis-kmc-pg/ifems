import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  RESOLVED: 'bg-green-100 text-[#27AE60] dark:bg-green-900/30 dark:text-[#27AE60]',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '발생',
  ACKNOWLEDGED: '인지',
  RESOLVED: '해소',
};

/**
 * 알림 상태 뱃지 (ALT004/ALT005/ALT006 공통)
 *
 * @param status - ACTIVE | ACKNOWLEDGED | RESOLVED
 */
export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? ''}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
