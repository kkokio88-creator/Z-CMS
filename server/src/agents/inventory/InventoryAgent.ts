import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type { Task, TaskResult, CoachingMessage } from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type {
  StateManager,
  StocktakeAnomalyItem,
  InventorySafetyItem,
} from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class InventoryAgent extends Agent {
  private safetyStockDays = 7; // Default safety stock coverage
  private anomalyThreshold = 10; // 10% variance threshold for stocktake
  private predictionConfidence = 0.85;

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('inventory-agent', eventBus, stateManager, learningRegistry);
  }

  getCapabilities(): string[] {
    return [
      '재고 수준 모니터링',
      '안전재고 계산',
      '재고실사 이상 감지',
      '수요 예측',
      '발주 제안 생성',
    ];
  }

  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'analyze_safety_stock':
          return await this.analyzeSafetyStock(task);
        case 'detect_stocktake_anomalies':
          return await this.detectStocktakeAnomalies(task);
        case 'generate_order_suggestions':
          return await this.generateOrderSuggestions(task);
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
   * Analyze safety stock levels
   */
  private async analyzeSafetyStock(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getInventoryState();
    const items = state.inventoryItems;

    const criticalItems = items.filter(item => item.status === 'critical');
    const warningItems = items.filter(item => item.status === 'warning');

    if (criticalItems.length > 0) {
      this.publishInsight(
        'inventory',
        `긴급 재고 부족: ${criticalItems.length}개 품목`,
        `${criticalItems
          .map(i => i.materialName)
          .slice(0, 3)
          .join(', ')} 등의 재고가 안전재고 이하입니다.`,
        {
          highlight: `${criticalItems[0].daysRemaining}일 내 재고 소진 예상`,
          level: 'critical',
          confidence: 0.95,
          data: criticalItems,
          suggestedActions: ['긴급 발주 진행', '대체 자재 검토', '생산 일정 조정'],
        }
      );
    } else if (warningItems.length > 0) {
      this.publishInsight(
        'inventory',
        `재고 주의 품목: ${warningItems.length}개`,
        '안전재고 수준에 근접한 품목이 있습니다.',
        {
          level: 'warning',
          confidence: 0.9,
          data: warningItems.slice(0, 5),
          suggestedActions: ['발주 계획 검토'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        criticalCount: criticalItems.length,
        warningCount: warningItems.length,
        normalCount: items.length - criticalItems.length - warningItems.length,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Detect stocktake anomalies and predict expected quantities
   */
  private async detectStocktakeAnomalies(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getInventoryState();
    const anomalies = state.anomalies;

    if (anomalies.length === 0) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No anomalies to process' },
        processingTime: Date.now() - startTime,
      };
    }

    // Generate AI predictions for anomalies
    const processedAnomalies: StocktakeAnomalyItem[] = [];

    for (const anomaly of anomalies.slice(0, 5)) {
      const inventory = state.inventoryItems.find(i => i.materialCode === anomaly.materialCode);

      if (inventory) {
        const prediction = await geminiAdapter.predictInventory({
          materialName: anomaly.materialName,
          currentStock: anomaly.systemQty,
          avgDailyUsage: inventory.avgDailyUsage,
          recentTrend:
            inventory.trend === 'up'
              ? 'increasing'
              : inventory.trend === 'down'
                ? 'decreasing'
                : 'stable',
        });

        const updatedAnomaly: StocktakeAnomalyItem = {
          ...anomaly,
          aiExpectedQty: prediction.expectedQty,
          reason: prediction.reasoning,
        };

        processedAnomalies.push(updatedAnomaly);

        // Update state
        this.stateManager.updateAnomaly(anomaly.id, {
          aiExpectedQty: prediction.expectedQty,
          reason: prediction.reasoning,
        });
      }
    }

    // Publish insight for significant anomalies
    const highAnomalies = processedAnomalies.filter(a => a.anomalyScore >= 70);
    if (highAnomalies.length > 0) {
      this.publishInsight(
        'inventory',
        `재고실사 이상: ${highAnomalies.length}개 품목`,
        `시스템 재고와 실제 재고 간 큰 차이가 발견되었습니다.`,
        {
          highlight: `최대 차이: ${Math.abs(highAnomalies[0].systemQty - highAnomalies[0].countedQty)}개`,
          level: highAnomalies[0].anomalyScore >= 90 ? 'critical' : 'warning',
          confidence: this.predictionConfidence,
          data: highAnomalies,
          suggestedActions: ['재실사 진행', '입출고 기록 검토', '분실/파손 조사'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        processedCount: processedAnomalies.length,
        highAnomalyCount: highAnomalies.length,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Generate order suggestions based on current inventory
   */
  private async generateOrderSuggestions(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getInventoryState();
    const suggestions = state.orderSuggestions;

    const urgentOrders = suggestions.filter(s => s.urgency === 'high');

    if (urgentOrders.length > 0) {
      const totalCost = urgentOrders.reduce((sum, s) => sum + s.estimatedCost, 0);

      this.publishInsight(
        'inventory',
        `긴급 발주 필요: ${urgentOrders.length}건`,
        `${urgentOrders
          .map(o => o.materialName)
          .slice(0, 3)
          .join(', ')} 등의 발주가 필요합니다.`,
        {
          highlight: `예상 발주 금액: ${totalCost.toLocaleString()}원`,
          level: 'warning',
          confidence: 0.9,
          data: urgentOrders,
          actionable: true,
          suggestedActions: ['발주서 생성', '공급업체 연락'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        totalSuggestions: suggestions.length,
        urgentCount: urgentOrders.length,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Generate a general domain insight
   */
  private async generateDomainInsight(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getInventoryState();

    // Calculate overall inventory health
    const items = state.inventoryItems;
    const criticalRate = items.filter(i => i.status === 'critical').length / (items.length || 1);
    const avgDaysRemaining =
      items.reduce((sum, i) => sum + i.daysRemaining, 0) / (items.length || 1);

    if (criticalRate > 0.1) {
      this.publishInsight(
        'inventory',
        '재고 건전성 주의',
        `전체 품목 중 ${Math.round(criticalRate * 100)}%가 위험 수준입니다.`,
        {
          highlight: `평균 잔여일: ${Math.round(avgDaysRemaining)}일`,
          level: 'warning',
          confidence: 0.85,
          data: { criticalRate, avgDaysRemaining },
          suggestedActions: ['전체 발주 계획 재검토'],
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
   * Apply coaching feedback
   */
  protected async applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void> {
    console.log(`InventoryAgent applying coaching for ${feedback.metric}`);

    if (feedback.metric === 'accuracy') {
      // Adjust prediction confidence
      this.predictionConfidence = Math.max(this.predictionConfidence * 0.95, 0.6);
      console.log(`Adjusted prediction confidence to ${this.predictionConfidence}`);
    }

    if (feedback.metric === 'user_acceptance') {
      // Adjust anomaly threshold
      this.anomalyThreshold = Math.min(this.anomalyThreshold + 2, 25);
      console.log(`Adjusted anomaly threshold to ${this.anomalyThreshold}%`);
    }

    this.learningRegistry.recordCoaching(this.id, 'general', [
      `predictionConfidence: ${this.predictionConfidence}`,
      `anomalyThreshold: ${this.anomalyThreshold}`,
    ]);
  }
}
