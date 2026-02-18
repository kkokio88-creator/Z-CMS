/**
 * Chief Orchestrator
 * 관리 및 조율 계층 (Orchestration Layer)
 * SOP: 사용자 목표 분석, 과업 분해, 최적의 실행 에이전트 선발 및 결과 최종 승인
 */

import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type {
  AgentId,
  Task,
  TaskResult,
  AgentMessage,
  CoachingMessage,
  AgentInsight,
  DomainTeam,
  InsightDomain,
  DebateRecord,
  DebateRound,
  FinalDecision,
  MessagePriority,
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { BomWasteTeam } from '../bom-waste-team/index.js';
import type { InventoryTeam } from '../inventory-team/index.js';
import type { ProfitabilityTeam } from '../profitability-team/index.js';
import type { CostTeam } from '../cost-team/index.js';
import type { QASpecialist } from '../governance/QASpecialist.js';
import type { ComplianceAuditor } from '../governance/ComplianceAuditor.js';

// 도메인 팀 타입
interface DomainTeams {
  bomWaste?: BomWasteTeam;
  inventory?: InventoryTeam;
  profitability?: ProfitabilityTeam;
  cost?: CostTeam;
}

// 거버넌스 에이전트
interface GovernanceAgents {
  qaSpecialist?: QASpecialist;
  complianceAuditor?: ComplianceAuditor;
}

export class ChiefOrchestrator extends Agent {
  private domainTeams: DomainTeams = {};
  private governanceAgents: GovernanceAgents = {};
  private debateManager?: DebateManager;
  private legacyAgents: Agent[] = []; // 기존 에이전트 (병행 운영)

  private pendingDebates: Map<
    string,
    {
      thesis?: DebateRound;
      antithesis?: DebateRound;
      synthesis?: DebateRound;
      contextData: unknown;
      priority: MessagePriority;
    }
  > = new Map();

  private insightBuffer: Map<string, AgentInsight> = new Map();
  private coachingInterval: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('chief-orchestrator', eventBus, stateManager, learningRegistry);
  }

  /**
   * 도메인 팀 등록
   */
  registerDomainTeams(teams: DomainTeams): void {
    this.domainTeams = { ...this.domainTeams, ...teams };
    console.log('[ChiefOrchestrator] 도메인 팀 등록됨:', Object.keys(teams).join(', '));
  }

  /**
   * 거버넌스 에이전트 등록
   */
  registerGovernanceAgents(agents: GovernanceAgents): void {
    this.governanceAgents = { ...this.governanceAgents, ...agents };
    console.log('[ChiefOrchestrator] 거버넌스 에이전트 등록됨');
  }

  /**
   * 토론 매니저 등록
   */
  registerDebateManager(debateManager: DebateManager): void {
    this.debateManager = debateManager;
    console.log('[ChiefOrchestrator] 토론 매니저 등록됨');
  }

  /**
   * 레거시 에이전트 등록 (병행 운영)
   */
  registerLegacyAgents(agents: Agent[]): void {
    this.legacyAgents = agents;
    console.log('[ChiefOrchestrator] 레거시 에이전트 등록됨:', agents.length);
  }

  /**
   * 역량 목록
   */
  getCapabilities(): string[] {
    return [
      '도메인 토론 오케스트레이션',
      '크로스도메인 인사이트 종합',
      '거버넌스 에스컬레이션',
      '에이전트 코칭',
      '우선순위 관리',
      '변증법적 토론 조율',
    ];
  }

  /**
   * 시작
   */
  start(): void {
    super.start();

    // 토론 관련 메시지 구독
    this.eventBus.subscribeType('DEBATE_SYNTHESIS', this.handleDebateSynthesis.bind(this));
    this.eventBus.subscribeType('GOVERNANCE_REVIEW_RESULT', this.handleGovernanceResult.bind(this));
    this.eventBus.subscribeType('INSIGHT_SHARE', this.handleInsightShare.bind(this));
    this.eventBus.subscribeType('TASK_RESULT', this.handleTaskResult.bind(this));

    // 주기적 코칭 평가
    this.coachingInterval = setInterval(() => {
      this.evaluateAndCoach();
    }, 60000);

    console.log('[ChiefOrchestrator] 시작됨');
  }

  /**
   * 중지
   */
  stop(): void {
    if (this.coachingInterval) {
      clearInterval(this.coachingInterval);
    }
    super.stop();
    console.log('[ChiefOrchestrator] 중지됨');
  }

  /**
   * 태스크 처리
   */
  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'orchestrate_debate':
          await this.orchestrateDebate(
            task.input as {
              team: DomainTeam;
              topic: string;
              contextData: unknown;
              priority?: MessagePriority;
            }
          );
          return this.successResult(task, startTime, { initiated: true });

        case 'orchestrate_all_teams':
          await this.orchestrateAllTeams(
            task.input as {
              priority?: MessagePriority;
            }
          );
          return this.successResult(task, startTime, { initiated: true });

        case 'synthesize_insights':
          const summary = await this.synthesizeAllInsights();
          return this.successResult(task, startTime, { summary });

        default:
          throw new Error(`알 수 없는 태스크 타입: ${task.type}`);
      }
    } catch (error) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  private successResult(task: Task, startTime: number, output: unknown): TaskResult {
    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * 도메인 토론 시작
   */
  async orchestrateDebate(input: {
    team: DomainTeam;
    topic: string;
    contextData: unknown;
    priority?: MessagePriority;
  }): Promise<string> {
    if (!this.debateManager) {
      throw new Error('DebateManager가 등록되지 않았습니다.');
    }

    const { team, topic, contextData, priority = 'medium' } = input;

    // 토론 시작
    const debateId = await this.debateManager.initiateDebate({
      team,
      topic,
      contextData,
      priority,
      immediate: true,
    });

    if (debateId === 'queued') {
      console.log(`[ChiefOrchestrator] 토론 대기열에 추가됨: ${topic}`);
      return 'queued';
    }

    // 진행 중인 토론 추적
    this.pendingDebates.set(debateId, {
      contextData,
      priority,
    });

    // 팀의 Optimist에게 토론 시작 메시지 전송
    const optimistId = this.getTeamOptimistId(team);
    const sender = this.eventBus.createSender(this.id);

    sender.send(
      optimistId,
      'DEBATE_START',
      {
        debateId,
        topic,
        contextData,
      },
      priority
    );

    console.log(`[ChiefOrchestrator] 토론 시작: ${debateId} - ${topic}`);
    return debateId;
  }

  /**
   * 팀의 Optimist 에이전트 ID 조회
   */
  private getTeamOptimistId(team: DomainTeam): AgentId {
    const mapping: Record<DomainTeam, AgentId> = {
      'bom-waste-team': 'bom-waste-optimist',
      'inventory-team': 'inventory-optimist',
      'profitability-team': 'profitability-optimist',
      'cost-management-team': 'cost-optimist',
      'business-strategy-team': 'business-optimist',
    };
    return mapping[team];
  }

  /**
   * 모든 팀에 토론 시작
   */
  async orchestrateAllTeams(input?: { priority?: MessagePriority }): Promise<void> {
    const priority = input?.priority || 'medium';
    const state = this.stateManager;

    const teams: { team: DomainTeam; topic: string; contextData: unknown }[] = [
      {
        team: 'bom-waste-team',
        topic: 'BOM 차이 및 폐기물 분석',
        contextData: state.getBomWasteState(),
      },
      {
        team: 'inventory-team',
        topic: '재고 수준 및 안전재고 분석',
        contextData: state.getInventoryState(),
      },
      {
        team: 'profitability-team',
        topic: '채널별 수익성 분석',
        contextData: state.getProfitabilityState(),
      },
      {
        team: 'cost-management-team',
        topic: '원가 구조 분석',
        contextData: {}, // 원가 데이터는 별도 조회 필요
      },
    ];

    for (const { team, topic, contextData } of teams) {
      try {
        await this.orchestrateDebate({ team, topic, contextData, priority });
      } catch (error) {
        console.error(`[ChiefOrchestrator] ${team} 토론 시작 실패:`, error);
      }
    }

    console.log(`[ChiefOrchestrator] 전체 팀 토론 시작됨 (${teams.length}개)`);
  }

  /**
   * 토론 종합 결과 수신
   */
  protected async handleDebateSynthesis(message: AgentMessage): Promise<void> {
    const payload = message.payload as {
      debateId: string;
      thesis: DebateRound;
      antithesis: DebateRound;
      synthesis: DebateRound;
      contextData: unknown;
    };

    const pendingDebate = this.pendingDebates.get(payload.debateId);
    if (!pendingDebate) {
      console.warn(`[ChiefOrchestrator] 알 수 없는 토론 ID: ${payload.debateId}`);
      return;
    }

    // 토론 정보 업데이트
    pendingDebate.thesis = payload.thesis;
    pendingDebate.antithesis = payload.antithesis;
    pendingDebate.synthesis = payload.synthesis;

    // 거버넌스 검토 요청 (높은 우선순위나 낮은 신뢰도의 경우)
    const needsGovernance =
      pendingDebate.priority === 'critical' ||
      pendingDebate.priority === 'high' ||
      payload.synthesis.content.confidence < 70;

    if (needsGovernance && this.debateManager) {
      await this.requestGovernanceReview(payload.debateId);
    } else {
      // 바로 토론 완료 처리
      await this.completeDebate(payload.debateId);
    }
  }

  /**
   * 거버넌스 검토 요청
   */
  private async requestGovernanceReview(debateId: string): Promise<void> {
    if (!this.debateManager) return;

    const debate = this.debateManager.getActiveDebate(debateId);
    if (!debate) return;

    const sender = this.eventBus.createSender(this.id);

    // QA Specialist 검토 요청
    if (this.governanceAgents.qaSpecialist) {
      sender.send(
        'qa-specialist',
        'GOVERNANCE_REVIEW_REQUEST',
        {
          debateId,
          debate,
        },
        'high'
      );
    }

    // Compliance Auditor 검토 요청
    if (this.governanceAgents.complianceAuditor) {
      sender.send(
        'compliance-auditor',
        'GOVERNANCE_REVIEW_REQUEST',
        {
          debateId,
          debate,
        },
        'high'
      );
    }

    console.log(`[ChiefOrchestrator] 거버넌스 검토 요청: ${debateId}`);
  }

  /**
   * 거버넌스 검토 결과 수신
   */
  protected async handleGovernanceResult(message: AgentMessage): Promise<void> {
    const payload = message.payload as {
      debateId: string;
      review: unknown;
      reviewType: 'qa' | 'compliance';
    };

    const debate = this.debateManager?.getActiveDebate(payload.debateId);
    if (!debate) return;

    // 모든 거버넌스 검토가 완료되었는지 확인
    const reviews = debate.governanceReviews || [];
    const hasQA = reviews.some(r => r.reviewerId === 'qa-specialist');
    const hasCompliance = reviews.some(r => r.reviewerId === 'compliance-auditor');

    // 두 검토가 모두 완료되면 토론 완료
    if (hasQA && hasCompliance) {
      await this.completeDebate(payload.debateId);
    }
  }

  /**
   * 토론 완료 처리
   */
  private async completeDebate(debateId: string): Promise<void> {
    const pendingDebate = this.pendingDebates.get(debateId);
    if (!pendingDebate || !pendingDebate.synthesis) return;

    if (!this.debateManager) return;

    // 최종 결정 생성
    const finalDecision = this.createFinalDecision(pendingDebate);

    // 토론 완료
    const completedDebate = await this.debateManager.completeDebate(debateId, finalDecision);

    // 인사이트 발행
    this.publishDebateInsight(completedDebate);

    // 추적에서 제거
    this.pendingDebates.delete(debateId);

    console.log(`[ChiefOrchestrator] 토론 완료: ${debateId}`);
  }

  /**
   * 최종 결정 생성
   */
  private createFinalDecision(pendingDebate: {
    synthesis?: DebateRound;
    priority: MessagePriority;
  }): FinalDecision {
    const synthesis = pendingDebate.synthesis!;

    return {
      recommendation: synthesis.content.position,
      reasoning: synthesis.content.reasoning,
      confidence: synthesis.content.confidence,
      actions: synthesis.content.suggestedActions || [],
      priority: pendingDebate.priority,
    };
  }

  /**
   * 토론 결과 인사이트 발행
   */
  private publishDebateInsight(debate: DebateRecord): void {
    if (!debate.finalDecision) return;

    const level =
      debate.finalDecision.confidence >= 80
        ? 'info'
        : debate.finalDecision.confidence >= 60
          ? 'warning'
          : 'critical';

    this.publishInsight(
      debate.domain,
      `[토론 완료] ${debate.topic}`,
      debate.finalDecision.recommendation,
      {
        highlight: `신뢰도 ${debate.finalDecision.confidence}%`,
        level,
        confidence: debate.finalDecision.confidence / 100,
        data: {
          debateId: debate.id,
          team: debate.team,
          thesisPosition: debate.thesis?.content.position,
          antithesisPosition: debate.antithesis?.content.position,
          governanceReviews: debate.governanceReviews?.map(r => ({
            reviewer: r.reviewerId,
            approved: r.approved,
            score: r.score,
          })),
        },
        actionable: true,
        suggestedActions: debate.finalDecision.actions,
      }
    );
  }

  /**
   * 인사이트 수신 처리
   */
  protected async handleInsightShare(message: AgentMessage): Promise<void> {
    if (message.source === this.id) return;

    const insight = message.payload as AgentInsight;
    this.insightBuffer.set(insight.id, insight);

    // 버퍼 크기 제한
    if (this.insightBuffer.size > 50) {
      const oldestKey = this.insightBuffer.keys().next().value;
      if (oldestKey) this.insightBuffer.delete(oldestKey);
    }
  }

  /**
   * 태스크 결과 수신 처리 (레거시 에이전트용)
   */
  protected async handleTaskResult(message: AgentMessage): Promise<void> {
    // 레거시 에이전트의 결과 처리
    if (this.legacyAgents.some(a => a.getStatus().id === message.source)) {
      console.log(`[ChiefOrchestrator] 레거시 에이전트 결과 수신: ${message.source}`);
    }
  }

  /**
   * 모든 인사이트 종합
   */
  async synthesizeAllInsights(): Promise<string> {
    const recentInsights = Array.from(this.insightBuffer.values()).filter(
      i => Date.now() - i.timestamp.getTime() < 300000
    ); // 최근 5분

    const byDomain: Record<string, AgentInsight[]> = {};
    for (const insight of recentInsights) {
      if (!byDomain[insight.domain]) {
        byDomain[insight.domain] = [];
      }
      byDomain[insight.domain].push(insight);
    }

    // Gemini로 종합 생성
    const summary = await geminiAdapter.generateCoordinatorSummary({
      bomWaste:
        byDomain['bom']?.map(i => i.description).join('; ') ||
        byDomain['waste']?.map(i => i.description).join('; '),
      inventory: byDomain['inventory']?.map(i => i.description).join('; '),
      profitability: byDomain['profitability']?.map(i => i.description).join('; '),
    });

    // 종합 인사이트 발행
    const criticalCount = recentInsights.filter(i => i.level === 'critical').length;
    const warningCount = recentInsights.filter(i => i.level === 'warning').length;

    this.publishInsight('general', '전체 도메인 종합 분석', summary, {
      highlight:
        criticalCount > 0
          ? `긴급 ${criticalCount}건, 주의 ${warningCount}건`
          : warningCount > 0
            ? `주의 ${warningCount}건`
            : '정상 운영 중',
      level: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'info',
      confidence: 0.9,
      data: {
        domainCount: Object.keys(byDomain).length,
        insightCount: recentInsights.length,
        criticalCount,
        warningCount,
      },
    });

    return summary;
  }

  /**
   * 주기적 코칭 평가
   */
  private async evaluateAndCoach(): Promise<void> {
    const performances = this.learningRegistry.getAllPerformances();

    for (const perf of performances) {
      if (this.learningRegistry.needsCoaching(perf.agentId)) {
        const feedback = this.learningRegistry.generateCoachingFeedback(perf.agentId);

        if (feedback) {
          const sender = this.eventBus.createSender(this.id);
          sender.send(perf.agentId, 'COACHING_FEEDBACK', { feedback }, 'medium');

          console.log(`[ChiefOrchestrator] 코칭 전송: ${perf.agentId}`);
        }
      }
    }
  }

  /**
   * 코칭 적용 (ChiefOrchestrator는 코칭 받지 않음)
   */
  protected async applyCoaching(): Promise<void> {
    console.log('[ChiefOrchestrator] 코칭 미적용 (최고 조율자)');
  }

  /**
   * 토론 상태 조회
   */
  getDebateStatus(): {
    active: number;
    pending: number;
    completed: number;
  } {
    const queueStatus = this.debateManager?.getQueueStatus();
    const statistics = this.debateManager?.getStatistics();

    return {
      active: queueStatus?.activeCount || 0,
      pending: this.pendingDebates.size,
      completed: statistics?.completedDebates || 0,
    };
  }

  /**
   * 모든 팀 상태 조회
   */
  getAllTeamStatuses(): Record<string, unknown>[] {
    const statuses: Record<string, unknown>[] = [];

    const teams = [
      { name: 'bom-waste-team', team: this.domainTeams.bomWaste },
      { name: 'inventory-team', team: this.domainTeams.inventory },
      { name: 'profitability-team', team: this.domainTeams.profitability },
      { name: 'cost-team', team: this.domainTeams.cost },
    ];

    for (const { name, team } of teams) {
      if (team) {
        statuses.push({
          team: name,
          optimist: team.optimist.getStatus(),
          pessimist: team.pessimist.getStatus(),
          mediator: team.mediator.getStatus(),
        });
      }
    }

    return statuses;
  }
}
