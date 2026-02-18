import React from 'react';

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
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {totalItems}건 중 {startIndex + 1}~{endIndex}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="material-icons-outlined text-sm">chevron_left</span>
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-xs text-gray-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onGoToPage(p)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                p === currentPage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="material-icons-outlined text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  );
};
