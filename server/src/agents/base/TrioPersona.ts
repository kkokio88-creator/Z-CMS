/**
 * TrioPersona 베이스 클래스
 * 변증법적 토론(정-반-합)에 참여하는 에이전트의 기반 클래스
 * SOP: 실행 팀별 에이전트 역할 구성 (The Trio Model)
 */

import { v4 as uuidv4 } from 'uuid';
import { Agent } from './Agent.js';
import type {
  AgentId,
  AgentMessage,
  Task,
  TaskResult,
  CoachingMessage,
  InsightDomain,
  TrioRole,
  DomainTeam,
  CATSCommand,
  DebateRound,
  DebateContent,
  DebatePhase,
  MessagePriority
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export interface TrioPersonaConfig {
  role: TrioRole;
  team: DomainTeam;
  domain: InsightDomain;
}

export abstract class TrioPersona extends Agent {
  protected role: TrioRole;
  protected team: DomainTeam;
  protected domain: InsightDomain;
  protected debateManager?: DebateManager;
  protected geminiAdapter?: GeminiAdapter;
  protected currentDebateId?: string;

  // 코칭으로 조정되는 파라미터
  protected confidenceAdjustment: number = 0;
  protected verbosityLevel: 'concise' | 'normal' | 'detailed' = 'normal';

  constructor(
    id: AgentId,
    config: TrioPersonaConfig,
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry
  ) {
    super(id, eventBus, stateManager, learningRegistry);
    this.role = config.role;
    this.team = config.team;
    this.domain = config.domain;
  }

  /**
   * 의존성 주입
   */
  injectDependencies(
    debateManager: DebateManager,
    geminiAdapter: GeminiAdapter
  ): void {
    this.debateManager = debateManager;
    this.geminiAdapter = geminiAdapter;
  }

  /**
   * 메시지 핸들링 확장 - 토론 관련 메시지 처리
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'DEBATE_START':
        await this.handleDebateStart(message);
        break;
      case 'DEBATE_THESIS':
        await this.handleDebateThesis(message);
        break;
      case 'DEBATE_ANTITHESIS':
        await this.handleDebateAntithesis(message);
        break;
      case 'DEBATE_SYNTHESIS':
        await this.handleDebateSynthesis(message);
        break;
      default:
        await super.handleMessage(message);
    }
  }

  /**
   * 토론 시작 핸들링 - Optimist가 처리
   */
  protected async handleDebateStart(message: AgentMessage): Promise<void> {
    if (this.role !== 'optimist') return;

    const payload = message.payload as {
      debateId: string;
      topic: string;
      contextData: unknown;
    };

    this.currentDebateId = payload.debateId;
    this.status = 'processing';
    const startTime = Date.now();

    try {
      const catsCommand = this.createCATSCommand(
        `${payload.topic}에 대한 가능성과 기회를 분석하세요.`,
        payload
      );

      const position = await this.generatePosition(
        payload.topic,
        payload.contextData,
        catsCommand
      );

      const round: DebateRound = {
        id: uuidv4(),
        debateId: payload.debateId,
        phase: 'thesis',
        role: 'optimist',
        agentId: this.id,
        content: position,
        timestamp: new Date(),
        catsCommand
      };

      // 토론 매니저에 라운드 기록
      if (this.debateManager) {
        await this.debateManager.recordRound(payload.debateId, round);
      }

      // Pessimist에게 전달
      const sender = this.eventBus.createSender(this.id);
      const pessimistId = this.id.replace('-optimist', '-pessimist') as AgentId;
      sender.send(pessimistId, 'DEBATE_THESIS', {
        debateId: payload.debateId,
        thesis: round,
        contextData: payload.contextData
      }, message.priority);

      this.processedTasks++;
      this.successfulTasks++;
      this.totalProcessingTime += Date.now() - startTime;

    } catch (error) {
      console.error(`[${this.id}] 토론 시작 오류:`, error);
      this.status = 'error';
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * 정(Thesis) 수신 핸들링 - Pessimist가 처리
   */
  protected async handleDebateThesis(message: AgentMessage): Promise<void> {
    if (this.role !== 'pessimist') return;

    const payload = message.payload as {
      debateId: string;
      thesis: DebateRound;
      contextData: unknown;
    };

    this.currentDebateId = payload.debateId;
    this.status = 'processing';
    const startTime = Date.now();

    try {
      const catsCommand = this.createCATSCommand(
        `낙관론(${payload.thesis.content.position})에 대한 리스크와 제약을 분석하세요.`,
        payload
      );

      const position = await this.generatePosition(
        payload.thesis.content.position,
        payload.contextData,
        catsCommand,
        [payload.thesis]
      );

      const round: DebateRound = {
        id: uuidv4(),
        debateId: payload.debateId,
        phase: 'antithesis',
        role: 'pessimist',
        agentId: this.id,
        content: position,
        timestamp: new Date(),
        catsCommand,
        respondsTo: [payload.thesis.id]
      };

      // 토론 매니저에 라운드 기록
      if (this.debateManager) {
        await this.debateManager.recordRound(payload.debateId, round);
      }

      // Mediator에게 전달
      const sender = this.eventBus.createSender(this.id);
      const mediatorId = this.id.replace('-pessimist', '-mediator') as AgentId;
      sender.send(mediatorId, 'DEBATE_ANTITHESIS', {
        debateId: payload.debateId,
        thesis: payload.thesis,
        antithesis: round,
        contextData: payload.contextData
      }, message.priority);

      this.processedTasks++;
      this.successfulTasks++;
      this.totalProcessingTime += Date.now() - startTime;

    } catch (error) {
      console.error(`[${this.id}] 반론 생성 오류:`, error);
      this.status = 'error';
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * 반(Antithesis) 수신 핸들링 - Mediator가 처리
   */
  protected async handleDebateAntithesis(message: AgentMessage): Promise<void> {
    if (this.role !== 'mediator') return;

    const payload = message.payload as {
      debateId: string;
      thesis: DebateRound;
      antithesis: DebateRound;
      contextData: unknown;
    };

    this.currentDebateId = payload.debateId;
    this.status = 'processing';
    const startTime = Date.now();

    try {
      const catsCommand = this.createCATSCommand(
        `낙관론과 비관론을 종합하여 균형 잡힌 결론을 도출하세요.`,
        payload
      );

      const position = await this.generatePosition(
        `${payload.thesis.content.position} vs ${payload.antithesis.content.position}`,
        payload.contextData,
        catsCommand,
        [payload.thesis, payload.antithesis]
      );

      const round: DebateRound = {
        id: uuidv4(),
        debateId: payload.debateId,
        phase: 'synthesis',
        role: 'mediator',
        agentId: this.id,
        content: position,
        timestamp: new Date(),
        catsCommand,
        respondsTo: [payload.thesis.id, payload.antithesis.id]
      };

      // 토론 매니저에 라운드 기록
      if (this.debateManager) {
        await this.debateManager.recordRound(payload.debateId, round);
      }

      // Chief Orchestrator에게 종합 결과 전달
      const sender = this.eventBus.createSender(this.id);
      sender.send('chief-orchestrator', 'DEBATE_SYNTHESIS', {
        debateId: payload.debateId,
        thesis: payload.thesis,
        antithesis: payload.antithesis,
        synthesis: round,
        contextData: payload.contextData
      }, message.priority);

      this.processedTasks++;
      this.successfulTasks++;
      this.totalProcessingTime += Date.now() - startTime;

    } catch (error) {
      console.error(`[${this.id}] 종합 생성 오류:`, error);
      this.status = 'error';
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * 종합(Synthesis) 수신 핸들링 (필요시 override)
   */
  protected async handleDebateSynthesis(message: AgentMessage): Promise<void> {
    // 기본 구현: 아무것도 하지 않음
  }

  /**
   * C.A.T.S 명령 생성
   */
  protected createCATSCommand(
    task: string,
    payload: { contextData?: unknown }
  ): CATSCommand {
    const roleDescriptions: Record<TrioRole, string> = {
      optimist: '가능성, 확장성, 창의적 대안 제시',
      pessimist: '제약 조건, 리스크, 잠재적 실패 요인 분석',
      mediator: '두 관점을 통합하여 실행 가능한 결론 도출'
    };

    return {
      context: JSON.stringify(payload.contextData || {}).slice(0, 1000),
      agentRole: this.role,
      task: `[${this.team}] ${roleDescriptions[this.role]}. ${task}`,
      successCriteria: this.getSuccessCriteria()
    };
  }

  /**
   * 역할별 성공 기준
   */
  protected getSuccessCriteria(): string {
    const criteria: Record<TrioRole, string> = {
      optimist: 'position(주장), reasoning(추론), evidence(근거 배열), confidence(0-100)를 JSON으로 반환',
      pessimist: 'position(반론), reasoning(리스크 분석), evidence(위험 요소 배열), confidence(0-100)를 JSON으로 반환',
      mediator: 'position(종합), reasoning(균형 분석), suggestedActions(권고 조치 배열), confidence(0-100)를 JSON으로 반환'
    };
    return criteria[this.role];
  }

  /**
   * 입장 생성 (서브클래스에서 구현)
   */
  protected abstract generatePosition(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    priorRounds?: DebateRound[]
  ): Promise<DebateContent>;

  /**
   * 기본 태스크 처리 (필수 구현)
   */
  async process(task: Task): Promise<TaskResult> {
    // 토론 외 일반 태스크 처리
    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { message: `${this.role} persona processed task` },
      processingTime: 0
    };
  }

  /**
   * 에이전트 역량 목록
   */
  getCapabilities(): string[] {
    const baseCapabilities = [
      'dialectical_debate',
      'cats_command_execution',
      `${this.role}_perspective`
    ];

    const roleCapabilities: Record<TrioRole, string[]> = {
      optimist: ['opportunity_analysis', 'growth_projection', 'innovation_proposal'],
      pessimist: ['risk_assessment', 'constraint_analysis', 'failure_mode_detection'],
      mediator: ['synthesis_generation', 'consensus_building', 'action_planning']
    };

    return [...baseCapabilities, ...roleCapabilities[this.role]];
  }

  /**
   * 코칭 적용
   */
  protected async applyCoaching(
    feedback: CoachingMessage['payload']['feedback']
  ): Promise<void> {
    console.log(`[${this.id}] 코칭 적용: ${feedback.suggestion}`);

    switch (feedback.metric) {
      case 'accuracy':
        // 정확도 개선을 위한 신뢰도 조정
        if (feedback.score < feedback.benchmark) {
          this.confidenceAdjustment -= 5;
        } else {
          this.confidenceAdjustment += 2;
        }
        break;

      case 'latency':
        // 응답 속도 개선을 위한 상세도 조정
        if (feedback.score > feedback.benchmark) {
          this.verbosityLevel = 'concise';
        }
        break;

      case 'user_acceptance':
        // 사용자 수용도 개선
        if (feedback.score < feedback.benchmark) {
          this.verbosityLevel = 'detailed';
        }
        break;
    }

    // 학습 레지스트리에 기록
    this.learningRegistry.recordCoaching(this.id, {
      appliedAt: new Date(),
      adjustments: [
        `confidenceAdjustment: ${this.confidenceAdjustment}`,
        `verbosityLevel: ${this.verbosityLevel}`
      ]
    });
  }

  /**
   * 현재 역할 정보 조회
   */
  getRoleInfo(): {
    role: TrioRole;
    team: DomainTeam;
    domain: InsightDomain;
  } {
    return {
      role: this.role,
      team: this.team,
      domain: this.domain
    };
  }

  /**
   * 조정된 신뢰도 계산
   */
  protected getAdjustedConfidence(baseConfidence: number): number {
    const adjusted = baseConfidence + this.confidenceAdjustment;
    return Math.max(0, Math.min(100, adjusted));
  }
}
