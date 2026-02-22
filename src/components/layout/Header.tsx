import React from 'react';
import { Menu, Sun, Moon, Bell, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { DATE_RANGE_OPTIONS, getRangeLabel, type DateRangeOption } from '../../utils/dateRange';

interface HeaderProps {
  pageTitle: string;
  toggleDarkMode: () => void;
  isDarkMode: boolean;
  dateRange: DateRangeOption;
  setDateRange: (range: DateRangeOption) => void;
  onNotificationClick: () => void;
  hasUnreadNotifications: boolean;
  onExport: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  toggleDarkMode,
  isDarkMode,
  dateRange,
  setDateRange,
  onNotificationClick,
  hasUnreadNotifications,
  onExport,
  onToggleSidebar,
}) => {
  return (
    <header className="bg-card border-b h-14 flex items-center justify-between px-6 shrink-0 z-10 transition-colors duration-200">
      {/* 왼쪽: 타이틀 + 날짜 필터 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground hidden md:block whitespace-nowrap">
          {pageTitle}
        </h1>
        <div className="flex items-center gap-1">
          {DATE_RANGE_OPTIONS.map(opt => (
            <Button
              key={opt.key}
              variant={dateRange === opt.key ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setDateRange(opt.key)}
              className="px-2.5 py-1 text-xs h-7 rounded-full"
            >
              {opt.label}
            </Button>
          ))}
          <span className="ml-1 text-[11px] text-muted-foreground hidden lg:inline">{getRangeLabel(dateRange)}</span>
        </div>
      </div>

      {/* 오른쪽: 유틸리티 버튼 */}
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNotificationClick}
          className="relative"
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse">
              <span className="sr-only">읽지 않은 알림 있음</span>
            </span>
          )}
        </Button>

        <Button size="sm" onClick={onExport} className="text-xs ml-2">
          <Download className="h-3.5 w-3.5 mr-1" />
          내보내기
        </Button>
      </div>
    </header>
  );
};
