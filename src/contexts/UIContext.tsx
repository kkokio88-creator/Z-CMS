/**
 * UI Context — UI 상태 전역 관리
 * 뷰 전환, 다크모드, 날짜 범위, 모달 등 UI 상태를 전역 제공합니다.
 * UIProvider가 모든 상태를 내부적으로 소유합니다.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
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
  insightMode: boolean;
  setInsightMode: (mode: boolean) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  pendingView: ViewType | null;
  confirmNavigateAway: () => void;
  cancelNavigateAway: () => void;
}

const UIContext = createContext<UIContextType | null>(null);

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('z-cms-dark') === 'true'; } catch { return false; }
  });
  const [activeView, setActiveViewRaw] = useState<ViewType>('home');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30days');
  const [insightMode, setInsightMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<ViewType | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try { localStorage.setItem('z-cms-dark', String(isDarkMode)); } catch {}
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  const handleSetActiveView = useCallback((view: ViewType) => {
    if (settingsDirty && activeView === 'settings' && view !== 'settings') {
      setPendingView(view);
      return;
    }
    setActiveViewRaw(view);
    setActiveSubTab(null);
    setIsSidebarOpen(false);
  }, [settingsDirty, activeView]);

  const confirmNavigateAway = useCallback(() => {
    if (pendingView) {
      setSettingsDirty(false);
      setActiveViewRaw(pendingView);
      setActiveSubTab(null);
      setPendingView(null);
    }
  }, [pendingView]);

  const cancelNavigateAway = useCallback(() => {
    setPendingView(null);
  }, []);

  const value = useMemo<UIContextType>(() => ({
    activeView,
    setActiveView: handleSetActiveView,
    activeSubTab,
    setActiveSubTab,
    dateRange,
    setDateRange,
    isDarkMode,
    toggleDarkMode,
    settingsDirty,
    setSettingsDirty,
    insightMode,
    setInsightMode,
    isSidebarOpen,
    toggleSidebar,
    pendingView,
    confirmNavigateAway,
    cancelNavigateAway,
  }), [activeView, activeSubTab, dateRange, isDarkMode, settingsDirty, insightMode, isSidebarOpen, pendingView, handleSetActiveView, toggleDarkMode, toggleSidebar, confirmNavigateAway, cancelNavigateAway]);

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
