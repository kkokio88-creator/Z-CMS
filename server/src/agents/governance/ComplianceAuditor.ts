/**
 * Compliance Auditor Agent
 * 품질 및 거버넌스 계층 (Governance Layer)
 *
 * 역할:
 * - 규정 준수 확인
 * - 데이터 프라이버시 검토
 * - 비즈니스 룰 준수 확인
 * - 리스크 평가 검토
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
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';
import type { DebateManager } from '../../services/DebateManager.js';
import type { GeminiAdapter } from '../../adapters/GeminiAdapter.js';

// 컴플라이언스 룰 정의
interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'data_privacy' | 'business_rule' | 'risk_management' | 'regulatory';
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (debate: DebateRecord) => boolean;
}

export class ComplianceAuditor extends Agent {
  private debateManager?: DebateManager;
  private geminiAdapter?: GeminiAdapter;

  // 컴플라이언스 규칙들
  private rules: ComplianceRule[] = [
    {
      id: 'DP001',
      name: '개인정보 노출 금지',
      description: '토론 내용에 개인 식별 정보가 포함되어서는 안 됩니다.',
      category: 'data_privacy',
      severity: 'critical',
      check: debate => {
        const content = JSON.stringify(debate);
        // 이메일, 전화번호, 주민번호 패턴 검사
        const piiPatterns = [
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
          /\b01[0-9]-?\d{3,4}-?\d{4}\b/,
          /\b\d{6}-?[1-4]\d{6}\b/,
        ];
        return !piiPatterns.some(pattern => pattern.test(content));
      },
    },
    {
      id: 'BR001',
      name: '재무 데이터 정확성',
      description: '재무 관련 수치는 검증 가능한 출처가 있어야 합니다.',
      category: 'business_rule',
      severity: 'high',
      check: debate => {
        // 금액 관련 수치가 있을 때 근거도 있는지 확인
        const hasFinancialData = /[₩\$]\d+|억|만원/.test(JSON.stringify(debate));
        if (!hasFinancialData) return true;

        const hasEvidence =
          debate.thesis?.content.evidence?.length > 0 ||
          debate.antithesis?.content.evidence?.length > 0 ||
          debate.synthesis?.content.evidence?.length > 0;
        return hasEvidence;
      },
    },
    {
      id: 'RM001',
      name: '리스크 평가 필수',
      description: '모든 토론에는 리스크 분석이 포함되어야 합니다.',
      category: 'risk_management',
      severity: 'medium',
      check: debate => {
        // 비관론자(antithesis)가 리스크를 언급했는지 확인
        if (!debate.antithesis) return false;
        const riskKeywords = ['리스크', '위험', '우려', '문제', '장애', '실패', 'risk'];
        const content =
          debate.antithesis.content.reasoning.toLowerCase() +
          debate.antithesis.content.position.toLowerCase();
        return riskKeywords.some(keyword => content.includes(keyword));
      },
    },
    {
      id: 'RM002',
      name: '리스크 완화 방안',
      description: '식별된 리스크에 대한 완화 방안이 제시되어야 합니다.',
      category: 'risk_management',
      severity: 'medium',
      check: debate => {
        if (!debate.synthesis) return false;
        const mitigationKeywords = ['완화', '대응', '방지', '예방', '관리', '조치'];
        const actions = debate.synthesis.content.suggestedActions || [];
        return actions.some(action => mitigationKeywords.some(keyword => action.includes(keyword)));
      },
    },
    {
      id: 'RG001',
      name: '도메인 관련성',
      description: '토론 내용이 지정된 도메인과 관련되어야 합니다.',
      category: 'regulatory',
      severity: 'low',
      check: debate => {
        const domainKeywords: Record<string, string[]> = {
          bom: ['BOM', '원자재', '생산', '제조', '부품'],
          waste: ['폐기물', '손실', '불량', '스크랩'],
          inventory: ['재고', '창고', '보관', '안전재고', '발주'],
          profitability: ['수익', '마진', '매출', '이익', '채널'],
          general: ['원가', '비용', '경영', '전략'],
        };

        const keywords = domainKeywords[debate.domain] || domainKeywords.general;
        const content = JSON.stringify(debate).toLowerCase();
        return keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
      },
    },
    {
      id: 'BR002',
      name: '결론 명확성',
      description: '최종 결론은 명확하고 실행 가능해야 합니다.',
      category: 'business_rule',
      severity: 'medium',
      check: debate => {
        if (!debate.synthesis) return false;
        const position = debate.synthesis.content.position;
        const actions = debate.synthesis.content.suggestedActions || [];

        // 결론이 최소 길이 이상이고 실행 항목이 있는지
        return position.length >= 20 && actions.length >= 1;
      },
    },
  ];

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('compliance-auditor', eventBus, stateManager, learningRegistry);
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
      const review = await this.performComplianceReview(payload.debate);

      // 토론 매니저에 검토 결과 추가
      if (this.debateManager) {
        await this.debateManager.addGovernanceReview(payload.debateId, review);
      }

      // 결과 전송
      const sender = this.eventBus.createSender(this.id);
      sender.reply(message, 'GOVERNANCE_REVIEW_RESULT', {
        debateId: payload.debateId,
        review,
        reviewType: 'compliance',
      });

      this.processedTasks++;
      this.successfulTasks++;
      this.totalProcessingTime += Date.now() - startTime;

      // 컴플라이언스 위반 발견 시 인사이트 발행
      if (!review.approved) {
        this.publishComplianceInsight(payload.debate, review);
      }
    } catch (error) {
      console.error('[ComplianceAuditor] 검토 오류:', error);
      this.status = 'error';
    } finally {
      this.status = 'idle';
    }
  }

  /**
   * 컴플라이언스 검토 수행
   */
  async performComplianceReview(
    debate: DebateRecord
  ): Promise<Omit<GovernanceReview, 'id' | 'debateId'>> {
    const issues: GovernanceIssue[] = [];
    let score = 100;

    // 각 규칙 검사
    for (const rule of this.rules) {
      try {
        const passed = rule.check(debate);

        if (!passed) {
          const severityPenalty = {
            low: 5,
            medium: 10,
            high: 20,
            critical: 40,
          };

          issues.push({
            type: 'compliance',
            severity: rule.severity,
            description: `[${rule.id}] ${rule.name}: ${rule.description}`,
          });

          score -= severityPenalty[rule.severity];
        }
      } catch (error) {
        console.error(`[ComplianceAuditor] 규칙 ${rule.id} 검사 오류:`, error);
      }
    }

    // 점수 범위 조정
    score = Math.max(0, Math.min(100, score));

    // 승인 기준: 점수 60 이상 & critical 이슈 없음
    const approved = score >= 60 && !issues.some(i => i.severity === 'critical');

    // 권고사항 생성
    const recommendations = this.generateRecommendations(issues);

    return {
      reviewerId: 'compliance-auditor',
      reviewerAgentId: this.id,
      approved,
      issues: issues.length > 0 ? issues : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      score,
      timestamp: new Date(),
    };
  }

  /**
   * 권고사항 생성
   */
  private generateRecommendations(issues: GovernanceIssue[]): string[] {
    const recommendations: string[] = [];
    const categories = new Set(
      issues.map(i => {
        const match = i.description.match(/\[(.*?)\]/);
        return match ? match[1].substring(0, 2) : '';
      })
    );

    if (issues.some(i => i.description.includes('DP'))) {
      recommendations.push('개인정보 보호를 위해 민감 데이터를 익명화하거나 제거하세요.');
    }

    if (issues.some(i => i.description.includes('BR'))) {
      recommendations.push('비즈니스 규정 준수를 위해 결론과 근거를 보강하세요.');
    }

    if (issues.some(i => i.description.includes('RM'))) {
      recommendations.push('리스크 관리 체계를 강화하고 완화 방안을 명시하세요.');
    }

    if (issues.some(i => i.description.includes('RG'))) {
      recommendations.push('토론 내용이 지정된 도메인과 관련성을 갖도록 조정하세요.');
    }

    if (issues.some(i => i.severity === 'critical')) {
      recommendations.push('심각한 컴플라이언스 위반이 발견되어 즉각적인 조치가 필요합니다.');
    }

    return recommendations;
  }

  /**
   * 컴플라이언스 인사이트 발행
   */
  private publishComplianceInsight(
    debate: DebateRecord,
    review: Omit<GovernanceReview, 'id' | 'debateId'>
  ): void {
    const criticalIssues = review.issues?.filter(i => i.severity === 'critical') || [];
    const level: InsightLevel =
      criticalIssues.length > 0 ? 'critical' : review.score < 60 ? 'warning' : 'info';

    this.publishInsight(
      debate.domain,
      `[컴플라이언스] ${debate.topic}`,
      `컴플라이언스 검토 완료: ${review.approved ? '승인' : '위반 발견'} (점수: ${review.score}/100)`,
      {
        level,
        confidence: review.score / 100,
        data: {
          debateId: debate.id,
          issues: review.issues,
          recommendations: review.recommendations,
          violatedRules: review.issues?.map(i => {
            const match = i.description.match(/\[(.*?)\]/);
            return match ? match[1] : '';
          }),
        },
        actionable: !review.approved,
        suggestedActions: review.recommendations,
      }
    );
  }

  /**
   * 규칙 추가 (런타임에 규칙 확장 가능)
   */
  addRule(rule: ComplianceRule): void {
    this.rules.push(rule);
    console.log(`[ComplianceAuditor] 규칙 추가됨: ${rule.id} - ${rule.name}`);
  }

  /**
   * 규칙 목록 조회
   */
  getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  /**
   * 태스크 처리
   */
  async process(task: Task): Promise<TaskResult> {
    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { message: 'Compliance review processed' },
      processingTime: 0,
    };
  }

  /**
   * 에이전트 역량
   */
  getCapabilities(): string[] {
    return [
      'compliance_auditing',
      'data_privacy_review',
      'business_rule_validation',
      'risk_assessment_review',
      'regulatory_compliance',
      'governance_approval',
    ];
  }

  /**
   * 코칭 적용
   */
  protected async applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void> {
    console.log(`[ComplianceAuditor] 코칭 적용: ${feedback.suggestion}`);

    // 향후 규칙 가중치 조정 등에 활용 가능
  }
}
