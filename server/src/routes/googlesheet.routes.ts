import { Router, Request, Response } from 'express';
import { googleSheetAdapter } from '../adapters/GoogleSheetAdapter.js';

const router = Router();

// 모든 구글 시트 데이터 동기화
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.syncAllData();

    // Transform to frontend format
    const transformedData = transformGoogleSheetData(data);

    res.json({
      success: true,
      data: {
        dailySalesCount: data.dailySales.length,
        salesDetailCount: data.salesDetail.length,
        productionCount: data.production.length,
        purchasesCount: data.purchases.length,
        utilitiesCount: data.utilities.length,
        syncedAt: data.syncedAt,
      },
      transformedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Google Sheet sync failed',
    });
  }
});

// 일별 채널 매출 데이터
router.get('/daily-sales', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchDailySales();
    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch daily sales',
    });
  }
});

// 판매 상세 데이터
router.get('/sales-detail', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchSalesDetail();
    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sales detail',
    });
  }
});

// 생산/폐기 데이터
router.get('/production', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchProduction();
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

// 구매/원자재 데이터
router.get('/purchases', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchPurchases();
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

// 노무비 데이터
router.get('/labor', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchLabor();
    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch labor data',
    });
  }
});

// 유틸리티 데이터
router.get('/utilities', async (req: Request, res: Response) => {
  try {
    const data = await googleSheetAdapter.fetchUtilities();
    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch utilities',
    });
  }
});

/**
 * Transform Google Sheet data to frontend format
 */
function transformGoogleSheetData(data: any) {
  // 실제 원가율 계산: 총구매액 / 총매출액
  const totalRevenue = data.dailySales.reduce((s: number, d: any) => s + (d.totalRevenue || 0), 0);
  const totalPurchaseCost = data.purchases.reduce((s: number, p: any) => s + (p.total || 0), 0);
  const actualCostRate = totalRevenue > 0 ? totalPurchaseCost / totalRevenue : 0.7;
  const actualMarginRate = Math.round((1 - actualCostRate) * 100 * 10) / 10;

  // 일별 매출 → 채널별 수익 트렌드
  const profitTrend = data.dailySales.map((d: any) => ({
    date: formatDateForDisplay(d.date),
    revenue: d.totalRevenue,
    profit: Math.round(d.totalRevenue * (1 - actualCostRate)),
    marginRate: actualMarginRate,
    channels: {
      jasa: d.jasaPrice,
      coupang: d.coupangPrice,
      kurly: d.kurlyPrice,
    },
  }));

  // 판매 상세 → 품목별 수익 순위
  const productProfits = new Map<
    string,
    { name: string; channel: string; revenue: number; quantity: number }
  >();
  data.salesDetail.forEach((sale: any) => {
    const existing = productProfits.get(sale.productCode) || {
      name: sale.productName,
      channel: sale.customer,
      revenue: 0,
      quantity: 0,
    };
    existing.revenue += sale.total;
    existing.quantity += sale.quantity;
    productProfits.set(sale.productCode, existing);
  });

  const sortedProducts = Array.from(productProfits.entries())
    .map(([code, data]) => ({
      id: code,
      skuCode: code,
      skuName: data.name,
      channel: data.channel,
      revenue: data.revenue,
      quantity: data.quantity,
      profit: Math.round(data.revenue * (1 - actualCostRate)),
      margin: actualMarginRate,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProfit = sortedProducts.slice(0, 10).map((item, idx) => ({
    id: `top-${idx}`,
    rank: idx + 1,
    skuName: item.skuName,
    channel: item.channel,
    profit: item.profit,
    margin: item.margin,
  }));

  const bottomProfit = sortedProducts
    .slice(-10)
    .reverse()
    .map((item, idx) => ({
      id: `bot-${idx}`,
      rank: idx + 1,
      skuName: item.skuName,
      channel: item.channel,
      profit: item.profit,
      margin: item.margin,
    }));

  // 생산/폐기 → 폐기율 트렌드
  const wasteTrend = data.production.map((p: any) => ({
    day: formatDateForDisplay(p.date),
    avg: 2.5, // 업계 평균
    actual: p.wasteFinishedPct || 0,
    productionQty: p.prodQtyTotal,
    wasteQty: p.wasteFinishedEa,
  }));

  // 구매 데이터 → 원자재별 구매 현황
  const purchasesByProduct = new Map<
    string,
    { name: string; totalQty: number; totalAmount: number; avgPrice: number }
  >();
  data.purchases.forEach((p: any) => {
    const existing = purchasesByProduct.get(p.productCode) || {
      name: p.productName,
      totalQty: 0,
      totalAmount: 0,
      avgPrice: 0,
    };
    existing.totalQty += p.quantity;
    existing.totalAmount += p.total;
    purchasesByProduct.set(p.productCode, existing);
  });

  const purchaseSummary = Array.from(purchasesByProduct.entries()).map(([code, data]) => ({
    productCode: code,
    productName: data.name,
    totalQuantity: data.totalQty,
    totalAmount: data.totalAmount,
    avgUnitPrice: data.totalQty > 0 ? Math.round(data.totalAmount / data.totalQty) : 0,
  }));

  // 유틸리티 → 비용 트렌드
  const utilityCosts = data.utilities.map((u: any) => ({
    date: formatDateForDisplay(u.date),
    electricity: u.elecCost,
    water: u.waterCost,
    gas: u.gasCost,
    total: u.elecCost + u.waterCost + u.gasCost,
  }));

  return {
    profitTrend,
    topProfit,
    bottomProfit,
    wasteTrend,
    purchaseSummary,
    utilityCosts,
    rawData: {
      dailySales: data.dailySales,
      salesDetail: data.salesDetail,
      production: data.production,
      purchases: data.purchases,
      utilities: data.utilities,
    },
  };
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  // YYYY-MM-DD → MM/DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

export { router as googleSheetRoutes };
