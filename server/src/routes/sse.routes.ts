import { Router, Request, Response } from 'express';
import type { EventBus } from '../services/EventBus.js';
import type { AgentMessage } from '../types/index.js';

const router = Router();

let eventCounter = 0;
const activeConnections = new Map<string, { connectedAt: Date; lastEventId: number }>();

// SSE endpoint for real-time agent updates
router.get('/', (req: Request, res: Response) => {
  const eventBus = req.app.locals.eventBus as EventBus;
  const connId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lastEventId = req.headers['last-event-id']
    ? parseInt(req.headers['last-event-id'] as string, 10)
    : 0;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-SSE-Connection-Id', connId);

  activeConnections.set(connId, { connectedAt: new Date(), lastEventId });

  // Send initial connection message
  const connectEvent = {
    type: 'connected',
    connectionId: connId,
    timestamp: new Date().toISOString(),
    resumedFrom: lastEventId || null,
  };
  res.write(`id: ${++eventCounter}\nevent: connected\ndata: ${JSON.stringify(connectEvent)}\n\n`);

  // Subscribe to all agent messages
  const unsubscribe = eventBus.subscribeAll((message: AgentMessage) => {
    if (['INSIGHT_SHARE', 'STATE_SYNC', 'TASK_RESULT'].includes(message.type)) {
      const currentId = ++eventCounter;
      const data = {
        id: message.id,
        type: message.type,
        source: message.source,
        timestamp: message.timestamp,
        payload: message.payload,
      };

      res.write(`id: ${currentId}\nevent: ${message.type.toLowerCase()}\ndata: ${JSON.stringify(data)}\n\n`);
      activeConnections.get(connId)!.lastEventId = currentId;
    }
  });

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    const hbId = ++eventCounter;
    res.write(
      `id: ${hbId}\nevent: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
    );
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    activeConnections.delete(connId);
    console.log(`SSE client disconnected: ${connId}`);
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

// Get active SSE connections
router.get('/connections', (_req: Request, res: Response) => {
  const connections = Array.from(activeConnections.entries()).map(([id, info]) => ({
    id,
    connectedAt: info.connectedAt.toISOString(),
    lastEventId: info.lastEventId,
  }));

  res.json({
    success: true,
    count: connections.length,
    connections,
  });
});

export { router as sseRoutes };
