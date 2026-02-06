/**
 * Supabase API Routes
 * 동기화 트리거 및 Supabase 데이터 조회 엔드포인트
 */

import { Router, Request, Response } from 'express';
import { syncService } from '../services/SyncService.js';
import { supabaseAdapter } from '../adapters/SupabaseAdapter.js';

const router = Router();

// ==============================
// 동기화 트리거
// ==============================

/**
 * POST /api/sync/google-sheets
 * Google Sheets → Supabase 동기화
 */
router.post('/sync/google-sheets', async (_req: Request, res: Response) => {
  try {
    const result = await syncService.syncFromGoogleSheets();
    res.json({
      success: result.success,
      message: result.success
        ? `Google Sheets 동기화 완료 (${result.duration}ms)`
        : `동기화 실패: ${result.error}`,
      records: result.records,
      duration: result.duration,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/data/inventory
 */
router.get('/data/inventory', async (_req: Request, res: Response) => {
  try {
    const data = await supabaseAdapter.getInventory();
    res.json({ success: true, data, count: data.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

export default router;
