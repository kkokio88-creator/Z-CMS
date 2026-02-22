/**
 * DebateMiniCard 컴포넌트
 * 토론 요약 카드 - 진행 상황을 시각적으로 표시
 */

import React from 'react';
import type { DebateRecord, DebatePhase } from '../../agents/types';
import { TEAM_NAMES, DOMAIN_NAMES } from '../../agents/types';
import { cn } from '../../lib/utils';

interface DebateMiniCardProps {
  debate: DebateRecord;
  onClick?: (debate: DebateRecord) => void;
}

const phaseProgress: Record<DebatePhase, number> = {
  pending: 0,
  thesis: 25,
  antithesis: 50,
  synthesis: 75,
  governance_review: 90,
  complete: 100,
};

const phaseLabels: Record<DebatePhase, string> = {
  pending: '대기',
  thesis: '정(正)',
  antithesis: '반(反)',
  synthesis: '합(合)',
  governance_review: '검토',
  complete: '완료',
};

export const DebateMiniCard: React.FC<DebateMiniCardProps> = ({ debate, onClick }) => {
  const progress = phaseProgress[debate.currentPhase] || 0;
  const isActive = debate.currentPhase !== 'complete';
  const teamName = TEAM_NAMES[debate.team] || debate.team;

  // 진행 바 세그먼트
  const segments: { phase: DebatePhase; label: string }[] = [
    { phase: 'thesis', label: '정' },
    { phase: 'antithesis', label: '반' },
    { phase: 'synthesis', label: '합' },
  ];

  const getSegmentStatus = (segmentPhase: DebatePhase): 'completed' | 'active' | 'pending' => {
    const segmentProgress = phaseProgress[segmentPhase];
    const currentProgress = phaseProgress[debate.currentPhase];

    if (currentProgress > segmentProgress) return 'completed';
    if (currentProgress === segmentProgress) return 'active';
    return 'pending';
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md',
        isActive
          ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-border bg-muted/50'
      )}
      onClick={() => onClick?.(debate)}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {teamName}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              진행중
            </span>
          )}
        </div>
        {debate.finalDecision && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              debate.finalDecision.confidence >= 80
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : debate.finalDecision.confidence >= 60
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            )}
          >
            {debate.finalDecision.confidence}%
          </span>
        )}
      </div>

      {/* 토픽 */}
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 line-clamp-1">
        {debate.topic}
      </p>

      {/* 진행 바 */}
      <div className="flex items-center gap-1">
        {segments.map((segment, index) => {
          const status = getSegmentStatus(segment.phase);
          return (
            <React.Fragment key={segment.phase}>
              {/* 세그먼트 */}
              <div className="flex-1 relative">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    status === 'completed' && 'bg-indigo-500',
                    status === 'active' && 'bg-indigo-400 animate-pulse',
                    status === 'pending' && 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
                <span
                  className={cn(
                    'absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px]',
                    status === 'active'
                      ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {segment.label}
                </span>
              </div>
              {/* 연결점 */}
              {index < segments.length - 1 && (
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    getSegmentStatus(segments[index + 1].phase) !== 'pending'
                      ? 'bg-indigo-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 퍼센트 표시 */}
      <div className="text-right mt-4 text-xs text-muted-foreground">
        {progress}%
      </div>
    </div>
  );
};

export default DebateMiniCard;
