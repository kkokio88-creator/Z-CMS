import React from 'react';
import { SSEStatusIndicator } from './SSEStatusIndicator';

interface HeaderProps {
  toggleDarkMode: () => void;
  isDarkMode: boolean;
  dateRange: string;
  setDateRange: (range: string) => void;
  onNotificationClick: () => void;
  hasUnreadNotifications: boolean;
  onExport: () => void; // New Prop
}

export const Header: React.FC<HeaderProps> = ({
  toggleDarkMode,
  isDarkMode,
  dateRange,
  setDateRange,
  onNotificationClick,
  hasUnreadNotifications,
  onExport,
}) => {
  return (
    <header className="bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 shrink-0 z-10 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <span className="material-icons-outlined">menu</span>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white hidden md:block">
          폐기 및 BOM 차이 분석
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* Global Date Filter */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-1.5 border border-gray-200 dark:border-gray-600">
          <span className="material-icons-outlined text-gray-500 dark:text-gray-300 text-sm mr-2">
            calendar_today
          </span>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none border-none p-0 cursor-pointer"
          >
            <option value="7days">최근 7일</option>
            <option value="30days">최근 30일</option>
            <option value="month">이번 달</option>
          </select>
        </div>

        <div className="relative hidden sm:block">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-icons-outlined text-gray-400 text-lg">search</span>
          </span>
          <input
            type="text"
            className="block w-48 pl-10 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out"
            placeholder="분석 검색..."
          />
        </div>

        <SSEStatusIndicator />

        <button
          onClick={toggleDarkMode}
          className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
        >
          <span className="material-icons-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
        </button>

        <button
          onClick={onNotificationClick}
          className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary relative"
        >
          <span className="material-icons-outlined">notifications</span>
          {hasUnreadNotifications && (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={onExport}
          className="bg-primary hover:bg-primary-hover text-white text-sm px-4 py-2 rounded shadow-sm flex items-center transition-colors active:transform active:scale-95"
        >
          <span className="material-icons-outlined text-sm mr-2">download</span>
          내보내기
        </button>
      </div>
    </header>
  );
};
