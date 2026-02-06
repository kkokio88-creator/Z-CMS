import { Router, Request, Response } from 'express';
import {
  googleSheetsAdapter,
  MonthlyCostSummary,
  CostTarget,
} from '../adapters/GoogleSheetsAdapter.js';

const router = Router();

// In-memory storage for cost targets (could be persisted to DB later)
let costTargets: CostTarget[] = [];

// Test Google Sheets connection
router.get('/test', async (req: Request, res: Response) => {
  try {
    const result = await googleSheetsAdapter.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get all cost data (raw from sheets)
router.get('/raw', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetsAdapter.fetchAllCostData();
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get monthly cost summary with targets
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const rawData = await googleSheetsAdapter.fetchAllCostData();
    const monthlySummary = googleSheetsAdapter.calculateMonthlySummary(rawData);

    // Merge with targets
    const summaryWithTargets = monthlySummary.map(summary => {
      const target = costTargets.find(t => t.month === summary.month);
      return {
        ...summary,
        targetRatio: target?.targetRatio || null,
        achievementRate: target?.targetRatio
          ? parseFloat(((summary.profitRatio / target.targetRatio) * 100).toFixed(1))
          : null,
      };
    });

    res.json({
      success: true,
      data: summaryWithTargets,
      targets: costTargets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get targets
router.get('/targets', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: costTargets,
  });
});

// Set targets
router.post('/targets', (req: Request, res: Response) => {
  try {
    const { targets } = req.body;

    if (!Array.isArray(targets)) {
      res.status(400).json({
        success: false,
        error: 'targets must be an array',
      });
      return;
    }

    costTargets = targets.map(t => ({
      month: t.month,
      targetRatio: parseFloat(t.targetRatio) || 0,
      targetSales: t.targetSales ? parseFloat(t.targetSales) : undefined,
      targetCost: t.targetCost ? parseFloat(t.targetCost) : undefined,
    }));

    res.json({
      success: true,
      message: 'Targets saved',
      data: costTargets,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update single target
router.put('/targets/:month', (req: Request, res: Response) => {
  try {
    const month = req.params.month as string;
    const { targetRatio, targetSales, targetCost } = req.body;

    const existingIdx = costTargets.findIndex(t => t.month === month);
    const newTarget: CostTarget = {
      month,
      targetRatio: parseFloat(targetRatio) || 0,
      targetSales: targetSales ? parseFloat(targetSales) : undefined,
      targetCost: targetCost ? parseFloat(targetCost) : undefined,
    };

    if (existingIdx >= 0) {
      costTargets[existingIdx] = newTarget;
    } else {
      costTargets.push(newTarget);
    }

    res.json({
      success: true,
      message: `Target for ${month} updated`,
      data: newTarget,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Configure Google Sheets credentials
router.post('/config', (req: Request, res: Response) => {
  try {
    const { credentials, apiKey } = req.body;

    if (apiKey) {
      process.env.GOOGLE_API_KEY = apiKey;
    }

    if (credentials) {
      googleSheetsAdapter.setCredentials(credentials);
    }

    res.json({
      success: true,
      message: 'Configuration updated',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export { router as costReportRoutes };
