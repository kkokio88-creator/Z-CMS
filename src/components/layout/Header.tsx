import React from 'react';
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
    <header className="bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 h-14 flex items-center justify-between px-6 shrink-0 z-10 transition-colors duration-200">
      {/* 왼쪽: 타이틀 + 날짜 필터 */}
      <div className="flex items-center gap-4">
        <button
          className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400"
          onClick={onToggleSidebar}
          aria-label="메뉴 열기"
        >
          <span className="material-icons-outlined">menu</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden md:block whitespace-nowrap">
          {pageTitle}
        </h1>
        <div className="flex items-center gap-1">
          {DATE_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                dateRange === opt.key
                  ? 'bg-primary text-white dark:bg-green-600'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-1 text-[11px] text-gray-400 hidden lg:inline">{getRangeLabel(dateRange)}</span>
        </div>
      </div>

      {/* 오른쪽: 유틸리티 버튼 */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleDarkMode}
          className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
          aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <span className="material-icons-outlined text-xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
        </button>

        <button
          onClick={onNotificationClick}
          className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none relative"
          aria-label="알림"
        >
          <span className="material-icons-outlined text-xl">notifications</span>
          {hasUnreadNotifications && (
            <span className="absolute top-0.5 right-0.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 animate-pulse">
              <span className="sr-only">읽지 않은 알림 있음</span>
            </span>
          )}
        </button>

        <button
          onClick={onExport}
          className="bg-primary hover:bg-primary-hover text-white text-xs px-3 py-1.5 rounded shadow-sm flex items-center transition-colors active:transform active:scale-95"
          aria-label="CSV 내보내기"
        >
          <span className="material-icons-outlined text-sm mr-1">download</span>
          내보내기
        </button>
      </div>
    </header>
  );
};
