import React, { useState } from 'react';
import { useAgentContext } from '../src/agents/AgentContext';
import { AgentInsightBanner } from './AgentInsightBanner';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import type { AgentInsight, InsightDomain } from '../src/agents/types';
import { AGENT_NAMES } from '../src/agents/types';

interface AIInsightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onInsightClick?: (insight: AgentInsight) => void;
}

const DOMAIN_FILTERS: { id: InsightDomain | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'bom', label: 'BOM' },
  { id: 'inventory', label: '재고' },
  { id: 'profitability', label: '수익' },
];

export const AIInsightSidebar: React.FC<AIInsightSidebarProps> = ({
  isOpen,
  onClose,
  onInsightClick,
}) => {
  const {
    insights,
    agentStatuses,
    isConnected,
    isLoading,
    submitFeedback,
    triggerAnalysis,
    feedbackSubmitted,
  } = useAgentContext();

  const [activeFilter, setActiveFilter] = useState<InsightDomain | 'all'>('all');

  const filteredInsights = activeFilter === 'all'
    ? insights
    : insights.filter(i => i.domain === activeFilter);

  const criticalCount = insights.filter(i => i.level === 'critical').length;
  const warningCount = insights.filter(i => i.level === 'warning').length;

  const handleFeedback = async (insightId: string, type: 'helpful' | 'dismissed') => {
    await submitFeedback(insightId, type);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => onClose()}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-l-lg shadow-lg z-40 transition-all"
        title="AI 인사이트 열기"
      >
        <span className="material-icons-outlined">auto_awesome</span>
        {(criticalCount > 0 || warningCount > 0) && (
          <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
            {criticalCount + warningCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className="w-80 bg-white dark:bg-surface-dark border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined text-indigo-500">auto_awesome</span>
            AI 에이전트
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <span className="material-icons-outlined text-gray-500">close</span>
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between text-xs mb-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-gray-600 dark:text-gray-400">
              {isConnected ? '연결됨' : '연결 끊김'}
            </span>
          </div>
          <button
            onClick={() => triggerAnalysis('high')}
            disabled={isLoading || !isConnected}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
          >
            <span className={`material-icons-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
              {isLoading ? 'sync' : 'play_arrow'}
            </span>
            분석 실행
          </button>
        </div>

        {/* Alert Summary */}
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex gap-2 mb-3">
            {criticalCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <span className="material-icons-outlined text-[10px] mr-1">error</span>
                긴급 {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <span className="material-icons-outlined text-[10px] mr-1">warning</span>
                주의 {warningCount}
              </span>
            )}
          </div>
        )}

        {/* Domain Filter */}
        <div className="flex gap-1">
          {DOMAIN_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeFilter === filter.id
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredInsights.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <span className="material-icons-outlined text-4xl mb-2 block opacity-50">
              lightbulb
            </span>
            <p className="text-sm">인사이트가 없습니다</p>
            <p className="text-xs mt-1">분석 실행 버튼을 눌러주세요</p>
          </div>
        ) : (
          filteredInsights.slice(0, 20).map((insight) => (
            <AgentInsightBanner
              key={insight.id}
              insight={insight}
              onFeedback={handleFeedback}
              onDetailClick={onInsightClick}
              hasFeedback={feedbackSubmitted.has(insight.id)}
            />
          ))
        )}
      </div>

      {/* Agent Status Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
          에이전트 상태
        </h3>
        <div className="space-y-2">
          {agentStatuses.map((status) => (
            <div key={status.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  status.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                  status.status === 'error' ? 'bg-red-500' :
                  status.status === 'idle' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-gray-700 dark:text-gray-300">
                  {AGENT_NAMES[status.id] || status.id}
                </span>
              </div>
              <span className="text-gray-500">
                {status.processedTasks}건
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

// Toggle button component for use elsewhere
export const AIInsightToggle: React.FC<{
  onClick: () => void;
  insightCount: number;
}> = ({ onClick, insightCount }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
    >
      <span className="material-icons-outlined text-sm">auto_awesome</span>
      <span className="text-sm font-medium">AI</span>
      {insightCount > 0 && (
        <span className="px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-800 rounded-full text-[10px]">
          {insightCount}
        </span>
      )}
    </button>
  );
};
