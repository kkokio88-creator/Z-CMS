// Agent Types for Frontend

export type AgentId =
  | 'coordinator'
  | 'bom-waste-agent'
  | 'inventory-agent'
  | 'profitability-agent'
  | 'chief-orchestrator'
  // BOM/Waste 팀
  | 'bom-waste-optimist'
  | 'bom-waste-pessimist'
  | 'bom-waste-mediator'
  // 재고 팀
  | 'inventory-optimist'
  | 'inventory-pessimist'
  | 'inventory-mediator'
  // 수익성 팀
  | 'profitability-optimist'
  | 'profitability-pessimist'
  | 'profitability-mediator'
  // 원가 팀
  | 'cost-optimist'
  | 'cost-pessimist'
  | 'cost-mediator'
  // 사업전략 팀
  | 'business-optimist'
  | 'business-pessimist'
  | 'business-mediator';

export type AgentStatus = 'idle' | 'processing' | 'error' | 'stopped';

export type InsightLevel = 'info' | 'warning' | 'critical';
export type InsightDomain = 'bom' | 'waste' | 'inventory' | 'profitability' | 'general' | 'business';
export type FeedbackType = 'helpful' | 'dismissed' | 'corrected';

// 토론 관련 타입
export type DebatePhase =
  | 'pending'
  | 'thesis'
  | 'antithesis'
  | 'synthesis'
  | 'governance_review'
  | 'complete';

export type DomainTeam =
  | 'bom-waste-team'
  | 'inventory-team'
  | 'profitability-team'
  | 'cost-management-team'
  | 'business-strategy-team';

export type TrioRole = 'optimist' | 'pessimist' | 'mediator';

export interface DebateRound {
  id: string;
  phase: DebatePhase;
  role: TrioRole;
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

export interface DebateRecord {
  id: string;
  domain: InsightDomain;
  team: DomainTeam;
  topic: string;
  currentPhase: DebatePhase;
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
  governanceReviews?: Array<{
    id: string;
    reviewerId: string;
    approved: boolean;
    score: number;
    issues?: { type: string; severity: string; description: string }[];
    recommendations?: string[];
    timestamp: string;
  }>;
  startedAt: string;
  completedAt?: string;
}

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
  'chief-orchestrator': '수석 조율자',
  'bom-waste-optimist': 'BOM 낙관론자',
  'bom-waste-pessimist': 'BOM 비관론자',
  'bom-waste-mediator': 'BOM 중재자',
  'inventory-optimist': '재고 낙관론자',
  'inventory-pessimist': '재고 비관론자',
  'inventory-mediator': '재고 중재자',
  'profitability-optimist': '수익 낙관론자',
  'profitability-pessimist': '수익 비관론자',
  'profitability-mediator': '수익 중재자',
  'cost-optimist': '원가 낙관론자',
  'cost-pessimist': '원가 비관론자',
  'cost-mediator': '원가 중재자',
  'business-optimist': '사업 낙관론자',
  'business-pessimist': '사업 비관론자',
  'business-mediator': '사업 중재자',
};

// 팀 이름 매핑
export const TEAM_NAMES: Record<DomainTeam, string> = {
  'bom-waste-team': 'BOM/폐기물 팀',
  'inventory-team': '재고 팀',
  'profitability-team': '수익성 팀',
  'cost-management-team': '원가 팀',
  'business-strategy-team': '사업전략 팀',
};

// 도메인 이름 매핑
export const DOMAIN_NAMES: Record<InsightDomain, string> = {
  bom: 'BOM',
  waste: '폐기물',
  inventory: '재고',
  profitability: '수익성',
  general: '일반',
  business: '사업전략',
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
