/**
 * QA Specialist Agent
 * 품질 및 거버넌스 계층 (Governance Layer)
 *
 * 역할:
 * - 토론 품질 검증
 * - 논리적 일관성 확인
 * - 실행 가능성 검토
 * - 결과물의 기술적 무결성 검증
 */

import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../base/Agent.js';
import type {
  AgentId,
  AgentMessage,
  Task,
  TaskResult,
  CoachingMessage,
  InsightLevel,
  GovernanceReview,
  GovernanceIssue,
  DebateRecord,
  DebateRound,
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

export class QASpecialist extends Agent {
  private debateManager?: DebateManager;
  private geminiAdapter?: GeminiAdapter;

  // QA 임계값 설정
  private minConfidenceThreshold = 50;
  private minEvidenceCount = 2;
  private maxRoundDuration = 60000; // 1분

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('qa-specialist', eventBus, stateManager, learningRegistry);
  }

  /**
   * 의존성 주입
   */
  injectDependencies(debateManager: DebateManager, geminiAdapter: GeminiAdapter): void {
    this.debateManager = debateManager;
    this.geminiAdapter = geminiAdapter;
  }

  /**
   * 메시지 핸들링 확장
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'GOVERNANCE_REVIEW_REQUEST':
        await this.handleReviewRequest(message);
        break;
      default:
        await super.handleMessage(message);
    }
  }

  /**
   * 거버넌스 검토 요청 처리
   */
  private async handleReviewRequest(message: AgentMessage): Promise<void> {
    const payload = message.payload as {
      debateId: string;
      debate: DebateRecord;
    };

    this.status = 'processing';
    const startTime = Date.now();

    try {
      const review = await this.performQAReview(payload.debate);

      // 토론 매니저에 검토 결과 추가
      if (this.debateManager) {
        await this.debateManager.addGovernanceReview(payload.debateId, review);
      }

      // 결과 전송
      const sender = this.eventBus.createSender(this.id);
      sender.reply(message, 'GOVERNANCE_REVIEW_RESULT', {
        debateId: payload.debateId,
        review,
        reviewType: 'qa',
      });

      this.processedTasks++;
      this.successfulTasks++;
      this.totalProcessingTime += Date.now() - startTime;

      // 심각한 이슈 발견 시 인사이트 발행
      if (!review.approved || review.issues?.some(i => i.severity === 'critical')) {
        this.publishQAInsight(payload.debate, review);
      }
    } catch (error) {
      console.error('[QASpecialist] 검토 오류:', error);
      this.status = 'error';
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * QA 검토 수행
   */
  async performQAReview(debate: DebateRecord): Promise<Omit<GovernanceReview, 'id' | 'debateId'>> {
    const issues: GovernanceIssue[] = [];
    let score = 100;

    // 1. 기본 구조 검증
    const structureIssues = this.validateStructure(debate);
    issues.push(...structureIssues);
    score -= structureIssues.length * 10;

    // 2. 논리적 일관성 검증
    const logicIssues = this.validateLogic(debate);
    issues.push(...logicIssues);
    score -= logicIssues.length * 15;

    // 3. 신뢰도 검증
    const confidenceIssues = this.validateConfidence(debate);
    issues.push(...confidenceIssues);
    score -= confidenceIssues.length * 5;

    // 4. 근거 검증
    const evidenceIssues = this.validateEvidence(debate);
    issues.push(...evidenceIssues);
    score -= evidenceIssues.length * 10;

    // 5. 실행 가능성 검증
    const actionabilityIssues = this.validateActionability(debate);
    issues.push(...actionabilityIssues);
    score -= actionabilityIssues.length * 8;

    // 점수 범위 조정
    score = Math.max(0, Math.min(100, score));

    // 승인 기준: 점수 70 이상 & critical 이슈 없음
    const approved = score >= 70 && !issues.some(i => i.severity === 'critical');

    // 권고사항 생성
    const recommendations = this.generateRecommendations(issues);

    return {
      reviewerId: 'qa-specialist',
      reviewerAgentId: this.id,
      approved,
      issues: issues.length > 0 ? issues : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      score,
      timestamp: new Date(),
    };
  }

  /**
   * 구조 검증
   */
  private validateStructure(debate: DebateRecord): GovernanceIssue[] {
    const issues: GovernanceIssue[] = [];

    if (!debate.thesis) {
      issues.push({
        type: 'quality',
        severity: 'critical',
        description: '정(Thesis) 라운드가 누락되었습니다.',
        affectedRound: 'thesis',
      });
    }

    if (!debate.antithesis) {
      issues.push({
        type: 'quality',
        severity: 'critical',
        description: '반(Antithesis) 라운드가 누락되었습니다.',
        affectedRound: 'antithesis',
      });
    }

    if (!debate.synthesis) {
      issues.push({
        type: 'quality',
        severity: 'critical',
        description: '합(Synthesis) 라운드가 누락되었습니다.',
        affectedRound: 'synthesis',
      });
    }

    return issues;
  }

  /**
   * 논리적 일관성 검증
   */
  private validateLogic(debate: DebateRecord): GovernanceIssue[] {
    const issues: GovernanceIssue[] = [];

    if (debate.thesis && debate.antithesis) {
      // 반론이 정론을 실제로 반박하는지 확인
      if (debate.antithesis.content.position === debate.thesis.content.position) {
        issues.push({
          type: 'logic',
          severity: 'high',
          description: '반론이 정론과 동일합니다. 실질적인 반박이 이루어지지 않았습니다.',
          affectedRound: 'antithesis',
        });
      }
    }

    if (debate.synthesis) {
      // 종합이 양측을 모두 고려했는지 확인
      const synthesisText = debate.synthesis.content.reasoning.toLowerCase();
      const mentionsOptimist =
        synthesisText.includes('낙관') ||
        synthesisText.includes('기회') ||
        synthesisText.includes('긍정');
      const mentionsPessimist =
        synthesisText.includes('비관') ||
        synthesisText.includes('리스크') ||
        synthesisText.includes('위험');

      if (!mentionsOptimist && !mentionsPessimist) {
        issues.push({
          type: 'logic',
          severity: 'medium',
          description: '종합이 양측 관점을 명시적으로 참조하지 않습니다.',
          affectedRound: 'synthesis',
        });
      }
    }

    return issues;
  }

  /**
   * 신뢰도 검증
   */
  private validateConfidence(debate: DebateRecord): GovernanceIssue[] {
    const issues: GovernanceIssue[] = [];
    const rounds: {
      name: string;
      round?: DebateRound;
      affectedRound: 'thesis' | 'antithesis' | 'synthesis';
    }[] = [
      { name: '정(Thesis)', round: debate.thesis, affectedRound: 'thesis' },
      { name: '반(Antithesis)', round: debate.antithesis, affectedRound: 'antithesis' },
      { name: '합(Synthesis)', round: debate.synthesis, affectedRound: 'synthesis' },
    ];

    for (const { name, round, affectedRound } of rounds) {
      if (round && round.content.confidence < this.minConfidenceThreshold) {
        issues.push({
          type: 'quality',
          severity: 'medium',
          description: `${name} 라운드의 신뢰도(${round.content.confidence}%)가 기준치(${this.minConfidenceThreshold}%) 미만입니다.`,
          affectedRound,
        });
      }
    }

    return issues;
  }

  /**
   * 근거 검증
   */
  private validateEvidence(debate: DebateRecord): GovernanceIssue[] {
    const issues: GovernanceIssue[] = [];
    const rounds: {
      name: string;
      round?: DebateRound;
      affectedRound: 'thesis' | 'antithesis' | 'synthesis';
    }[] = [
      { name: '정(Thesis)', round: debate.thesis, affectedRound: 'thesis' },
      { name: '반(Antithesis)', round: debate.antithesis, affectedRound: 'antithesis' },
      { name: '합(Synthesis)', round: debate.synthesis, affectedRound: 'synthesis' },
    ];

    for (const { name, round, affectedRound } of rounds) {
      if (round && round.content.evidence.length < this.minEvidenceCount) {
        issues.push({
          type: 'data',
          severity: 'low',
          description: `${name} 라운드의 근거(${round.content.evidence.length}개)가 권장 수준(${this.minEvidenceCount}개) 미만입니다.`,
          affectedRound,
        });
      }
    }

    return issues;
  }

  /**
   * 실행 가능성 검증
   */
  private validateActionability(debate: DebateRecord): GovernanceIssue[] {
    const issues: GovernanceIssue[] = [];

    if (debate.synthesis) {
      const actions = debate.synthesis.content.suggestedActions || [];

      if (actions.length === 0) {
        issues.push({
          type: 'quality',
          severity: 'medium',
          description: '종합 결과에 구체적인 실행 항목이 없습니다.',
          affectedRound: 'synthesis',
        });
      }

      // 실행 항목이 너무 모호한지 확인
      const vagueActions = actions.filter(
        a => a.length < 10 || a.includes('등') || a.includes('기타') || a.includes('필요시')
      );

      if (vagueActions.length > actions.length / 2) {
        issues.push({
          type: 'quality',
          severity: 'low',
          description: '실행 항목 중 일부가 구체적이지 않습니다.',
          affectedRound: 'synthesis',
        });
      }
    }

    return issues;
  }

  /**
   * 권고사항 생성
   */
  private generateRecommendations(issues: GovernanceIssue[]): string[] {
    const recommendations: string[] = [];

    const issueTypes = new Set(issues.map(i => i.type));

    if (issueTypes.has('quality')) {
      recommendations.push('토론 각 단계의 완성도를 높이기 위해 추가 분석을 권고합니다.');
    }

    if (issueTypes.has('logic')) {
      recommendations.push(
        '논리적 일관성 향상을 위해 상대 관점을 명시적으로 반박/수용해야 합니다.'
      );
    }

    if (issueTypes.has('data')) {
      recommendations.push('근거 자료를 보강하여 주장의 신뢰성을 높이기 바랍니다.');
    }

    if (issues.some(i => i.severity === 'critical')) {
      recommendations.push('심각한 품질 이슈가 발견되어 토론 재진행을 권고합니다.');
    }

    return recommendations;
  }

  /**
   * QA 인사이트 발행
   */
  private publishQAInsight(
    debate: DebateRecord,
    review: Omit<GovernanceReview, 'id' | 'debateId'>
  ): void {
    const level: InsightLevel = review.approved
      ? 'info'
      : review.score >= 50
        ? 'warning'
        : 'critical';

    this.publishInsight(
      debate.domain,
      `[QA 검토] ${debate.topic}`,
      `QA 검토 완료: ${review.approved ? '승인' : '보완 필요'} (점수: ${review.score}/100)`,
      {
        level,
        confidence: review.score / 100,
        data: {
          debateId: debate.id,
          issues: review.issues,
          recommendations: review.recommendations,
        },
        actionable: !review.approved,
        suggestedActions: review.recommendations,
      }
    );
  }

  /**
   * 태스크 처리
   */
  async process(task: Task): Promise<TaskResult> {
    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { message: 'QA review processed' },
      processingTime: 0,
    };
  }

  /**
   * 에이전트 역량
   */
  getCapabilities(): string[] {
    return [
      'quality_assurance',
      'logic_validation',
      'evidence_verification',
      'actionability_review',
      'governance_approval',
    ];
  }

  /**
   * 코칭 적용
   */
  protected async applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void> {
    console.log(`[QASpecialist] 코칭 적용: ${feedback.suggestion}`);

    if (feedback.metric === 'accuracy' && feedback.score < feedback.benchmark) {
      // 검증 기준 강화
      this.minConfidenceThreshold = Math.min(70, this.minConfidenceThreshold + 5);
      this.minEvidenceCount = Math.min(5, this.minEvidenceCount + 1);
    }
  }
}
