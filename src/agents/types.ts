// Agent Types for Frontend

export type AgentId = 'coordinator' | 'bom-waste-agent' | 'inventory-agent' | 'profitability-agent';

export type AgentStatus = 'idle' | 'processing' | 'error' | 'stopped';

export type InsightLevel = 'info' | 'warning' | 'critical';
export type InsightDomain = 'bom' | 'waste' | 'inventory' | 'profitability' | 'general';
export type FeedbackType = 'helpful' | 'dismissed' | 'corrected';

export interface AgentInsight {
  id: string;
  agentId: AgentId;
  domain: InsightDomain;
  timestamp: Date;
  title: string;
  description: string;
  highlight?: string;
  level: InsightLevel;
  confidence: number;
  data?: unknown;
  actionable: boolean;
  suggestedActions?: string[];
}

export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  lastActivity: Date;
  processedTasks: number;
  successRate: number;
  avgProcessingTime: number;
}

export interface AgentPerformance {
  agentId: AgentId;
  totalInsights: number;
  helpfulCount: number;
  dismissedCount: number;
  correctedCount: number;
  accuracyScore: number;
  acceptanceRate: number;
  lastUpdated: Date;
}

export interface SSEMessage {
  id: string;
  type: string;
  source: AgentId;
  timestamp: string;
  payload: unknown;
}

// Agent name mapping for display
export const AGENT_NAMES: Record<AgentId, string> = {
  coordinator: '총괄 감독자',
  'bom-waste-agent': 'BOM/폐기물 분석',
  'inventory-agent': '재고 안전 관리',
  'profitability-agent': '수익성 분석',
};

// Level colors
export const LEVEL_COLORS: Record<InsightLevel, { bg: string; text: string; border: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
};
