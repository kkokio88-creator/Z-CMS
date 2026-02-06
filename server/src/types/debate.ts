/**
 * 변증법적 토론 프레임워크 타입 정의
 * SOP: 에이전틱 멀티-레이어 조직 운영 가이드 v2.0
 */

import { AgentId, InsightDomain, MessagePriority } from './index';

// Trio 역할 (정-반-합)
export type TrioRole = 'optimist' | 'pessimist' | 'mediator';

// 토론 단계
export type DebatePhase =
  | 'pending'
  | 'thesis'
  | 'antithesis'
  | 'synthesis'
  | 'governance_review'
  | 'complete';

// 도메인 팀 식별자
export type DomainTeam =
  | 'bom-waste-team'
  | 'inventory-team'
  | 'profitability-team'
  | 'cost-management-team'
  | 'business-strategy-team';

// 거버넌스 역할
export type GovernanceRole = 'qa-specialist' | 'compliance-auditor';

// C.A.T.S 명령 프레임워크
export interface CATSCommand {
  /** 프로젝트 배경 및 가용 자원 */
  context: string;
  /** 트리오 역할 (낙관/비관/중재) */
  agentRole: TrioRole;
  /** 현재 단계에서 수행할 구체적 과업 */
  task: string;
  /** 다음 에이전트가 넘겨받을 파일의 형식 및 품질 기준 */
  successCriteria: string;
}

// 토론 라운드 콘텐츠
export interface DebateContent {
  /** 주장/입장 */
  position: string;
  /** 추론 과정 */
  reasoning: string;
  /** 근거 데이터 */
  evidence: unknown[];
  /** 신뢰도 (0-100) */
  confidence: number;
  /** 제안된 조치들 */
  suggestedActions?: string[];
}

// 토론 라운드
export interface DebateRound {
  id: string;
  debateId: string;
  phase: DebatePhase;
  role: TrioRole;
  agentId: AgentId;
  content: DebateContent;
  timestamp: Date;
  catsCommand: CATSCommand;
  /** 이전 라운드 참조 (반론/종합 시) */
  respondsTo?: string[];
}

// 최종 결정
export interface FinalDecision {
  recommendation: string;
  reasoning: string;
  confidence: number;
  /** 소수 의견 (있는 경우) */
  dissent?: string;
  /** 권장 조치 사항 */
  actions: string[];
  /** 우선순위 */
  priority: MessagePriority;
}

// 전체 토론 기록
export interface DebateRecord {
  id: string;
  domain: InsightDomain;
  team: DomainTeam;
  topic: string;
  /** 토론 배경 데이터 */
  contextData: unknown;
  /** 현재 단계 */
  currentPhase: DebatePhase;
  /** 정(thesis) - 낙관론자 */
  thesis?: DebateRound;
  /** 반(antithesis) - 비관론자 */
  antithesis?: DebateRound;
  /** 합(synthesis) - 중재자 */
  synthesis?: DebateRound;
  /** 최종 결정 */
  finalDecision?: FinalDecision;
  /** 거버넌스 검토 결과 */
  governanceReviews?: GovernanceReview[];
  startedAt: Date;
  completedAt?: Date;
  /** 토론 버전 (동일 주제 재토론 시 증가) */
  version: number;
}

// 거버넌스 검토 결과
export interface GovernanceReview {
  id: string;
  debateId: string;
  reviewerId: GovernanceRole;
  reviewerAgentId: AgentId;
  /** 승인 여부 */
  approved: boolean;
  /** 발견된 이슈들 */
  issues?: GovernanceIssue[];
  /** 개선 권고 사항 */
  recommendations?: string[];
  /** 검토 점수 (0-100) */
  score: number;
  timestamp: Date;
}

// 거버넌스 이슈
export interface GovernanceIssue {
  type: 'quality' | 'compliance' | 'logic' | 'data' | 'risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRound?: 'thesis' | 'antithesis' | 'synthesis';
}

// 토론 통계
export interface DebateStatistics {
  totalDebates: number;
  completedDebates: number;
  averageConfidence: number;
  averageDuration: number;
  governanceApprovalRate: number;
  byDomain: Record<InsightDomain, number>;
  byTeam: Record<DomainTeam, number>;
}

// WIP 파일 메타데이터
export interface WipFileMetadata {
  debateId: string;
  version: number;
  domain: InsightDomain;
  team: DomainTeam;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
  phase: DebatePhase;
}

// 토론 시작 요청
export interface DebateStartRequest {
  team: DomainTeam;
  topic: string;
  contextData: unknown;
  priority?: MessagePriority;
  /** 즉시 시작 여부 (false면 큐에 추가) */
  immediate?: boolean;
}

// 토론 이벤트 (SSE용)
export interface DebateEvent {
  type: 'debate_started' | 'round_completed' | 'debate_completed' | 'governance_reviewed';
  debateId: string;
  data: Partial<DebateRecord>;
  timestamp: Date;
}
