import React, { useState } from 'react';
import { AgentInsightBanner } from './AgentInsightBanner';
import type { AgentInsight, InsightDomain } from '../agents/types';

interface AgentInsightPanelProps {
  insights: AgentInsight[];
  onFeedback?: (insightId: string, type: 'helpful' | 'dismissed') => Promise<void>;
  onDetailClick?: (insight: AgentInsight) => void;
  feedbackSubmitted?: Set<string>;
  maxVisible?: number;
}

const DOMAIN_TABS: { id: InsightDomain | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '전체', icon: 'dashboard' },
  { id: 'bom', label: 'BOM', icon: 'precision_manufacturing' },
  { id: 'waste', label: '폐기물', icon: 'delete' },
  { id: 'inventory', label: '재고', icon: 'inventory_2' },
  { id: 'profitability', label: '수익성', icon: 'trending_up' },
  { id: 'general', label: '종합', icon: 'analytics' },
];

export const AgentInsightPanel: React.FC<AgentInsightPanelProps> = ({
  insights,
  onFeedback,
  onDetailClick,
  feedbackSubmitted = new Set(),
  maxVisible = 10,
}) => {
  const [activeTab, setActiveTab] = useState<InsightDomain | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  const filteredInsights = insights.filter(i => activeTab === 'all' || i.domain === activeTab);

  const visibleInsights = showAll ? filteredInsights : filteredInsights.slice(0, maxVisible);

  const criticalCount = insights.filter(i => i.level === 'critical').length;
  const warningCount = insights.filter(i => i.level === 'warning').length;

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined text-indigo-500">auto_awesome</span>
            AI 인사이트
          </h2>

          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                긴급 {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                주의 {warningCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {DOMAIN_TABS.map(tab => {
            const count =
              tab.id === 'all' ? insights.length : insights.filter(i => i.domain === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="material-icons-outlined text-xs">{tab.icon}</span>
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                      activeTab === tab.id
                        ? 'bg-indigo-200 dark:bg-indigo-800'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto">
        {visibleInsights.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <span className="material-icons-outlined text-4xl mb-2 block opacity-50">
              auto_awesome
            </span>
            <p className="text-sm">
              {activeTab === 'all'
                ? '아직 인사이트가 없습니다'
                : `${activeTab} 관련 인사이트가 없습니다`}
            </p>
          </div>
        ) : (
          <>
            {visibleInsights.map(insight => (
              <AgentInsightBanner
                key={insight.id}
                insight={insight}
                onFeedback={onFeedback}
                onDetailClick={onDetailClick}
                hasFeedback={feedbackSubmitted.has(insight.id)}
              />
            ))}

            {filteredInsights.length > maxVisible && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {filteredInsights.length - maxVisible}개 더 보기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
