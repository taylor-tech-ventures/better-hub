import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { offsetYearMonth } from '@/shared/lib/date';

type MonthNavProps = {
  yearMonth: string;
  onNavigate: (yearMonth: string) => void;
};

export function MonthNav({ yearMonth, onNavigate }: MonthNavProps) {
  const label = new Date(`${yearMonth}-01`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const isCurrentMonth = yearMonth === new Date().toISOString().slice(0, 7);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onNavigate(offsetYearMonth(yearMonth, -1))}
        className="p-1 rounded hover:bg-muted transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="text-sm font-medium min-w-36 text-center">{label}</span>
      <button
        type="button"
        onClick={() => onNavigate(offsetYearMonth(yearMonth, 1))}
        disabled={isCurrentMonth}
        className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
