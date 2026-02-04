import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type { Task, TaskResult, CoachingMessage } from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type {
  StateManager,
  ChannelProfitData,
  ProfitRankItem,
} from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class ProfitabilityAgent extends Agent {
  private marginThreshold = 15; // Alert when margin below 15%
  private trendSensitivity = 0.8;

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('profitability-agent', eventBus, stateManager, learningRegistry);
  }

  getCapabilities(): string[] {
    return [
      '채널별 수익성 분석',
      '마진 트렌드 모니터링',
      '비용 구조 분석',
      '가격 최적화 제안',
      '수익 랭킹 분석',
    ];
  }

  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'analyze_channel_profit':
          return await this.analyzeChannelProfit(task);
        case 'analyze_profit_ranking':
          return await this.analyzeProfitRanking(task);
        case 'detect_margin_issues':
          return await this.detectMarginIssues(task);
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
   * Analyze channel profitability
   */
  private async analyzeChannelProfit(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getProfitabilityState();
    const profitData = state.profitTrend;

    if (profitData.length === 0) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No profit data available' },
        processingTime: Date.now() - startTime,
      };
    }

    // Aggregate by channel
    const channelStats = new Map<
      string,
      { revenue: number; cost: number; profit: number; count: number }
    >();

    for (const data of profitData) {
      const current = channelStats.get(data.channel) || {
        revenue: 0,
        cost: 0,
        profit: 0,
        count: 0,
      };
      channelStats.set(data.channel, {
        revenue: current.revenue + data.revenue,
        cost: current.cost + data.cost,
        profit: current.profit + data.profit,
        count: current.count + 1,
      });
    }

    // Find underperforming channels
    const underperforming: { channel: string; margin: number; avgProfit: number }[] = [];

    for (const [channel, stats] of channelStats) {
      const margin = (stats.profit / stats.revenue) * 100;
      const avgProfit = stats.profit / stats.count;

      if (margin < this.marginThreshold) {
        underperforming.push({ channel, margin, avgProfit });
      }
    }

    if (underperforming.length > 0) {
      const worst = underperforming.sort((a, b) => a.margin - b.margin)[0];

      const analysis = await geminiAdapter.analyzeProfitability({
        channel: worst.channel,
        revenue: channelStats.get(worst.channel)!.revenue,
        cost: channelStats.get(worst.channel)!.cost,
        margin: worst.margin,
        trend: '하락',
      });

      this.publishInsight('profitability', `수익성 개선 필요: ${worst.channel}`, analysis, {
        highlight: `마진율: ${worst.margin.toFixed(1)}%`,
        level: worst.margin < 10 ? 'critical' : 'warning',
        confidence: 0.85 * this.trendSensitivity,
        data: underperforming,
        suggestedActions: ['가격 정책 재검토', '비용 구조 분석', '고마진 상품 푸시'],
      });
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        channelCount: channelStats.size,
        underperformingCount: underperforming.length,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze profit ranking trends
   */
  private async analyzeProfitRanking(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getProfitabilityState();
    const { topProfitItems, bottomProfitItems } = state;

    // Check for declining top performers
    const decliningTop = topProfitItems.filter(item => item.trend === 'down');

    if (decliningTop.length > 0) {
      this.publishInsight(
        'profitability',
        '상위 수익 품목 하락 경고',
        `${decliningTop.map(i => i.skuName).join(', ')}의 수익이 하락 추세입니다.`,
        {
          highlight: `${decliningTop.length}개 상위 품목 하락`,
          level: 'warning',
          confidence: 0.8,
          data: decliningTop,
          suggestedActions: ['판매 촉진 검토', '경쟁사 가격 분석'],
        }
      );
    }

    // Check for improving bottom performers
    const improvingBottom = bottomProfitItems.filter(item => item.trend === 'up');

    if (improvingBottom.length > 0) {
      this.publishInsight(
        'profitability',
        '하위 품목 개선 기회',
        `${improvingBottom.map(i => i.skuName).join(', ')}의 수익이 개선되고 있습니다.`,
        {
          level: 'info',
          confidence: 0.75,
          data: improvingBottom,
          suggestedActions: ['개선 요인 분석', '성공 패턴 확산'],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        topItemsCount: topProfitItems.length,
        decliningTopCount: decliningTop.length,
        improvingBottomCount: improvingBottom.length,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Detect margin issues across all data
   */
  private async detectMarginIssues(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getProfitabilityState();
    const profitData = state.profitTrend;

    // Calculate daily margin trends
    const dailyMargins = profitData.reduce(
      (acc, d) => {
        if (!acc[d.date]) {
          acc[d.date] = { revenue: 0, profit: 0 };
        }
        acc[d.date].revenue += d.revenue;
        acc[d.date].profit += d.profit;
        return acc;
      },
      {} as Record<string, { revenue: number; profit: number }>
    );

    const marginTrend = Object.entries(dailyMargins)
      .map(([date, data]) => ({
        date,
        margin: (data.profit / data.revenue) * 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Check for declining trend
    if (marginTrend.length >= 7) {
      const recentMargin = marginTrend.slice(-7).reduce((sum, d) => sum + d.margin, 0) / 7;
      const previousMargin = marginTrend.slice(-14, -7).reduce((sum, d) => sum + d.margin, 0) / 7;

      if (recentMargin < previousMargin * 0.95) {
        this.publishInsight(
          'profitability',
          '전체 마진율 하락 추세',
          `최근 7일 평균 마진율이 ${(recentMargin - previousMargin).toFixed(1)}%p 하락했습니다.`,
          {
            highlight: `현재 평균: ${recentMargin.toFixed(1)}%`,
            level: previousMargin - recentMargin > 3 ? 'critical' : 'warning',
            confidence: 0.9,
            data: { recentMargin, previousMargin, marginTrend: marginTrend.slice(-14) },
            suggestedActions: ['비용 증가 요인 파악', '가격 정책 검토', '고마진 상품 확대'],
          }
        );
      }
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { analyzed: true },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Generate a general domain insight
   */
  private async generateDomainInsight(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const state = this.stateManager.getProfitabilityState();

    // Calculate overall metrics
    const totalRevenue = state.profitTrend.reduce((sum, d) => sum + d.revenue, 0);
    const totalProfit = state.profitTrend.reduce((sum, d) => sum + d.profit, 0);
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    this.publishInsight(
      'profitability',
      '수익성 현황 요약',
      `전체 마진율 ${overallMargin.toFixed(1)}%, 총 수익 ${totalProfit.toLocaleString()}원`,
      {
        level: overallMargin < this.marginThreshold ? 'warning' : 'info',
        confidence: 0.95,
        data: { totalRevenue, totalProfit, overallMargin },
      }
    );

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
    console.log(`ProfitabilityAgent applying coaching for ${feedback.metric}`);

    if (feedback.metric === 'accuracy') {
      this.marginThreshold = Math.max(this.marginThreshold - 1, 5);
      console.log(`Adjusted margin threshold to ${this.marginThreshold}%`);
    }

    if (feedback.metric === 'user_acceptance') {
      this.trendSensitivity = Math.max(this.trendSensitivity * 0.9, 0.5);
      console.log(`Adjusted trend sensitivity to ${this.trendSensitivity}`);
    }

    this.learningRegistry.recordCoaching(this.id, 'general', [
      `marginThreshold: ${this.marginThreshold}`,
      `trendSensitivity: ${this.trendSensitivity}`,
    ]);
  }
}
