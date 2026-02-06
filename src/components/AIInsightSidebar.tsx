import React, { useState } from 'react';
import { useAgentContext } from '../agents/AgentContext';
import { AgentInsightBanner } from './AgentInsightBanner';
import { DebatePanel } from './DebatePanel';
import type { AgentInsight, InsightDomain } from '../agents/types';
import { AGENT_NAMES } from '../agents/types';

interface AIInsightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onInsightClick?: (insight: AgentInsight) => void;
}

type TabId = 'insights' | 'debates' | 'agents';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'insights', label: '인사이트', icon: 'lightbulb' },
  { id: 'debates', label: '토론', icon: 'forum' },
  { id: 'agents', label: '에이전트', icon: 'smart_toy' },
];

const DOMAIN_FILTERS: { id: InsightDomain | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'bom', label: 'BOM' },
  { id: 'inventory', label: '재고' },
  { id: 'profitability', label: '수익' },
  { id: 'business', label: '사업' },
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
    activeDebates,
  } = useAgentContext();

  const [activeTab, setActiveTab] = useState<TabId>('insights');
  const [activeFilter, setActiveFilter] = useState<InsightDomain | 'all'>('all');

  const filteredInsights =
    activeFilter === 'all' ? insights : insights.filter(i => i.domain === activeFilter);

  const criticalCount = insights.filter(i => i.level === 'critical').length;
  const warningCount = insights.filter(i => i.level === 'warning').length;
  const activeDebateCount = activeDebates.length;

  const handleFeedback = async (insightId: string, type: 'helpful' | 'dismissed') => {
    await submitFeedback(insightId, type);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => onClose()}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-l-lg shadow-lg z-40 transition-all"
        title="AI 에이전트 열기"
      >
        <span className="material-icons-outlined">auto_awesome</span>
        {(criticalCount > 0 || warningCount > 0 || activeDebateCount > 0) && (
          <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
            {criticalCount + warningCount + activeDebateCount}
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
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <span className="material-icons-outlined text-gray-500">close</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all
                ${activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }
              `}
            >
              <span className="material-icons-outlined text-sm">{tab.icon}</span>
              {tab.label}
              {/* 뱃지 */}
              {tab.id === 'insights' && (criticalCount > 0 || warningCount > 0) && (
                <span className="px-1 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                  {criticalCount + warningCount}
                </span>
              )}
              {tab.id === 'debates' && activeDebateCount > 0 && (
                <span className="px-1 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full animate-pulse">
                  {activeDebateCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 인사이트 탭 */}
        {activeTab === 'insights' && (
          <>
            {/* Filter + Actions */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                {/* Alert Summary */}
                {(criticalCount > 0 || warningCount > 0) && (
                  <div className="flex gap-2">
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
                <button
                  onClick={() => triggerAnalysis('high')}
                  disabled={isLoading || !isConnected}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors text-xs"
                >
                  <span className={`material-icons-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
                    {isLoading ? 'sync' : 'play_arrow'}
                  </span>
                  분석 실행
                </button>
              </div>

              {/* Domain Filter */}
              <div className="flex gap-1 flex-wrap">
                {DOMAIN_FILTERS.map(filter => (
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
                filteredInsights
                  .slice(0, 20)
                  .map(insight => (
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
          </>
        )}

        {/* 토론 탭 */}
        {activeTab === 'debates' && (
          <div className="flex-1 overflow-y-auto p-4">
            <DebatePanel />
          </div>
        )}

        {/* 에이전트 탭 */}
        {activeTab === 'agents' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Agent Status Grid */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                  에이전트 상태
                </h3>
                <div className="space-y-2">
                  {agentStatuses.map(status => (
                    <div
                      key={status.id}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              status.status === 'processing'
                                ? 'bg-blue-500 animate-pulse'
                                : status.status === 'error'
                                  ? 'bg-red-500'
                                  : status.status === 'idle'
                                    ? 'bg-green-500'
                                    : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {AGENT_NAMES[status.id] || status.id}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            status.status === 'processing'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : status.status === 'idle'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : status.status === 'error'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {status.status === 'processing'
                            ? '처리중'
                            : status.status === 'idle'
                              ? '대기'
                              : status.status === 'error'
                                ? '오류'
                                : '중지'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>처리: {status.processedTasks}건</span>
                        <span>성공률: {(status.successRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800">
                <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                  시스템 현황
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {agentStatuses.filter(s => s.status === 'idle').length}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">활성</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {insights.length}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">인사이트</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {activeDebates.length}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">토론</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
