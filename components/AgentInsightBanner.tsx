import React, { useState } from 'react';
import type { AgentInsight } from '../src/agents/types';
import { AGENT_NAMES, LEVEL_COLORS } from '../src/agents/types';

interface AgentInsightBannerProps {
  insight: AgentInsight;
  onFeedback?: (insightId: string, type: 'helpful' | 'dismissed') => Promise<void>;
  onDetailClick?: (insight: AgentInsight) => void;
  hasFeedback?: boolean;
}

export const AgentInsightBanner: React.FC<AgentInsightBannerProps> = ({
  insight,
  onFeedback,
  onDetailClick,
  hasFeedback = false,
}) => {
  const [feedback, setFeedback] = useState<'helpful' | 'dismissed' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colors = LEVEL_COLORS[insight.level];
  const agentName = AGENT_NAMES[insight.agentId] || insight.agentId;

  const handleFeedback = async (type: 'helpful' | 'dismissed') => {
    if (isSubmitting || feedback || hasFeedback) return;

    setIsSubmitting(true);
    try {
      if (onFeedback) {
        await onFeedback(insight.id, type);
      }
      setFeedback(type);
    } catch (error) {
      console.error('Feedback submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback === 'dismissed') return null;

  const levelIcon = {
    info: 'info',
    warning: 'warning',
    critical: 'error',
  }[insight.level];

  const feedbackGiven = feedback || hasFeedback;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg shadow-sm p-4 mb-4 transition-colors`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-full ${colors.bg} shrink-0`}>
          <span className={`material-icons-outlined ${colors.text}`}>
            {levelIcon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-semibold ${colors.text}`}>
              {insight.title}
            </h3>

            {/* Agent Badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <span className="material-icons-outlined text-[10px] mr-1">smart_toy</span>
              {agentName}
            </span>

            {/* Learned Badge */}
            {feedbackGiven && feedback !== 'dismissed' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="material-icons-outlined text-[10px] mr-1">check</span>
                학습 완료
              </span>
            )}

            {/* Confidence */}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              신뢰도: {Math.round(insight.confidence * 100)}%
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {insight.description}
            {insight.highlight && (
              <span className={`font-semibold ml-1 ${colors.text}`}>
                {insight.highlight}
              </span>
            )}
          </p>

          {/* Suggested Actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {insight.suggestedActions.map((action, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  {action}
                </span>
              ))}
            </div>
          )}

          {/* Feedback Buttons */}
          {!feedbackGiven && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleFeedback('helpful')}
                disabled={isSubmitting}
                className="flex items-center text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
              >
                <span className="material-icons-outlined text-xs mr-1">thumb_up</span>
                유용함 (학습에 반영)
              </button>
              <button
                onClick={() => handleFeedback('dismissed')}
                disabled={isSubmitting}
                className="flex items-center text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <span className="material-icons-outlined text-xs mr-1">thumb_down</span>
                무시
              </button>
            </div>
          )}
        </div>

        {/* Detail Button */}
        {onDetailClick && (
          <button
            onClick={() => onDetailClick(insight)}
            className={`text-sm ${colors.text} font-medium hover:underline whitespace-nowrap shrink-0`}
          >
            상세 분석
          </button>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-right">
        {new Date(insight.timestamp).toLocaleString('ko-KR')}
      </div>
    </div>
  );
};
