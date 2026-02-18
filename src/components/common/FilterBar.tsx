import React from 'react';

export interface FilterOption {
  key: string;
  label: string;
  /** 컬러 도트 표시용 색상 (선택) */
  color?: string;
}

export interface FilterBarProps {
  filters: FilterOption[];
  active: string;
  onChange: (key: string) => void;
  /** 추가 검색 입력창 플레이스홀더 */
  searchPlaceholder?: string;
  /** 검색 입력값 */
  searchValue?: string;
  /** 검색 입력 변경 핸들러 */
  onSearchChange?: (value: string) => void;
  className?: string;
}

/**
 * FilterBar — 공통 탭 필터 컴포넌트
 *
 * CostManagementView 및 ProductionBomView 의 로컬 FilterBar 패턴을 통합한 범용 버전.
 * color 없이 사용하면 CostManagementView 스타일, color 포함 시 ProductionBomView 스타일로 렌더.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  active,
  onChange,
  searchPlaceholder = '검색...',
  searchValue,
  onSearchChange,
  className = '',
}) => (
  <div className={`flex flex-wrap items-center gap-2 mb-4 ${className}`}>
    {filters.map(f => (
      <button
        key={f.key}
        onClick={() => onChange(f.key)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
          active === f.key
            ? f.color
              ? 'text-white shadow-sm'
              : 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        style={active === f.key && f.color ? { backgroundColor: f.color } : undefined}
      >
        {f.color && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: f.color }}
          />
        )}
        {f.label}
      </button>
    ))}

    {onSearchChange !== undefined && (
      <div className="ml-auto flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-2.5 py-1.5">
        <span className="material-icons-outlined text-gray-400 dark:text-gray-500 text-sm">search</span>
        <input
          type="text"
          value={searchValue ?? ''}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="bg-transparent text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 outline-none w-36"
        />
      </div>
    )}
  </div>
);

export default FilterBar;
