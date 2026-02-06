import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type {
  AgentId,
  Task,
  TaskResult,
  AgentMessage,
  CoachingMessage,
  AgentInsight,
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export class CoordinatorAgent extends Agent {
  private subordinates: Agent[];
  private pendingResults: Map<string, TaskResult[]> = new Map();
  private coachingInterval: NodeJS.Timeout | null = null;
  private insightBuffer: Map<string, AgentInsight> = new Map();

  constructor(
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry,
    subordinates: Agent[]
  ) {
    super('coordinator', eventBus, stateManager, learningRegistry);
    this.subordinates = subordinates;
  }

  getCapabilities(): string[] {
    return [
      '태스크 오케스트레이션',
      '에이전트 코칭',
      '크로스도메인 인사이트 통합',
      '우선순위 관리',
      '성과 모니터링',
    ];
  }

  /**
   * Start coordinator with coaching loop
   */
  start(): void {
    super.start();

    // Subscribe to insight shares from subordinates
    this.eventBus.subscribeType('INSIGHT_SHARE', this.handleInsightShare.bind(this));
    this.eventBus.subscribeType('TASK_RESULT', this.handleTaskResult.bind(this));

    // Start periodic coaching check
    this.coachingInterval = setInterval(() => {
      this.evaluateAndCoach();
    }, 60000); // Check every minute

    console.log('Coordinator started with coaching loop');
  }

  /**
   * Stop coordinator
   */
  stop(): void {
    if (this.coachingInterval) {
      clearInterval(this.coachingInterval);
    }
    super.stop();
  }

  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'orchestrate_analysis':
          await this.orchestrateAnalysis(task);
          return {
            taskId: task.id,
            agentId: this.id,
            success: true,
            output: { orchestrated: true },
            processingTime: Date.now() - startTime,
          };
        case 'synthesize_insights':
          return await this.synthesizeInsights(task);
        case 'evaluate_agents':
          return await this.evaluateAgents(task);
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
   * Orchestrate analysis across all domain agents
   */
  async orchestrateAnalysis(input?: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const correlationId = uuidv4();
    const sender = this.eventBus.createSender(this.id);

    // Create tasks for each domain agent
    const tasks: { agentId: AgentId; task: Task }[] = [
      {
        agentId: 'bom-waste-agent',
        task: {
          id: uuidv4(),
          type: 'analyze_bom_variance',
          domain: 'bom',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
      {
        agentId: 'bom-waste-agent',
        task: {
          id: uuidv4(),
          type: 'analyze_waste_trend',
          domain: 'waste',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
      {
        agentId: 'inventory-agent',
        task: {
          id: uuidv4(),
          type: 'analyze_safety_stock',
          domain: 'inventory',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
      {
        agentId: 'inventory-agent',
        task: {
          id: uuidv4(),
          type: 'detect_stocktake_anomalies',
          domain: 'stocktake',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
      {
        agentId: 'profitability-agent',
        task: {
          id: uuidv4(),
          type: 'analyze_channel_profit',
          domain: 'profit',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
      {
        agentId: 'profitability-agent',
        task: {
          id: uuidv4(),
          type: 'detect_margin_issues',
          domain: 'margin',
          input: {},
          priority: input?.priority || 'medium',
        },
      },
    ];

    // Initialize pending results for this orchestration
    this.pendingResults.set(correlationId, []);

    // Dispatch tasks to agents
    for (const { agentId, task } of tasks) {
      sender.send(agentId, 'TASK_ASSIGNMENT', task, task.priority, correlationId);
    }

    console.log(`Orchestrated ${tasks.length} analysis tasks (correlation: ${correlationId})`);
  }

  /**
   * Handle task results from subordinates
   */
  protected async handleTaskResult(message: AgentMessage): Promise<void> {
    if (message.source === this.id) return; // Ignore own results

    const result = message.payload as TaskResult;
    const correlationId = message.correlationId;

    if (correlationId && this.pendingResults.has(correlationId)) {
      const results = this.pendingResults.get(correlationId)!;
      results.push(result);

      // Check if all results are in (we expect 6 tasks)
      if (results.length >= 6) {
        await this.synthesizeFromResults(correlationId, results);
        this.pendingResults.delete(correlationId);
      }
    }
  }

  /**
   * Handle insight shares from subordinates
   */
  protected async handleInsightShare(message: AgentMessage): Promise<void> {
    if (message.source === this.id) return;

    const insight = message.payload as AgentInsight;
    this.insightBuffer.set(insight.id, insight);

    // Keep buffer limited
    if (this.insightBuffer.size > 50) {
      const oldestKey = this.insightBuffer.keys().next().value;
      if (oldestKey) this.insightBuffer.delete(oldestKey);
    }
  }

  /**
   * Synthesize insights from analysis results
   */
  private async synthesizeFromResults(correlationId: string, results: TaskResult[]): Promise<void> {
    const successfulResults = results.filter(r => r.success);

    // Get recent insights from buffer
    const recentInsights = Array.from(this.insightBuffer.values()).filter(
      i => Date.now() - i.timestamp.getTime() < 60000
    ); // Last minute

    if (recentInsights.length === 0 && successfulResults.length === 0) {
      return;
    }

    // Categorize insights
    const bomInsights = recentInsights.filter(i => i.domain === 'bom' || i.domain === 'waste');
    const inventoryInsights = recentInsights.filter(i => i.domain === 'inventory');
    const profitInsights = recentInsights.filter(i => i.domain === 'profitability');

    // Generate coordinator summary
    const summary = await geminiAdapter.generateCoordinatorSummary({
      bomWaste: bomInsights.map(i => i.description).join('; ') || undefined,
      inventory: inventoryInsights.map(i => i.description).join('; ') || undefined,
      profitability: profitInsights.map(i => i.description).join('; ') || undefined,
    });

    // Publish coordinated insight
    const criticalCount = recentInsights.filter(i => i.level === 'critical').length;
    const warningCount = recentInsights.filter(i => i.level === 'warning').length;

    this.publishInsight('general', '종합 분석 완료', summary, {
      highlight:
        criticalCount > 0
          ? `긴급 ${criticalCount}건, 주의 ${warningCount}건`
          : warningCount > 0
            ? `주의 ${warningCount}건`
            : '정상 운영 중',
      level: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'info',
      confidence: 0.9,
      data: {
        analysisCount: successfulResults.length,
        insightCount: recentInsights.length,
        criticalCount,
        warningCount,
      },
    });

    // Clear processed insights from buffer
    for (const insight of recentInsights) {
      this.insightBuffer.delete(insight.id);
    }
  }

  /**
   * Synthesize insights on demand
   */
  private async synthesizeInsights(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const insights = this.stateManager.getInsights(undefined, 20);

    // Group by domain
    const byDomain = new Map<string, AgentInsight[]>();
    for (const insight of insights) {
      const current = byDomain.get(insight.domain) || [];
      current.push(insight);
      byDomain.set(insight.domain, current);
    }

    // Generate summary
    const domainSummaries: Record<string, string> = {};
    for (const [domain, domainInsights] of byDomain) {
      domainSummaries[domain] = domainInsights
        .map(i => i.description)
        .slice(0, 3)
        .join('; ');
    }

    const summary = await geminiAdapter.generateCoordinatorSummary({
      bomWaste: domainSummaries['bom'] || domainSummaries['waste'],
      inventory: domainSummaries['inventory'],
      profitability: domainSummaries['profitability'],
    });

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { summary },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Evaluate agents and provide coaching
   */
  private async evaluateAgents(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    await this.evaluateAndCoach();

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { evaluated: true },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Periodic coaching evaluation
   */
  private async evaluateAndCoach(): Promise<void> {
    const performances = this.learningRegistry.getAllPerformances();

    for (const perf of performances) {
      if (this.learningRegistry.needsCoaching(perf.agentId)) {
        const feedback = this.learningRegistry.generateCoachingFeedback(perf.agentId);

        if (feedback) {
          const sender = this.eventBus.createSender(this.id);
          sender.send(perf.agentId, 'COACHING_FEEDBACK', { feedback }, 'medium');

          console.log(
            `Sent coaching to ${perf.agentId}: ${feedback.metric} (score: ${feedback.score})`
          );
        }
      }
    }
  }

  /**
   * Apply coaching (Coordinator doesn't receive coaching)
   */
  protected async applyCoaching(): Promise<void> {
    // Coordinator doesn't receive coaching from others
    console.log('Coordinator: coaching not applicable');
  }

  /**
   * Get all subordinate agent statuses
   */
  getSubordinateStatuses() {
    return this.subordinates.map(agent => agent.getStatus());
  }
}
