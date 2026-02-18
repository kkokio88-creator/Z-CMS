/**
 * Supabase API Routes
 * 동기화 트리거 및 Supabase 데이터 조회 엔드포인트
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncService } from '../services/SyncService.js';
import { supabaseAdapter } from '../adapters/SupabaseAdapter.js';
import { validateBody } from '../middleware/validate.js';

const agentStateSchema = z.object({}).passthrough().refine(
  val => Object.keys(val).length > 0,
  { message: '빈 상태 객체는 저장할 수 없습니다' }
);

const router = Router();

// ==============================
// 동기화 트리거
// ==============================

/**
 * POST /api/sync/google-sheets
 * Google Sheets → Supabase 동기화
 */
router.post('/sync/google-sheets', async (req: Request, res: Response) => {
  try {
    const incremental = req.query.incremental === 'true';
    const result = await syncService.syncFromGoogleSheets(incremental);
    res.json({
      success: result.success,
      message: result.success
        ? `Google Sheets 동기화 완료 (${result.duration}ms)${result.skippedTables?.length ? ` [스킵: ${result.skippedTables.join(',')}]` : ''}`
        : `동기화 실패: ${result.error}`,
      records: result.records,
      duration: result.duration,
      skippedTables: result.skippedTables,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/sync/ecount
 * ECOUNT → Supabase 동기화
 */
router.post('/sync/ecount', async (_req: Request, res: Response) => {
  try {
    const result = await syncService.syncFromEcount();
    res.json({
      success: result.success,
      message: result.success
        ? `ECOUNT 동기화 완료 (${result.duration}ms)`
        : `동기화 실패: ${result.error}`,
      records: result.records,
      duration: result.duration,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/sync/all
 * 모든 소스에서 동기화
 */
router.post('/sync/all', async (_req: Request, res: Response) => {
  try {
    const [gsResult, ecountResult] = await Promise.allSettled([
      syncService.syncFromGoogleSheets(),
      syncService.syncFromEcount(),
    ]);

    res.json({
      success: true,
      googleSheets:
        gsResult.status === 'fulfilled'
          ? gsResult.value
          : { success: false, error: (gsResult as PromiseRejectedResult).reason?.message },
      ecount:
        ecountResult.status === 'fulfilled'
          ? ecountResult.value
          : { success: false, error: (ecountResult as PromiseRejectedResult).reason?.message },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/sync/status
 * 최근 동기화 상태
 */
router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const logs = await syncService.getLastSyncStatus();
    const [gsMinutes, ecountMinutes] = await Promise.all([
      syncService.getMinutesSinceLastSync('google_sheets'),
      syncService.getMinutesSinceLastSync('ecount'),
    ]);

    res.json({
      success: true,
      lastSync: {
        googleSheets: gsMinutes !== null ? `${gsMinutes}분 전` : '동기화 기록 없음',
        ecount: ecountMinutes !== null ? `${ecountMinutes}분 전` : '동기화 기록 없음',
      },
      recentLogs: logs,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ==============================
// 데이터 조회 (Supabase에서 읽기)
// ==============================

/**
 * GET /api/data/daily-sales
 */
router.get('/data/daily-sales', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getDailySales(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/sales-detail
 */
router.get('/data/sales-detail', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getSalesDetail(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/production
 */
router.get('/data/production', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getProductionDaily(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/purchases
 */
router.get('/data/purchases', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getPurchases(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/inventory
 */
router.get('/data/inventory', async (_req: Request, res: Response) => {
  try {
    const data = await supabaseAdapter.getInventory();
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/utilities
 */
router.get('/data/utilities', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getUtilities(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/labor
 * 노무비 일별 데이터
 */
router.get('/data/labor', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await supabaseAdapter.getLaborDaily(
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/bom
 * BOM 데이터 (SAN + ZIP)
 */
router.get('/data/bom', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;
    const data = await supabaseAdapter.getBom(source as string | undefined);
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/material-master
 * 자재 마스터 데이터
 */
router.get('/data/material-master', async (_req: Request, res: Response) => {
  try {
    const data = await supabaseAdapter.getMaterialMaster();
    res.json({ success: true, data, count: data.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/data/health
 * Supabase 연결 상태 확인
 */
router.get('/data/health', async (_req: Request, res: Response) => {
  try {
    const result = await supabaseAdapter.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================
// 데이터 정합성 검증
// ==============================

/**
 * GET /api/data/validate
 * Supabase 테이블별 행 수 + 데이터 정합성 검증
 */
router.get('/data/validate', async (_req: Request, res: Response) => {
  try {
    const [counts, salesValidation, channelValidation, lastSync] = await Promise.all([
      supabaseAdapter.getTableCounts(),
      supabaseAdapter.validateSalesDetail(),
      supabaseAdapter.validateDailySalesChannels(),
      supabaseAdapter.getRecentSyncLogs(1),
    ]);

    const issues: string[] = [];

    // 빈 테이블 감지
    for (const [table, count] of Object.entries(counts)) {
      if (count === 0) issues.push(`${table}: 데이터 없음 (0행)`);
      if (count === -1) issues.push(`${table}: 조회 실패`);
    }

    // sales_detail 비정상 데이터
    if (salesValidation.zeroRecommended > 0) {
      issues.push(`sales_detail: 권장판매매출 0인 행 ${salesValidation.zeroRecommended}건`);
    }
    if (salesValidation.mismatchRows > 0) {
      issues.push(`sales_detail: 권장판매매출 < 공급가액인 비정상 행 ${salesValidation.mismatchRows}건`);
    }

    // daily_sales 채널 합계 불일치
    if (channelValidation.mismatchRows.length > 0) {
      issues.push(`daily_sales: 채널 합계 ≠ totalRevenue 불일치 ${channelValidation.mismatchRows.length}건`);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tableCounts: counts,
      salesDetail: salesValidation,
      dailySalesChannels: {
        totalRows: channelValidation.totalRows,
        mismatchCount: channelValidation.mismatchRows.length,
        samples: channelValidation.mismatchRows,
      },
      lastSync: lastSync[0] || null,
      issues,
      healthy: issues.length === 0,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// ==============================
// 에이전트 상태 영구 저장
// ==============================

/**
 * PUT /api/agent-state/:agentId
 * 에이전트 상태 저장
 */
router.put('/agent-state/:agentId', validateBody(agentStateSchema), async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const state = req.body;
    await supabaseAdapter.saveAgentState(agentId, state);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/agent-state/:agentId
 * 에이전트 상태 조회
 */
router.get('/agent-state/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId as string;
    const state = await supabaseAdapter.loadAgentState(agentId);
    res.json({ success: true, data: state });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
