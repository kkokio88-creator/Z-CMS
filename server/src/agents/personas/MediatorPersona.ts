/**
 * 중재자(Mediator) 페르소나
 * 합(合/Synthesis) - 실현 가능성, 데이터 기반 객관성, 최종 합의
 * SOP: 조율자 (The Mediator)
 */

import { TrioPersona, TrioPersonaConfig } from '../base/TrioPersona.js';
import type {
  AgentId,
  CATSCommand,
  DebateRound,
  DebateContent,
  InsightDomain,
  DomainTeam,
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class MediatorPersona extends TrioPersona {
  constructor(
    id: AgentId,
    team: DomainTeam,
    domain: InsightDomain,
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry
  ) {
    const config: TrioPersonaConfig = {
      role: 'mediator',
      team,
      domain,
    };
    super(id, config, eventBus, stateManager, learningRegistry);
  }

  /**
   * 종합적 입장 생성
   * 두 관점을 통합하여 실제 실행 가능한 최적의 결론 도출
   */
  protected async generatePosition(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    priorRounds?: DebateRound[]
  ): Promise<DebateContent> {
    const thesis = priorRounds?.[0];
    const antithesis = priorRounds?.[1];

    // Gemini 어댑터가 없으면 기본 응답 생성
    if (!this.geminiAdapter) {
      return this.generateMockPosition(topic, contextData, thesis, antithesis);
    }

    try {
      const prompt = this.buildMediatorPrompt(topic, contextData, catsCommand, thesis, antithesis);
      const response = await this.geminiAdapter.generate(prompt);
      return this.parseResponse(response.text, topic);
    } catch (error) {
      console.error(`[${this.id}] Gemini 호출 실패:`, error);
      return this.generateMockPosition(topic, contextData, thesis, antithesis);
    }
  }

  /**
   * 중재자 프롬프트 구성
   */
  private buildMediatorPrompt(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    thesis?: DebateRound,
    antithesis?: DebateRound
  ): string {
    const verbosityGuide = {
      concise: '핵심 결론만 명확하게',
      normal: '균형 잡힌 분석과 함께',
      detailed: '모든 관점을 종합하여 상세하게',
    };

    let debateContext = '';
    if (thesis && antithesis) {
      debateContext = `
## 낙관론자의 주장 (정/正)
- 입장: ${thesis.content.position}
- 추론: ${thesis.content.reasoning}
- 근거: ${thesis.content.evidence.join(', ')}
- 신뢰도: ${thesis.content.confidence}%

## 비관론자의 반론 (반/反)
- 입장: ${antithesis.content.position}
- 추론: ${antithesis.content.reasoning}
- 위험 요소: ${antithesis.content.evidence.join(', ')}
- 신뢰도: ${antithesis.content.confidence}%
`;
    }

    return `당신은 ${this.team}의 조율자(Mediator)입니다.

## C.A.T.S 명령
- Context: ${catsCommand.context}
- Agent Role: ${catsCommand.agentRole} - 균형 잡힌 종합과 최종 결정
- Task: ${catsCommand.task}
- Success Criteria: ${catsCommand.successCriteria}

## 분석 주제
${topic}
${debateContext}
## 배경 데이터
${JSON.stringify(contextData, null, 2)}

## 지시사항
${verbosityGuide[this.verbosityLevel]} 다음을 수행하세요:

1. **양측 검토**: 낙관론의 기회와 비관론의 리스크를 객관적으로 평가
2. **공통점 발견**: 두 관점이 동의하는 부분 식별
3. **균형점 도출**: 기회를 살리면서 리스크를 완화할 수 있는 방안
4. **실행 계획**: 구체적이고 실현 가능한 행동 계획 제시
5. **우선순위 결정**: 가장 중요한 조치 순서 결정

**핵심 원칙**:
- 데이터와 근거에 기반한 객관적 판단
- 극단적인 낙관도 비관도 아닌 현실적인 결론
- 명확한 다음 단계(Action Items) 제시

## 응답 형식 (JSON)
{
  "position": "종합 결론 (한 문장)",
  "reasoning": "균형 분석 과정 설명",
  "evidence": ["핵심 근거 1", "핵심 근거 2", "핵심 근거 3"],
  "confidence": 80,
  "suggestedActions": ["우선 조치 1", "후속 조치 2", "모니터링 항목 3"]
}

JSON만 반환하세요.`;
  }

  /**
   * 응답 파싱
   */
  private parseResponse(response: string, topic: string): DebateContent {
    try {
      // JSON 추출
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON을 찾을 수 없음');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        position: parsed.position || `${topic}에 대한 균형 잡힌 접근이 필요합니다`,
        reasoning: parsed.reasoning || '양측의 관점을 종합하여 최적의 결론을 도출했습니다.',
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        confidence: this.getAdjustedConfidence(parsed.confidence || 78),
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch (error) {
      console.error(`[${this.id}] 응답 파싱 실패:`, error);
      return this.generateMockPosition(topic, {}, undefined, undefined);
    }
  }

  /**
   * 목 응답 생성 (API 없을 때)
   */
  private generateMockPosition(
    topic: string,
    contextData: unknown,
    thesis?: DebateRound,
    antithesis?: DebateRound
  ): DebateContent {
    const domainSynthesis: Record<
      InsightDomain,
      {
        position: string;
        actions: string[];
      }
    > = {
      bom: {
        position: '원가 최적화와 품질 유지의 균형점을 찾아 단계적으로 개선을 추진해야 합니다.',
        actions: [
          '파일럿 테스트로 대체 원자재 검증',
          '리스크 완화 계획과 함께 점진적 도입',
          '주간 모니터링 및 품질 지표 추적',
        ],
      },
      waste: {
        position: '폐기물 감소 목표를 현실적으로 조정하고 단계별 실행 계획을 수립해야 합니다.',
        actions: [
          '현재 폐기물 발생 원인 정밀 분석',
          '비용 대비 효과가 큰 개선안부터 시행',
          '월간 폐기율 추적 및 목표 조정',
        ],
      },
      inventory: {
        position: '안전재고 수준을 데이터 기반으로 최적화하고 공급망 유연성을 확보해야 합니다.',
        actions: [
          '수요 예측 모델 정확도 개선',
          'ABC 분석 기반 차등적 재고 관리',
          '비상 공급 루트 확보',
        ],
      },
      profitability: {
        position: '수익성 개선과 리스크 관리를 병행하는 균형 잡힌 전략이 필요합니다.',
        actions: [
          '고수익 채널 우선 강화',
          '가격 변경 시 시장 반응 모니터링',
          '비용 구조 지속적 최적화',
        ],
      },
      general: {
        position: '기회를 포착하되 리스크를 관리하는 신중한 접근이 바람직합니다.',
        actions: [
          '우선순위 기반 단계적 실행',
          '주기적 성과 검토 및 조정',
          '이해관계자 지속적 커뮤니케이션',
        ],
      },
    };

    const synthesis = domainSynthesis[this.domain];

    // 양측 신뢰도를 고려한 가중 평균 신뢰도
    let synthesisConfidence = 78;
    if (thesis && antithesis) {
      synthesisConfidence = Math.round(
        thesis.content.confidence * 0.4 + antithesis.content.confidence * 0.4 + 20 // 중재자의 기본 신뢰도 보정
      );
    }

    const evidenceSummary: string[] = [];
    if (thesis) {
      evidenceSummary.push(`낙관론 핵심: ${thesis.content.evidence[0] || thesis.content.position}`);
    }
    if (antithesis) {
      evidenceSummary.push(
        `비관론 핵심: ${antithesis.content.evidence[0] || antithesis.content.position}`
      );
    }
    evidenceSummary.push('양측 관점을 종합한 균형 잡힌 접근 권고');

    return {
      position: synthesis.position,
      reasoning: `낙관론자의 기회 요소와 비관론자의 위험 요소를 모두 고려하여 분석했습니다. ${this.domain} 영역에서 실현 가능하고 리스크를 관리할 수 있는 최적의 방안을 도출했습니다.`,
      evidence: evidenceSummary,
      confidence: this.getAdjustedConfidence(synthesisConfidence),
      suggestedActions: synthesis.actions,
    };
  }

  /**
   * 인사이트로 변환하여 발행
   */
  async publishSynthesisAsInsight(
    topic: string,
    content: DebateContent,
    debateId: string
  ): Promise<void> {
    this.publishInsight(this.domain, `[토론 종합] ${topic}`, content.position, {
      highlight: content.reasoning.slice(0, 100),
      level: content.confidence >= 80 ? 'info' : content.confidence >= 60 ? 'warning' : 'critical',
      confidence: content.confidence / 100,
      data: {
        debateId,
        synthesisDetails: content,
      },
      actionable: true,
      suggestedActions: content.suggestedActions,
    });
  }
}
