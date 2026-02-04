/**
 * 낙관론자(Optimist) 페르소나
 * 정(正/Thesis) - 가능성, 확장성, 창의적 대안 제시
 * SOP: 혁신가 (The Optimist)
 */

import { TrioPersona, TrioPersonaConfig } from '../base/TrioPersona.js';
import type {
  AgentId,
  CATSCommand,
  DebateRound,
  DebateContent,
  InsightDomain,
  DomainTeam
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class OptimistPersona extends TrioPersona {
  constructor(
    id: AgentId,
    team: DomainTeam,
    domain: InsightDomain,
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry
  ) {
    const config: TrioPersonaConfig = {
      role: 'optimist',
      team,
      domain
    };
    super(id, config, eventBus, stateManager, learningRegistry);
  }

  /**
   * 낙관적 입장 생성
   * "어떻게 하면 이 아이디어를 가장 멋지게 실현할 수 있을까?"
   */
  protected async generatePosition(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand,
    priorRounds?: DebateRound[]
  ): Promise<DebateContent> {
    // Gemini 어댑터가 없으면 기본 응답 생성
    if (!this.geminiAdapter) {
      return this.generateMockPosition(topic, contextData);
    }

    try {
      const prompt = this.buildOptimistPrompt(topic, contextData, catsCommand);
      const response = await this.geminiAdapter.generate(prompt);
      return this.parseResponse(response.text, topic);
    } catch (error) {
      console.error(`[${this.id}] Gemini 호출 실패:`, error);
      return this.generateMockPosition(topic, contextData);
    }
  }

  /**
   * 낙관론자 프롬프트 구성
   */
  private buildOptimistPrompt(
    topic: string,
    contextData: unknown,
    catsCommand: CATSCommand
  ): string {
    const verbosityGuide = {
      concise: '핵심만 간결하게 2-3문장으로',
      normal: '적절한 수준으로 상세하게',
      detailed: '가능한 모든 기회를 상세히 분석하여'
    };

    return `당신은 ${this.team}의 혁신가(Optimist)입니다.

## C.A.T.S 명령
- Context: ${catsCommand.context}
- Agent Role: ${catsCommand.agentRole} - 가능성과 기회에 집중
- Task: ${catsCommand.task}
- Success Criteria: ${catsCommand.successCriteria}

## 분석 주제
${topic}

## 배경 데이터
${JSON.stringify(contextData, null, 2)}

## 지시사항
${verbosityGuide[this.verbosityLevel]} 다음 관점에서 분석하세요:
1. 성장 기회: 이 상황에서 얻을 수 있는 최대의 이익은?
2. 혁신 가능성: 새로운 접근 방식이나 개선점은?
3. 확장성: 장기적으로 어떤 가치를 창출할 수 있는가?
4. 긍정적 시나리오: 최상의 결과는 어떤 모습인가?

## 응답 형식 (JSON)
{
  "position": "핵심 주장 (한 문장)",
  "reasoning": "추론 과정 설명",
  "evidence": ["근거 1", "근거 2", "근거 3"],
  "confidence": 75,
  "suggestedActions": ["권장 조치 1", "권장 조치 2"]
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
        position: parsed.position || `${topic}에서 성장 기회가 있습니다`,
        reasoning: parsed.reasoning || '분석 결과 긍정적인 가능성이 확인되었습니다.',
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        confidence: this.getAdjustedConfidence(parsed.confidence || 70),
        suggestedActions: parsed.suggestedActions
      };
    } catch (error) {
      console.error(`[${this.id}] 응답 파싱 실패:`, error);
      return this.generateMockPosition(topic, {});
    }
  }

  /**
   * 목 응답 생성 (API 없을 때)
   */
  private generateMockPosition(topic: string, contextData: unknown): DebateContent {
    const domainOpportunities: Record<InsightDomain, string[]> = {
      bom: [
        '원가 절감 가능성 발견',
        '대체 원자재를 통한 품질 개선 기회',
        '생산 효율성 향상 여지 존재'
      ],
      waste: [
        '폐기물 감소를 통한 비용 절감 가능',
        '재활용 프로세스 도입 기회',
        '친환경 생산으로 브랜드 가치 상승'
      ],
      inventory: [
        '재고 최적화로 자금 효율성 개선',
        '적시 납품 체계 구축 가능',
        '안전재고 조정으로 비용 절감'
      ],
      profitability: [
        '고수익 채널 확대 기회',
        '가격 정책 최적화 여지',
        '신규 시장 진입 가능성'
      ],
      general: [
        '전반적인 운영 효율성 개선 가능',
        '디지털 전환 기회 발견',
        '조직 역량 강화 여지 존재'
      ]
    };

    const opportunities = domainOpportunities[this.domain];

    return {
      position: `${topic} 분석 결과, 상당한 개선 기회가 발견되었습니다.`,
      reasoning: `현재 상황을 면밀히 검토한 결과, ${this.domain} 영역에서 다음과 같은 성장 가능성이 확인되었습니다. 적극적인 개선 노력을 통해 예상보다 큰 성과를 달성할 수 있을 것으로 전망됩니다.`,
      evidence: opportunities,
      confidence: this.getAdjustedConfidence(75),
      suggestedActions: [
        '상세 기회 분석 실시',
        '파일럿 프로젝트 기획',
        '이해관계자 의견 수렴'
      ]
    };
  }
}
