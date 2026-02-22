import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPrev,
  onNext,
  onGoToPage,
}) => {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-muted-foreground">
        {totalItems}건 중 {startIndex + 1}~{endIndex}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGoToPage(p)}
              className="h-7 w-7 p-0 text-xs"
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
