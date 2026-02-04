import { Router, Request, Response } from 'express';
import type { LearningRegistry } from '../services/LearningRegistry.js';
import type { FeedbackType, AgentId } from '../types/index.js';

const router = Router();

// Submit feedback for an insight
router.post('/', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { insightId, feedbackType, correction } = req.body;

  if (!insightId || !feedbackType) {
    res.status(400).json({
      success: false,
      error: 'insightId and feedbackType are required',
    });
    return;
  }

  if (!['helpful', 'dismissed', 'corrected'].includes(feedbackType)) {
    res.status(400).json({
      success: false,
      error: 'feedbackType must be helpful, dismissed, or corrected',
    });
    return;
  }

  const success = learningRegistry.recordFeedback(
    insightId,
    feedbackType as FeedbackType,
    correction
  );

  if (success) {
    res.json({
      success: true,
      message: '피드백이 기록되었습니다',
    });
  } else {
    res.status(404).json({
      success: false,
      error: '해당 인사이트를 찾을 수 없습니다',
    });
  }
});

// Get learning records
router.get('/records', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { agentId, limit } = req.query;

  const records = learningRegistry.getRecords(
    agentId as AgentId | undefined,
    limit ? parseInt(limit as string, 10) : 100
  );

  res.json({
    success: true,
    data: records,
    count: records.length,
  });
});

// Get records with feedback
router.get('/records/with-feedback', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { agentId } = req.query;

  const records = learningRegistry.getRecordsWithFeedback(agentId as AgentId | undefined);

  res.json({
    success: true,
    data: records,
    count: records.length,
  });
});

// Get agent performance
router.get('/performance/:agentId', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { agentId } = req.params;

  const performance = learningRegistry.getAgentPerformance(agentId as AgentId);

  res.json({
    success: true,
    data: performance,
  });
});

// Check if agent needs coaching
router.get('/needs-coaching/:agentId', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { agentId } = req.params;
  const { threshold } = req.query;

  const needsCoaching = learningRegistry.needsCoaching(
    agentId as AgentId,
    threshold ? parseInt(threshold as string, 10) : 70
  );

  res.json({
    success: true,
    data: { needsCoaching },
  });
});

// Generate coaching feedback
router.get('/coaching/:agentId', (req: Request, res: Response) => {
  const learningRegistry = req.app.locals.learningRegistry as LearningRegistry;
  const { agentId } = req.params;

  const feedback = learningRegistry.generateCoachingFeedback(agentId as AgentId);

  res.json({
    success: true,
    data: feedback,
  });
});

export { router as feedbackRoutes };
