import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

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

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  active,
  onChange,
  searchPlaceholder = '검색...',
  searchValue,
  onSearchChange,
  className = '',
}) => (
  <div className={cn('flex flex-wrap items-center gap-2 mb-4', className)}>
    {filters.map(f => (
      <Button
        key={f.key}
        variant={active === f.key ? 'default' : 'secondary'}
        size="sm"
        onClick={() => onChange(f.key)}
        className={cn(
          'text-xs h-8',
          active === f.key && f.color ? 'text-white shadow-sm' : ''
        )}
        style={active === f.key && f.color ? { backgroundColor: f.color } : undefined}
      >
        {f.color && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: f.color }}
          />
        )}
        {f.label}
      </Button>
    ))}

    {onSearchChange !== undefined && (
      <div className="ml-auto flex items-center gap-1.5 bg-secondary rounded-lg px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={searchValue ?? ''}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-auto border-0 bg-transparent p-0 text-xs w-36 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    )}
  </div>
);

export default FilterBar;
