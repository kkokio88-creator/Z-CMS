// Agent Types
export type AgentId =
  // 기존 에이전트 (병행 운영)
  | 'coordinator'
  | 'bom-waste-agent'
  | 'inventory-agent'
  | 'profitability-agent'
  | 'cost-management-agent'
  // 조율 계층 (Orchestration Layer)
  | 'chief-orchestrator'
  // BOM/Waste 팀 (Trio)
  | 'bom-waste-optimist'
  | 'bom-waste-pessimist'
  | 'bom-waste-mediator'
  // 재고 팀 (Trio)
  | 'inventory-optimist'
  | 'inventory-pessimist'
  | 'inventory-mediator'
  // 수익성 팀 (Trio)
  | 'profitability-optimist'
  | 'profitability-pessimist'
  | 'profitability-mediator'
  // 원가 팀 (Trio)
  | 'cost-optimist'
  | 'cost-pessimist'
  | 'cost-mediator'
  // 사업전략 팀 (Trio)
  | 'business-optimist'
  | 'business-pessimist'
  | 'business-mediator'
  // 거버넌스 계층 (Governance Layer)
  | 'qa-specialist'
  | 'compliance-auditor';

export type AgentStatus = 'idle' | 'processing' | 'error' | 'stopped';

export type MessageType =
  | 'TASK_ASSIGNMENT'
  | 'TASK_RESULT'
  | 'INSIGHT_SHARE'
  | 'COACHING_FEEDBACK'
  | 'LEARNING_UPDATE'
  | 'DATA_REQUEST'
  | 'STATE_SYNC'
  | 'USER_FEEDBACK'
  // 토론 프레임워크 메시지 타입
  | 'DEBATE_START'
  | 'DEBATE_THESIS'
  | 'DEBATE_ANTITHESIS'
  | 'DEBATE_SYNTHESIS'
  | 'DEBATE_COMPLETE'
  | 'GOVERNANCE_REVIEW_REQUEST'
  | 'GOVERNANCE_REVIEW_RESULT';

export type MessagePriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentMessage {
  id: string;
  timestamp: Date;
  type: MessageType;
  source: AgentId;
  target: AgentId | 'broadcast';
  payload: unknown;
  priority: MessagePriority;
  correlationId?: string;
}

export interface Task {
  id: string;
  type: string;
  domain: 'bom' | 'waste' | 'inventory' | 'stocktake' | 'profit' | 'margin';
  input: unknown;
  priority: MessagePriority;
  deadline?: Date;
  payload?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  agentId: AgentId;
  success: boolean;
  output?: unknown;
  error?: string;
  processingTime: number;
}

// Coaching Types
export type CoachingMetric = 'accuracy' | 'latency' | 'user_acceptance';

export interface CoachingFeedback {
  metric: CoachingMetric;
  score: number;
  benchmark: number;
  suggestion: string;
  examples?: {
    input: unknown;
    expectedOutput: unknown;
    actualOutput: unknown;
  }[];
}

export interface CoachingMessage extends AgentMessage {
  type: 'COACHING_FEEDBACK';
  payload: {
    feedback: CoachingFeedback;
  };
}

// Insight Types
export type InsightLevel = 'info' | 'warning' | 'critical';
export type InsightDomain = 'bom' | 'waste' | 'inventory' | 'profitability' | 'general';

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

// Learning Types
export type FeedbackType = 'helpful' | 'dismissed' | 'corrected';

export interface LearningRecord {
  id: string;
  agentId: AgentId;
  timestamp: Date;
  insightId: string;
  output: {
    type: 'reasoning' | 'prediction' | 'recommendation';
    content: unknown;
  };
  feedback?: {
    type: FeedbackType;
    correction?: unknown;
    timestamp: Date;
  };
  coaching?: {
    appliedAt: Date;
    adjustments: string[];
  };
}

// ECOUNT Types (mirrored from frontend)
export interface EcountConfig {
  COM_CODE: string;
  USER_ID: string;
  API_KEY: string;
  ZONE: string;
}

export interface EcountSaleRaw {
  IO_DATE: string;
  PROD_CD: string;
  PROD_DES: string;
  QTY: number;
  U_PRICE: number;
  SUPPLY_AMT: number;
  CUST_CD: string;
  CUST_DES: string;
}

export interface EcountInventoryRaw {
  PROD_CD: string;
  PROD_DES: string;
  WH_CD: string;
  BAL_QTY: number;
  IN_QTY: number;
  OUT_QTY: number;
}

export interface EcountProductionRaw {
  IO_DATE: string;
  PROD_CD: string;
  PROD_DES: string;
  QTY: number;
  WORK_CD: string;
}

export interface EcountBomRaw {
  PROD_CD: string;
  PROD_DES: string;
  SUB_PROD_CD: string;
  SUB_PROD_DES: string;
  QTY: number;
}

export interface EcountPurchaseRaw {
  IO_DATE: string;
  PROD_CD: string;
  PROD_DES: string;
  QTY: number;
  U_PRICE: number;
  SUPPLY_AMT: number;
  CUST_CD: string;
  CUST_DES: string;
}

// Agent State
export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  lastActivity: Date;
  processedTasks: number;
  successRate: number;
  avgProcessingTime: number;
  currentTask?: Task;
}

// Re-export debate types
export * from './debate';
