import { cn } from '../../lib/utils';

const SIZES = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[2.5px]',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  message?: string;
  className?: string;
}

export default function Spinner({ size = 'md', message, className }: SpinnerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('animate-spin rounded-full border-[#E94560] border-t-transparent', SIZES[size])} />
      {message && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{message}</span>
      )}
    </div>
  );
}
