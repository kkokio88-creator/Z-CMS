import { Router, Request, Response } from 'express';
import type { ChiefOrchestrator } from '../agents/orchestrator/ChiefOrchestrator.js';

export function createHealthRoutes(
  chiefOrchestrator: ChiefOrchestrator,
  legacyAgents: Record<string, { getStatus: () => any }>
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const debateStatus = chiefOrchestrator.getDebateStatus();
    const teamStatuses = chiefOrchestrator.getAllTeamStatuses();

    const legacyStatuses: Record<string, any> = {};
    for (const [key, agent] of Object.entries(legacyAgents)) {
      legacyStatuses[key] = agent.getStatus();
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      legacyAgents: legacyStatuses,
      agenticSystem: {
        chiefOrchestrator: chiefOrchestrator.getStatus(),
        teams: teamStatuses,
        debates: debateStatus,
      },
    });
  });

  return router;
}
