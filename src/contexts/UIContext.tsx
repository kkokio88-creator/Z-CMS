/**
 * UI Context — UI 상태 전역 관리
 * 뷰 전환은 React Router가 담당하며, 이 컨텍스트는 다크모드, 날짜 범위, 사이드바 등
 * 라우터와 무관한 UI 상태를 전역 제공합니다.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { DateRangeOption } from '../utils/dateRange';
import { viewFromPath, tabKeyFromPath, ROUTES } from '../config/routeConfig';

export type ViewType =
  | 'home'
  | 'profit'
  | 'sales'
  | 'cost'
  | 'production'
  | 'inventory'
  | 'settings';

export interface UIContextType {
  /** 현재 활성 뷰 (URL에서 파생) */
  activeView: ViewType;
  /** URL 기반 네비게이션 */
  setActiveView: (view: ViewType) => void;
  /** 현재 활성 서브탭 (URL에서 파생) */
  activeSubTab: string | null;
  /** 서브탭 변경 (URL 업데이트) */
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
  const location = useLocation();
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('z-cms-dark') === 'true'; } catch { return false; }
  });
  const [dateRange, setDateRange] = useState<DateRangeOption>('30days');
  const [insightMode, setInsightMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<ViewType | null>(null);

  // URL에서 activeView와 activeSubTab 파생
  const activeView = useMemo(() => viewFromPath(location.pathname), [location.pathname]);
  const activeSubTab = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return tabKeyFromPath(activeView, segments[1]) ?? null;
    }
    return null;
  }, [location.pathname, activeView]);

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
    const route = ROUTES[view];
    navigate(route.path);
    setIsSidebarOpen(false);
  }, [settingsDirty, activeView, navigate]);

  const setActiveSubTab = useCallback((tab: string | null) => {
    if (!tab) return;
    const route = ROUTES[activeView];
    const tabDef = route.tabs?.find(t => t.key === tab);
    if (tabDef) {
      navigate(`${route.path}/${tabDef.path}`, { replace: true });
    }
  }, [activeView, navigate]);

  const confirmNavigateAway = useCallback(() => {
    if (pendingView) {
      setSettingsDirty(false);
      const route = ROUTES[pendingView];
      navigate(route.path);
      setPendingView(null);
    }
  }, [pendingView, navigate]);

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
  }), [activeView, activeSubTab, dateRange, isDarkMode, settingsDirty, insightMode, isSidebarOpen, pendingView, handleSetActiveView, setActiveSubTab, toggleDarkMode, toggleSidebar, confirmNavigateAway, cancelNavigateAway]);

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
