/**
 * TeamStatusPanel 컴포넌트
 * 도메인 팀(Trio) 상태 표시
 */

import React, { useState, useEffect } from 'react';

// 타입 정의
interface AgentStatus {
  id: string;
  status: 'idle' | 'processing' | 'error' | 'stopped';
  lastActivity: string;
  processedTasks: number;
  successRate: number;
  avgProcessingTime: number;
}

interface TeamStatus {
  team: string;
  optimist: AgentStatus;
  pessimist: AgentStatus;
  mediator: AgentStatus;
}

interface DebateStatus {
  active: number;
  pending: number;
  completed: number;
}

interface TeamStatusPanelProps {
  apiBaseUrl?: string;
  refreshInterval?: number;
  onTeamClick?: (teamName: string) => void;
  onStartDebate?: (teamName: string) => void;
}

const teamLabels: Record<string, { name: string; icon: string; color: string }> = {
  'bom-waste-team': { name: 'BOM/Waste', icon: '🏭', color: 'blue' },
  'inventory-team': { name: '재고', icon: '📦', color: 'green' },
  'profitability-team': { name: '수익성', icon: '💰', color: 'yellow' },
  'cost-team': { name: '원가', icon: '📊', color: 'purple' },
};

const roleLabels: Record<string, { name: string; icon: string }> = {
  optimist: { name: '혁신가', icon: '💡' },
  pessimist: { name: '검증가', icon: '⚠️' },
  mediator: { name: '조율자', icon: '⚖️' },
};

const statusColors: Record<string, string> = {
  idle: 'bg-gray-400',
  processing: 'bg-blue-500 animate-pulse',
  error: 'bg-red-500',
  stopped: 'bg-gray-600',
};

export const TeamStatusPanel: React.FC<TeamStatusPanelProps> = ({
  apiBaseUrl = 'http://localhost:4001/api',
  refreshInterval = 5000,
  onTeamClick,
  onStartDebate,
}) => {
  const [teams, setTeams] = useState<TeamStatus[]>([]);
  const [debateStatus, setDebateStatus] = useState<DebateStatus>({
    active: 0,
    pending: 0,
    completed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/debates/teams/status`);
      if (!response.ok) throw new Error('상태 조회 실패');

      const data = await response.json();
      if (data.success) {
        setTeams(data.data.teams || []);
        setDebateStatus(data.data.debates || { active: 0, pending: 0, completed: 0 });
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [apiBaseUrl, refreshInterval]);

  const handleStartAllDebates = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/debates/all-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'medium' }),
      });

      if (response.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error('전체 토론 시작 실패:', err);
    }
  };

  const getTeamOverallStatus = (team: TeamStatus): 'idle' | 'processing' | 'error' => {
    if (
      team.optimist.status === 'error' ||
      team.pessimist.status === 'error' ||
      team.mediator.status === 'error'
    ) {
      return 'error';
    }
    if (
      team.optimist.status === 'processing' ||
      team.pessimist.status === 'processing' ||
      team.mediator.status === 'processing'
    ) {
      return 'processing';
    }
    return 'idle';
  };

  const renderAgentBadge = (agent: AgentStatus, role: 'optimist' | 'pessimist' | 'mediator') => {
    const { name, icon } = roleLabels[role];

    return (
      <div
        className={`
          flex items-center gap-2 p-2 rounded-lg
          ${agent.status === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'}
        `}
      >
        <div className="relative">
          <span className="text-lg">{icon}</span>
          <span
            className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full ${statusColors[agent.status]}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {agent.processedTasks}건 • {agent.successRate}%
          </p>
        </div>
        {agent.status === 'processing' && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        팀 상태 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
        <p className="font-medium">상태 조회 실패</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchStatus} className="mt-2 text-sm underline hover:no-underline">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 토론 상태 요약 */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-white">
        <div className="text-center">
          <p className="text-2xl font-bold">{debateStatus.active}</p>
          <p className="text-xs opacity-80">진행중</p>
        </div>
        <div className="text-center border-x border-white/20">
          <p className="text-2xl font-bold">{debateStatus.pending}</p>
          <p className="text-xs opacity-80">대기중</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{debateStatus.completed}</p>
          <p className="text-xs opacity-80">완료</p>
        </div>
      </div>

      {/* 전체 토론 시작 버튼 */}
      <button
        onClick={handleStartAllDebates}
        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-icons-outlined text-xl">play_circle</span>
        전체 팀 토론 시작
      </button>

      {/* 팀 목록 */}
      <div className="space-y-3">
        {teams.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-2 block">🔌</span>
            <p>연결된 팀이 없습니다</p>
            <p className="text-sm">서버가 실행 중인지 확인하세요</p>
          </div>
        ) : (
          teams.map(team => {
            const info = teamLabels[team.team] || { name: team.team, icon: '👥', color: 'gray' };
            const overallStatus = getTeamOverallStatus(team);
            const isExpanded = expandedTeam === team.team;

            return (
              <div
                key={team.team}
                className={`
                  rounded-lg border-2 overflow-hidden transition-all
                  ${overallStatus === 'processing' ? 'border-blue-400 dark:border-blue-600' : ''}
                  ${overallStatus === 'error' ? 'border-red-400 dark:border-red-600' : ''}
                  ${overallStatus === 'idle' ? 'border-gray-200 dark:border-gray-700' : ''}
                `}
              >
                {/* 팀 헤더 */}
                <div
                  className={`
                    p-3 cursor-pointer transition-colors
                    ${overallStatus === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}
                    hover:bg-gray-50 dark:hover:bg-gray-750
                  `}
                  onClick={() => {
                    setExpandedTeam(isExpanded ? null : team.team);
                    onTeamClick?.(team.team);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-200">
                          {info.name} 팀
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span className={`w-2 h-2 rounded-full ${statusColors[overallStatus]}`} />
                          <span>
                            {overallStatus === 'processing'
                              ? '토론 진행중'
                              : overallStatus === 'error'
                                ? '오류 발생'
                                : '대기중'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onStartDebate && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onStartDebate(team.team);
                          }}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                          title="토론 시작"
                        >
                          <span className="material-icons-outlined text-xl text-gray-600 dark:text-gray-400">
                            play_arrow
                          </span>
                        </button>
                      )}
                      <span className="material-icons-outlined text-gray-400">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 확장된 에이전트 목록 */}
                {isExpanded && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {renderAgentBadge(team.optimist, 'optimist')}
                    {renderAgentBadge(team.pessimist, 'pessimist')}
                    {renderAgentBadge(team.mediator, 'mediator')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 레전드 */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span>대기</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>처리중</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>오류</span>
        </div>
      </div>
    </div>
  );
};

export default TeamStatusPanel;
