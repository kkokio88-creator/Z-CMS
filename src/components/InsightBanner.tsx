import React, { useState } from 'react';
import { AnomalyInsight } from '../types';

export const InsightBanner = ({ insight }: { insight: AnomalyInsight }) => {
  const [feedback, setFeedback] = useState<'helpful' | 'dismissed' | null>(null);

  const handleFeedback = (type: 'helpful' | 'dismissed') => {
    setFeedback(type);
    // In a real app, this would trigger an API call to update the AI model
    console.log(`AI Feedback recorded: ${type}`);
  };

  if (feedback === 'dismissed') return null;

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 flex items-start gap-4 transition-colors">
      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full shrink-0">
        <span className="material-icons-outlined text-indigo-600 dark:text-indigo-400">
          auto_awesome
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {insight.title}
          {feedback === 'helpful' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <span className="material-icons-outlined text-[10px] mr-1">check</span> 학습 완료
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {insight.description}{' '}
          <span className="text-red-600 dark:text-red-400 font-medium">{insight.highlight}</span>{' '}
          이는 표준 BOM에서 크게 벗어난 수치이며, 혼합 밸브 보정 문제일 가능성이 있습니다.
        </p>

        {feedback === null && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleFeedback('helpful')}
              className="flex items-center text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <span className="material-icons-outlined text-xs mr-1">thumb_up</span>
              유용함 (기준 반영)
            </button>
            <button
              onClick={() => handleFeedback('dismissed')}
              className="flex items-center text-xs px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="material-icons-outlined text-xs mr-1">thumb_down</span>
              무시
            </button>
          </div>
        )}
      </div>
      <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline whitespace-nowrap">
        상세 분석
      </button>
    </div>
  );
};
