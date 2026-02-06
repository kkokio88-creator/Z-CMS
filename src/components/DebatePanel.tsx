/**
 * DebatePanel 컴포넌트
 * 토론 목록 및 시작 버튼 패널
 */

import React, { useState } from 'react';
import { useAgentContext } from '../agents/AgentContext';
import { DebateMiniCard } from './DebateMiniCard';
import { DebateViewer } from './DebateViewer';
import type { DebateRecord, DomainTeam } from '../agents/types';
import { TEAM_NAMES } from '../agents/types';

interface DebatePanelProps {
  onDebateFeedback?: (debateId: string, type: 'helpful' | 'dismissed') => void;
}

export const DebatePanel: React.FC<DebatePanelProps> = ({ onDebateFeedback }) => {
  const {
    activeDebates,
    completedDebates,
    isDebateLoading,
    isConnected,
    startAllDebates,
    startTeamDebate,
  } = useAgentContext();

  const [selectedDebate, setSelectedDebate] = useState<DebateRecord | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(false);

  const teams: { id: DomainTeam; name: string; topic: string }[] = [
    { id: 'bom-waste-team', name: 'BOM/폐기물 팀', topic: 'BOM 차이 및 폐기물 분석' },
    { id: 'inventory-team', name: '재고 팀', topic: '재고 수준 및 안전재고 분석' },
    { id: 'profitability-team', name: '수익성 팀', topic: '채널별 수익성 분석' },
    { id: 'cost-management-team', name: '원가 팀', topic: '원가 구조 분석' },
    { id: 'business-strategy-team', name: '사업전략 팀', topic: '사업 전략 및 시장 기회 분석' },
  ];

  const handleStartAllDebates = async () => {
    await startAllDebates('medium');
  };

  const handleStartTeamDebate = async (team: DomainTeam, topic: string) => {
    await startTeamDebate(team, topic, 'medium');
    setShowTeamSelector(false);
  };

  const handleDebateClick = (debate: DebateRecord) => {
    setSelectedDebate(debate);
  };

  // DebateViewer에 전달할 형식으로 변환
  const convertDebateForViewer = (debate: DebateRecord) => {
    return {
      id: debate.id,
      domain: debate.domain as string,
      team: debate.team as string,
      topic: debate.topic,
      currentPhase: debate.currentPhase as string,
      thesis: debate.thesis
        ? {
            ...debate.thesis,
            phase: debate.thesis.phase as 'thesis' | 'antithesis' | 'synthesis',
            role: debate.thesis.role as 'optimist' | 'pessimist' | 'mediator',
            content: {
              ...debate.thesis.content,
              evidence: debate.thesis.content.evidence || [],
            },
          }
        : undefined,
      antithesis: debate.antithesis
        ? {
            ...debate.antithesis,
            phase: debate.antithesis.phase as 'thesis' | 'antithesis' | 'synthesis',
            role: debate.antithesis.role as 'optimist' | 'pessimist' | 'mediator',
            content: {
              ...debate.antithesis.content,
              evidence: debate.antithesis.content.evidence || [],
            },
          }
        : undefined,
      synthesis: debate.synthesis
        ? {
            ...debate.synthesis,
            phase: debate.synthesis.phase as 'thesis' | 'antithesis' | 'synthesis',
            role: debate.synthesis.role as 'optimist' | 'pessimist' | 'mediator',
            content: {
              ...debate.synthesis.content,
              evidence: debate.synthesis.content.evidence || [],
            },
          }
        : undefined,
      finalDecision: debate.finalDecision,
      governanceReviews: debate.governanceReviews,
      startedAt: debate.startedAt,
      completedAt: debate.completedAt,
      isActive: debate.currentPhase !== 'complete',
    };
  };

  // 토론 상세 보기 모달
  if (selectedDebate) {
    return (
      <div className="h-full flex flex-col">
        <DebateViewer
          debate={convertDebateForViewer(selectedDebate)}
          onClose={() => setSelectedDebate(null)}
          onFeedback={onDebateFeedback}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 토론 시작 버튼 */}
      <div className="mb-4 space-y-2">
        <button
          onClick={handleStartAllDebates}
          disabled={isDebateLoading || !isConnected}
          className={`
            w-full py-2.5 px-4 rounded-lg font-medium text-sm
            flex items-center justify-center gap-2 transition-all
            ${isConnected && !isDebateLoading
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isDebateLoading ? (
            <>
              <span className="material-icons-outlined text-base animate-spin">sync</span>
              토론 시작 중...
            </>
          ) : (
            <>
              <span className="material-icons-outlined text-base">rocket_launch</span>
              전체 팀 토론 시작
            </>
          )}
        </button>

        {/* 개별 팀 선택 토글 */}
        <button
          onClick={() => setShowTeamSelector(!showTeamSelector)}
          className="w-full py-1.5 px-3 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center justify-center gap-1"
        >
          <span className="material-icons-outlined text-sm">
            {showTeamSelector ? 'expand_less' : 'expand_more'}
          </span>
          개별 팀 토론
        </button>

        {/* 팀 선택 드롭다운 */}
        {showTeamSelector && (
          <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => handleStartTeamDebate(team.id, team.topic)}
                disabled={isDebateLoading || !isConnected}
                className="p-2 text-xs text-left rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <div className="font-medium text-gray-700 dark:text-gray-300">{team.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 진행 중인 토론 */}
      {activeDebates.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            진행 중인 토론 ({activeDebates.length})
          </h3>
          <div className="space-y-2">
            {activeDebates.map(debate => (
              <DebateMiniCard
                key={debate.id}
                debate={debate}
                onClick={handleDebateClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 최근 완료된 토론 */}
      {completedDebates.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            최근 완료된 토론
          </h3>
          <div className="space-y-2">
            {completedDebates.slice(0, 5).map(debate => (
              <DebateMiniCard
                key={debate.id}
                debate={debate}
                onClick={handleDebateClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {activeDebates.length === 0 && completedDebates.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <span className="material-icons-outlined text-4xl mb-2 block opacity-50">
              forum
            </span>
            <p className="text-sm">토론이 없습니다</p>
            <p className="text-xs mt-1">
              위 버튼을 눌러 팀 토론을 시작하세요
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebatePanel;
