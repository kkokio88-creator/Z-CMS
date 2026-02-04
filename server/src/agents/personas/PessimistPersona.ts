/**
 * 비관론자(Pessimist) 페르소나
 * 반(反/Antithesis) - 제약 조건, 리스크, 잠재적 실패 요인
 * SOP: 검증가 (The Pessimist)
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

export class PessimistPersona extends TrioPersona {
  constructor(
    id: AgentId,
    team: DomainTeam,
    domain: InsightDomain,
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry
  ) {
    const config: TrioPersonaConfig = {
      role: 'pessimist',
      team,
      domain,
    };
    super(id, config, eventBus, stateManager, learningRegistry);
  }

  /**
   * 비관적 입장 생성
   * "무엇 때문에 이 프로젝트가 실패할 것인가?"
   */
  protected async generatePosition(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    priorRounds?: DebateRound[]
  ): Promise<DebateContent> {
    const thesis = priorRounds?.[0];

    // Gemini 어댑터가 없으면 기본 응답 생성
    if (!this.geminiAdapter) {
      return this.generateMockPosition(topic, contextData, thesis);
    }

    try {
      const prompt = this.buildPessimistPrompt(topic, contextData, catsCommand, thesis);
      const response = await this.geminiAdapter.generate(prompt);
      return this.parseResponse(response.text, topic);
    } catch (error) {
      console.error(`[${this.id}] Gemini 호출 실패:`, error);
      return this.generateMockPosition(topic, contextData, thesis);
    }
  }

  /**
   * 비관론자 프롬프트 구성
   */
  private buildPessimistPrompt(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    thesis?: DebateRound
  ): string {
    const verbosityGuide = {
      concise: '핵심 리스크만 간결하게',
      normal: '주요 리스크를 적절히 상세하게',
      detailed: '모든 잠재적 위험을 철저히 분석하여',
    };

    let thesisContext = '';
    if (thesis) {
      thesisContext = `
## 낙관론자의 주장 (반박 대상)
- 입장: ${thesis.content.position}
- 추론: ${thesis.content.reasoning}
- 근거: ${thesis.content.evidence.join(', ')}
- 신뢰도: ${thesis.content.confidence}%
`;
    }

    return `당신은 ${this.team}의 검증가(Pessimist)입니다.

## C.A.T.S 명령
- Context: ${catsCommand.context}
- Agent Role: ${catsCommand.agentRole} - 리스크와 제약에 집중
- Task: ${catsCommand.task}
- Success Criteria: ${catsCommand.successCriteria}

## 분석 주제
${topic}
${thesisContext}
## 배경 데이터
${JSON.stringify(contextData, null, 2)}

## 지시사항
${verbosityGuide[this.verbosityLevel]} 다음 관점에서 분석하세요:
1. 실패 시나리오: 이 계획이 실패할 수 있는 경우는?
2. 숨겨진 비용: 예상치 못한 추가 비용이나 자원 소모는?
3. 외부 위험: 시장, 경쟁, 규제 등 외부 요인은?
4. 실행 장애물: 구현 과정에서 마주칠 현실적 문제는?
5. 최악의 시나리오: 가장 부정적인 결과는 무엇인가?

**중요**: 낙관론자의 주장에 있는 허점과 간과된 위험을 정확히 지적하세요.

## 응답 형식 (JSON)
{
  "position": "핵심 반론 (한 문장)",
  "reasoning": "리스크 분석 과정 설명",
  "evidence": ["위험 요소 1", "위험 요소 2", "위험 요소 3"],
  "confidence": 75,
  "suggestedActions": ["위험 완화 조치 1", "위험 완화 조치 2"]
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
        position: parsed.position || `${topic}에는 주의가 필요한 위험 요소가 있습니다`,
        reasoning: parsed.reasoning || '분석 결과 간과된 리스크가 발견되었습니다.',
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        confidence: this.getAdjustedConfidence(parsed.confidence || 70),
        suggestedActions: parsed.suggestedActions,
      };
    } catch (error) {
      console.error(`[${this.id}] 응답 파싱 실패:`, error);
      return this.generateMockPosition(topic, {}, undefined);
    }
  }

  /**
   * 목 응답 생성 (API 없을 때)
   */
  private generateMockPosition(
    topic: string,
    contextData: unknown,
    thesis?: DebateRound
  ): DebateContent {
    const domainRisks: Record<InsightDomain, string[]> = {
      bom: [
        '원자재 가격 변동에 따른 예산 초과 위험',
        '대체 원자재 품질 검증 미흡 가능성',
        '공급업체 의존도 증가에 따른 리스크',
      ],
      waste: [
        '폐기물 처리 비용 과소평가 가능성',
        '환경 규제 강화에 따른 추가 비용 발생',
        '재활용 인프라 구축 비용 미반영',
      ],
      inventory: [
        '수요 예측 불확실성으로 인한 재고 위험',
        '보관 비용 및 감가상각 고려 미흡',
        '긴급 발주 시 추가 비용 발생 가능',
      ],
      profitability: [
        '경쟁사 가격 전략에 따른 마진 압박',
        '고정비 증가로 인한 수익성 악화 가능',
        '시장 변동성에 따른 매출 감소 위험',
      ],
      general: [
        '실행 역량 부족에 따른 지연 가능성',
        '조직 내 저항으로 인한 추진력 약화',
        '예상치 못한 외부 요인 발생 가능성',
      ],
    };

    const risks = domainRisks[this.domain];

    let counterArgument = '';
    if (thesis) {
      counterArgument = `낙관론자의 "${thesis.content.position}"는 다음 요소를 간과하고 있습니다: `;
    }

    return {
      position: `${counterArgument}${topic}에는 신중한 접근이 필요합니다.`,
      reasoning: `${this.domain} 영역에서 다음과 같은 잠재적 위험 요소가 식별되었습니다. 이러한 리스크를 사전에 인지하고 대응책을 마련하지 않으면 예상치 못한 문제가 발생할 수 있습니다.`,
      evidence: risks,
      confidence: this.getAdjustedConfidence(72),
      suggestedActions: [
        '리스크 평가 매트릭스 작성',
        '비상 대응 계획 수립',
        '단계별 검증 프로세스 도입',
      ],
    };
  }
}
