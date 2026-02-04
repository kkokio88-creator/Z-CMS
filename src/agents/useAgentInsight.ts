import { useMemo, useCallback } from 'react';
import { useAgentContext } from './AgentContext';
import type { InsightDomain, AgentInsight } from './types';

interface UseAgentInsightOptions {
  domain?: InsightDomain;
  level?: 'info' | 'warning' | 'critical';
  limit?: number;
}

interface UseAgentInsightReturn {
  insights: AgentInsight[];
  latestInsight: AgentInsight | null;
  criticalInsights: AgentInsight[];
  warningInsights: AgentInsight[];
  markHelpful: (insightId: string) => Promise<void>;
  dismiss: (insightId: string) => Promise<void>;
  correct: (insightId: string, correction: unknown) => Promise<void>;
  hasFeedback: (insightId: string) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAgentInsight(options: UseAgentInsightOptions = {}): UseAgentInsightReturn {
  const {
    insights: allInsights,
    submitFeedback,
    feedbackSubmitted,
    isLoading,
    refreshInsights,
  } = useAgentContext();

  const { domain, level, limit = 20 } = options;

  // Filter insights based on options
  const insights = useMemo(() => {
    let filtered = allInsights;

    if (domain) {
      filtered = filtered.filter(i => i.domain === domain);
    }

    if (level) {
      filtered = filtered.filter(i => i.level === level);
    }

    return filtered.slice(0, limit);
  }, [allInsights, domain, level, limit]);

  // Get critical and warning insights
  const criticalInsights = useMemo(
    () => insights.filter(i => i.level === 'critical'),
    [insights]
  );

  const warningInsights = useMemo(
    () => insights.filter(i => i.level === 'warning'),
    [insights]
  );

  const latestInsight = insights[0] || null;

  // Feedback actions
  const markHelpful = useCallback(async (insightId: string) => {
    await submitFeedback(insightId, 'helpful');
  }, [submitFeedback]);

  const dismiss = useCallback(async (insightId: string) => {
    await submitFeedback(insightId, 'dismissed');
  }, [submitFeedback]);

  const correct = useCallback(async (insightId: string, correction: unknown) => {
    await submitFeedback(insightId, 'corrected', correction);
  }, [submitFeedback]);

  const hasFeedback = useCallback((insightId: string) => {
    return feedbackSubmitted.has(insightId);
  }, [feedbackSubmitted]);

  const refresh = useCallback(async () => {
    await refreshInsights(domain);
  }, [refreshInsights, domain]);

  return {
    insights,
    latestInsight,
    criticalInsights,
    warningInsights,
    markHelpful,
    dismiss,
    correct,
    hasFeedback,
    isLoading,
    refresh,
  };
}

// Convenience hooks for specific domains
export function useBomInsights(limit?: number) {
  return useAgentInsight({ domain: 'bom', limit });
}

export function useWasteInsights(limit?: number) {
  return useAgentInsight({ domain: 'waste', limit });
}

export function useInventoryInsights(limit?: number) {
  return useAgentInsight({ domain: 'inventory', limit });
}

export function useProfitabilityInsights(limit?: number) {
  return useAgentInsight({ domain: 'profitability', limit });
}

export function useCriticalInsights() {
  return useAgentInsight({ level: 'critical' });
}
