import { useMemo, useCallback } from 'react';
import { useAgentContext } from './AgentContext';
import type { AgentId, AgentState } from './types';

interface UseAgentStatusReturn {
  statuses: AgentState[];
  getStatus: (agentId: AgentId) => AgentState | undefined;
  isAnyProcessing: boolean;
  hasErrors: boolean;
  refresh: () => Promise<void>;
}

export function useAgentStatus(): UseAgentStatusReturn {
  const { agentStatuses, refreshStatuses } = useAgentContext();

  const getStatus = useCallback((agentId: AgentId) => {
    return agentStatuses.find(s => s.id === agentId);
  }, [agentStatuses]);

  const isAnyProcessing = useMemo(
    () => agentStatuses.some(s => s.status === 'processing'),
    [agentStatuses]
  );

  const hasErrors = useMemo(
    () => agentStatuses.some(s => s.status === 'error'),
    [agentStatuses]
  );

  return {
    statuses: agentStatuses,
    getStatus,
    isAnyProcessing,
    hasErrors,
    refresh: refreshStatuses,
  };
}
