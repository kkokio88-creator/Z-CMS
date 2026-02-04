import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GeminiAdapter {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private initialized = false;

  constructor() {
    // Lazy initialization - will be done on first API call
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      console.log('Gemini API initialized');
    } else {
      console.warn('Gemini API key not configured - using mock responses');
    }
  }

  async generate(prompt: string): Promise<GeminiResponse> {
    this.ensureInitialized();

    if (!this.model) {
      return this.generateMockResponse(prompt);
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.generateMockResponse(prompt);
    }
  }

  async analyzeAnomaly(data: {
    itemName: string;
    expected: number;
    actual: number;
    diffPercent: number;
    historicalContext?: string;
  }): Promise<string> {
    const prompt = `당신은 제조업 생산 분석 전문가입니다. 다음 BOM 차이를 분석해주세요:

품목: ${data.itemName}
표준량: ${data.expected}
실제 투입량: ${data.actual}
차이율: ${data.diffPercent.toFixed(1)}%
${data.historicalContext ? `과거 맥락: ${data.historicalContext}` : ''}

다음 형식으로 간결하게 분석해주세요 (한국어, 2-3문장):
1. 가능한 원인
2. 권장 조치

응답:`;

    const response = await this.generate(prompt);
    return response.text;
  }

  async predictInventory(data: {
    materialName: string;
    currentStock: number;
    avgDailyUsage: number;
    recentTrend: 'increasing' | 'decreasing' | 'stable';
  }): Promise<{ expectedQty: number; reasoning: string }> {
    const prompt = `당신은 재고 예측 전문가입니다. 다음 재고 상황을 분석해주세요:

자재명: ${data.materialName}
현재 재고: ${data.currentStock}
일평균 사용량: ${data.avgDailyUsage}
최근 추세: ${data.recentTrend === 'increasing' ? '증가' : data.recentTrend === 'decreasing' ? '감소' : '안정'}

예측 재고량과 근거를 JSON 형식으로 응답해주세요:
{"expectedQty": 숫자, "reasoning": "설명"}`;

    const response = await this.generate(prompt);

    try {
      const parsed = JSON.parse(response.text);
      return {
        expectedQty: parsed.expectedQty || data.currentStock,
        reasoning: parsed.reasoning || '분석 데이터 부족',
      };
    } catch {
      return {
        expectedQty: Math.round(data.currentStock * 0.95),
        reasoning: '일반적인 소비 패턴 기반 예측',
      };
    }
  }

  async analyzeProfitability(data: {
    channel: string;
    revenue: number;
    cost: number;
    margin: number;
    trend: string;
  }): Promise<string> {
    const prompt = `당신은 수익성 분석 전문가입니다. 다음 채널의 수익성을 분석해주세요:

채널: ${data.channel}
매출: ${data.revenue.toLocaleString()}원
비용: ${data.cost.toLocaleString()}원
마진율: ${data.margin.toFixed(1)}%
추세: ${data.trend}

간결한 인사이트를 제공해주세요 (한국어, 2-3문장):`;

    const response = await this.generate(prompt);
    return response.text;
  }

  async analyzeCostStructure(data: {
    salesAmount: number;
    rawMaterialCost: number;
    subMaterialCost: number;
    laborCost: number;
    expenseAmount: number;
    targetRatios: {
      rawMaterial?: number;
      subMaterial?: number;
      labor?: number;
      expense?: number;
    };
    trend?: 'improving' | 'stable' | 'deteriorating';
  }): Promise<{ analysis: string; recommendations: string[] }> {
    const totalCost =
      data.rawMaterialCost + data.subMaterialCost + data.laborCost + data.expenseAmount;
    const profitRatio = data.salesAmount > 0 ? data.salesAmount / totalCost : 0;

    const prompt = `당신은 제조업 원가 관리 전문가입니다. 다음 원가 구조를 분석해주세요:

생산매출: ${data.salesAmount.toLocaleString()}원
원재료비: ${data.rawMaterialCost.toLocaleString()}원 (${data.targetRatios.rawMaterial ? `목표비율: ${data.targetRatios.rawMaterial}` : '목표 미설정'})
부재료비: ${data.subMaterialCost.toLocaleString()}원 (${data.targetRatios.subMaterial ? `목표비율: ${data.targetRatios.subMaterial}` : '목표 미설정'})
노무비: ${data.laborCost.toLocaleString()}원 (${data.targetRatios.labor ? `목표비율: ${data.targetRatios.labor}` : '목표 미설정'})
경비: ${data.expenseAmount.toLocaleString()}원 (${data.targetRatios.expense ? `목표비율: ${data.targetRatios.expense}` : '목표 미설정'})
총 원가: ${totalCost.toLocaleString()}원
생산매출/원가 비율: ${profitRatio.toFixed(2)}
추세: ${data.trend === 'improving' ? '개선' : data.trend === 'deteriorating' ? '악화' : '안정'}

다음 JSON 형식으로 분석 결과를 제공해주세요:
{"analysis": "상황 분석 (2-3문장)", "recommendations": ["구체적 권장사항1", "권장사항2", "권장사항3"]}`;

    const response = await this.generate(prompt);

    try {
      const parsed = JSON.parse(response.text);
      return {
        analysis: parsed.analysis || '원가 구조 분석 중입니다.',
        recommendations: parsed.recommendations || ['비용 항목별 상세 분석 필요'],
      };
    } catch {
      return {
        analysis:
          profitRatio < 1.2
            ? '원가 비율이 높아 수익성 개선이 필요합니다.'
            : '원가 구조가 양호한 상태입니다.',
        recommendations: [
          '원재료비 절감을 위한 대체 공급처 검토',
          '생산 효율성 향상을 통한 노무비 절감',
          '불필요한 경비 항목 검토',
        ],
      };
    }
  }

  async analyzeLaborCost(data: {
    totalLaborCost: number;
    employeeCount: number;
    overtimeHours: number;
    productionVolume: number;
    previousPeriodCost?: number;
  }): Promise<{ analysis: string; efficiencyScore: number; suggestions: string[] }> {
    const costPerEmployee = data.employeeCount > 0 ? data.totalLaborCost / data.employeeCount : 0;
    const costPerUnit = data.productionVolume > 0 ? data.totalLaborCost / data.productionVolume : 0;

    const prompt = `당신은 인건비 분석 전문가입니다. 다음 노무비 데이터를 분석해주세요:

총 노무비: ${data.totalLaborCost.toLocaleString()}원
인원수: ${data.employeeCount}명
초과근무 시간: ${data.overtimeHours}시간
생산량: ${data.productionVolume}
${data.previousPeriodCost ? `전기 대비 증감: ${(((data.totalLaborCost - data.previousPeriodCost) / data.previousPeriodCost) * 100).toFixed(1)}%` : ''}
인당 노무비: ${costPerEmployee.toLocaleString()}원
단위당 노무비: ${costPerUnit.toFixed(0)}원

다음 JSON 형식으로 분석 결과를 제공해주세요:
{"analysis": "노무비 현황 분석 (2문장)", "efficiencyScore": 0-100, "suggestions": ["개선방안1", "개선방안2"]}`;

    const response = await this.generate(prompt);

    try {
      const parsed = JSON.parse(response.text);
      return {
        analysis: parsed.analysis || '노무비 분석 중입니다.',
        efficiencyScore: parsed.efficiencyScore || 70,
        suggestions: parsed.suggestions || ['인력 배치 최적화 검토'],
      };
    } catch {
      const overtimeRatio = data.overtimeHours / (data.employeeCount * 160); // 월 160시간 기준
      return {
        analysis:
          overtimeRatio > 0.1
            ? '초과근무 비율이 높아 인력 충원 또는 생산 계획 조정이 필요합니다.'
            : '노무비 구조가 안정적입니다.',
        efficiencyScore: Math.round(Math.max(50, 90 - overtimeRatio * 100)),
        suggestions: [
          overtimeRatio > 0.1 ? '초과근무 원인 분석 및 인력 배치 조정' : '현 인력 운영 유지',
          '생산성 향상을 위한 교육 투자 검토',
        ],
      };
    }
  }

  async analyzePurchaseOrders(data: {
    totalAmount: number;
    orderCount: number;
    topSuppliers: { name: string; amount: number }[];
    urgentOrders: number;
    leadTimeAvg: number;
  }): Promise<{ analysis: string; riskLevel: 'low' | 'medium' | 'high'; suggestions: string[] }> {
    const prompt = `당신은 구매/조달 분석 전문가입니다. 다음 발주 데이터를 분석해주세요:

총 발주금액: ${data.totalAmount.toLocaleString()}원
발주건수: ${data.orderCount}건
긴급발주: ${data.urgentOrders}건
평균 리드타임: ${data.leadTimeAvg}일
상위 거래처: ${data.topSuppliers.map(s => `${s.name}(${s.amount.toLocaleString()}원)`).join(', ')}

다음 JSON 형식으로 분석 결과를 제공해주세요:
{"analysis": "발주 현황 분석 (2문장)", "riskLevel": "low/medium/high", "suggestions": ["개선방안1", "개선방안2"]}`;

    const response = await this.generate(prompt);

    try {
      const parsed = JSON.parse(response.text);
      return {
        analysis: parsed.analysis || '발주 현황을 분석 중입니다.',
        riskLevel: parsed.riskLevel || 'medium',
        suggestions: parsed.suggestions || ['발주 패턴 최적화 검토'],
      };
    } catch {
      const urgentRatio = data.urgentOrders / data.orderCount;
      return {
        analysis:
          urgentRatio > 0.2
            ? '긴급발주 비율이 높아 재고 관리 및 발주 계획 개선이 필요합니다.'
            : '발주 관리가 안정적입니다.',
        riskLevel: urgentRatio > 0.3 ? 'high' : urgentRatio > 0.1 ? 'medium' : 'low',
        suggestions: ['정기 발주 시스템 도입 검토', '주요 거래처 다각화로 리스크 분산'],
      };
    }
  }

  async generateCoordinatorSummary(domainInsights: {
    bomWaste?: string;
    inventory?: string;
    profitability?: string;
  }): Promise<string> {
    const parts = [];
    if (domainInsights.bomWaste) parts.push(`BOM/폐기물: ${domainInsights.bomWaste}`);
    if (domainInsights.inventory) parts.push(`재고: ${domainInsights.inventory}`);
    if (domainInsights.profitability) parts.push(`수익성: ${domainInsights.profitability}`);

    const prompt = `당신은 생산 관리 총괄 분석가입니다. 다음 도메인별 인사이트를 종합하여 경영진을 위한 핵심 요약을 제공해주세요:

${parts.join('\n\n')}

다음 형식으로 응답해주세요 (한국어):
1. 핵심 현황 (1문장)
2. 우선 조치 사항 (1-2개)
3. 예상 영향 (간략히)`;

    const response = await this.generate(prompt);
    return response.text;
  }

  private generateMockResponse(prompt: string): GeminiResponse {
    let mockText = '';

    if (prompt.includes('BOM') || prompt.includes('차이')) {
      mockText =
        '최근 원자재 품질 변동으로 인한 투입량 증가로 판단됩니다. 공급업체 품질 검수를 강화하고, 작업 표준서 업데이트를 권장합니다.';
    } else if (prompt.includes('재고') || prompt.includes('예측')) {
      mockText = JSON.stringify({
        expectedQty: 150,
        reasoning: '계절적 수요 증가와 최근 출고 패턴을 고려한 예측입니다.',
      });
    } else if (prompt.includes('원가') || prompt.includes('비용')) {
      mockText = JSON.stringify({
        analysis:
          '원재료비 비중이 높아 원가 구조 개선이 필요합니다. 목표 대비 노무비는 양호한 수준입니다.',
        recommendations: [
          '원재료 대체재 검토 또는 대량 구매 협상',
          '생산 공정 효율화로 부재료 사용 절감',
          '경비 항목 중 불필요한 지출 검토',
        ],
      });
    } else if (prompt.includes('노무비') || prompt.includes('인건비')) {
      mockText = JSON.stringify({
        analysis: '초과근무 비율이 다소 높으나 생산성은 양호합니다.',
        efficiencyScore: 75,
        suggestions: ['야간 근무 인력 배치 최적화', '자동화 투자를 통한 노동 집약도 감소'],
      });
    } else if (prompt.includes('발주') || prompt.includes('구매')) {
      mockText = JSON.stringify({
        analysis: '긴급발주 비율이 높아 재고 관리 개선이 필요합니다.',
        riskLevel: 'medium',
        suggestions: ['안전재고 수준 재검토', '주요 원재료 장기 계약 체결 검토'],
      });
    } else if (prompt.includes('수익') || prompt.includes('마진')) {
      mockText =
        '해당 채널의 마진율이 업계 평균 대비 양호합니다. 판매량 증대를 통한 추가 수익 확보가 가능할 것으로 보입니다.';
    } else if (prompt.includes('종합') || prompt.includes('요약')) {
      mockText = `1. 핵심 현황: 생산 효율성은 양호하나 일부 원자재 재고 주의가 필요합니다.
2. 우선 조치: PP 원료 긴급 발주 검토, BOM 표준량 업데이트
3. 예상 영향: 적시 조치 시 다음 주 생산 차질 방지 가능`;
    } else {
      mockText = '분석 데이터를 검토 중입니다. 추가 맥락 정보가 필요할 수 있습니다.';
    }

    return {
      text: mockText,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  isConfigured(): boolean {
    return this.model !== null;
  }

  // ============================================
  // 변증법적 토론 프레임워크 메서드 (정-반-합)
  // ============================================

  /**
   * 낙관론자(Optimist) 입장 생성 - 정(Thesis)
   */
  async generateOptimistPosition(data: {
    topic: string;
    contextData: unknown;
    domain: string;
    catsCommand: {
      context: string;
      task: string;
      successCriteria: string;
    };
  }): Promise<{
    position: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    suggestedActions: string[];
  }> {
    const prompt = `당신은 ${data.domain} 도메인의 혁신가(Optimist)입니다.

## C.A.T.S 명령
- Context: ${data.catsCommand.context}
- Agent Role: Optimist - 가능성, 확장성, 창의적 대안 제시
- Task: ${data.catsCommand.task}
- Success Criteria: ${data.catsCommand.successCriteria}

## 분석 주제
${data.topic}

## 배경 데이터
${JSON.stringify(data.contextData, null, 2).slice(0, 2000)}

## 지시사항
"어떻게 하면 이 아이디어를 가장 멋지게 실현할 수 있을까?"의 관점에서 분석하세요:
1. 성장 기회와 이익 가능성
2. 혁신적 접근 방식
3. 확장성과 장기적 가치
4. 최상의 시나리오

## 응답 형식 (JSON만 반환)
{
  "position": "핵심 주장 (한 문장)",
  "reasoning": "추론 과정 설명 (2-3문장)",
  "evidence": ["근거1", "근거2", "근거3"],
  "confidence": 75,
  "suggestedActions": ["권장 조치1", "권장 조치2"]
}`;

    const response = await this.generate(prompt);
    return this.parseDebateResponse(response.text, 'optimist');
  }

  /**
   * 비관론자(Pessimist) 입장 생성 - 반(Antithesis)
   */
  async generatePessimistPosition(data: {
    topic: string;
    contextData: unknown;
    domain: string;
    thesis: {
      position: string;
      reasoning: string;
      evidence: string[];
      confidence: number;
    };
    catsCommand: {
      context: string;
      task: string;
      successCriteria: string;
    };
  }): Promise<{
    position: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    suggestedActions: string[];
  }> {
    const prompt = `당신은 ${data.domain} 도메인의 검증가(Pessimist)입니다.

## C.A.T.S 명령
- Context: ${data.catsCommand.context}
- Agent Role: Pessimist - 제약 조건, 리스크, 잠재적 실패 요인 분석
- Task: ${data.catsCommand.task}
- Success Criteria: ${data.catsCommand.successCriteria}

## 분석 주제
${data.topic}

## 낙관론자(정/正)의 주장 (반박 대상)
- 입장: ${data.thesis.position}
- 추론: ${data.thesis.reasoning}
- 근거: ${data.thesis.evidence.join(', ')}
- 신뢰도: ${data.thesis.confidence}%

## 배경 데이터
${JSON.stringify(data.contextData, null, 2).slice(0, 1500)}

## 지시사항
"무엇 때문에 이 프로젝트가 실패할 것인가?"의 관점에서 분석하세요:
1. 실패 시나리오와 위험 요인
2. 숨겨진 비용과 자원 소모
3. 외부 위험 (시장, 경쟁, 규제)
4. 실행 장애물
5. 최악의 시나리오

**중요**: 낙관론자의 주장에 있는 허점과 간과된 위험을 정확히 지적하세요.

## 응답 형식 (JSON만 반환)
{
  "position": "핵심 반론 (한 문장)",
  "reasoning": "리스크 분석 과정 (2-3문장)",
  "evidence": ["위험 요소1", "위험 요소2", "위험 요소3"],
  "confidence": 70,
  "suggestedActions": ["위험 완화 조치1", "위험 완화 조치2"]
}`;

    const response = await this.generate(prompt);
    return this.parseDebateResponse(response.text, 'pessimist');
  }

  /**
   * 중재자(Mediator) 종합 생성 - 합(Synthesis)
   */
  async generateMediatorSynthesis(data: {
    topic: string;
    contextData: unknown;
    domain: string;
    thesis: {
      position: string;
      reasoning: string;
      evidence: string[];
      confidence: number;
    };
    antithesis: {
      position: string;
      reasoning: string;
      evidence: string[];
      confidence: number;
    };
    catsCommand: {
      context: string;
      task: string;
      successCriteria: string;
    };
  }): Promise<{
    position: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    suggestedActions: string[];
    dissent?: string;
  }> {
    const prompt = `당신은 ${data.domain} 도메인의 조율자(Mediator)입니다.

## C.A.T.S 명령
- Context: ${data.catsCommand.context}
- Agent Role: Mediator - 실현 가능성, 데이터 기반 객관성, 최종 합의
- Task: ${data.catsCommand.task}
- Success Criteria: ${data.catsCommand.successCriteria}

## 분석 주제
${data.topic}

## 낙관론자(정/正)의 주장
- 입장: ${data.thesis.position}
- 추론: ${data.thesis.reasoning}
- 근거: ${data.thesis.evidence.join(', ')}
- 신뢰도: ${data.thesis.confidence}%

## 비관론자(반/反)의 반론
- 입장: ${data.antithesis.position}
- 추론: ${data.antithesis.reasoning}
- 위험 요소: ${data.antithesis.evidence.join(', ')}
- 신뢰도: ${data.antithesis.confidence}%

## 배경 데이터
${JSON.stringify(data.contextData, null, 2).slice(0, 1000)}

## 지시사항
두 관점을 종합하여 실제 실행 가능한 최적의 결론(Action Plan)을 도출하세요:
1. 양측 검토: 낙관론의 기회와 비관론의 리스크를 객관적으로 평가
2. 공통점 발견: 두 관점이 동의하는 부분 식별
3. 균형점 도출: 기회를 살리면서 리스크를 완화할 수 있는 방안
4. 실행 계획: 구체적이고 실현 가능한 행동 계획
5. 우선순위 결정: 가장 중요한 조치 순서

**핵심 원칙**: 데이터 기반 객관적 판단, 현실적인 결론, 명확한 Action Items

## 응답 형식 (JSON만 반환)
{
  "position": "종합 결론 (한 문장)",
  "reasoning": "균형 분석 과정 (3-4문장)",
  "evidence": ["핵심 근거1", "핵심 근거2", "핵심 근거3"],
  "confidence": 80,
  "suggestedActions": ["우선 조치1", "후속 조치2", "모니터링 항목3"],
  "dissent": "소수 의견 (있는 경우만)"
}`;

    const response = await this.generate(prompt);
    return this.parseDebateResponse(response.text, 'mediator');
  }

  /**
   * QA 검토 수행
   */
  async performQAReview(debate: {
    topic: string;
    domain: string;
    thesis?: { position: string; reasoning: string; confidence: number };
    antithesis?: { position: string; reasoning: string; confidence: number };
    synthesis?: { position: string; reasoning: string; suggestedActions?: string[] };
  }): Promise<{
    approved: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const prompt = `당신은 품질 보증(QA) 전문가입니다. 다음 토론 결과를 검토해주세요:

## 토론 주제: ${debate.topic}
## 도메인: ${debate.domain}

## 정(Thesis)
${debate.thesis ? `- 입장: ${debate.thesis.position}\n- 추론: ${debate.thesis.reasoning}\n- 신뢰도: ${debate.thesis.confidence}%` : '없음'}

## 반(Antithesis)
${debate.antithesis ? `- 입장: ${debate.antithesis.position}\n- 추론: ${debate.antithesis.reasoning}\n- 신뢰도: ${debate.antithesis.confidence}%` : '없음'}

## 합(Synthesis)
${debate.synthesis ? `- 결론: ${debate.synthesis.position}\n- 추론: ${debate.synthesis.reasoning}\n- 권장 조치: ${debate.synthesis.suggestedActions?.join(', ') || '없음'}` : '없음'}

## 검토 기준
1. 논리적 일관성: 각 단계의 추론이 타당한가?
2. 완성도: 모든 단계가 충분히 작성되었는가?
3. 실행 가능성: 권장 조치가 구체적이고 실행 가능한가?
4. 균형성: 중재자가 양측을 적절히 반영했는가?

## 응답 형식 (JSON만 반환)
{
  "approved": true/false,
  "score": 0-100,
  "issues": ["발견된 문제1", "문제2"],
  "recommendations": ["개선 권고1", "권고2"]
}`;

    const response = await this.generate(prompt);

    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: parsed.approved ?? true,
          score: parsed.score ?? 70,
          issues: parsed.issues ?? [],
          recommendations: parsed.recommendations ?? [],
        };
      }
    } catch (e) {
      console.error('QA 검토 파싱 실패:', e);
    }

    return {
      approved: true,
      score: 75,
      issues: [],
      recommendations: ['상세 검토 필요'],
    };
  }

  /**
   * 컴플라이언스 검토 수행
   */
  async performComplianceReview(debate: {
    topic: string;
    domain: string;
    fullContent: string;
  }): Promise<{
    approved: boolean;
    score: number;
    violations: string[];
    recommendations: string[];
  }> {
    const prompt = `당신은 컴플라이언스 감사 전문가입니다. 다음 토론 내용을 검토해주세요:

## 토론 주제: ${debate.topic}
## 도메인: ${debate.domain}

## 토론 내용
${debate.fullContent.slice(0, 2000)}

## 검토 항목
1. 개인정보 보호: 민감한 개인정보가 포함되어 있는가?
2. 비즈니스 규정: 회사 정책이나 규정을 위반하는 내용이 있는가?
3. 리스크 관리: 적절한 리스크 분석과 완화 방안이 있는가?
4. 도메인 적합성: 토론 내용이 지정된 도메인과 관련 있는가?

## 응답 형식 (JSON만 반환)
{
  "approved": true/false,
  "score": 0-100,
  "violations": ["위반 사항1", "위반2"],
  "recommendations": ["권고1", "권고2"]
}`;

    const response = await this.generate(prompt);

    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: parsed.approved ?? true,
          score: parsed.score ?? 80,
          violations: parsed.violations ?? [],
          recommendations: parsed.recommendations ?? [],
        };
      }
    } catch (e) {
      console.error('컴플라이언스 검토 파싱 실패:', e);
    }

    return {
      approved: true,
      score: 80,
      violations: [],
      recommendations: ['정기 컴플라이언스 검토 권장'],
    };
  }

  /**
   * 토론 응답 파싱 헬퍼
   */
  private parseDebateResponse(
    text: string,
    role: 'optimist' | 'pessimist' | 'mediator'
  ): {
    position: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    suggestedActions: string[];
    dissent?: string;
  } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          position: parsed.position || this.getDefaultPosition(role),
          reasoning: parsed.reasoning || '분석 진행 중',
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
          confidence: parsed.confidence || 70,
          suggestedActions: parsed.suggestedActions || [],
          dissent: parsed.dissent,
        };
      }
    } catch (e) {
      console.error('토론 응답 파싱 실패:', e);
    }

    return {
      position: this.getDefaultPosition(role),
      reasoning: '추가 분석이 필요합니다.',
      evidence: [],
      confidence: 65,
      suggestedActions: ['상세 검토 필요'],
    };
  }

  private getDefaultPosition(role: 'optimist' | 'pessimist' | 'mediator'): string {
    const defaults = {
      optimist: '기회 요인이 발견되어 추가 검토가 권장됩니다.',
      pessimist: '주의가 필요한 리스크 요인이 있습니다.',
      mediator: '양측 의견을 종합하여 균형 잡힌 접근이 필요합니다.',
    };
    return defaults[role];
  }
}

export const geminiAdapter = new GeminiAdapter();
