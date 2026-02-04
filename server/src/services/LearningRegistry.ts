import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  LearningRecord,
  FeedbackType,
  CoachingFeedback,
  CoachingMetric,
} from '../types/index.js';

interface AgentPerformance {
  agentId: AgentId;
  totalInsights: number;
  helpfulCount: number;
  dismissedCount: number;
  correctedCount: number;
  accuracyScore: number;
  acceptanceRate: number;
  lastUpdated: Date;
}

export class LearningRegistry {
  private records: LearningRecord[] = [];
  private readonly maxRecords = 5000;
  private performanceCache: Map<AgentId, AgentPerformance> = new Map();

  /**
   * Record an agent's output for later feedback correlation
   */
  recordOutput(agentId: AgentId, insightId: string, output: LearningRecord['output']): string {
    const record: LearningRecord = {
      id: uuidv4(),
      agentId,
      timestamp: new Date(),
      insightId,
      output,
    };

    this.records.push(record);

    // Cleanup old records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    return record.id;
  }

  /**
   * Record user feedback for an insight
   */
  recordFeedback(insightId: string, feedbackType: FeedbackType, correction?: unknown): boolean {
    const record = this.records.find(r => r.insightId === insightId);
    if (!record) {
      console.warn(`No learning record found for insight: ${insightId}`);
      return false;
    }

    record.feedback = {
      type: feedbackType,
      correction,
      timestamp: new Date(),
    };

    // Update performance cache
    this.updatePerformance(record.agentId, feedbackType);

    return true;
  }

  /**
   * Record that coaching was applied to an agent
   */
  recordCoaching(agentId: AgentId, insightId: string, adjustments: string[]): void {
    const record = this.records.find(r => r.agentId === agentId && r.insightId === insightId);

    if (record) {
      record.coaching = {
        appliedAt: new Date(),
        adjustments,
      };
    }
  }

  /**
   * Get performance metrics for an agent
   */
  getAgentPerformance(agentId: AgentId): AgentPerformance {
    const cached = this.performanceCache.get(agentId);
    if (cached) {
      return cached;
    }

    // Calculate from records
    return this.calculatePerformance(agentId);
  }

  /**
   * Check if an agent needs coaching based on performance
   */
  needsCoaching(agentId: AgentId, threshold = 70): boolean {
    const performance = this.getAgentPerformance(agentId);
    return performance.acceptanceRate < threshold && performance.totalInsights >= 5;
  }

  /**
   * Generate coaching feedback for an agent
   */
  generateCoachingFeedback(agentId: AgentId): CoachingFeedback | null {
    const performance = this.getAgentPerformance(agentId);

    if (!this.needsCoaching(agentId)) {
      return null;
    }

    // Find recent dismissed/corrected examples
    const recentFailures = this.records
      .filter(
        r =>
          r.agentId === agentId &&
          r.feedback &&
          (r.feedback.type === 'dismissed' || r.feedback.type === 'corrected')
      )
      .slice(-5);

    const examples = recentFailures.map(r => ({
      input: r.output.content,
      expectedOutput: r.feedback?.correction || 'N/A',
      actualOutput: r.output.content,
    }));

    // Determine which metric to focus on
    let metric: CoachingMetric = 'user_acceptance';
    let suggestion = '';

    if (performance.dismissedCount > performance.correctedCount) {
      suggestion = `사용자들이 자주 인사이트를 무시합니다. 다음을 고려하세요:
1. 더 구체적이고 실행 가능한 인사이트 제공
2. 신뢰도가 낮은 분석은 제외
3. 맥락과 근거를 더 명확히 설명`;
    } else {
      metric = 'accuracy';
      suggestion = `분석 정확도 개선이 필요합니다. 다음을 고려하세요:
1. 데이터 패턴을 더 신중하게 분석
2. 이상치와 정상 변동을 구분
3. 과거 피드백 사례 학습`;
    }

    return {
      metric,
      score: performance.acceptanceRate,
      benchmark: 80,
      suggestion,
      examples,
    };
  }

  /**
   * Get learning records for an agent
   */
  getRecords(agentId?: AgentId, limit = 100): LearningRecord[] {
    let filtered = this.records;
    if (agentId) {
      filtered = filtered.filter(r => r.agentId === agentId);
    }
    return filtered.slice(-limit);
  }

  /**
   * Get records with feedback
   */
  getRecordsWithFeedback(agentId?: AgentId): LearningRecord[] {
    return this.records.filter(r => r.feedback && (!agentId || r.agentId === agentId));
  }

  /**
   * Get all agent performances
   */
  getAllPerformances(): AgentPerformance[] {
    const agentIds: AgentId[] = ['bom-waste-agent', 'inventory-agent', 'profitability-agent'];

    return agentIds.map(id => this.getAgentPerformance(id));
  }

  private updatePerformance(agentId: AgentId, feedbackType: FeedbackType): void {
    const performance = this.calculatePerformance(agentId);
    this.performanceCache.set(agentId, performance);
  }

  private calculatePerformance(agentId: AgentId): AgentPerformance {
    const agentRecords = this.records.filter(r => r.agentId === agentId);
    const recordsWithFeedback = agentRecords.filter(r => r.feedback);

    const helpfulCount = recordsWithFeedback.filter(r => r.feedback?.type === 'helpful').length;
    const dismissedCount = recordsWithFeedback.filter(r => r.feedback?.type === 'dismissed').length;
    const correctedCount = recordsWithFeedback.filter(r => r.feedback?.type === 'corrected').length;

    const totalWithFeedback = recordsWithFeedback.length || 1;

    return {
      agentId,
      totalInsights: agentRecords.length,
      helpfulCount,
      dismissedCount,
      correctedCount,
      accuracyScore: Math.round(((helpfulCount + correctedCount * 0.5) / totalWithFeedback) * 100),
      acceptanceRate: Math.round((helpfulCount / totalWithFeedback) * 100),
      lastUpdated: new Date(),
    };
  }
}
