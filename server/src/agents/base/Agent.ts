import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  AgentStatus,
  AgentState,
  AgentMessage,
  AgentInsight,
  Task,
  TaskResult,
  CoachingMessage,
  InsightDomain,
  InsightLevel,
} from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

export abstract class Agent {
  protected id: AgentId;
  protected status: AgentStatus = 'idle';
  protected eventBus: EventBus;
  protected stateManager: StateManager;
  protected learningRegistry: LearningRegistry;
  protected processedTasks = 0;
  protected successfulTasks = 0;
  protected totalProcessingTime = 0;
  protected currentTask?: Task;
  protected unsubscribe?: () => void;

  constructor(
    id: AgentId,
    eventBus: EventBus,
    stateManager: StateManager,
    learningRegistry: LearningRegistry
  ) {
    this.id = id;
    this.eventBus = eventBus;
    this.stateManager = stateManager;
    this.learningRegistry = learningRegistry;
  }

  /**
   * Start the agent and subscribe to events
   */
  start(): void {
    this.status = 'idle';
    this.unsubscribe = this.eventBus.subscribeAgent(this.id, this.handleMessage.bind(this));
    console.log(`Agent ${this.id} started`);
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.status = 'stopped';
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    console.log(`Agent ${this.id} stopped`);
  }

  /**
   * Get current agent status
   */
  getStatus(): AgentState {
    return {
      id: this.id,
      status: this.status,
      lastActivity: new Date(),
      processedTasks: this.processedTasks,
      successRate:
        this.processedTasks > 0
          ? Math.round((this.successfulTasks / this.processedTasks) * 100)
          : 100,
      avgProcessingTime:
        this.processedTasks > 0 ? Math.round(this.totalProcessingTime / this.processedTasks) : 0,
      currentTask: this.currentTask,
    };
  }

  /**
   * Handle incoming messages
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'TASK_ASSIGNMENT':
        await this.handleTaskAssignment(message);
        break;
      case 'COACHING_FEEDBACK':
        await this.handleCoaching(message as CoachingMessage);
        break;
      case 'INSIGHT_SHARE':
        await this.handleInsightShare(message);
        break;
      case 'DATA_REQUEST':
        await this.handleDataRequest(message);
        break;
      default:
        // Ignore other message types
        break;
    }
  }

  /**
   * Handle task assignment from coordinator
   */
  protected async handleTaskAssignment(message: AgentMessage): Promise<void> {
    const task = message.payload as Task;
    this.currentTask = task;
    this.status = 'processing';
    const startTime = Date.now();

    try {
      const result = await this.process(task);
      this.processedTasks++;
      this.totalProcessingTime += Date.now() - startTime;

      if (result.success) {
        this.successfulTasks++;
      }

      // Send result back to coordinator
      const sender = this.eventBus.createSender(this.id);
      sender.reply(message, 'TASK_RESULT', result);
    } catch (error) {
      console.error(`Agent ${this.id} task error:`, error);
      this.status = 'error';

      const sender = this.eventBus.createSender(this.id);
      sender.reply(message, 'TASK_RESULT', {
        taskId: task.id,
        agentId: this.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      } as TaskResult);
    } finally {
      this.currentTask = undefined;
      this.status = 'idle';
    }
  }

  /**
   * Handle coaching feedback from coordinator
   */
  protected async handleCoaching(message: CoachingMessage): Promise<void> {
    const { feedback } = message.payload;
    console.log(`Agent ${this.id} received coaching:`, feedback.suggestion);

    // Record that coaching was applied
    await this.applyCoaching(feedback);
  }

  /**
   * Handle insight sharing from other agents
   */
  protected async handleInsightShare(message: AgentMessage): Promise<void> {
    // Default: do nothing. Override in subclasses if needed.
  }

  /**
   * Handle data requests
   */
  protected async handleDataRequest(message: AgentMessage): Promise<void> {
    // Default: do nothing. Override in subclasses if needed.
  }

  /**
   * Create and publish an insight
   */
  protected publishInsight(
    domain: InsightDomain,
    title: string,
    description: string,
    options: {
      highlight?: string;
      level?: InsightLevel;
      confidence?: number;
      data?: unknown;
      actionable?: boolean;
      suggestedActions?: string[];
    } = {}
  ): AgentInsight {
    const insight: AgentInsight = {
      id: uuidv4(),
      agentId: this.id,
      domain,
      timestamp: new Date(),
      title,
      description,
      highlight: options.highlight,
      level: options.level || 'info',
      confidence: options.confidence || 0.8,
      data: options.data,
      actionable: options.actionable ?? true,
      suggestedActions: options.suggestedActions,
    };

    // Add to state manager
    this.stateManager.addInsight(insight);

    // Record for learning
    this.learningRegistry.recordOutput(this.id, insight.id, {
      type: 'reasoning',
      content: { title, description },
    });

    // Broadcast to other agents and frontend
    const sender = this.eventBus.createSender(this.id);
    sender.broadcast('INSIGHT_SHARE', insight);

    return insight;
  }

  /**
   * Abstract method: Process a task
   */
  abstract process(task: Task): Promise<TaskResult>;

  /**
   * Abstract method: Get agent capabilities
   */
  abstract getCapabilities(): string[];

  /**
   * Abstract method: Apply coaching feedback
   */
  protected abstract applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void>;
}
