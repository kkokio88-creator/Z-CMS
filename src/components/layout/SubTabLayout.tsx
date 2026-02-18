import React, { useState, useEffect } from 'react';

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
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key || '');

  useEffect(() => {
    onTabChange?.(activeTab);
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    onTabChange?.(key);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {headerRight && (
        <div className="flex items-center justify-end">
          {headerRight}
        </div>
      )}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary dark:text-green-400 dark:border-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="material-icons-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div>{children(activeTab)}</div>
    </div>
  );
};
