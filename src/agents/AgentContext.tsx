import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { agentService } from '../services/agentService';
import type { AgentInsight, AgentState, FeedbackType, InsightDomain, AgentId } from './types';

interface AgentContextValue {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;

  // Insights
  insights: AgentInsight[];
  latestInsight: AgentInsight | null;

  // Agent states
  agentStatuses: AgentState[];

  // Actions
  submitFeedback: (insightId: string, type: FeedbackType, correction?: unknown) => Promise<void>;
  triggerAnalysis: (priority?: 'low' | 'medium' | 'high' | 'critical') => Promise<void>;
  syncData: () => Promise<void>;
  refreshInsights: (domain?: InsightDomain) => Promise<void>;
  refreshStatuses: () => Promise<void>;

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
  maxInsights = 50
}: AgentProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentState[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set());

  // Connect to SSE on mount
  useEffect(() => {
    if (!autoConnect) return;

    agentService.connectSSE();

    const unsubscribeConnection = agentService.onConnectionChange(setIsConnected);
    const unsubscribeInsight = agentService.onInsight((insight) => {
      setInsights(prev => {
        const newInsights = [insight, ...prev].slice(0, maxInsights);
        return newInsights;
      });
    });

    // Initial data fetch
    refreshInsights();
    refreshStatuses();

    return () => {
      agentService.disconnectSSE();
      unsubscribeConnection();
      unsubscribeInsight();
    };
  }, [autoConnect, maxInsights]);

  const refreshInsights = useCallback(async (domain?: InsightDomain) => {
    try {
      const fetchedInsights = await agentService.getInsights(domain, maxInsights);
      setInsights(fetchedInsights);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    }
  }, [maxInsights]);

  const refreshStatuses = useCallback(async () => {
    try {
      const statuses = await agentService.getAgentStatuses();
      setAgentStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch agent statuses:', error);
    }
  }, []);

  const submitFeedback = useCallback(async (
    insightId: string,
    type: FeedbackType,
    correction?: unknown
  ) => {
    try {
      await agentService.submitFeedback(insightId, type, correction);
      setFeedbackSubmitted(prev => new Set(prev).add(insightId));
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }, []);

  const triggerAnalysis = useCallback(async (
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    setIsLoading(true);
    try {
      await agentService.triggerAnalysis(priority);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const latestInsight = insights[0] || null;

  const value: AgentContextValue = {
    isConnected,
    isLoading,
    insights,
    latestInsight,
    agentStatuses,
    submitFeedback,
    triggerAnalysis,
    syncData,
    refreshInsights,
    refreshStatuses,
    feedbackSubmitted,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
}
