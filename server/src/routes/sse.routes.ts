import { Router, Request, Response } from 'express';
import type { EventBus } from '../services/EventBus.js';
import type { AgentMessage } from '../types/index.js';

const router = Router();

// SSE endpoint for real-time agent updates
router.get('/', (req: Request, res: Response) => {
  const eventBus = req.app.locals.eventBus as EventBus;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Subscribe to all agent messages
  const unsubscribe = eventBus.subscribeAll((message: AgentMessage) => {
    // Filter to only send relevant messages to frontend
    if (['INSIGHT_SHARE', 'STATE_SYNC', 'TASK_RESULT'].includes(message.type)) {
      const data = {
        id: message.id,
        type: message.type,
        source: message.source,
        timestamp: message.timestamp,
        payload: message.payload,
      };

      res.write(`event: ${message.type.toLowerCase()}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    console.log('SSE client disconnected');
  });
});

// Get current state snapshot
router.get('/state', (req: Request, res: Response) => {
  const stateManager = req.app.locals.stateManager;

  res.json({
    success: true,
    data: stateManager.getAllState(),
    timestamp: new Date().toISOString(),
  });
});

export { router as sseRoutes };
