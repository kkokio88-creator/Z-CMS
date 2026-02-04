/**
 * DebateViewer 컴포넌트
 * 변증법적 토론(정-반-합) 타임라인 시각화
 */

import React, { useState, useEffect } from 'react';

// 토론 관련 타입
interface DebateRound {
  id: string;
  phase: 'thesis' | 'antithesis' | 'synthesis';
  role: 'optimist' | 'pessimist' | 'mediator';
  agentId: string;
  content: {
    position: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    suggestedActions?: string[];
  };
  timestamp: string;
}

interface GovernanceReview {
  id: string;
  reviewerId: string;
  approved: boolean;
  score: number;
  issues?: { type: string; severity: string; description: string }[];
  recommendations?: string[];
  timestamp: string;
}

interface DebateRecord {
  id: string;
  domain: string;
  team: string;
  topic: string;
  currentPhase: string;
  thesis?: DebateRound;
  antithesis?: DebateRound;
  synthesis?: DebateRound;
  finalDecision?: {
    recommendation: string;
    reasoning: string;
    confidence: number;
    actions: string[];
    priority: string;
  };
  governanceReviews?: GovernanceReview[];
  startedAt: string;
  completedAt?: string;
  isActive: boolean;
}

interface DebateViewerProps {
  debate: DebateRecord;
  onClose?: () => void;
  onFeedback?: (debateId: string, type: 'helpful' | 'dismissed') => void;
}

const phaseLabels: Record<string, { label: string; icon: string }> = {
  thesis: { label: '정(正)', icon: '💡' },
  antithesis: { label: '반(反)', icon: '⚠️' },
  synthesis: { label: '합(合)', icon: '✨' }
};

const roleLabels: Record<string, string> = {
  optimist: '혁신가',
  pessimist: '검증가',
  mediator: '조율자'
};

const domainLabels: Record<string, string> = {
  bom: 'BOM 분석',
  waste: '폐기물',
  inventory: '재고',
  profitability: '수익성',
  general: '일반'
};

export const DebateViewer: React.FC<DebateViewerProps> = ({
  debate,
  onClose,
  onFeedback
}) => {
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [showGovernance, setShowGovernance] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPhaseStatus = (phase: 'thesis' | 'antithesis' | 'synthesis') => {
    const round = debate[phase];
    if (round) return 'completed';
    if (debate.currentPhase === phase) return 'active';
    return 'pending';
  };

  const renderRound = (round: DebateRound | undefined, phase: 'thesis' | 'antithesis' | 'synthesis') => {
    const status = getPhaseStatus(phase);
    const { label, icon } = phaseLabels[phase];
    const isExpanded = expandedRound === phase;

    return (
      <div
        className={`
          relative p-4 rounded-lg border-2 transition-all cursor-pointer
          ${status === 'completed' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
          ${status === 'active' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 animate-pulse' : ''}
          ${status === 'pending' ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50' : ''}
        `}
        onClick={() => setExpandedRound(isExpanded ? null : phase)}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <span className="font-bold text-lg">{label}</span>
            {round && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {roleLabels[round.role]}
              </span>
            )}
          </div>
          {round && (
            <div className="flex items-center gap-2">
              <span className={`
                px-2 py-1 rounded text-sm font-medium
                ${round.content.confidence >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                ${round.content.confidence >= 60 && round.content.confidence < 80 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
                ${round.content.confidence < 60 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : ''}
              `}>
                신뢰도 {round.content.confidence}%
              </span>
            </div>
          )}
        </div>

        {/* 입장 */}
        {round ? (
          <div>
            <p className="text-gray-800 dark:text-gray-200 font-medium">
              {round.content.position}
            </p>

            {/* 확장된 상세 내용 */}
            {isExpanded && (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">추론</h4>
                  <p className="text-gray-700 dark:text-gray-300">{round.content.reasoning}</p>
                </div>

                {round.content.evidence.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">근거</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {round.content.evidence.map((e, i) => (
                        <li key={i} className="text-gray-700 dark:text-gray-300">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {round.content.suggestedActions && round.content.suggestedActions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">권장 조치</h4>
                    <ul className="list-decimal list-inside space-y-1">
                      {round.content.suggestedActions.map((a, i) => (
                        <li key={i} className="text-gray-700 dark:text-gray-300">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-gray-500 dark:text-gray-500 text-xs">
                  {formatDate(round.timestamp)} • {round.agentId}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">
            {status === 'active' ? '진행 중...' : '대기 중'}
          </p>
        )}

        {/* 연결선 */}
        {phase !== 'synthesis' && (
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden max-w-2xl w-full">
      {/* 헤더 */}
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                {domainLabels[debate.domain] || debate.domain}
              </span>
              {debate.isActive && (
                <span className="bg-green-400 px-2 py-0.5 rounded text-sm animate-pulse">
                  진행중
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold mt-1">{debate.topic}</h2>
            <p className="text-white/80 text-sm">
              {debate.team} • {formatDate(debate.startedAt)}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 토론 타임라인 */}
      <div className="p-6 space-y-6">
        {renderRound(debate.thesis, 'thesis')}
        {renderRound(debate.antithesis, 'antithesis')}
        {renderRound(debate.synthesis, 'synthesis')}
      </div>

      {/* 최종 결정 */}
      {debate.finalDecision && (
        <div className="px-6 pb-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-bold text-indigo-800 dark:text-indigo-200">최종 결정</h3>
              <span className={`
                px-2 py-0.5 rounded text-xs
                ${debate.finalDecision.priority === 'critical' ? 'bg-red-500 text-white' : ''}
                ${debate.finalDecision.priority === 'high' ? 'bg-orange-500 text-white' : ''}
                ${debate.finalDecision.priority === 'medium' ? 'bg-yellow-500 text-white' : ''}
                ${debate.finalDecision.priority === 'low' ? 'bg-gray-500 text-white' : ''}
              `}>
                {debate.finalDecision.priority}
              </span>
            </div>
            <p className="text-gray-800 dark:text-gray-200 font-medium mb-2">
              {debate.finalDecision.recommendation}
            </p>
            {debate.finalDecision.actions.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">실행 항목</h4>
                <ul className="mt-1 space-y-1">
                  {debate.finalDecision.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-indigo-500">→</span>
                      <span className="text-gray-700 dark:text-gray-300">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 거버넌스 검토 */}
      {debate.governanceReviews && debate.governanceReviews.length > 0 && (
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowGovernance(!showGovernance)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <span className="material-icons-outlined text-base">
              {showGovernance ? 'expand_less' : 'expand_more'}
            </span>
            거버넌스 검토 ({debate.governanceReviews.length})
          </button>

          {showGovernance && (
            <div className="mt-2 space-y-2">
              {debate.governanceReviews.map((review) => (
                <div
                  key={review.id}
                  className={`
                    p-3 rounded-lg text-sm
                    ${review.approved ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {review.reviewerId === 'qa-specialist' ? 'QA Specialist' : 'Compliance Auditor'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{review.score}/100</span>
                      <span className={review.approved ? 'text-green-600' : 'text-red-600'}>
                        {review.approved ? '✓ 승인' : '✗ 거부'}
                      </span>
                    </div>
                  </div>
                  {review.issues && review.issues.length > 0 && (
                    <ul className="text-red-600 dark:text-red-400 text-xs mt-1">
                      {review.issues.map((issue, i) => (
                        <li key={i}>• {issue.description}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 피드백 버튼 */}
      {onFeedback && debate.finalDecision && (
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() => onFeedback(debate.id, 'helpful')}
            className="flex-1 py-2 px-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            👍 도움됨
          </button>
          <button
            onClick={() => onFeedback(debate.id, 'dismissed')}
            className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            👎 관련없음
          </button>
        </div>
      )}
    </div>
  );
};

export default DebateViewer;
