/**
 * 거버넌스 API 라우트
 * QA 및 컴플라이언스 관련 엔드포인트
 */

import { Router, Request, Response } from 'express';
import type { DebateManager } from '../services/DebateManager.js';
import type { QASpecialist } from '../agents/governance/QASpecialist.js';
import type { ComplianceAuditor } from '../agents/governance/ComplianceAuditor.js';
import type { EventBus } from '../services/EventBus.js';

export function createGovernanceRoutes(
  debateManager: DebateManager,
  eventBus: EventBus,
  qaSpecialist: QASpecialist,
  complianceAuditor: ComplianceAuditor
): Router {
  const router = Router();

  /**
   * GET /api/governance/reviews
   * 거버넌스 검토 목록 조회
   */
  router.get('/reviews', async (req: Request, res: Response) => {
    try {
      const { debateId, reviewer, limit = '20' } = req.query;

      // 히스토리에서 거버넌스 검토 수집
      const history = debateManager.getDebateHistory({
        limit: parseInt(limit as string) * 2, // 검토가 있는 것만 필터링하므로 더 많이 조회
      });

      let reviews: unknown[] = [];

      for (const debate of history) {
        if (debate.governanceReviews && debate.governanceReviews.length > 0) {
          for (const review of debate.governanceReviews) {
            // 필터링
            if (debateId && debate.id !== debateId) continue;
            if (reviewer && review.reviewerId !== reviewer) continue;

            reviews.push({
              ...review,
              debateTopic: debate.topic,
              debateDomain: debate.domain,
              debateTeam: debate.team,
            });
          }
        }
      }

      // 최신순 정렬 및 제한
      reviews = reviews
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, parseInt(limit as string));

      res.json({
        success: true,
        data: reviews,
        meta: {
          total: reviews.length,
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 검토 목록 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/governance/statistics
   * 거버넌스 통계
   */
  router.get('/statistics', async (req: Request, res: Response) => {
    try {
      const history = debateManager.getDebateHistory({ limit: 100 });

      let totalReviews = 0;
      let approvedCount = 0;
      let qaReviews = 0;
      let complianceReviews = 0;
      let totalScore = 0;

      for (const debate of history) {
        if (debate.governanceReviews) {
          for (const review of debate.governanceReviews) {
            totalReviews++;
            totalScore += review.score;
            if (review.approved) approvedCount++;
            if (review.reviewerId === 'qa-specialist') qaReviews++;
            if (review.reviewerId === 'compliance-auditor') complianceReviews++;
          }
        }
      }

      res.json({
        success: true,
        data: {
          totalReviews,
          approvedCount,
          rejectedCount: totalReviews - approvedCount,
          approvalRate: totalReviews > 0 ? ((approvedCount / totalReviews) * 100).toFixed(1) : 0,
          averageScore: totalReviews > 0 ? (totalScore / totalReviews).toFixed(1) : 0,
          byReviewer: {
            'qa-specialist': qaReviews,
            'compliance-auditor': complianceReviews,
          },
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 통계 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/governance/escalate
   * 토론을 거버넌스 검토로 에스컬레이션
   */
  router.post('/escalate', async (req: Request, res: Response) => {
    try {
      const { debateId, reason, reviewers = ['qa', 'compliance'] } = req.body;

      if (!debateId) {
        return res.status(400).json({
          success: false,
          error: 'debateId는 필수입니다.',
        });
      }

      // 토론 조회
      let debate = debateManager.getActiveDebate(debateId);
      if (!debate) {
        const history = debateManager.getDebateHistory({ limit: 100 });
        debate = history.find(d => d.id === debateId);
      }

      if (!debate) {
        return res.status(404).json({
          success: false,
          error: '토론을 찾을 수 없습니다.',
        });
      }

      const sender = eventBus.createSender('chief-orchestrator');
      const requests: string[] = [];

      // 검토 요청 전송
      if (reviewers.includes('qa')) {
        sender.send(
          'qa-specialist',
          'GOVERNANCE_REVIEW_REQUEST',
          {
            debateId,
            debate,
            reason,
          },
          'high'
        );
        requests.push('qa-specialist');
      }

      if (reviewers.includes('compliance')) {
        sender.send(
          'compliance-auditor',
          'GOVERNANCE_REVIEW_REQUEST',
          {
            debateId,
            debate,
            reason,
          },
          'high'
        );
        requests.push('compliance-auditor');
      }

      res.json({
        success: true,
        data: {
          debateId,
          requestedReviewers: requests,
          message: '거버넌스 검토가 요청되었습니다.',
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 에스컬레이션 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/governance/qa/status
   * QA Specialist 상태
   */
  router.get('/qa/status', async (req: Request, res: Response) => {
    try {
      const status = qaSpecialist.getStatus();
      const capabilities = qaSpecialist.getCapabilities();

      res.json({
        success: true,
        data: {
          ...status,
          capabilities,
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] QA 상태 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/governance/compliance/status
   * Compliance Auditor 상태
   */
  router.get('/compliance/status', async (req: Request, res: Response) => {
    try {
      const status = complianceAuditor.getStatus();
      const capabilities = complianceAuditor.getCapabilities();
      const rules = complianceAuditor.getRules();

      res.json({
        success: true,
        data: {
          ...status,
          capabilities,
          ruleCount: rules.length,
          rules: rules.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            severity: r.severity,
          })),
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 컴플라이언스 상태 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/governance/compliance/rules
   * 컴플라이언스 규칙 추가
   */
  router.post('/compliance/rules', async (req: Request, res: Response) => {
    try {
      const { id, name, description, category, severity } = req.body;

      if (!id || !name || !description || !category || !severity) {
        return res.status(400).json({
          success: false,
          error: 'id, name, description, category, severity는 필수입니다.',
        });
      }

      // 간단한 규칙 추가 (실제로는 check 함수도 필요)
      complianceAuditor.addRule({
        id,
        name,
        description,
        category,
        severity,
        check: () => true, // 기본 통과
      });

      res.status(201).json({
        success: true,
        data: {
          id,
          name,
          message: '규칙이 추가되었습니다.',
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 규칙 추가 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/governance/qa/review
   * 수동 QA 검토 요청
   */
  router.post('/qa/review', async (req: Request, res: Response) => {
    try {
      const { debateId } = req.body;

      if (!debateId) {
        return res.status(400).json({
          success: false,
          error: 'debateId는 필수입니다.',
        });
      }

      // 토론 조회
      let debate = debateManager.getActiveDebate(debateId);
      if (!debate) {
        const history = debateManager.getDebateHistory({ limit: 100 });
        debate = history.find(d => d.id === debateId);
      }

      if (!debate) {
        return res.status(404).json({
          success: false,
          error: '토론을 찾을 수 없습니다.',
        });
      }

      // 직접 QA 검토 수행
      const review = await qaSpecialist.performQAReview(debate);

      res.json({
        success: true,
        data: {
          debateId,
          review,
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] QA 검토 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/governance/compliance/review
   * 수동 컴플라이언스 검토 요청
   */
  router.post('/compliance/review', async (req: Request, res: Response) => {
    try {
      const { debateId } = req.body;

      if (!debateId) {
        return res.status(400).json({
          success: false,
          error: 'debateId는 필수입니다.',
        });
      }

      // 토론 조회
      let debate = debateManager.getActiveDebate(debateId);
      if (!debate) {
        const history = debateManager.getDebateHistory({ limit: 100 });
        debate = history.find(d => d.id === debateId);
      }

      if (!debate) {
        return res.status(404).json({
          success: false,
          error: '토론을 찾을 수 없습니다.',
        });
      }

      // 직접 컴플라이언스 검토 수행
      const review = await complianceAuditor.performComplianceReview(debate);

      res.json({
        success: true,
        data: {
          debateId,
          review,
        },
      });
    } catch (error) {
      console.error('[GovernanceRoutes] 컴플라이언스 검토 오류:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
