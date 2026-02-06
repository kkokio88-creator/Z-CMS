import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { agentService, DebateSSEEvent } from '../services/agentService';
import type {
  AgentInsight,
  AgentState,
  FeedbackType,
  InsightDomain,
  AgentId,
  DebateRecord,
  DomainTeam,
} from './types';

interface AgentContextValue {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;

  // Insights
  insights: AgentInsight[];
  latestInsight: AgentInsight | null;

  // Agent states
  agentStatuses: AgentState[];

  // Debates
  activeDebates: DebateRecord[];
  completedDebates: DebateRecord[];
  isDebateLoading: boolean;

  // Actions
  submitFeedback: (insightId: string, type: FeedbackType, correction?: unknown) => Promise<void>;
  triggerAnalysis: (priority?: 'low' | 'medium' | 'high' | 'critical') => Promise<void>;
  syncData: () => Promise<void>;
  refreshInsights: (domain?: InsightDomain) => Promise<void>;
  refreshStatuses: () => Promise<void>;
  startAllDebates: (priority?: 'low' | 'medium' | 'high' | 'critical') => Promise<void>;
  startTeamDebate: (team: DomainTeam, topic: string, priority?: 'low' | 'medium' | 'high' | 'critical') => Promise<void>;
  refreshDebates: () => Promise<void>;

  // Feedback state tracking
  feedbackSubmitted: Set<string>;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

interface AgentProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  maxInsights?: number;
}

export function AgentProvider({
  children,
  autoConnect = true,
  maxInsights = 50,
}: AgentProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentState[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set());
  const [activeDebates, setActiveDebates] = useState<DebateRecord[]>([]);
  const [completedDebates, setCompletedDebates] = useState<DebateRecord[]>([]);
  const [isDebateLoading, setIsDebateLoading] = useState(false);

  // Connect to SSE on mount
  useEffect(() => {
    if (!autoConnect) return;

    agentService.connectSSE();

    const unsubscribeConnection = agentService.onConnectionChange(setIsConnected);
    const unsubscribeInsight = agentService.onInsight(insight => {
      setInsights(prev => {
        const newInsights = [insight, ...prev].slice(0, maxInsights);
        return newInsights;
      });
    });

    // Subscribe to debate events
    const unsubscribeDebate = agentService.onDebateEvent((event: DebateSSEEvent) => {
      handleDebateEvent(event);
    });

    // Initial data fetch
    refreshInsights();
    refreshStatuses();
    refreshDebates();

    return () => {
      agentService.disconnectSSE();
      unsubscribeConnection();
      unsubscribeInsight();
      unsubscribeDebate();
    };
  }, [autoConnect, maxInsights]);

  // Handle debate SSE events
  const handleDebateEvent = useCallback((event: DebateSSEEvent) => {
    switch (event.type) {
      case 'debate_started':
        setActiveDebates(prev => {
          const existing = prev.find(d => d.id === event.debateId);
          if (existing) return prev;
          return [...prev, event.data as DebateRecord];
        });
        break;

      case 'round_completed':
        setActiveDebates(prev =>
          prev.map(d =>
            d.id === event.debateId
              ? { ...d, ...event.data }
              : d
          )
        );
        break;

      case 'debate_completed':
        setActiveDebates(prev => prev.filter(d => d.id !== event.debateId));
        setCompletedDebates(prev => {
          const completed = event.data as DebateRecord;
          return [completed, ...prev].slice(0, 20);
        });
        break;

      case 'governance_reviewed':
        setActiveDebates(prev =>
          prev.map(d =>
            d.id === event.debateId
              ? { ...d, ...event.data }
              : d
          )
        );
        break;
    }
  }, []);

  const refreshInsights = useCallback(
    async (domain?: InsightDomain) => {
      try {
        const fetchedInsights = await agentService.getInsights(domain, maxInsights);
        setInsights(fetchedInsights);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      }
    },
    [maxInsights]
  );

  const refreshStatuses = useCallback(async () => {
    try {
      const statuses = await agentService.getAgentStatuses();
      setAgentStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch agent statuses:', error);
    }
  }, []);

  const submitFeedback = useCallback(
    async (insightId: string, type: FeedbackType, correction?: unknown) => {
      try {
        await agentService.submitFeedback(insightId, type, correction);
        setFeedbackSubmitted(prev => new Set(prev).add(insightId));
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        throw error;
      }
    },
    []
  );

  const triggerAnalysis = useCallback(
    async (priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
      setIsLoading(true);
      try {
        await agentService.triggerAnalysis(priority);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const syncData = useCallback(async () => {
    setIsLoading(true);
    try {
      await agentService.syncEcountData();
      await refreshInsights();
      await refreshStatuses();
    } finally {
      setIsLoading(false);
    }
  }, [refreshInsights, refreshStatuses]);

  const refreshDebates = useCallback(async () => {
    try {
      const [active, history] = await Promise.all([
        agentService.getActiveDebates(),
        agentService.getDebateHistory(10),
      ]);
      setActiveDebates(active);
      setCompletedDebates(history);
    } catch (error) {
      console.error('Failed to fetch debates:', error);
    }
  }, []);

  const startAllDebates = useCallback(
    async (priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
      setIsDebateLoading(true);
      try {
        await agentService.startAllTeamDebates(priority);
        // Debates will be updated via SSE
      } finally {
        setIsDebateLoading(false);
      }
    },
    []
  );

  const startTeamDebate = useCallback(
    async (
      team: DomainTeam,
      topic: string,
      priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    ) => {
      setIsDebateLoading(true);
      try {
        await agentService.startTeamDebate(team, topic, priority);
        // Debate will be updated via SSE
      } finally {
        setIsDebateLoading(false);
      }
    },
    []
  );

  const latestInsight = insights[0] || null;

  const value: AgentContextValue = {
    isConnected,
    isLoading,
    insights,
    latestInsight,
    agentStatuses,
    activeDebates,
    completedDebates,
    isDebateLoading,
    submitFeedback,
    triggerAnalysis,
    syncData,
    refreshInsights,
    refreshStatuses,
    startAllDebates,
    startTeamDebate,
    refreshDebates,
    feedbackSubmitted,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
}
