/**
 * 토론 API 라우트
 * 변증법적 토론 프레임워크 엔드포인트
 */

import { Router, Request, Response } from 'express';
import type { DebateManager } from '../services/DebateManager.js';
import type { WipManager } from '../services/WipManager.js';
import type { ChiefOrchestrator } from '../agents/orchestrator/ChiefOrchestrator.js';
import type { DomainTeam, MessagePriority, InsightDomain } from '../types/index.js';

export function createDebateRoutes(
  debateManager: DebateManager,
  wipManager: WipManager,
  chiefOrchestrator: ChiefOrchestrator
): Router {
  const router = Router();

  /**
   * GET /api/debates
   * 토론 목록 조회
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { domain, team, limit = '20', includeActive = 'true' } = req.query;

      const results: unknown[] = [];

      // 활성 토론
      if (includeActive === 'true') {
        const activeDebates = debateManager.getAllActiveDebates();
        results.push(
          ...activeDebates.map(d => ({
            ...d,
            isActive: true,
          }))
        );
      }

      // 히스토리
      const history = debateManager.getDebateHistory({
        domain: domain as InsightDomain | undefined,
        team: team as DomainTeam | undefined,
        limit: parseInt(limit as string),
      });

      results.push(
        ...history.map(d => ({
          ...d,
          isActive: false,
        }))
      );

      res.json({
        success: true,
        data: results,
        meta: {
          total: results.length,
          activeCount: debateManager.getQueueStatus().activeCount,
          queuedCount: debateManager.getQueueStatus().queuedCount,
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 목록 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/debates/statistics
   * 토론 통계 조회
   */
  router.get('/statistics', async (req: Request, res: Response) => {
    try {
      const statistics = debateManager.getStatistics();
      const queueStatus = debateManager.getQueueStatus();

      res.json({
        success: true,
        data: {
          ...statistics,
          queue: queueStatus,
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 통계 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/debates/:id
   * 특정 토론 상세 조회
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // 활성 토론에서 찾기
      let debate = debateManager.getActiveDebate(id);
      let isActive = true;

      // 없으면 히스토리에서 찾기
      if (!debate) {
        const history = debateManager.getDebateHistory({ limit: 100 });
        debate = history.find(d => d.id === id);
        isActive = false;
      }

      if (!debate) {
        return res.status(404).json({
          success: false,
          error: '토론을 찾을 수 없습니다.',
        });
      }

      res.json({
        success: true,
        data: {
          ...debate,
          isActive,
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 상세 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/debates/:id/log
   * 토론 로그 (마크다운) 조회
   */
  router.get('/:id/log', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const log = await wipManager.readDebateLog(id);

      if (!log) {
        return res.status(404).json({
          success: false,
          error: '토론 로그를 찾을 수 없습니다.',
        });
      }

      // 마크다운 또는 JSON 반환
      const { format = 'markdown' } = req.query;

      if (format === 'json') {
        res.json({
          success: true,
          data: { content: log },
        });
      } else {
        res.type('text/markdown').send(log);
      }
    } catch (error) {
      console.error('[DebateRoutes] 로그 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/debates
   * 새 토론 시작
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { team, topic, contextData, priority = 'medium' } = req.body;

      if (!team || !topic) {
        return res.status(400).json({
          success: false,
          error: 'team과 topic은 필수입니다.',
        });
      }

      const debateId = await chiefOrchestrator.orchestrateDebate({
        team: team as DomainTeam,
        topic,
        contextData: contextData || {},
        priority: priority as MessagePriority,
      });

      res.status(201).json({
        success: true,
        data: {
          debateId,
          status: debateId === 'queued' ? 'queued' : 'started',
          message:
            debateId === 'queued' ? '토론이 대기열에 추가되었습니다.' : '토론이 시작되었습니다.',
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 토론 시작 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/debates/all-teams
   * 모든 팀에 토론 시작
   */
  router.post('/all-teams', async (req: Request, res: Response) => {
    try {
      const { priority = 'medium' } = req.body;

      await chiefOrchestrator.orchestrateAllTeams({
        priority: priority as MessagePriority,
      });

      res.status(201).json({
        success: true,
        data: {
          message: '모든 팀에 토론이 시작되었습니다.',
          teams: ['bom-waste-team', 'inventory-team', 'profitability-team', 'cost-management-team'],
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 전체 팀 토론 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/debates/:id/cancel
   * 토론 취소
   */
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { reason = '사용자 요청에 의한 취소' } = req.body;

      await debateManager.cancelDebate(id, reason);

      res.json({
        success: true,
        data: {
          debateId: id,
          status: 'cancelled',
          reason,
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 토론 취소 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/debates/:id/feedback
   * 토론 결과에 대한 피드백
   */
  router.post('/:id/feedback', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { type, comment, rating } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'type은 필수입니다. (helpful, dismissed, corrected)',
        });
      }

      // 피드백 저장 로직 (LearningRegistry에 기록 가능)
      console.log(`[DebateRoutes] 피드백 수신: ${id} - ${type}`);

      res.json({
        success: true,
        data: {
          debateId: id,
          feedback: { type, comment, rating },
          message: '피드백이 기록되었습니다.',
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 피드백 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/debates/wip/files
   * WIP 파일 목록 조회
   */
  router.get('/wip/files', async (req: Request, res: Response) => {
    try {
      const files = await wipManager.listDebateLogs();

      res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      console.error('[DebateRoutes] WIP 파일 목록 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/debates/teams/status
   * 팀 상태 조회
   */
  router.get('/teams/status', async (req: Request, res: Response) => {
    try {
      const statuses = chiefOrchestrator.getAllTeamStatuses();
      const debateStatus = chiefOrchestrator.getDebateStatus();

      res.json({
        success: true,
        data: {
          teams: statuses,
          debates: debateStatus,
        },
      });
    } catch (error) {
      console.error('[DebateRoutes] 팀 상태 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
