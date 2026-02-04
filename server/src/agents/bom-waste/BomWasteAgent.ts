import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type { Task, TaskResult, CoachingMessage } from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager, BomDiffItem } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class BomWasteAgent extends Agent {
  private anomalyThreshold = 5; // Default 5% variance threshold
  private confidenceMultiplier = 1.0;

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('bom-waste-agent', eventBus, stateManager, learningRegistry);
  }

  getCapabilities(): string[] {
    return ['BOM 차이 분석', '폐기물 원인 추론', '표준량 업데이트 제안', '이상 패턴 감지'];
  }

  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'analyze_bom_variance':
          return await this.analyzeBomVariance(task);
        case 'analyze_waste_trend':
          return await this.analyzeWasteTrend(task);
        case 'generate_insight':
          return await this.generateDomainInsight(task);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
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

  /**
   * Analyze BOM variance and generate reasoning
   */
  private async analyzeBomVariance(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getBomWasteState();
    const bomItems = state.bomItems;

    if (bomItems.length === 0) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No BOM items to analyze' },
        processingTime: Date.now() - startTime,
      };
    }

    // Find items with significant variance
    const anomalies = bomItems.filter(item => Math.abs(item.diffPercent) >= this.anomalyThreshold);

    // Generate AI reasoning for each anomaly
    const analyzedItems: BomDiffItem[] = [];

    for (const item of anomalies.slice(0, 5)) {
      // Limit to top 5
      const reasoning = await geminiAdapter.analyzeAnomaly({
        itemName: item.skuName,
        expected: item.stdQty,
        actual: item.actualQty,
        diffPercent: item.diffPercent,
      });

      // Update item with reasoning
      const updatedItem: BomDiffItem = {
        ...item,
        reasoning,
        anomalyScore: this.calculateAnomalyScore(item) * this.confidenceMultiplier,
      };

      analyzedItems.push(updatedItem);

      // Update state
      this.stateManager.updateBomItem(item.id, {
        reasoning,
        anomalyScore: updatedItem.anomalyScore,
      });
    }

    // Publish insight if significant anomalies found
    if (analyzedItems.length > 0) {
      const topAnomaly = analyzedItems[0];
      this.publishInsight(
        'bom',
        `BOM 이상 감지: ${topAnomaly.skuName}`,
        topAnomaly.reasoning || `표준 대비 ${topAnomaly.diffPercent.toFixed(1)}% 차이 발생`,
        {
          highlight: `${analyzedItems.length}개 품목 주의 필요`,
          level: topAnomaly.anomalyScore >= 80 ? 'critical' : 'warning',
          confidence: 0.85 * this.confidenceMultiplier,
          data: analyzedItems,
          suggestedActions: ['표준 BOM 수량 검토', '작업 공정 점검', '원자재 품질 확인'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        analyzedCount: analyzedItems.length,
        items: analyzedItems,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze waste trend patterns
   */
  private async analyzeWasteTrend(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getBomWasteState();
    const wasteTrend = state.wasteTrend;

    if (wasteTrend.length < 3) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'Insufficient data for trend analysis' },
        processingTime: Date.now() - startTime,
      };
    }

    // Calculate trend direction
    const recentAvg = wasteTrend.slice(-7).reduce((sum, d) => sum + d.wastePercent, 0) / 7;
    const previousAvg = wasteTrend.slice(-14, -7).reduce((sum, d) => sum + d.wastePercent, 0) / 7;
    const trend =
      recentAvg > previousAvg ? 'increasing' : recentAvg < previousAvg ? 'decreasing' : 'stable';

    // Check if exceeding target
    const latestWaste = wasteTrend[wasteTrend.length - 1];
    const isExceedingTarget = latestWaste.wastePercent > latestWaste.targetPercent;

    if (isExceedingTarget || trend === 'increasing') {
      this.publishInsight(
        'waste',
        `폐기율 ${trend === 'increasing' ? '상승' : '목표 초과'} 경고`,
        `현재 폐기율 ${latestWaste.wastePercent.toFixed(1)}% (목표: ${latestWaste.targetPercent}%)`,
        {
          highlight: trend === 'increasing' ? '지난 주 대비 상승 추세' : undefined,
          level:
            latestWaste.wastePercent > latestWaste.targetPercent * 1.2 ? 'critical' : 'warning',
          confidence: 0.9,
          data: { trend, recentAvg, previousAvg },
          suggestedActions: ['생산 라인별 폐기 원인 분석', '작업자 교육 강화', '원자재 품질 점검'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        trend,
        recentAvg,
        previousAvg,
        isExceedingTarget,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Generate a general domain insight on demand
   */
  private async generateDomainInsight(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getBomWasteState();

    // Find most impactful issue
    const highImpactItems = state.bomItems
      .filter(item => item.costImpact > 0)
      .sort((a, b) => b.costImpact - a.costImpact);

    if (highImpactItems.length > 0) {
      const top = highImpactItems[0];
      this.publishInsight(
        'bom',
        '비용 영향 분석',
        `${top.skuName}의 BOM 차이로 인한 추가 비용이 가장 높습니다.`,
        {
          highlight: `예상 추가 비용: ${top.costImpact.toLocaleString()}원`,
          level: top.costImpact > 100000 ? 'critical' : 'warning',
          confidence: 0.85,
          data: { topItems: highImpactItems.slice(0, 3) },
          suggestedActions: ['BOM 표준량 재검토', '공정 최적화'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { generated: true },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate anomaly score based on variance and patterns
   */
  private calculateAnomalyScore(item: BomDiffItem): number {
    const varianceScore = Math.min(Math.abs(item.diffPercent) * 5, 50);
    const costScore = Math.min(item.costImpact / 10000, 30);
    const baseScore = varianceScore + costScore;

    // Add penalty for repeated issues (would need history tracking)
    return Math.min(Math.round(baseScore + 20), 100);
  }

  /**
   * Apply coaching feedback to adjust behavior
   */
  protected async applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void> {
    console.log(`BomWasteAgent applying coaching for ${feedback.metric}`);

    if (feedback.metric === 'accuracy') {
      // Increase threshold to be more selective
      this.anomalyThreshold = Math.min(this.anomalyThreshold + 1, 15);
      console.log(`Adjusted anomaly threshold to ${this.anomalyThreshold}%`);
    }

    if (feedback.metric === 'user_acceptance') {
      // Reduce confidence multiplier if insights are being dismissed
      this.confidenceMultiplier = Math.max(this.confidenceMultiplier * 0.95, 0.5);
      console.log(`Adjusted confidence multiplier to ${this.confidenceMultiplier}`);
    }

    // Record coaching application
    this.learningRegistry.recordCoaching(this.id, 'general', [
      `threshold: ${this.anomalyThreshold}`,
      `confidence: ${this.confidenceMultiplier}`,
    ]);
  }
}
