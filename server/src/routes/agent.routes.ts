import { Router, Request, Response } from 'express';
import type { CoordinatorAgent } from '../agents/coordinator/CoordinatorAgent.js';
import type { Agent } from '../agents/base/Agent.js';

const router = Router();

// Get all agent statuses
router.get('/status', (req: Request, res: Response) => {
  const agents = req.app.locals.agents as Record<string, Agent>;
  const statuses = Object.entries(agents).map(([name, agent]) => ({
    name,
    ...agent.getStatus(),
  }));

  res.json({
    success: true,
    data: statuses,
    timestamp: new Date().toISOString(),
  });
});

// Get specific agent status
router.get('/status/:agentId', (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const agents = req.app.locals.agents as Record<string, Agent>;
  const agent = agents[agentId];

  if (!agent) {
    res.status(404).json({
      success: false,
      error: `Agent not found: ${agentId}`,
    });
    return;
  }

  res.json({
    success: true,
    data: agent.getStatus(),
  });
});

// Trigger full analysis
router.post('/analyze', async (req: Request, res: Response) => {
  const coordinator = req.app.locals.coordinatorAgent as CoordinatorAgent;
  const { priority } = req.body;

  try {
    await coordinator.orchestrateAnalysis({ priority });

    res.json({
      success: true,
      message: 'Analysis orchestration started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get agent insights
router.get('/insights', (req: Request, res: Response) => {
  const stateManager = req.app.locals.stateManager;
  const { domain, limit } = req.query;

  const insights = stateManager.getInsights(
    domain as string | undefined,
    limit ? parseInt(limit as string, 10) : 20
  );

  res.json({
    success: true,
    data: insights,
    count: insights.length,
  });
});

// Get agent capabilities
router.get('/capabilities', (req: Request, res: Response) => {
  const agents = req.app.locals.agents as Record<string, Agent>;
  const capabilities: Record<string, string[]> = {};

  for (const [name, agent] of Object.entries(agents)) {
    capabilities[name] = agent.getCapabilities();
  }

  res.json({
    success: true,
    data: capabilities,
  });
});

// Get agent performance metrics
router.get('/performance', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry;

  res.json({
    success: true,
    data: learningRegistry.getAllPerformances(),
  });
});

// Get event history
router.get('/events', (req: Request, res: Response) => {
  const eventBus = req.app.locals.eventBus;
  const { limit, type } = req.query;

  let events;
  if (type) {
    events = eventBus.getMessagesByType(type as string, limit ? parseInt(limit as string, 10) : 50);
  } else {
    events = eventBus.getHistory(limit ? parseInt(limit as string, 10) : 50);
  }

  res.json({
    success: true,
    data: events,
    count: events.length,
  });
});

// Trigger cost management analysis
router.post('/cost-management/analyze', async (req: Request, res: Response) => {
  const agents = req.app.locals.agents as Record<string, Agent>;
  const costManagementAgent = agents['cost-management'];

  if (!costManagementAgent) {
    res.status(404).json({
      success: false,
      error: 'Cost management agent not found',
    });
    return;
  }

  const { type, payload } = req.body;

  try {
    // Create a task for the agent
    const task = {
      id: `task-${Date.now()}`,
      type: type || 'analyze_cost_structure',
      priority: 'high',
      payload: payload || {},
      createdAt: new Date(),
    };

    // Process the task
    const result = await (costManagementAgent as any).process(task);

    res.json({
      success: true,
      taskId: task.id,
      result,
      message: 'Cost analysis completed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

export { router as agentRoutes };
