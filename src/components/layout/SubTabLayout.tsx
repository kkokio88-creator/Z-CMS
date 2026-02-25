import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DynamicIcon } from '../ui/icon';
import { cn } from '../../lib/utils';
import { useUI } from '../../contexts/UIContext';
import { ROUTES, tabKeyFromPath, tabPathFromKey } from '../../config/routeConfig';

interface SubTab {
  key: string;
  label: string;
  icon: string;
}

interface SubTabLayoutProps {
  title: string;
  tabs: SubTab[];
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
  headerRight?: React.ReactNode;
  children: (activeTab: string) => React.ReactNode;
}

export const SubTabLayout: React.FC<SubTabLayoutProps> = ({ title, tabs, defaultTab, onTabChange, headerRight, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeView } = useUI();

  // URL에서 현재 탭 결정
  const segments = location.pathname.split('/').filter(Boolean);
  const urlTabSegment = segments[1]; // e.g., /profit/channel → "channel"
  const urlTabKey = urlTabSegment ? tabKeyFromPath(activeView, urlTabSegment) : undefined;
  const activeTab = urlTabKey ?? defaultTab ?? tabs[0]?.key ?? '';

  // 탭 경로 없이 상위 URL 접근 시 기본 탭으로 리다이렉트
  useEffect(() => {
    if (!urlTabSegment && tabs.length > 0) {
      const firstTab = defaultTab ?? tabs[0].key;
      const route = ROUTES[activeView];
      const path = tabPathFromKey(activeView, firstTab);
      navigate(`${route.path}/${path}`, { replace: true });
    }
  }, [urlTabSegment, tabs, defaultTab, activeView, navigate]);

  // 외부에 현재 탭 알림
  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab]);

  const handleTabChange = (key: string) => {
    const route = ROUTES[activeView];
    const path = tabPathFromKey(activeView, key);
    navigate(`${route.path}/${path}`, { replace: true });
    onTabChange?.(key);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {headerRight && (
        <div className="flex items-center justify-end">
          {headerRight}
        </div>
      )}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary text-primary dark:text-green-400 dark:border-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <DynamicIcon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div>{children(activeTab)}</div>
    </div>
  );
};
