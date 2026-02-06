import React from 'react';
import type { AgentState } from '../agents/types';
import { AGENT_NAMES } from '../agents/types';

interface AgentStatusIndicatorProps {
  statuses: AgentState[];
  compact?: boolean;
  onClick?: () => void;
}

const STATUS_COLORS = {
  idle: 'bg-green-500',
  processing: 'bg-blue-500 animate-pulse',
  error: 'bg-red-500',
  stopped: 'bg-gray-400',
};

const STATUS_TEXT = {
  idle: '대기 중',
  processing: '분석 중',
  error: '오류',
  stopped: '중지됨',
};

export const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({
  statuses,
  compact = false,
  onClick,
}) => {
  const processingCount = statuses.filter(s => s.status === 'processing').length;
  const errorCount = statuses.filter(s => s.status === 'error').length;
  const totalAgents = statuses.length;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <div className="flex -space-x-1">
          {statuses.slice(0, 4).map(status => (
            <div
              key={status.id}
              className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status.status]} ring-2 ring-white dark:ring-gray-800`}
              title={`${AGENT_NAMES[status.id]}: ${STATUS_TEXT[status.status]}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {processingCount > 0
            ? `${processingCount}개 분석 중`
            : errorCount > 0
              ? `${errorCount}개 오류`
              : `${totalAgents}개 에이전트`}
        </span>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span className="material-icons-outlined text-base">smart_toy</span>
        AI 에이전트 상태
      </h3>

      <div className="space-y-3">
        {statuses.map(status => (
          <AgentStatusRow key={status.id} status={status} />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {statuses.reduce((sum, s) => sum + s.processedTasks, 0)}
            </div>
            <div className="text-xs text-gray-500">총 분석</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {Math.round(
                statuses.reduce((sum, s) => sum + s.successRate, 0) / (statuses.length || 1)
              )}
              %
            </div>
            <div className="text-xs text-gray-500">평균 성공률</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {Math.round(
                statuses.reduce((sum, s) => sum + s.avgProcessingTime, 0) / (statuses.length || 1)
              )}
              ms
            </div>
            <div className="text-xs text-gray-500">평균 처리 시간</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AgentStatusRow: React.FC<{ status: AgentState }> = ({ status }) => {
  const agentName = AGENT_NAMES[status.id] || status.id;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status.status]}`} />
        <span className="text-sm text-gray-700 dark:text-gray-300">{agentName}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{STATUS_TEXT[status.status]}</span>
        <span>{status.processedTasks}건</span>
        <span className="text-green-600 dark:text-green-400">{status.successRate}%</span>
      </div>
    </div>
  );
};

export const AgentStatusMini: React.FC<{
  isConnected: boolean;
  isProcessing: boolean;
  onClick?: () => void;
}> = ({ isConnected, isProcessing, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={isConnected ? '에이전트 연결됨' : '에이전트 연결 끊김'}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          !isConnected ? 'bg-gray-400' : isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
        }`}
      />
      <span className="text-gray-600 dark:text-gray-300">
        {!isConnected ? '연결 끊김' : isProcessing ? '분석 중' : 'AI 연결됨'}
      </span>
    </button>
  );
};
