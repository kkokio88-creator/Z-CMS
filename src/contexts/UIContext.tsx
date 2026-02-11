/**
 * UI Context — UI 상태 전역 관리
 * 뷰 전환, 다크모드, 날짜 범위, 모달 등 UI 상태를 전역 제공합니다.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { DateRangeOption } from '../utils/dateRange';

export type ViewType =
  | 'home'
  | 'profit'
  | 'sales'
  | 'cost'
  | 'production'
  | 'inventory'
  | 'settings';

export interface UIContextType {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  activeSubTab: string | null;
  setActiveSubTab: (tab: string | null) => void;
  dateRange: DateRangeOption;
  setDateRange: (range: DateRangeOption) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  settingsDirty: boolean;
  setSettingsDirty: (dirty: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

interface UIProviderProps {
  children: ReactNode;
  value: UIContextType;
}

export function UIProvider({ children, value }: UIProviderProps) {
  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

/** UI 상태에 접근하는 훅 */
export function useUI(): UIContextType {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error('useUI must be used within UIProvider');
  }
  return ctx;
}
