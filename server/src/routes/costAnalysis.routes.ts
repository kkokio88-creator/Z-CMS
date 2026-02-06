/**
 * Cost Analysis API Routes
 * 원가 관리 대시보드를 위한 API 엔드포인트
 */

import { Router, Request, Response } from 'express';
import { ecountAdapter } from '../adapters/EcountAdapter.js';
import type {
  EcountPurchaseRaw,
  EcountProductionRaw,
  EcountBomRaw,
  EcountSaleRaw,
  EcountInventoryRaw,
} from '../types/index.js';

const router = Router();

// ========================================
// Helper Functions
// ========================================

type AnomalyLevel = 'normal' | 'warning' | 'critical';
type BudgetStatus = 'normal' | 'warning' | 'critical';
type PerformanceStatus = 'on-target' | 'below-target' | 'above-target';

const determineAnomalyLevel = (gap: number): AnomalyLevel => {
  const absGap = Math.abs(gap);
  if (absGap >= 10) return 'critical';
  if (absGap >= 5) return 'warning';
  return 'normal';
};

const determineBudgetStatus = (
  burnRate: number,
  daysElapsed: number,
  daysInMonth: number
): BudgetStatus => {
  const expectedBurnRate = (daysElapsed / daysInMonth) * 100;
  const deviation = burnRate - expectedBurnRate;
  if (deviation > 15 || burnRate > 95) return 'critical';
  if (deviation > 8 || burnRate > 80) return 'warning';
  return 'normal';
};

const determinePerformanceStatus = (actual: number, target: number): PerformanceStatus => {
  const ratio = (actual / target) * 100;
  if (ratio > 105) return 'above-target';
  if (ratio < 95) return 'below-target';
  return 'on-target';
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // YYYYMMDD -> YYYY-MM-DD
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
};

const getDateRange = (days: number): { from: string; to: string } => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const toStr = to.toISOString().slice(0, 10).replace(/-/g, '');
  const fromStr = from.toISOString().slice(0, 10).replace(/-/g, '');

  return { from: fromStr, to: toStr };
};

// ========================================
// API Endpoints
// ========================================

/**
 * POST /sync - 전체 원가 분석 데이터 동기화
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.syncAllData();

    // Transform to cost analysis format
    const bomYield = transformBomYieldData(data.production, data.bom);
    const inventoryDiscrepancy = transformInventoryDiscrepancy(data.inventory, data.production);
    const materialPriceHistory = transformMaterialPriceHistory(data.purchases);
    const materialImpacts = calculateMaterialImpacts(materialPriceHistory, data.bom);
    const channelProfitability = transformChannelProfitability(data.sales, data.purchases);
    const dailyPerformance = transformDailyPerformance(data.production, data.purchases);
    const { budgetItems, expenseSummary } = transformBudgetData(data.purchases);

    res.json({
      success: true,
      data: {
        bomYield,
        inventoryDiscrepancy,
        materialPriceHistory,
        materialImpacts,
        channelProfitability,
        dailyPerformance,
        budgetItems,
        expenseSummary,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }
});

/**
 * GET /bom-yield - BOM Yield 분석 데이터
 */
router.get('/bom-yield', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const data = await ecountAdapter.syncAllData();

    const bomYield = transformBomYieldData(data.production, data.bom);

    res.json({ success: true, data: bomYield });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch BOM yield data',
    });
  }
});

/**
 * GET /inventory-discrepancy - 재고 괴리 데이터
 */
router.get('/inventory-discrepancy', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.syncAllData();
    const discrepancy = transformInventoryDiscrepancy(data.inventory, data.production);

    res.json({ success: true, data: discrepancy });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory discrepancy',
    });
  }
});

/**
 * GET /material-price-trend - 원재료 단가 추이
 */
router.get('/material-price-trend', async (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 12;
    const data = await ecountAdapter.syncAllData();

    const priceHistory = transformMaterialPriceHistory(data.purchases, weeks);

    res.json({ success: true, data: priceHistory });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price trend',
    });
  }
});

/**
 * GET /material-impacts - 원가 영향 분석
 */
router.get('/material-impacts', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.syncAllData();
    const priceHistory = transformMaterialPriceHistory(data.purchases);
    const impacts = calculateMaterialImpacts(priceHistory, data.bom);

    res.json({ success: true, data: impacts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch material impacts',
    });
  }
});

/**
 * GET /channel-profitability - 채널별 수익성
 */
router.get('/channel-profitability', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '30days';
    const data = await ecountAdapter.syncAllData();

    const profitability = transformChannelProfitability(data.sales, data.purchases, period);

    res.json({ success: true, data: profitability });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch channel profitability',
    });
  }
});

/**
 * GET /daily-performance - 일일 성과 지표
 */
router.get('/daily-performance', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const data = await ecountAdapter.syncAllData();

    const performance = transformDailyPerformance(data.production, data.purchases);

    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch daily performance',
    });
  }
});

/**
 * GET /budget-status - 예산 현황
 */
router.get('/budget-status', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string;
    const data = await ecountAdapter.syncAllData();

    const { budgetItems } = transformBudgetData(data.purchases, period);

    res.json({ success: true, data: budgetItems });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch budget status',
    });
  }
});

/**
 * GET /expense-summary - 경비 요약
 */
router.get('/expense-summary', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string;
    const data = await ecountAdapter.syncAllData();

    const { expenseSummary } = transformBudgetData(data.purchases, period);

    res.json({ success: true, data: expenseSummary });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch expense summary',
    });
  }
});

/**
 * POST /drill-down - 드릴다운 상세 데이터
 */
router.post('/drill-down', async (req: Request, res: Response) => {
  try {
    const { type, targetId } = req.body;
    const data = await ecountAdapter.syncAllData();

    let drilldownData: any = null;

    switch (type) {
      case 'material-impact':
        drilldownData = getMaterialImpactDrilldown(targetId, data);
        break;
      case 'bom-yield':
        drilldownData = getBomYieldDrilldown(targetId, data);
        break;
      case 'channel-cogs':
        drilldownData = getChannelCogsDrilldown(targetId, data);
        break;
      case 'budget-detail':
        drilldownData = getBudgetDetailDrilldown(targetId, data);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid drilldown type' });
    }

    res.json({ success: true, data: drilldownData });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch drilldown data',
    });
  }
});

/**
 * GET /staffing-suggestions - 인력 배치 제안
 */
router.get('/staffing-suggestions', async (req: Request, res: Response) => {
  try {
    // Generate suggestions based on performance data
    const suggestions = generateStaffingSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch staffing suggestions',
    });
  }
});

/**
 * GET /budget-alerts - 예산 경고 알림
 */
router.get('/budget-alerts', async (req: Request, res: Response) => {
  try {
    const data = await ecountAdapter.syncAllData();
    const { budgetItems } = transformBudgetData(data.purchases);

    const alerts = budgetItems
      .filter(b => b.status !== 'normal')
      .map(b => ({
        id: `alert-${b.id}`,
        budgetItemId: b.id,
        accountName: b.accountName,
        alertType: b.projectedOverrun > 0 ? 'exceeded' : 'approaching',
        message:
          b.projectedOverrun > 0
            ? `${b.accountName} 예산 초과 예상: ₩${b.projectedOverrun.toLocaleString()}`
            : `${b.accountName} 예산 소진율 ${b.burnRate.toFixed(1)}% 도달`,
        severity: b.status,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      }));

    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch budget alerts',
    });
  }
});

// ========================================
// Transform Functions
// ========================================

function transformBomYieldData(production: EcountProductionRaw[], bom: EcountBomRaw[]): any[] {
  // Group production by product
  const productionByProduct = new Map<string, { total: number; used: number; dates: string[] }>();

  production.forEach(p => {
    const prodCode = p.PROD_CD;
    if (!productionByProduct.has(prodCode)) {
      productionByProduct.set(prodCode, { total: 0, used: 0, dates: [] });
    }
    const entry = productionByProduct.get(prodCode)!;
    entry.total += parseFloat(p.QTY as any) || 0;
    entry.used += parseFloat((p as any).USE_QTY as any) || 0;
    if (p.IO_DATE) entry.dates.push(p.IO_DATE);
  });

  // Calculate yield for each product
  const result: any[] = [];
  let idx = 0;

  productionByProduct.forEach((data, prodCode) => {
    // Find standard BOM quantity
    const bomEntry = bom.find(b => b.PROD_CD === prodCode);
    const stdQty = bomEntry ? parseFloat((bomEntry as any).USE_QTY as any) || 100 : 100;

    // Calculate yield
    const stdYield = 100; // 표준 수율 100%
    const actualYield = data.total > 0 ? ((data.total - data.used) / data.total) * 100 : 100;
    const yieldGap = actualYield - stdYield;

    result.push({
      id: `bom-yield-${idx++}`,
      productCode: prodCode,
      productName: prodCode, // 실제로는 PROD_DES 필요
      process: '생산',
      stdYield,
      actualYield: Math.round(actualYield * 100) / 100,
      yieldGap: Math.round(yieldGap * 100) / 100,
      transactionDate: data.dates.length > 0 ? formatDate(data.dates[data.dates.length - 1]) : '',
      anomalyLevel: determineAnomalyLevel(yieldGap),
      costImpact: Math.round(yieldGap * -1000), // 예시 계산
    });
  });

  return result;
}

function transformInventoryDiscrepancy(
  inventory: EcountInventoryRaw[],
  production: EcountProductionRaw[]
): any[] {
  // Calculate theoretical inventory based on transactions
  const theoreticalInventory = new Map<string, number>();

  production.forEach(p => {
    const code = (p as any).USE_PROD_CD || p.PROD_CD;
    const qty = parseFloat((p as any).USE_QTY as any) || parseFloat(p.QTY as any) || 0;
    theoreticalInventory.set(code, (theoreticalInventory.get(code) || 0) - qty);
  });

  // Compare with actual inventory
  return inventory
    .map((item, idx) => {
      const physicalQty = parseFloat(item.BAL_QTY as any) || 0;
      const transactionQty = theoreticalInventory.get(item.PROD_CD) || physicalQty;
      const discrepancyQty = physicalQty - transactionQty;
      const discrepancyRate =
        transactionQty !== 0 ? (discrepancyQty / Math.abs(transactionQty)) * 100 : 0;

      return {
        id: `disc-${idx}`,
        materialCode: item.PROD_CD,
        materialName: item.PROD_DES || item.PROD_CD,
        warehouse: item.WH_CD || '기본창고',
        transactionQty: Math.round(transactionQty),
        physicalQty: Math.round(physicalQty),
        discrepancyQty: Math.round(discrepancyQty),
        discrepancyRate: Math.round(discrepancyRate * 100) / 100,
        actionStatus: Math.abs(discrepancyRate) > 10 ? 'pending' : 'resolved',
        lastCheckedDate: new Date().toISOString().slice(0, 10),
      };
    })
    .filter(item => Math.abs(item.discrepancyRate) > 1); // 1% 이상만
}

function transformMaterialPriceHistory(purchases: EcountPurchaseRaw[], weeks: number = 12): any[] {
  // Group purchases by material
  const priceByMaterial = new Map<
    string,
    { prices: { date: string; price: number; supplier: string }[]; name: string }
  >();

  purchases.forEach(p => {
    const code = p.PROD_CD;
    if (!priceByMaterial.has(code)) {
      priceByMaterial.set(code, { prices: [], name: p.PROD_DES || code });
    }
    priceByMaterial.get(code)!.prices.push({
      date: formatDate(p.IO_DATE),
      price: parseFloat(p.U_PRICE as any) || 0,
      supplier: p.CUST_DES || '',
    });
  });

  const result: any[] = [];

  priceByMaterial.forEach((data, code) => {
    const sortedPrices = data.prices.sort((a, b) => a.date.localeCompare(b.date));
    const currentPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1].price : 0;

    // Calculate week and month ago prices
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weekAgoPrice = findPriceAtDate(sortedPrices, weekAgo) || currentPrice;
    const monthAgoPrice = findPriceAtDate(sortedPrices, monthAgo) || currentPrice;

    const priceChangeWeek =
      weekAgoPrice > 0 ? ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100 : 0;
    const priceChangeMonth =
      monthAgoPrice > 0 ? ((currentPrice - monthAgoPrice) / monthAgoPrice) * 100 : 0;

    result.push({
      materialCode: code,
      materialName: data.name,
      category: '원재료',
      unit: 'EA',
      priceHistory: sortedPrices.map(p => ({
        date: p.date,
        unitPrice: p.price,
        supplierName: p.supplier,
      })),
      currentPrice,
      previousWeekPrice: weekAgoPrice,
      previousMonthPrice: monthAgoPrice,
      priceChangeWeek: Math.round(priceChangeWeek * 100) / 100,
      priceChangeMonth: Math.round(priceChangeMonth * 100) / 100,
      avgPrice30Days: calculateAvgPrice(sortedPrices, 30),
    });
  });

  return result;
}

function findPriceAtDate(prices: { date: string; price: number }[], targetDate: Date): number {
  const targetStr = targetDate.toISOString().slice(0, 10);
  const closest = prices.filter(p => p.date <= targetStr).pop();
  return closest?.price || 0;
}

function calculateAvgPrice(prices: { date: string; price: number }[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentPrices = prices.filter(p => p.date >= cutoffStr);
  if (recentPrices.length === 0) return 0;

  const sum = recentPrices.reduce((acc, p) => acc + p.price, 0);
  return Math.round(sum / recentPrices.length);
}

function calculateMaterialImpacts(priceHistory: any[], bom: EcountBomRaw[]): any[] {
  // Find materials with significant price increases
  const increasedMaterials = priceHistory.filter(
    m => m.priceChangeWeek > 5 || m.priceChangeMonth > 10
  );

  return increasedMaterials.map(material => {
    // Find products that use this material
    const affectedBom = bom.filter(b => (b as any).USE_PROD_CD === material.materialCode);

    const affectedProducts = affectedBom.map(b => {
      const bomQty = parseFloat((b as any).USE_QTY as any) || 1;
      const deltaCost = bomQty * (material.currentPrice - material.previousWeekPrice);

      return {
        productCode: b.PROD_CD,
        productName: b.PROD_CD,
        bomQty,
        currentCost: bomQty * material.previousWeekPrice,
        newCost: bomQty * material.currentPrice,
        deltaCost,
        deltaPercent: material.priceChangeWeek,
      };
    });

    const totalDeltaCost = affectedProducts.reduce((sum, p) => sum + p.deltaCost, 0);

    return {
      materialCode: material.materialCode,
      materialName: material.materialName,
      priceIncrease: material.currentPrice - material.previousWeekPrice,
      priceIncreasePercent: material.priceChangeWeek,
      affectedProducts,
      totalDeltaCost,
      urgencyLevel:
        material.priceChangeWeek > 15
          ? 'critical'
          : material.priceChangeWeek > 10
            ? 'warning'
            : 'normal',
    };
  });
}

function transformChannelProfitability(
  sales: EcountSaleRaw[],
  purchases: EcountPurchaseRaw[],
  period: string = '30days'
): any[] {
  // Group sales by channel (CUST_DES)
  const channelData = new Map<string, { revenue: number; orders: number; items: Set<string> }>();

  sales.forEach(s => {
    const channel = s.CUST_DES || '기타';
    if (!channelData.has(channel)) {
      channelData.set(channel, { revenue: 0, orders: 0, items: new Set() });
    }
    const data = channelData.get(channel)!;
    data.revenue += parseFloat(s.SUPPLY_AMT as any) || 0;
    data.orders++;
    data.items.add(s.PROD_CD);
  });

  // Calculate total purchase cost for COGS estimation
  const totalPurchaseCost = purchases.reduce(
    (sum, p) => sum + (parseFloat(p.SUPPLY_AMT as any) || 0),
    0
  );
  const totalRevenue = Array.from(channelData.values()).reduce((sum, d) => sum + d.revenue, 0);
  const avgCostRatio = totalRevenue > 0 ? totalPurchaseCost / totalRevenue : 0.6;

  const result: any[] = [];

  channelData.forEach((data, channel) => {
    const estimatedCogs = data.revenue * avgCostRatio;
    const grossProfit = data.revenue - estimatedCogs;
    const grossMargin = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0;

    // Estimate COGS breakdown
    const cogs = {
      rawMaterial: estimatedCogs * 0.5,
      labor: estimatedCogs * 0.25,
      logistics: estimatedCogs * 0.1,
      commission: estimatedCogs * 0.1,
      packaging: estimatedCogs * 0.03,
      other: estimatedCogs * 0.02,
    };

    result.push({
      channelId: channel,
      channelName: channel,
      channelType: determineChannelType(channel),
      revenue: Math.round(data.revenue),
      cogs,
      totalCogs: Math.round(estimatedCogs),
      grossProfit: Math.round(grossProfit),
      grossMargin: Math.round(grossMargin * 100) / 100,
      contributionMargin: Math.round((grossMargin - 5) * 100) / 100, // 예시: 5% 고정비 차감
      netProfit: Math.round(grossProfit * 0.8), // 예시: 80%
      netMargin: Math.round(grossMargin * 0.8 * 100) / 100,
      profitTrend: grossMargin > 20 ? 'up' : grossMargin > 10 ? 'stable' : 'down',
      trendPercent: Math.round((Math.random() - 0.5) * 20 * 100) / 100,
      orderCount: data.orders,
      avgOrderValue: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
    });
  });

  return result.sort((a, b) => b.revenue - a.revenue);
}

function determineChannelType(channelName: string): string {
  const name = channelName.toLowerCase();
  if (name.includes('쿠팡') || name.includes('마켓') || name.includes('11번가'))
    return 'Marketplace';
  if (name.includes('자사') || name.includes('홈페이지')) return 'D2C';
  if (name.includes('도매') || name.includes('납품')) return 'Wholesale';
  if (name.includes('b2b') || name.includes('기업')) return 'B2B';
  return 'Other';
}

function transformDailyPerformance(
  production: EcountProductionRaw[],
  purchases: EcountPurchaseRaw[]
): any[] {
  // Group by date
  const dailyData = new Map<string, { productionQty: number; materialCost: number }>();

  production.forEach(p => {
    const date = formatDate(p.IO_DATE);
    if (!dailyData.has(date)) {
      dailyData.set(date, { productionQty: 0, materialCost: 0 });
    }
    dailyData.get(date)!.productionQty += parseFloat(p.QTY as any) || 0;
  });

  purchases.forEach(p => {
    const date = formatDate(p.IO_DATE);
    if (dailyData.has(date)) {
      dailyData.get(date)!.materialCost += parseFloat(p.SUPPLY_AMT as any) || 0;
    }
  });

  // Calculate performance metrics
  const targetLaborRatio = 25; // 목표 노무비율 25%
  const targetMaterialRatio = 45; // 목표 원재료비율 45%
  const laborCostPerUnit = 5000; // 단위당 노무비 (예시)

  const result: any[] = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  dailyData.forEach((data, date) => {
    const laborCost = data.productionQty * laborCostPerUnit;
    const totalCost = laborCost + data.materialCost;
    const estimatedRevenue = totalCost / 0.7; // 원가율 70% 가정

    const actualLaborRatio = estimatedRevenue > 0 ? (laborCost / estimatedRevenue) * 100 : 0;
    const actualMaterialRatio =
      estimatedRevenue > 0 ? (data.materialCost / estimatedRevenue) * 100 : 0;

    const dateObj = new Date(date);
    const dayOfWeek = dayNames[dateObj.getDay()];

    result.push({
      date,
      dayOfWeek,
      productionQty: Math.round(data.productionQty),
      productionTarget: 1000, // 예시 목표
      productionAchievement: Math.round((data.productionQty / 1000) * 100),
      targetLaborRatio,
      actualLaborRatio: Math.round(actualLaborRatio * 100) / 100,
      laborCost: Math.round(laborCost),
      laborVariance: Math.round((actualLaborRatio - targetLaborRatio) * 100) / 100,
      laborStatus: determinePerformanceStatus(actualLaborRatio, targetLaborRatio),
      targetMaterialRatio,
      actualMaterialRatio: Math.round(actualMaterialRatio * 100) / 100,
      materialCost: Math.round(data.materialCost),
      materialVariance: Math.round((actualMaterialRatio - targetMaterialRatio) * 100) / 100,
      materialStatus: determinePerformanceStatus(actualMaterialRatio, targetMaterialRatio),
      efficiency: Math.round(
        100 -
          Math.abs(actualLaborRatio - targetLaborRatio) -
          Math.abs(actualMaterialRatio - targetMaterialRatio)
      ),
      overallStatus: determinePerformanceStatus(
        (actualLaborRatio + actualMaterialRatio) / 2,
        (targetLaborRatio + targetMaterialRatio) / 2
      ),
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function transformBudgetData(
  purchases: EcountPurchaseRaw[],
  period?: string
): { budgetItems: any[]; expenseSummary: any } {
  // Group purchases by supplier (as budget category proxy)
  const budgetByVendor = new Map<string, number>();

  purchases.forEach(p => {
    const vendor = p.CUST_DES || '기타';
    budgetByVendor.set(
      vendor,
      (budgetByVendor.get(vendor) || 0) + (parseFloat(p.SUPPLY_AMT as any) || 0)
    );
  });

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed;

  let totalUsed = 0;
  let fixedCostUsed = 0;
  let variableCostUsed = 0;

  const budgetItems: any[] = [];
  let idx = 0;

  budgetByVendor.forEach((usedAmount, vendor) => {
    const isFixed = vendor.includes('임대') || vendor.includes('보험') || vendor.includes('관리');
    const budgetAmount = usedAmount * 1.2; // 예상 예산 (사용액의 120%)
    const burnRate = (usedAmount / budgetAmount) * 100;
    const dailyBurnRate = daysElapsed > 0 ? usedAmount / daysElapsed : 0;
    const projectedTotal = dailyBurnRate * daysInMonth;
    const projectedOverrun = Math.max(0, projectedTotal - budgetAmount);

    totalUsed += usedAmount;
    if (isFixed) fixedCostUsed += usedAmount;
    else variableCostUsed += usedAmount;

    budgetItems.push({
      id: `budget-${idx++}`,
      category: isFixed ? 'fixed' : 'variable',
      accountCode: `ACC-${idx}`,
      accountName: vendor,
      vendorId: vendor,
      vendorName: vendor,
      budgetAmount: Math.round(budgetAmount),
      usedAmount: Math.round(usedAmount),
      remainingAmount: Math.round(budgetAmount - usedAmount),
      burnRate: Math.round(burnRate * 100) / 100,
      dailyBurnRate: Math.round(dailyBurnRate),
      projectedTotal: Math.round(projectedTotal),
      projectedOverrun: Math.round(projectedOverrun),
      daysElapsed,
      daysRemaining,
      status: determineBudgetStatus(burnRate, daysElapsed, daysInMonth),
      lastUpdated: now.toISOString(),
    });
  });

  const totalBudget = budgetItems.reduce((sum, b) => sum + b.budgetAmount, 0);
  const totalRemaining = totalBudget - totalUsed;
  const overallBurnRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
  const projectedMonthEnd = totalUsed + (totalUsed / daysElapsed) * daysRemaining;

  const expenseSummary = {
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    totalBudget: Math.round(totalBudget),
    totalUsed: Math.round(totalUsed),
    totalRemaining: Math.round(totalRemaining),
    overallBurnRate: Math.round(overallBurnRate * 100) / 100,
    fixedCostBudget: Math.round(fixedCostUsed * 1.2),
    fixedCostUsed: Math.round(fixedCostUsed),
    variableCostBudget: Math.round(variableCostUsed * 1.2),
    variableCostUsed: Math.round(variableCostUsed),
    overrunRisk: projectedMonthEnd > totalBudget,
    projectedMonthEnd: Math.round(projectedMonthEnd),
    healthScore: Math.max(
      0,
      Math.min(100, 100 - (overallBurnRate - (daysElapsed / daysInMonth) * 100))
    ),
  };

  return { budgetItems: budgetItems.sort((a, b) => b.usedAmount - a.usedAmount), expenseSummary };
}

// ========================================
// Drilldown Functions
// ========================================

function getMaterialImpactDrilldown(materialCode: string, data: any): any {
  // Return detailed impact analysis for a specific material
  const purchases = data.purchases.filter((p: any) => p.PROD_CD === materialCode);
  const bomUsage = data.bom.filter((b: any) => b.USE_PROD_CD === materialCode);

  return {
    type: 'material-impact',
    title: `원재료 단가 영향 분석: ${materialCode}`,
    data: {
      purchaseHistory: purchases.map((p: any) => ({
        date: formatDate(p.IO_DATE),
        price: parseFloat(p.PRICE) || 0,
        supplier: p.CUST_DES,
        qty: parseFloat(p.QTY) || 0,
      })),
      affectedProducts: bomUsage.map((b: any) => ({
        productCode: b.PROD_CD,
        bomQty: parseFloat(b.USE_QTY) || 0,
      })),
      suggestedActions: ['BOM 레시피 수정 검토', '판매가 인상 검토', '대체 공급처 탐색'],
    },
  };
}

function getBomYieldDrilldown(productCode: string, data: any): any {
  const production = data.production.filter((p: any) => p.PROD_CD === productCode);

  return {
    type: 'bom-yield',
    title: `BOM Yield 분석: ${productCode}`,
    data: {
      yieldHistory: production.map((p: any) => ({
        date: formatDate(p.IO_DATE),
        qty: parseFloat(p.QTY) || 0,
        used: parseFloat(p.USE_QTY) || 0,
        yield:
          parseFloat(p.QTY) > 0
            ? ((parseFloat(p.QTY) - parseFloat(p.USE_QTY)) / parseFloat(p.QTY)) * 100
            : 100,
      })),
      suggestedActions: ['BOM 표준 업데이트', '로스 원인 조사 요청'],
    },
  };
}

function getChannelCogsDrilldown(channelId: string, data: any): any {
  const sales = data.sales.filter((s: any) => s.CUST_DES === channelId);

  return {
    type: 'channel-cogs',
    title: `채널 COGS 분석: ${channelId}`,
    data: {
      salesByProduct: aggregateSalesByProduct(sales),
      cogsBreakdown: {
        rawMaterial: 50,
        labor: 25,
        logistics: 10,
        commission: 10,
        packaging: 3,
        other: 2,
      },
    },
  };
}

function getBudgetDetailDrilldown(budgetId: string, data: any): any {
  return {
    type: 'budget-detail',
    title: `예산 상세: ${budgetId}`,
    data: {
      monthlyTrend: [],
      transactions: [],
    },
  };
}

function aggregateSalesByProduct(sales: any[]): any[] {
  const byProduct = new Map<string, { qty: number; amount: number }>();

  sales.forEach(s => {
    const code = s.PROD_CD;
    if (!byProduct.has(code)) {
      byProduct.set(code, { qty: 0, amount: 0 });
    }
    byProduct.get(code)!.qty += parseFloat(s.QTY) || 0;
    byProduct.get(code)!.amount += parseFloat(s.SUPPLY_AMT) || 0;
  });

  return Array.from(byProduct.entries()).map(([code, data]) => ({
    productCode: code,
    qty: data.qty,
    amount: data.amount,
  }));
}

function generateStaffingSuggestions(): any[] {
  // Generate mock staffing suggestions
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return [
    {
      date: tomorrow.toISOString().slice(0, 10),
      department: '생산1팀',
      currentHeadcount: 10,
      suggestedHeadcount: 12,
      reason: '생산량 증가 예상으로 인력 보강 필요',
      priority: 'high',
    },
    {
      date: tomorrow.toISOString().slice(0, 10),
      department: '포장팀',
      currentHeadcount: 8,
      suggestedHeadcount: 7,
      reason: '주문량 감소 예상으로 인력 조정 가능',
      priority: 'low',
    },
  ];
}

export default router;
