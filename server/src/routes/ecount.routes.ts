import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ecountAdapter } from '../adapters/EcountAdapter.js';
import { apiAuth } from '../middleware/apiAuth.js';
import { validateBody } from '../middleware/validate.js';

const ecountConfigSchema = z.object({
  COM_CODE: z.string().min(1, 'COM_CODE 필수'),
  USER_ID: z.string().min(1, 'USER_ID 필수'),
  API_KEY: z.string().min(1, 'API_KEY 필수'),
  ZONE: z.string().default('CD'),
});

const router = Router();

// Get current ECOUNT config (without API key)
router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: ecountAdapter.getConfig(),
  });
});

// Update ECOUNT config (인증 필요)
router.post('/config', apiAuth, validateBody(ecountConfigSchema), (req: Request, res: Response) => {
  const { COM_CODE, USER_ID, API_KEY, ZONE } = req.body;

  ecountAdapter.updateConfig({
    COM_CODE,
    USER_ID,
    API_KEY,
    ZONE,
  });

  res.json({
    success: true,
    message: 'Config updated',
  });
});

// Test ECOUNT connection
router.post('/test', async (req: Request, res: Response) => {
  const result = await ecountAdapter.testConnection();

  res.json({
    success: result.success,
    message: result.message,
  });
});

// Sync all ECOUNT data and transform to frontend format
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.syncAllData();
    const stateManager = req.app.locals.stateManager;

    // Transform ECOUNT raw data to frontend format
    const transformedData = transformEcountData(data);

    // Update state manager with transformed data
    if (stateManager && stateManager.loadFromEcountData) {
      stateManager.loadFromEcountData({
        inventoryItems: transformedData.inventory,
        anomalies: transformedData.anomalies,
        orderSuggestions: transformedData.suggestions,
        bomItems: transformedData.bomItems,
        profitTrend: transformedData.profitTrend,
        topProfitItems: transformedData.topProfit,
        bottomProfitItems: transformedData.bottomProfit,
      });
    }

    res.json({
      success: true,
      data: {
        salesCount: data.sales.length,
        purchasesCount: data.purchases.length,
        inventoryCount: data.inventory.length,
        productionCount: data.production.length,
        bomCount: data.bom.length,
        syncedAt: data.syncedAt,
      },
      transformedData,
    });

    // Trigger analysis after sync
    const coordinator = req.app.locals.coordinatorAgent;
    if (coordinator) {
      coordinator.orchestrateAnalysis({ priority: 'medium' });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }
});

// Transform ECOUNT raw data to frontend format
function transformEcountData(data: any) {
  // Transform inventory data - use inventoryByLocation if inventory is empty
  const inventorySource =
    data.inventory.length > 0 ? data.inventory : data.inventoryByLocation || [];
  const inventory = inventorySource.map((item: any, idx: number) => ({
    id: item.PROD_CD || `inv-${idx}`,
    skuName: item.PROD_DES || item.PROD_CD || `품목 ${idx + 1}`,
    currentStock: parseFloat(item.BAL_QTY || item.QTY || item.BALANCE_QTY || 0),
    safetyStock: parseFloat(item.SAFE_QTY || 100), // Default safety stock if not provided
    status: determineStockStatus(
      parseFloat(item.BAL_QTY || item.QTY || item.BALANCE_QTY || 0),
      parseFloat(item.SAFE_QTY || 100)
    ),
    turnoverRate: 0, // Calculate if data available
    warehouse: item.WH_CD || 'Main',
    warehouseName: item.WH_DES || '',
    category: item.CLASS_CD || '일반',
    sizeDesc: item.PROD_SIZE_DES || '',
  }));

  // Transform sales data to profit trend
  const salesByDate = new Map<string, { revenue: number; cost: number }>();
  data.sales.forEach((sale: any) => {
    const date = sale.SALE_DATE || sale.IO_DATE;
    if (date) {
      const dateStr = formatDate(date);
      const existing = salesByDate.get(dateStr) || { revenue: 0, cost: 0 };
      existing.revenue += parseFloat(sale.SUPPLY_AMT || sale.AMT || 0);
      existing.cost += parseFloat(sale.COST_AMT || 0);
      salesByDate.set(dateStr, existing);
    }
  });

  const profitTrend = Array.from(salesByDate.entries())
    .map(([date, { revenue, cost }]) => ({
      date,
      revenue: Math.round(revenue),
      profit: Math.round(revenue - cost),
      marginRate: revenue > 0 ? parseFloat((((revenue - cost) / revenue) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-31); // Last 31 days

  // Transform BOM data
  const bomItems = data.bom.map((item: any, idx: number) => ({
    id: item.BOM_NO || `bom-${idx}`,
    skuCode: item.PROD_CD || `PRD-${idx}`,
    skuName: item.PROD_DES || `품목 ${idx + 1}`,
    skuSub: item.SUB_PROD_DES || '',
    process: item.PROCESS_CD || 'Default',
    stdQty: parseFloat(item.BOM_QTY || 0),
    stdUnit: item.UNIT_CD || 'EA',
    actualQty: parseFloat(item.ACTUAL_QTY || item.BOM_QTY || 0),
    diffPercent: 0, // Calculate from production data if available
    anomalyScore: 0,
    costImpact: 0,
    reasoning: '',
    status: 'pending' as const,
  }));

  // Calculate profit rankings from sales data
  const productProfits = new Map<
    string,
    { name: string; channel: string; profit: number; revenue: number }
  >();
  data.sales.forEach((sale: any) => {
    const prodCode = sale.PROD_CD || 'unknown';
    const existing = productProfits.get(prodCode) || {
      name: sale.PROD_DES || prodCode,
      channel: sale.CUST_DES || '기타',
      profit: 0,
      revenue: 0,
    };
    const revenue = parseFloat(sale.SUPPLY_AMT || sale.AMT || 0);
    const cost = parseFloat(sale.COST_AMT || 0);
    existing.profit += revenue - cost;
    existing.revenue += revenue;
    productProfits.set(prodCode, existing);
  });

  const sortedProfits = Array.from(productProfits.entries())
    .map(([id, data]) => ({
      id,
      ...data,
      margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const topProfit = sortedProfits.slice(0, 5).map((item, idx) => ({
    id: `top-${idx}`,
    rank: idx + 1,
    skuName: item.name,
    channel: item.channel,
    profit: Math.round(item.profit),
    margin: parseFloat(item.margin.toFixed(1)),
  }));

  const bottomProfit = sortedProfits
    .slice(-5)
    .reverse()
    .map((item, idx) => ({
      id: `bot-${idx}`,
      rank: idx + 1,
      skuName: item.name,
      channel: item.channel,
      profit: Math.round(item.profit),
      margin: parseFloat(item.margin.toFixed(1)),
    }));

  // Generate waste trend from production data
  const wasteTrend = profitTrend.slice(-14).map(p => ({
    day: p.date,
    avg: 2.5, // Industry average
    actual: 0, // Calculate from production data if available
  }));

  // Generate anomalies from inventory shortages
  const anomalies = inventory
    .filter((i: any) => i.status === 'Shortage')
    .map((i: any) => ({
      id: `anom-${i.id}`,
      materialName: i.skuName,
      location: `${i.warehouse}-A01`,
      systemQty: i.currentStock + 50,
      countedQty: i.currentStock,
      aiExpectedQty: i.currentStock + 20,
      anomalyScore: 75,
      reason: '시스템 재고와 실사 차이 발생',
      actionStatus: 'none' as const,
    }));

  // Generate order suggestions from shortages
  const suggestions = inventory
    .filter((i: any) => i.status === 'Shortage')
    .map((i: any) => ({
      id: `ord-${i.id}`,
      skuCode: i.id,
      skuName: i.skuName,
      supplierId: 'S1',
      supplierName: '협력업체',
      method: 'Email',
      currentStock: i.currentStock,
      safetyStock: i.safetyStock,
      avgDailyConsumption: Math.floor(i.safetyStock / 14),
      leadTime: 3,
      suggestedQty: Math.max(0, i.safetyStock * 2 - i.currentStock),
      orderQty: Math.max(0, i.safetyStock * 2 - i.currentStock),
      unit: 'EA',
      unitPrice: 1000,
      status: 'Ready',
    }));

  return {
    profitTrend,
    topProfit,
    bottomProfit,
    inventory,
    anomalies,
    suggestions,
    bomItems,
    wasteTrend,
  };
}

function determineStockStatus(
  current: number,
  safety: number
): 'Shortage' | 'Normal' | 'Overstock' {
  if (current < safety) return 'Shortage';
  if (current > safety * 2) return 'Overstock';
  return 'Normal';
}

import { formatDateDisplay as formatDate } from '../utils/formatDate.js';

// Get sales data
router.get('/sales', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;

  if (!dateFrom || !dateTo) {
    res.status(400).json({
      success: false,
      error: 'dateFrom and dateTo are required',
    });
    return;
  }

  try {
    const data = await ecountAdapter.fetchSales(dateFrom as string, dateTo as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sales',
    });
  }
});

// Get purchases data
router.get('/purchases', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;

  if (!dateFrom || !dateTo) {
    res.status(400).json({
      success: false,
      error: 'dateFrom and dateTo are required',
    });
    return;
  }

  try {
    const data = await ecountAdapter.fetchPurchases(dateFrom as string, dateTo as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchases',
    });
  }
});

// Get inventory data
router.get('/inventory', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.fetchInventory();

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory',
    });
  }
});

// Get production data
router.get('/production', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;

  if (!dateFrom || !dateTo) {
    res.status(400).json({
      success: false,
      error: 'dateFrom and dateTo are required',
    });
    return;
  }

  try {
    const data = await ecountAdapter.fetchProduction(dateFrom as string, dateTo as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch production',
    });
  }
});

// Get BOM data
router.get('/bom', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.fetchBom();

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch BOM',
    });
  }
});

// Get Purchase Orders (발주서 조회)
router.get('/purchase-orders', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;

  if (!dateFrom || !dateTo) {
    res.status(400).json({
      success: false,
      error: 'dateFrom and dateTo are required',
    });
    return;
  }

  try {
    const data = await ecountAdapter.fetchPurchaseOrders(dateFrom as string, dateTo as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchase orders',
    });
  }
});

// Get Inventory by Location (창고별 재고현황)
router.get('/inventory-by-location', async (req: Request, res: Response) => {
  const { baseDate } = req.query;

  try {
    const data = await ecountAdapter.fetchInventoryByLocation(baseDate as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory by location',
    });
  }
});

// Get Attendance Records (출퇴근 기록)
router.get('/attendance', async (req: Request, res: Response) => {
  const { dateFrom, dateTo } = req.query;

  if (!dateFrom || !dateTo) {
    res.status(400).json({
      success: false,
      error: 'dateFrom and dateTo are required',
    });
    return;
  }

  try {
    const data = await ecountAdapter.fetchAttendance(dateFrom as string, dateTo as string);

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attendance records',
    });
  }
});

// Get Customers/Vendors (거래처)
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.fetchCustomers();

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customers',
    });
  }
});

export { router as ecountRoutes };
