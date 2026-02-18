/**
 * 프론트엔드용 에이전트/토론 타입 정의
 * server/src/types/debate.ts 에서 필요한 타입만 추출
 */

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

export type InsightDomain = 'bom' | 'inventory' | 'profitability' | 'general';

export interface DebateRound {
  agentRole: string;
  content: string;
  confidence: number;
  timestamp: string;
}

export interface FinalDecision {
  recommendation: string;
  confidence: number;
  reasoning: string;
}

export interface DebateRecord {
  id: string;
  domain: InsightDomain;
  team: DomainTeam;
  topic: string;
  contextData: unknown;
  currentPhase: DebatePhase;
  thesis?: DebateRound;
  antithesis?: DebateRound;
  synthesis?: DebateRound;
  finalDecision?: FinalDecision;
  startedAt: string;
  completedAt?: string;
}

export const TEAM_NAMES: Record<string, string> = {
  'bom-waste-team': 'BOM/폐기',
  'inventory-team': '재고',
  'profitability-team': '수익성',
  'cost-management-team': '원가',
  'business-strategy-team': '경영전략',
};

export const DOMAIN_NAMES: Record<string, string> = {
  bom: 'BOM/폐기',
  inventory: '재고',
  profitability: '수익성',
  general: '종합',
};
