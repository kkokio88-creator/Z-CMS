/**
 * Insight Service — Supabase 실데이터 기반 분석 엔진
 * costAnalysisService를 완전 대체
 */

import type {
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
  UtilityData,
  LaborDailyData,
  BomItemData,
  MaterialMasterItem,
  InventorySnapshotData,
} from './googleSheetService';
import { getZScore } from './orderingService';
import type { InventorySafetyItem, BomYieldAnalysisItem, InventoryDiscrepancyItem } from '../types';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG } from '../config/businessConfig';
import type { ChannelCostSummary } from '../components/domain';

// ==============================
// Barrel re-exports from profitService
// ==============================
export {
  computeChannelRevenue,
  computeProductProfit,
  computeRevenueTrend,
  computeProductBEP,
  computeProfitCenterScore,
} from './profitService';

export type {
  ChannelProfitDetail,
  ChannelRevenueInsight,
  ProductProfitInsight,
  WeeklyTrendEntry,
  RevenueTrendInsight,
  ProductBEPItem,
  ProductBEPInsight,
  ProfitCenterScoreMetric,
  ProfitCenterScoreInsight,
} from './profitService';

import {
  computeChannelRevenue,
  computeProductProfit,
  computeRevenueTrend,
  computeProductBEP,
  computeProfitCenterScore,
} from './profitService';
import type {
  ChannelRevenueInsight,
  ProductProfitInsight,
  RevenueTrendInsight,
  ProductBEPInsight,
  ProfitCenterScoreInsight,
} from './profitService';

// ==============================
// Barrel re-exports from costService
// ==============================
export {
  computeMaterialPrices,
  computeUtilityCosts,
  computeCostBreakdown,
  computeLimitPrice,
  computeCostVarianceBreakdown,
  computeDailyPerformance,
  computeMaterialPriceImpact,
  computeBudgetExpense,
  computeCashFlow,
  isSubMaterial,
  isCostExcluded,
  diagnoseSubMaterialClassification,
} from './costService';

export type {
  MaterialPriceInsight,
  UtilityCostInsight,
  MaterialDetailItem,
  InventoryAdjustment,
  CostBreakdownInsight,
  LimitPriceItem,
  LimitPriceInsight,
  CashFlowInsight,
  CostVarianceDetailItem,
  CostVarianceCategory,
  CostVarianceBreakdown,
  DailyPerformanceInsight,
  MaterialPriceImpactInsight,
  BudgetExpenseInsight,
} from './costService';

import {
  computeMaterialPrices,
  computeUtilityCosts,
  computeCostBreakdown,
  computeLimitPrice,
  computeDailyPerformance,
  computeMaterialPriceImpact,
  computeBudgetExpense,
  computeCashFlow,
} from './costService';
import type {
  CostBreakdownInsight,
  MaterialPriceInsight,
  UtilityCostInsight,
  LimitPriceInsight,
  CashFlowInsight,
  DailyPerformanceInsight,
  MaterialPriceImpactInsight,
  BudgetExpenseInsight,
  InventoryAdjustment,
} from './costService';

// ==============================
// 타입 정의
// ==============================

export interface WasteAnalysisInsight {
  daily: {
    date: string;
    wasteFinishedPct: number;
    wasteSemiPct: number;
    wasteFinishedEa: number;
    wasteSemiKg: number;
    productionQty: number;
    productionKg: number;
    estimatedCost: number;
  }[];
  avgWasteRate: number;
  highWasteDays: { date: string; rate: number; qty: number; cost?: number; productionQty?: number }[];
  totalEstimatedCost: number;
  /** true=구매 데이터 기반 실제 원가, false=설정값 기반 추정 원가 */
  actualUnitCostUsed: boolean;
  /** 사용된 단위 원가 */
  unitCostUsed: number;
}

export interface ProductionEfficiencyInsight {
  daily: {
    date: string;
    normal: number;
    preprocess: number;
    frozen: number;
    sauce: number;
    bibimbap: number;
    total: number;
  }[];
  categoryStats: {
    category: string;
    total: number;
    avg: number;
    max: number;
    maxDate: string;
  }[];
  totalProduction: number;
  avgDaily: number;
  maxDay: { date: string; qty: number };
  dataRange: { from: string; to: string; days: number };
}

export interface CostRecommendation {
  id: string;
  type: 'material' | 'waste' | 'utility' | 'margin';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSaving: number;
  evidence: string;
}

// MaterialDetailItem, InventoryAdjustment, CostBreakdownInsight → costService.ts로 이동

export interface StatisticalOrderItem {
  productCode: string;
  productName: string;
  currentStock: number;
  avgDailyDemand: number;
  stdDevDemand: number;
  leadTime: number;
  safetyStock: number;
  rop: number;
  eoq: number;
  status: 'shortage' | 'urgent' | 'normal' | 'overstock';
  daysOfStock: number;
  suggestedOrderQty: number;
}

export interface StatisticalOrderInsight {
  items: StatisticalOrderItem[];
  serviceLevel: number;
  totalItems: number;
  urgentCount: number;
  shortageCount: number;
}

export type ABCClass = 'A' | 'B' | 'C';
export type XYZClass = 'X' | 'Y' | 'Z';

export interface ABCXYZItem {
  productCode: string;
  productName: string;
  totalSpent: number;       // 총 구매금액
  spentShare: number;       // 금액 비중 (%)
  cumulativeShare: number;  // 누적 비중 (%)
  abcClass: ABCClass;       // ABC 분류
  cv: number;               // 변동계수 (CoV)
  xyzClass: XYZClass;       // XYZ 분류
  combined: string;         // "AX", "BY" 등
}

export interface ABCXYZInsight {
  items: ABCXYZItem[];
  matrix: Record<string, number>;  // "AX"→건수, "BY"→건수 등 9칸
  summary: {
    A: number; B: number; C: number;
    X: number; Y: number; Z: number;
  };
}

export type FreshnessGrade = 'safe' | 'good' | 'caution' | 'warning' | 'danger';

export interface FreshnessItem {
  productCode: string;
  productName: string;
  score: number;           // 0~100
  grade: FreshnessGrade;
  daysSinceLastPurchase: number;
  avgDailyDemand: number;
  currentStock: number;
  estimatedDaysLeft: number; // 현재재고 / 일평균수요
}

export interface FreshnessInsight {
  items: FreshnessItem[];
  gradeCount: Record<FreshnessGrade, number>;
  avgScore: number;
}

// LimitPriceItem, LimitPriceInsight → costService.ts로 이동

export interface BomVarianceItem {
  productCode: string;
  productName: string;
  standardPrice: number;     // 기준단가 (BOM materialMaster unitPrice)
  actualPrice: number;       // 실제단가 (구매 평균단가)
  standardQty: number;       // 기준 투입량 (BOM consumptionQty 기반)
  actualQty: number;         // 실제 투입량 (구매량)
  priceVariance: number;     // 단가 차이 금액
  qtyVariance: number;       // 투입량 차이 금액
  totalVariance: number;     // 총 차이 금액
  unit: string;              // 단위 (kg, L, EA 등)
  linkedMenus: { code: string; name: string }[];  // 이 자재를 사용하는 메뉴 목록
  linkedMenuCount: number;   // 연결 메뉴 수
}

export interface BomVarianceInsight {
  items: BomVarianceItem[];
  totalPriceVariance: number;
  totalQtyVariance: number;
  totalVariance: number;
  favorableCount: number;    // 유리 (비용 절감) 품목
  unfavorableCount: number;  // 불리 (비용 초과) 품목
}

// CashFlowMonthly, ChannelCashCycle, CashFlowInsight → costService.ts로 이동

// ==============================
// P4-5 재고비용 최적화 타입
// ==============================

interface InventoryCostItem {
  productCode: string;
  productName: string;
  abcClass: string | null;
  avgStock: number;
  unitPrice: number;
  holdingCost: number;
  annualDemand: number;
  eoq: number;
  orderFrequency: number;
  orderingCost: number;
  stockoutRisk: number;
  estimatedStockoutCost: number;
  wasteCost: number;
  totalCost: number;
  eoqSaving: number;
  strategy: string;
}

export interface InventoryCostInsight {
  items: InventoryCostItem[];
  summary: {
    totalHoldingCost: number;
    totalOrderingCost: number;
    totalStockoutCost: number;
    totalWasteCost: number;
    grandTotal: number;
  };
  abcStrategies: {
    abcClass: string;
    itemCount: number;
    totalCost: number;
    strategy: string;
  }[];
  costComposition: { name: string; value: number }[];
}

// BOM 소진량 이상 감지 타입
export type BomAnomalyType = 'overuse' | 'underuse' | 'price_deviation';
export type BomAnomalySeverity = 'low' | 'medium' | 'high';

export interface BomConsumptionAnomalyItem {
  materialCode: string;
  materialName: string;
  productNames: string[];
  expectedConsumption: number;
  actualConsumption: number;
  deviationPct: number;
  bomUnitPrice: number;
  actualAvgPrice: number;
  priceDeviationPct: number;
  anomalyType: BomAnomalyType;
  severity: BomAnomalySeverity;
  costImpact: number;
  totalSpend: number;
  transactionCount: number;
}

export interface BomConsumptionAnomalyInsight {
  items: BomConsumptionAnomalyItem[];
  summary: {
    totalAnomalies: number;
    overuseCount: number;
    underuseCount: number;
    priceAnomalyCount: number;
    totalCostImpact: number;
    highSeverityCount: number;
  };
  topOveruse: BomConsumptionAnomalyItem[];
  topUnderuse: BomConsumptionAnomalyItem[];
  topPriceDeviation: BomConsumptionAnomalyItem[];
}

export interface DashboardInsights {
  channelRevenue: ChannelRevenueInsight | null;
  productProfit: ProductProfitInsight | null;
  revenueTrend: RevenueTrendInsight | null;
  materialPrices: MaterialPriceInsight | null;
  utilityCosts: UtilityCostInsight | null;
  wasteAnalysis: WasteAnalysisInsight | null;
  productionEfficiency: ProductionEfficiencyInsight | null;
  recommendations: CostRecommendation[];
  costBreakdown: CostBreakdownInsight | null;
  statisticalOrder: StatisticalOrderInsight | null;
  abcxyz: ABCXYZInsight | null;
  freshness: FreshnessInsight | null;
  limitPrice: LimitPriceInsight | null;
  bomVariance: BomVarianceInsight | null;
  productBEP: ProductBEPInsight | null;
  yieldTracking: YieldTrackingInsight | null;
  cashFlow: CashFlowInsight | null;
  inventoryCost: InventoryCostInsight | null;
  profitCenterScore: ProfitCenterScoreInsight | null;
  bomConsumptionAnomaly: BomConsumptionAnomalyInsight | null;
  dailyPerformance: DailyPerformanceInsight | null;
  materialPriceImpact: MaterialPriceImpactInsight | null;
  bomYieldAnalysis: BomYieldAnalysisItem[] | null;
  inventoryDiscrepancy: InventoryDiscrepancyItem[] | null;
  budgetExpense: BudgetExpenseInsight | null;
}

// DailyPerformanceInsight, MaterialPriceImpactInsight, BudgetExpenseInsight → costService.ts로 이동

export interface YieldDailyItem {
  date: string;
  productionQty: number;       // 생산 수량
  productionKg: number;        // 생산 kg
  wasteQty: number;            // 완성품 폐기 수량
  wasteKg: number;             // 반제품 폐기 kg
  yieldRate: number;           // 수율 (%, 수량 기준)
  yieldRateKg: number;         // 수율 (%, kg 기준)
  standardYield: number;       // 기준 수율
  yieldGap: number;            // 수율 차이 (실제 - 기준)
  unitCost: number;            // 단위당 원가
  adjustedUnitCost: number;    // 수율 반영 환산단가
}

export interface YieldTrackingInsight {
  daily: YieldDailyItem[];
  weekly: { weekLabel: string; avgYield: number; avgYieldKg: number; standardYield: number; totalQty: number; totalWaste: number; avgAdjustedCost: number }[];
  avgYieldRate: number;        // 평균 수율
  standardYield: number;       // 기준 수율
  yieldGap: number;            // 수율 차이
  avgUnitCost: number;         // 평균 단위원가
  avgAdjustedUnitCost: number; // 평균 환산단가
  costImpact: number;          // 수율 손실 금액
  lowYieldDays: number;        // 기준 미달 일수
  totalDays: number;           // 총 생산 일수
}

// ==============================
// 분석 함수
// ==============================

// computeChannelRevenue, computeProductProfit, computeRevenueTrend
// → profitService.ts로 이동 (barrel re-export는 파일 상단 참조)

// computeMaterialPrices, computeUtilityCosts → costService.ts로 이동 (barrel re-export는 파일 상단 참조)

export function computeWasteAnalysis(
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  purchases: PurchaseData[] = []
): WasteAnalysisInsight {
  // US-004: 실제 구매 데이터 기반 평균 단위 원가 산출
  // avgUnitCost = 총 구매금액 / 총 생산수량
  const totalPurchaseCost = purchases.reduce((s, p) => s + (p.total || 0), 0);
  const totalProductionQty = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  const purchaseBasedUnitCost = totalProductionQty > 0 ? Math.round(totalPurchaseCost / totalProductionQty) : 0;

  // 구매 데이터가 있고 유효한 원가가 나오면 실제 원가 사용, 아니면 설정값 폴백
  const actualUnitCostUsed = purchaseBasedUnitCost > 0;
  const unitCost = actualUnitCostUsed ? purchaseBasedUnitCost : config.wasteUnitCost;
  let totalEstimatedCost = 0;

  const daily = production.map(p => {
    const estimatedCost = p.wasteFinishedEa * unitCost;
    totalEstimatedCost += estimatedCost;
    return {
      date: p.date,
      wasteFinishedPct: p.wasteFinishedPct,
      wasteSemiPct: p.wasteSemiPct,
      wasteFinishedEa: p.wasteFinishedEa,
      wasteSemiKg: p.wasteSemiKg,
      productionQty: p.prodQtyTotal,
      productionKg: p.prodKgTotal || 0,
      estimatedCost,
    };
  });

  const validDays = daily.filter(d => d.productionQty > 0);
  const avgWasteRate = validDays.length > 0
    ? Math.round((validDays.reduce((s, d) => s + d.wasteFinishedPct, 0) / validDays.length) * 10) / 10
    : 0;

  const highWasteDays = daily
    .filter(d => d.wasteFinishedPct > config.wasteThresholdPct)
    .sort((a, b) => b.wasteFinishedPct - a.wasteFinishedPct)
    .map(d => ({ date: d.date, rate: d.wasteFinishedPct, qty: d.wasteFinishedEa, cost: d.estimatedCost, productionQty: d.productionQty }));

  return { daily, avgWasteRate, highWasteDays, totalEstimatedCost, actualUnitCostUsed, unitCostUsed: unitCost };
}

export function computeProductionEfficiency(production: ProductionData[]): ProductionEfficiencyInsight {
  const daily = production.map(p => ({
    date: p.date,
    normal: p.prodQtyNormal,
    preprocess: p.prodQtyPreprocess,
    frozen: p.prodQtyFrozen,
    sauce: p.prodQtySauce,
    bibimbap: p.prodQtyBibimbap,
    total: p.prodQtyTotal,
  }));

  // 카테고리별 통계
  const categories = [
    { key: 'normal' as const, label: '일반' },
    { key: 'preprocess' as const, label: '전처리' },
    { key: 'frozen' as const, label: '냉동' },
    { key: 'sauce' as const, label: '소스' },
    { key: 'bibimbap' as const, label: '비빔밥' },
  ];

  const categoryStats = categories.map(cat => {
    const values = daily.map(d => d[cat.key]);
    const total = values.reduce((s, v) => s + v, 0);
    const avg = values.length > 0 ? Math.round(total / values.length) : 0;
    const maxVal = Math.max(...values, 0);
    const maxIdx = values.indexOf(maxVal);
    return {
      category: cat.label,
      total,
      avg,
      max: maxVal,
      maxDate: maxIdx >= 0 && daily[maxIdx] ? daily[maxIdx].date : '',
    };
  });

  const totalProduction = daily.reduce((s, d) => s + d.total, 0);
  const avgDaily = daily.length > 0 ? Math.round(totalProduction / daily.length) : 0;
  const maxDayEntry = daily.reduce((max, d) => d.total > (max?.total || 0) ? d : max, daily[0]);

  const dates = daily.map(d => d.date).sort();

  return {
    daily,
    categoryStats,
    totalProduction,
    avgDaily,
    maxDay: maxDayEntry ? { date: maxDayEntry.date, qty: maxDayEntry.total } : { date: '', qty: 0 },
    dataRange: {
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
      days: dates.length,
    },
  };
}

// isSubMaterial, isCostExcluded, diagnoseSubMaterialClassification, computeCostBreakdown → costService.ts로 이동

// ==============================
// 통계적 발주 분석
// ==============================

export function computeStatisticalOrder(
  inventoryData: InventorySafetyItem[],
  purchases: PurchaseData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  serviceLevel?: number
): StatisticalOrderInsight {
  const sl = serviceLevel ?? config.defaultServiceLevel;
  const zScore = getZScore(sl);
  const leadTimeDefault = config.defaultLeadTime;
  const orderCost = config.orderCost;
  const holdingRate = config.holdingCostRate;

  // 품목별 일별 구매량 집계 (최근 데이터 기준)
  const dailyDemandMap = new Map<string, { name: string; dailyQtys: Map<string, number>; unitPrice: number }>();

  purchases.forEach(p => {
    if (!p.productCode || p.quantity === 0) return;
    const existing = dailyDemandMap.get(p.productCode) || {
      name: p.productName,
      dailyQtys: new Map<string, number>(),
      unitPrice: p.unitPrice,
    };
    const dayQty = existing.dailyQtys.get(p.date) || 0;
    existing.dailyQtys.set(p.date, dayQty + p.quantity);
    if (p.unitPrice > 0) existing.unitPrice = p.unitPrice;
    dailyDemandMap.set(p.productCode, existing);
  });

  // 재고 데이터에서 현재 재고 매핑
  const stockMap = new Map<string, { currentStock: number; skuName: string }>();
  inventoryData.forEach(item => {
    stockMap.set(item.skuName, { currentStock: item.currentStock, skuName: item.skuName });
  });

  const items: StatisticalOrderItem[] = [];

  dailyDemandMap.forEach((data, code) => {
    const dailyQtys = Array.from(data.dailyQtys.values());
    if (dailyQtys.length === 0) return;

    // 총 기간의 일수 계산
    const dates = Array.from(data.dailyQtys.keys()).sort();
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const totalDays = Math.max(Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);
    const totalQty = dailyQtys.reduce((s, q) => s + q, 0);

    // 일평균 수요
    const avgDailyDemand = totalQty / totalDays;

    // 일별 수요 표준편차 (구매가 없는 날은 0으로 계산)
    const allDayQtys: number[] = [];
    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      allDayQtys.push(data.dailyQtys.get(dateStr) || 0);
    }
    const mean = allDayQtys.reduce((s, q) => s + q, 0) / allDayQtys.length;
    const variance = allDayQtys.reduce((s, q) => s + (q - mean) ** 2, 0) / allDayQtys.length;
    const stdDevDemand = Math.sqrt(variance);

    // 통계적 발주 계산
    const leadTime = leadTimeDefault;
    const leadTimeStd = config.leadTimeStdDev;
    // 개선된 안전재고: SS = Z × √(L × σ_demand² + μ_demand² × σ_leadtime²)
    const safetyStock = Math.ceil(
      zScore * Math.sqrt(leadTime * stdDevDemand ** 2 + avgDailyDemand ** 2 * leadTimeStd ** 2)
    );
    const rop = Math.ceil(avgDailyDemand * leadTime + safetyStock);

    // EOQ = √(2DS/H) where D=연간수요, S=주문비용, H=단위당 연간 유지비용
    const annualDemand = avgDailyDemand * 365;
    const holdingCost = data.unitPrice * holdingRate;
    const eoq = holdingCost > 0 ? Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / holdingCost)) : 0;

    // 현재 재고 조회 (skuName 매핑)
    const stockInfo = stockMap.get(data.name);
    const currentStock = stockInfo?.currentStock || 0;

    // 재고일수
    const daysOfStock = avgDailyDemand > 0 ? Math.round((currentStock / avgDailyDemand) * 10) / 10 : 999;

    // 상태 판정
    let status: 'shortage' | 'urgent' | 'normal' | 'overstock';
    if (currentStock <= 0 || currentStock < safetyStock * 0.5) {
      status = 'shortage';
    } else if (currentStock < rop) {
      status = 'urgent';
    } else if (daysOfStock > 60) {
      status = 'overstock';
    } else {
      status = 'normal';
    }

    // 권장 발주량
    const suggestedOrderQty = currentStock < rop ? Math.max(eoq, rop - currentStock + safetyStock) : 0;

    items.push({
      productCode: code,
      productName: data.name,
      currentStock,
      avgDailyDemand: Math.round(avgDailyDemand * 10) / 10,
      stdDevDemand: Math.round(stdDevDemand * 10) / 10,
      leadTime,
      safetyStock,
      rop,
      eoq,
      status,
      daysOfStock,
      suggestedOrderQty,
    });
  });

  // 상태별 정렬 (shortage > urgent > normal > overstock)
  const statusOrder = { shortage: 0, urgent: 1, normal: 2, overstock: 3 };
  items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.daysOfStock - b.daysOfStock);

  return {
    items,
    serviceLevel: sl,
    totalItems: items.length,
    urgentCount: items.filter(i => i.status === 'urgent').length,
    shortageCount: items.filter(i => i.status === 'shortage').length,
  };
}

export function generateRecommendations(
  materialPrices: MaterialPriceInsight | null,
  wasteAnalysis: WasteAnalysisInsight | null,
  utilityCosts: UtilityCostInsight | null,
  productProfit: ProductProfitInsight | null,
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): CostRecommendation[] {
  const recs: CostRecommendation[] = [];
  let id = 1;

  // 1. 단가 10% 이상 상승 원재료
  if (materialPrices) {
    materialPrices.items
      .filter(m => m.changeRate >= 10)
      .forEach(m => {
        const saving = Math.round(Math.abs(m.priceChange) * (m.totalSpent / (m.avgPrice || 1)) * 0.1);
        recs.push({
          id: `rec-${id++}`,
          type: 'material',
          priority: m.changeRate >= 20 ? 'high' : 'medium',
          title: `${m.productName} 단가 ${m.changeRate.toFixed(1)}% 상승`,
          description: `대체 공급처 탐색 또는 대량 선구매를 검토하세요. 현재 단가 ₩${m.currentPrice.toLocaleString()}, 평균 대비 ₩${Math.abs(m.priceChange).toLocaleString()} 상승.`,
          estimatedSaving: saving,
          evidence: `기간 내 총 구매액 ₩${m.totalSpent.toLocaleString()}, 단가 변동률 ${m.changeRate.toFixed(1)}%`,
        });
      });
  }

  // 2. 폐기율 임계값 초과일
  if (wasteAnalysis && wasteAnalysis.highWasteDays.length > 0) {
    const wasteCostPerUnit = config.wasteUnitCost;
    const totalWasteCost = wasteAnalysis.highWasteDays.reduce((s, d) => s + d.qty * wasteCostPerUnit, 0);
    recs.push({
      id: `rec-${id++}`,
      type: 'waste',
      priority: wasteAnalysis.highWasteDays.length >= 5 ? 'high' : 'medium',
      title: `폐기율 ${config.wasteThresholdPct}% 초과일 ${wasteAnalysis.highWasteDays.length}일 발생`,
      description: `해당일 공정 점검이 필요합니다. 최고 폐기율 ${wasteAnalysis.highWasteDays[0].rate.toFixed(1)}% (${wasteAnalysis.highWasteDays[0].date}).`,
      estimatedSaving: totalWasteCost,
      evidence: `추정 폐기 비용 총 ₩${totalWasteCost.toLocaleString()} (개당 ₩${wasteCostPerUnit.toLocaleString()} 기준)`,
    });
  }

  // 3. 공과금/생산단위 증가 추세
  if (utilityCosts && utilityCosts.monthly.length >= 2) {
    const last = utilityCosts.monthly[utilityCosts.monthly.length - 1];
    const prev = utilityCosts.monthly[utilityCosts.monthly.length - 2];
    if (last.perUnit > prev.perUnit && prev.perUnit > 0) {
      const increase = Math.round(((last.perUnit - prev.perUnit) / prev.perUnit) * 100);
      recs.push({
        id: `rec-${id++}`,
        type: 'utility',
        priority: increase >= 20 ? 'high' : 'low',
        title: `단위당 에너지 비용 ${increase}% 증가`,
        description: `에너지 효율 개선을 검토하세요. 단위당 비용 ₩${prev.perUnit.toLocaleString()} → ₩${last.perUnit.toLocaleString()}.`,
        estimatedSaving: Math.round((last.perUnit - prev.perUnit) * (last.total / (last.perUnit || 1))),
        evidence: `${prev.month} 대비 ${last.month} 단위당 비용 상승`,
      });
    }
  }

  // 4. 매출↑ 마진↓ 품목
  if (productProfit) {
    productProfit.items
      .filter(p => p.revenue > 0 && p.marginRate < 20 && p.margin > 0)
      .slice(0, 3)
      .forEach(p => {
        recs.push({
          id: `rec-${id++}`,
          type: 'margin',
          priority: p.marginRate < 10 ? 'high' : 'medium',
          title: `${p.productName} 마진율 ${p.marginRate.toFixed(1)}%로 낮음`,
          description: `매출 대비 마진이 낮습니다. 가격 재협상 또는 원가 절감을 검토하세요.`,
          estimatedSaving: Math.round(p.revenue * config.overheadRatio), // 설정 비율 개선 가정
          evidence: `매출 ₩${p.revenue.toLocaleString()}, 비용 ₩${p.cost.toLocaleString()}, 마진 ₩${p.margin.toLocaleString()}`,
        });
      });
  }

  return recs.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || b.estimatedSaving - a.estimatedSaving;
  });
}

// ==============================
// ABC-XYZ 재고 분류
// ==============================

export function computeABCXYZ(
  purchases: PurchaseData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): ABCXYZInsight {
  if (purchases.length === 0) {
    return { items: [], matrix: {}, summary: { A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0 } };
  }

  // 품목별 월간 구매금액 집계
  const productMap = new Map<string, {
    name: string;
    totalSpent: number;
    monthlyAmounts: Map<string, number>;
  }>();

  purchases.forEach(p => {
    if (!p.productCode) return;
    const existing = productMap.get(p.productCode) || {
      name: p.productName,
      totalSpent: 0,
      monthlyAmounts: new Map(),
    };
    existing.totalSpent += p.total;
    const month = p.date.slice(0, 7);
    existing.monthlyAmounts.set(month, (existing.monthlyAmounts.get(month) || 0) + p.total);
    productMap.set(p.productCode, existing);
  });

  // 총 구매금액
  const grandTotal = Array.from(productMap.values()).reduce((s, v) => s + v.totalSpent, 0);

  // ABC 분류: 금액 내림차순 정렬 후 누적 비중
  const sorted = Array.from(productMap.entries())
    .map(([code, data]) => ({
      productCode: code,
      productName: data.name,
      totalSpent: data.totalSpent,
      spentShare: grandTotal > 0 ? (data.totalSpent / grandTotal) * 100 : 0,
      monthlyAmounts: data.monthlyAmounts,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  let cumulative = 0;
  const items: ABCXYZItem[] = sorted.map(item => {
    cumulative += item.spentShare;
    const cumulativeShare = Math.round(cumulative * 10) / 10;

    // ABC 분류
    let abcClass: ABCClass = 'C';
    if (cumulativeShare <= config.abcClassAThreshold) abcClass = 'A';
    else if (cumulativeShare <= config.abcClassBThreshold) abcClass = 'B';

    // XYZ 분류: 변동계수 (CV = 표준편차 / 평균)
    const amounts = Array.from(item.monthlyAmounts.values());
    let cv = 0;
    if (amounts.length > 1) {
      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      if (mean > 0) {
        const variance = amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / amounts.length;
        cv = Math.round((Math.sqrt(variance) / mean) * 100) / 100;
      }
    }

    let xyzClass: XYZClass = 'Z';
    if (cv <= config.xyzClassXThreshold) xyzClass = 'X';
    else if (cv <= config.xyzClassYThreshold) xyzClass = 'Y';

    return {
      productCode: item.productCode,
      productName: item.productName,
      totalSpent: item.totalSpent,
      spentShare: Math.round(item.spentShare * 10) / 10,
      cumulativeShare,
      abcClass,
      cv,
      xyzClass,
      combined: `${abcClass}${xyzClass}`,
    };
  });

  // 9칸 매트릭스 집계
  const matrix: Record<string, number> = {};
  const summary = { A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0 };
  for (const abc of ['A', 'B', 'C'] as ABCClass[]) {
    for (const xyz of ['X', 'Y', 'Z'] as XYZClass[]) {
      matrix[`${abc}${xyz}`] = 0;
    }
  }
  items.forEach(item => {
    matrix[item.combined]++;
    summary[item.abcClass]++;
    summary[item.xyzClass]++;
  });

  return { items, matrix, summary };
}

// ==============================
// P3-3 신선도 점수 시스템
// ==============================

const FRESHNESS_GRADES: { min: number; grade: FreshnessGrade }[] = [
  { min: 80, grade: 'safe' },
  { min: 60, grade: 'good' },
  { min: 40, grade: 'caution' },
  { min: 20, grade: 'warning' },
  { min: 0, grade: 'danger' },
];

function getFreshnessGrade(score: number): FreshnessGrade {
  for (const g of FRESHNESS_GRADES) {
    if (score >= g.min) return g.grade;
  }
  return 'danger';
}

export function computeFreshness(
  purchases: PurchaseData[],
  inventoryData: InventorySafetyItem[]
): FreshnessInsight {
  if (purchases.length === 0 || inventoryData.length === 0) {
    return { items: [], gradeCount: { safe: 0, good: 0, caution: 0, warning: 0, danger: 0 }, avgScore: 0 };
  }

  const today = new Date();
  // 품목별 구매 이력 집계
  const purchaseMap = new Map<string, { dates: Date[]; totalQty: number; name: string }>();
  purchases.forEach(p => {
    if (!p.productCode) return;
    const existing = purchaseMap.get(p.productCode) || { dates: [], totalQty: 0, name: p.productName };
    existing.dates.push(new Date(p.date));
    existing.totalQty += p.quantity;
    purchaseMap.set(p.productCode, existing);
  });

  // 조회 기간 (일)
  const allDates = purchases.map(p => new Date(p.date).getTime());
  const periodDays = Math.max(1, Math.round((Math.max(...allDates) - Math.min(...allDates)) / (1000 * 60 * 60 * 24)));

  // 재고 맵
  const stockMap = new Map<string, InventorySafetyItem>();
  inventoryData.forEach(inv => {
    const key = inv.id || inv.skuName;
    stockMap.set(key, inv);
  });

  const gradeCount: Record<FreshnessGrade, number> = { safe: 0, good: 0, caution: 0, warning: 0, danger: 0 };
  let totalScore = 0;

  const items: FreshnessItem[] = Array.from(purchaseMap.entries()).map(([code, data]) => {
    // 마지막 구매일
    const lastDate = new Date(Math.max(...data.dates.map(d => d.getTime())));
    const daysSinceLastPurchase = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    // 일평균 수요
    const avgDailyDemand = data.totalQty / periodDays;

    // 현재 재고 (재고 데이터 매칭)
    const inv = stockMap.get(code);
    const currentStock = inv?.currentStock || 0;

    // 예상 잔여일
    const estimatedDaysLeft = avgDailyDemand > 0 ? Math.round(currentStock / avgDailyDemand) : 999;

    // 점수 계산 (0~100)
    // 최근성 점수 (40%): 마지막 입고 후 경과일 → 0일=100, 30일이상=0
    const recencyScore = Math.max(0, 100 - Math.round(daysSinceLastPurchase * 100 / 30));
    // 회전 점수 (30%): 잔여일수 → 7일이하=100, 60일이상=0
    const coverageScore = estimatedDaysLeft >= 999 ? 0 : Math.max(0, 100 - Math.round(estimatedDaysLeft * 100 / 60));
    // 수요 안정성 (30%): 구매 횟수 → 10회이상=100
    const demandScore = Math.min(100, Math.round(data.dates.length * 10));

    const score = Math.round(recencyScore * 0.4 + coverageScore * 0.3 + demandScore * 0.3);
    const grade = getFreshnessGrade(score);
    gradeCount[grade]++;
    totalScore += score;

    return {
      productCode: code,
      productName: data.name,
      score, grade,
      daysSinceLastPurchase,
      avgDailyDemand: Math.round(avgDailyDemand * 10) / 10,
      currentStock,
      estimatedDaysLeft,
    };
  }).sort((a, b) => a.score - b.score); // 낮은 점수 우선

  return {
    items,
    gradeCount,
    avgScore: items.length > 0 ? Math.round(totalScore / items.length) : 0,
  };
}

// computeLimitPrice → costService.ts로 이동

// ==============================
// P3-4 레시피 대비 투입 오차 분석
// ==============================

export function computeBomVariance(
  purchases: PurchaseData[],
  production: ProductionData[],
  bomData: BomItemData[] = [],
  materialMaster: MaterialMasterItem[] = [],
  _inventorySnapshots: InventorySnapshotData[] = [],
  salesDetail: SalesDetailData[] = []
): BomVarianceInsight {
  const emptyResult: BomVarianceInsight = { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
  if (purchases.length === 0 || production.length === 0) return emptyResult;

  const totalProduction = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  if (totalProduction === 0) return emptyResult;

  // materialMaster → 이름/단위/단가 매핑
  const masterNameMap = new Map<string, string>();
  const masterUnitMap = new Map<string, string>();
  const masterPriceMap = new Map<string, number>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (!code) continue;
    if (mm.materialName) masterNameMap.set(code, mm.materialName);
    if (mm.unit) masterUnitMap.set(code, mm.unit);
    if (mm.unitPrice > 0) masterPriceMap.set(code, mm.unitPrice);
  }

  // BOM 연결 메뉴 목록 수집
  const bomLinkedMenus = new Map<string, { code: string; name: string }[]>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (!matCode || !bom.consumptionQty || !bom.productionQty) continue;
    const menus = bomLinkedMenus.get(matCode) || [];
    const menuCode = bom.productCode?.trim() || '';
    const menuName = bom.productName || menuCode;
    if (!menus.some(m => m.code === menuCode)) {
      menus.push({ code: menuCode, name: menuName });
    }
    bomLinkedMenus.set(matCode, menus);
  }

  // ── 판매 기반 예상 소비량 산출 (US-003: 균등 분배 → 판매 비례) ──
  // salesDetail이 있으면 제품별 판매량을 기반으로 자재 소비량을 산출
  // salesDetail이 없으면 기존 생산량 비례 폴백
  const salesByProduct = new Map<string, number>();
  if (salesDetail.length > 0) {
    for (const s of salesDetail) {
      const code = s.productCode?.trim();
      if (!code) continue;
      salesByProduct.set(code, (salesByProduct.get(code) || 0) + (s.quantity || 0));
    }
  }

  const bomStandardQty = new Map<string, number>();
  const hasSalesData = salesByProduct.size > 0;

  if (hasSalesData) {
    // 판매 기반: expectedQty = salesQty × (consumptionQty / productionQty)
    for (const bom of bomData) {
      const matCode = bom.materialCode?.trim();
      const prodCode = bom.productCode?.trim();
      if (!matCode || !prodCode || !bom.consumptionQty || !bom.productionQty) continue;

      const salesQty = salesByProduct.get(prodCode) || 0;
      if (salesQty <= 0) continue;

      const stdQty = (bom.consumptionQty / bom.productionQty) * salesQty;
      bomStandardQty.set(matCode, (bomStandardQty.get(matCode) || 0) + stdQty);
    }
  } else {
    // 폴백: 총 생산량을 BOM 제품수로 균등 분배 (레거시)
    const uniqueBomProducts = new Set(bomData.map(b => b.productCode?.trim()).filter(Boolean));
    const numBomProducts = uniqueBomProducts.size || 1;
    const perProductProduction = totalProduction / numBomProducts;

    for (const bom of bomData) {
      const matCode = bom.materialCode?.trim();
      if (!matCode || !bom.consumptionQty || !bom.productionQty) continue;
      const stdQty = bom.consumptionQty * (perProductProduction / bom.productionQty);
      bomStandardQty.set(matCode, (bomStandardQty.get(matCode) || 0) + stdQty);
    }
  }

  // BOM 데이터가 있는 경우: BOM 기준 로직
  if (bomStandardQty.size > 0) {
    // 실제 소모량 = 구매량 by materialCode
    const purchaseAgg = new Map<string, { qty: number; total: number; name: string }>();
    for (const p of purchases) {
      const code = p.productCode?.trim();
      if (!code || p.quantity === 0) continue;
      const existing = purchaseAgg.get(code) || { qty: 0, total: 0, name: p.productName };
      existing.qty += p.quantity;
      existing.total += p.total;
      purchaseAgg.set(code, existing);
    }

    let totalPriceVar = 0;
    let totalQtyVar = 0;
    const items: BomVarianceItem[] = [];

    for (const [code, stdQty] of bomStandardQty) {
      const purchase = purchaseAgg.get(code);
      const actualQty = purchase ? purchase.qty : 0;
      if (actualQty === 0 && stdQty === 0) continue;

      const standardQty = Math.round(stdQty);
      const standardPrice = masterPriceMap.get(code) || 0;
      const actualPrice = purchase && purchase.qty > 0 ? Math.round(purchase.total / purchase.qty) : standardPrice;
      const name = masterNameMap.get(code) || purchase?.name || code;
      const linkedMenus = bomLinkedMenus.get(code) || [];

      // 가격차이 = (실제단가 - 기준단가) × 실제수량
      const priceVariance = (actualPrice - standardPrice) * actualQty;
      // 수량차이 = (실제수량 - 기준수량) × 기준단가
      const qtyVariance = (actualQty - standardQty) * standardPrice;
      const totalVariance = priceVariance + qtyVariance;

      totalPriceVar += priceVariance;
      totalQtyVar += qtyVariance;

      items.push({
        productCode: code,
        productName: name,
        standardPrice, actualPrice,
        standardQty, actualQty,
        priceVariance, qtyVariance, totalVariance,
        unit: masterUnitMap.get(code) || '개',
        linkedMenus,
        linkedMenuCount: linkedMenus.length,
      });
    }

    items.sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));

    return {
      items,
      totalPriceVariance: totalPriceVar,
      totalQtyVariance: totalQtyVar,
      totalVariance: totalPriceVar + totalQtyVar,
      favorableCount: items.filter(i => i.totalVariance < 0).length,
      unfavorableCount: items.filter(i => i.totalVariance > 0).length,
    };
  }

  // Fallback: BOM 데이터 없을 때 — 전반기/후반기 비교 (레거시)
  const sortedPurchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));
  const midIdx = Math.floor(sortedPurchases.length / 2);
  const basePeriod = sortedPurchases.slice(0, midIdx);
  const recentPeriod = sortedPurchases.slice(midIdx);

  const sortedProd = [...production].sort((a, b) => a.date.localeCompare(b.date));
  const prodMidIdx = Math.floor(sortedProd.length / 2);
  const baseProd = sortedProd.slice(0, prodMidIdx);
  const recentProd = sortedProd.slice(prodMidIdx);

  const baseProdTotal = baseProd.reduce((s, p) => s + p.prodQtyTotal, 0) || 1;
  const recentProdTotal = recentProd.reduce((s, p) => s + p.prodQtyTotal, 0) || 1;

  type PeriodAgg = { qty: number; total: number; name: string };
  const aggregate = (data: PurchaseData[]) => {
    const map = new Map<string, PeriodAgg>();
    data.forEach(p => {
      if (!p.productCode || p.quantity === 0) return;
      const existing = map.get(p.productCode) || { qty: 0, total: 0, name: p.productName };
      existing.qty += p.quantity;
      existing.total += p.total;
      map.set(p.productCode, existing);
    });
    return map;
  };

  const baseAgg = aggregate(basePeriod);
  const recentAgg = aggregate(recentPeriod);
  const allCodes = new Set([...baseAgg.keys(), ...recentAgg.keys()]);
  let totalPriceVar = 0;
  let totalQtyVar = 0;
  const items: BomVarianceItem[] = [];

  allCodes.forEach(code => {
    const base = baseAgg.get(code);
    const recent = recentAgg.get(code);
    if (!base || !recent || base.qty === 0 || recent.qty === 0) return;

    const standardPrice = Math.round(base.total / base.qty);
    const actualPrice = Math.round(recent.total / recent.qty);
    const standardRatio = base.qty / baseProdTotal;
    const standardQty = Math.round(standardRatio * recentProdTotal);
    const actualQty = recent.qty;

    const priceVariance = (actualPrice - standardPrice) * actualQty;
    const qtyVariance = (actualQty - standardQty) * standardPrice;
    const totalVariance = priceVariance + qtyVariance;

    totalPriceVar += priceVariance;
    totalQtyVar += qtyVariance;

    const name = masterNameMap.get(code) || base.name || recent.name;
    items.push({
      productCode: code,
      productName: name,
      standardPrice, actualPrice,
      standardQty, actualQty,
      priceVariance, qtyVariance, totalVariance,
      unit: masterUnitMap.get(code) || '개',
      linkedMenus: [],
      linkedMenuCount: 0,
    });
  });

  items.sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));

  return {
    items,
    totalPriceVariance: totalPriceVar,
    totalQtyVariance: totalQtyVar,
    totalVariance: totalPriceVar + totalQtyVar,
    favorableCount: items.filter(i => i.totalVariance < 0).length,
    unfavorableCount: items.filter(i => i.totalVariance > 0).length,
  };
}

// computeProductBEP → profitService.ts로 이동

// ==============================
// P4-3 수율 추적 대시보드
// ==============================

export function computeYieldTracking(
  production: ProductionData[],
  purchases: PurchaseData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): YieldTrackingInsight {
  if (production.length === 0) {
    return {
      daily: [], weekly: [],
      avgYieldRate: 0, standardYield: 0, yieldGap: 0,
      avgUnitCost: 0, avgAdjustedUnitCost: 0, costImpact: 0,
      lowYieldDays: 0, totalDays: 0,
    };
  }

  const standardYield = 100 - (config.wasteThresholdPct || 3);

  // 총 구매금액 (원가 추정용)
  const totalPurchaseCost = purchases.reduce((s, p) => s + p.total, 0);
  const totalProductionQty = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  const avgUnitCost = totalProductionQty > 0 ? Math.round(totalPurchaseCost / totalProductionQty) : 0;

  // 일별 수율
  const sorted = [...production].sort((a, b) => a.date.localeCompare(b.date));
  let lowYieldDays = 0;
  let yieldSum = 0;
  let yieldKgSum = 0;
  let adjustedCostSum = 0;
  let validDays = 0;
  let totalWasteQty = 0;

  const daily: YieldDailyItem[] = sorted
    .filter(p => p.prodQtyTotal > 0)
    .map(p => {
      const yieldRate = 100 - p.wasteFinishedPct;
      const yieldRateKg = p.prodKgTotal > 0 && p.wasteSemiKg >= 0
        ? Math.round((1 - p.wasteSemiPct / 100) * 1000) / 10
        : yieldRate;

      const yieldGap = Math.round((yieldRate - standardYield) * 10) / 10;
      if (yieldRate < standardYield) lowYieldDays++;

      // 환산단가 = 단위원가 / (수율/100)
      const adjustedUnitCost = yieldRate > 0 ? Math.round(avgUnitCost / (yieldRate / 100)) : 0;

      yieldSum += yieldRate;
      yieldKgSum += yieldRateKg;
      adjustedCostSum += adjustedUnitCost;
      validDays++;
      totalWasteQty += p.wasteFinishedEa;

      return {
        date: p.date,
        productionQty: p.prodQtyTotal,
        productionKg: p.prodKgTotal,
        wasteQty: p.wasteFinishedEa,
        wasteKg: p.wasteSemiKg,
        yieldRate: Math.round(yieldRate * 10) / 10,
        yieldRateKg: Math.round(yieldRateKg * 10) / 10,
        standardYield,
        yieldGap,
        unitCost: avgUnitCost,
        adjustedUnitCost,
      };
    });

  // 주간 집계
  const weekMap = new Map<string, { yields: number[]; yieldsKg: number[]; totalQty: number; totalWaste: number; adjustedCosts: number[] }>();
  daily.forEach(d => {
    const date = new Date(d.date);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
    const weekLabel = `${(monday.getMonth() + 1).toString().padStart(2, '0')}/${monday.getDate().toString().padStart(2, '0')}`;

    const existing = weekMap.get(weekLabel) || { yields: [], yieldsKg: [], totalQty: 0, totalWaste: 0, adjustedCosts: [] };
    existing.yields.push(d.yieldRate);
    existing.yieldsKg.push(d.yieldRateKg);
    existing.totalQty += d.productionQty;
    existing.totalWaste += d.wasteQty;
    existing.adjustedCosts.push(d.adjustedUnitCost);
    weekMap.set(weekLabel, existing);
  });

  const weekly = Array.from(weekMap.entries()).map(([weekLabel, data]) => ({
    weekLabel,
    avgYield: Math.round(data.yields.reduce((s, v) => s + v, 0) / data.yields.length * 10) / 10,
    avgYieldKg: Math.round(data.yieldsKg.reduce((s, v) => s + v, 0) / data.yieldsKg.length * 10) / 10,
    standardYield,
    totalQty: data.totalQty,
    totalWaste: data.totalWaste,
    avgAdjustedCost: Math.round(data.adjustedCosts.reduce((s, v) => s + v, 0) / data.adjustedCosts.length),
  }));

  const avgYieldRate = validDays > 0 ? Math.round(yieldSum / validDays * 10) / 10 : 0;
  const avgAdjustedUnitCost = validDays > 0 ? Math.round(adjustedCostSum / validDays) : 0;

  // 수율 손실 비용 = 폐기수량 × 단위원가
  const costImpact = totalWasteQty * avgUnitCost;

  return {
    daily,
    weekly,
    avgYieldRate,
    standardYield,
    yieldGap: Math.round((avgYieldRate - standardYield) * 10) / 10,
    avgUnitCost,
    avgAdjustedUnitCost,
    costImpact,
    lowYieldDays,
    totalDays: validDays,
  };
}

// computeCashFlow → costService.ts로 이동

// ==============================
// P4-5 재고비용 최적화
// ==============================

function computeInventoryCost(
  purchases: PurchaseData[],
  inventoryData: InventorySafetyItem[],
  statisticalOrder: StatisticalOrderInsight | null,
  abcxyz: ABCXYZInsight | null,
  wasteAnalysis: WasteAnalysisInsight | null,
  config: BusinessConfig
): InventoryCostInsight {
  const holdingRate = config.holdingCostRate;
  const orderCostPerOrder = config.orderCost;
  const stockoutMul = config.stockoutCostMultiplier;
  const leadTime = config.defaultLeadTime;

  // statisticalOrder 맵 생성
  const soMap = new Map<string, StatisticalOrderItem>();
  if (statisticalOrder) {
    statisticalOrder.items.forEach(item => soMap.set(item.productCode, item));
  }

  // ABC 분류 맵
  const abcMap = new Map<string, string>();
  if (abcxyz) {
    abcxyz.items.forEach(item => abcMap.set(item.productCode, item.abcClass));
  }

  // 품목별 구매 집계
  const purchaseAgg = new Map<string, { name: string; totalQty: number; totalSpent: number; days: Set<string> }>();
  purchases.forEach(p => {
    if (!p.productCode || p.quantity === 0) return;
    const existing = purchaseAgg.get(p.productCode) || { name: p.productName, totalQty: 0, totalSpent: 0, days: new Set<string>() };
    existing.totalQty += p.quantity;
    existing.totalSpent += p.total;
    existing.days.add(p.date);
    purchaseAgg.set(p.productCode, existing);
  });

  // 총 기간
  const allDates = purchases.map(p => p.date).sort();
  const periodDays = allDates.length > 1
    ? Math.max(1, Math.ceil((new Date(allDates[allDates.length - 1]).getTime() - new Date(allDates[0]).getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  // 재고 맵
  const stockMap = new Map<string, number>();
  inventoryData.forEach(inv => {
    stockMap.set(inv.skuName, inv.currentStock);
  });

  // 폐기비용 총액
  const totalWasteCost = wasteAnalysis?.totalEstimatedCost || 0;
  // 총 매출원가 (배분 기준)
  const totalSpent = Array.from(purchaseAgg.values()).reduce((s, v) => s + v.totalSpent, 0);

  let sumHolding = 0;
  let sumOrdering = 0;
  let sumStockout = 0;
  let sumWaste = 0;

  const items: InventoryCostItem[] = Array.from(purchaseAgg.entries()).map(([code, data]) => {
    const unitPrice = data.totalQty > 0 ? Math.round(data.totalSpent / data.totalQty) : 0;
    const avgDailyDemand = data.totalQty / periodDays;
    const annualDemand = Math.round(avgDailyDemand * 365);

    // 평균 재고: statisticalOrder의 현재재고 또는 재고 맵
    const soItem = soMap.get(code);
    const currentStock = soItem?.currentStock ?? (stockMap.get(data.name) || 0);
    const avgStock = Math.max(currentStock, Math.round(avgDailyDemand * 15)); // 최소 15일치

    // 보유비용 = 평균재고 * 단가 * 보유비율 (연간)
    const holdingCost = Math.round(avgStock * unitPrice * holdingRate);

    // EOQ
    const holdingCostPerUnit = unitPrice * holdingRate;
    const eoq = holdingCostPerUnit > 0
      ? Math.ceil(Math.sqrt((2 * annualDemand * orderCostPerOrder) / holdingCostPerUnit))
      : annualDemand;

    // 현재 발주 횟수 추정: 실제 발주일 수
    const actualOrderCount = data.days.size;
    const annualizedOrderCount = Math.round(actualOrderCount * (365 / periodDays));
    const orderFrequency = annualizedOrderCount || 1;

    // 발주비용 = 연간 발주횟수 * 건당 발주비
    const orderingCost = Math.round(orderFrequency * orderCostPerOrder);

    // 품절 위험도
    let stockoutRisk = 0;
    if (soItem) {
      if (soItem.status === 'shortage') stockoutRisk = 0.8;
      else if (soItem.status === 'urgent') stockoutRisk = 0.4;
      else if (soItem.status === 'normal') stockoutRisk = 0.05;
      else stockoutRisk = 0.01;
    }

    // 품절비용 = stockoutRisk * 일평균수요 * 단가 * 리드타임 * 배율
    const estimatedStockoutCost = Math.round(stockoutRisk * avgDailyDemand * unitPrice * leadTime * stockoutMul);

    // 폐기비용: 전체 폐기비용을 매출비중으로 배분
    const spendShare = totalSpent > 0 ? data.totalSpent / totalSpent : 0;
    const wasteCost = Math.round(totalWasteCost * spendShare);

    const totalCost = holdingCost + orderingCost + estimatedStockoutCost + wasteCost;

    // EOQ 적용 시 절감: EOQ 기반 발주비용 + 보유비용 vs 현재
    const eoqOrderFreq = annualDemand > 0 && eoq > 0 ? Math.round(annualDemand / eoq) : 1;
    const eoqOrderingCost = eoqOrderFreq * orderCostPerOrder;
    const eoqAvgStock = Math.round(eoq / 2);
    const eoqHoldingCost = Math.round(eoqAvgStock * unitPrice * holdingRate);
    const eoqTotalCost = eoqHoldingCost + eoqOrderingCost + estimatedStockoutCost + wasteCost;
    const eoqSaving = Math.max(0, totalCost - eoqTotalCost);

    // ABC 전략
    const abcClass = abcMap.get(code) || null;
    let strategy = '일반 관리';
    if (abcClass === 'A') strategy = '실시간 모니터링 + JIT';
    else if (abcClass === 'B') strategy = '정기 EOQ 발주';
    else if (abcClass === 'C') strategy = '대량 발주로 비용 최소화';

    sumHolding += holdingCost;
    sumOrdering += orderingCost;
    sumStockout += estimatedStockoutCost;
    sumWaste += wasteCost;

    return {
      productCode: code,
      productName: data.name,
      abcClass,
      avgStock,
      unitPrice,
      holdingCost,
      annualDemand,
      eoq,
      orderFrequency,
      orderingCost,
      stockoutRisk,
      estimatedStockoutCost,
      wasteCost,
      totalCost,
      eoqSaving,
      strategy,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  const grandTotal = sumHolding + sumOrdering + sumStockout + sumWaste;

  // ABC 전략 요약
  const abcGroups = new Map<string, { count: number; cost: number }>();
  items.forEach(item => {
    const cls = item.abcClass || 'N/A';
    const existing = abcGroups.get(cls) || { count: 0, cost: 0 };
    existing.count++;
    existing.cost += item.totalCost;
    abcGroups.set(cls, existing);
  });

  const strategyMap: Record<string, string> = {
    'A': '실시간 모니터링 + JIT',
    'B': '정기 EOQ 발주',
    'C': '대량 발주로 비용 최소화',
    'N/A': '분류 미완료',
  };

  const abcStrategies = Array.from(abcGroups.entries())
    .sort((a, b) => {
      const order: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'N/A': 3 };
      return (order[a[0]] ?? 9) - (order[b[0]] ?? 9);
    })
    .map(([cls, data]) => ({
      abcClass: cls,
      itemCount: data.count,
      totalCost: data.cost,
      strategy: strategyMap[cls] || '일반 관리',
    }));

  const costComposition = [
    { name: '보유비용', value: sumHolding },
    { name: '발주비용', value: sumOrdering },
    { name: '품절비용', value: sumStockout },
    { name: '폐기비용', value: sumWaste },
  ];

  return {
    items,
    summary: {
      totalHoldingCost: sumHolding,
      totalOrderingCost: sumOrdering,
      totalStockoutCost: sumStockout,
      totalWasteCost: sumWaste,
      grandTotal,
    },
    abcStrategies,
    costComposition,
  };
}

// ==============================
// BOM 기준 자재 소진량 이상 감지
// ==============================

function computeBomConsumptionAnomaly(
  purchases: PurchaseData[],
  production: ProductionData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[],
  inventorySnapshots: InventorySnapshotData[],
  config: BusinessConfig
): BomConsumptionAnomalyInsight | null {
  if (bomData.length === 0 || purchases.length === 0 || production.length === 0) return null;

  // BOM 자재코드 집합 + 관련 제품명 + 자재명
  const bomMaterialCodes = new Set<string>();
  const bomProductNames = new Map<string, Set<string>>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (!matCode) continue;
    bomMaterialCodes.add(matCode);
    const names = bomProductNames.get(matCode) || new Set<string>();
    const prodName = bom.productName || bom.productCode || '';
    if (prodName) names.add(prodName);
    bomProductNames.set(matCode, names);
  }

  // materialMaster → 자재별 기준 단가 + 이름
  const masterPriceMap = new Map<string, number>();
  const masterNameMap = new Map<string, string>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (!code) continue;
    if (mm.unitPrice > 0) masterPriceMap.set(code, mm.unitPrice);
    if (mm.materialName) masterNameMap.set(code, mm.materialName);
  }

  // 재고 스냅샷 → 자재코드별 현재 재고 잔량
  const inventoryBalance = new Map<string, number>();
  for (const inv of inventorySnapshots) {
    const code = inv.productCode?.trim();
    if (!code) continue;
    inventoryBalance.set(code, (inventoryBalance.get(code) || 0) + inv.balanceQty);
  }

  // BOM 자재만 필터하여 구매 데이터 추출
  const bomPurchases = purchases.filter(p => bomMaterialCodes.has(p.productCode?.trim()));
  if (bomPurchases.length === 0) return null;

  // 기간 분할: 전반기(기준) vs 후반기(최근)
  const sortedPurchases = [...bomPurchases].sort((a, b) => a.date.localeCompare(b.date));
  const midIdx = Math.floor(sortedPurchases.length / 2);
  const basePeriod = sortedPurchases.slice(0, midIdx);
  const recentPeriod = sortedPurchases.slice(midIdx);

  const sortedProd = [...production].sort((a, b) => a.date.localeCompare(b.date));
  const prodMidIdx = Math.floor(sortedProd.length / 2);
  const baseProdTotal = sortedProd.slice(0, prodMidIdx).reduce((s, p) => s + p.prodQtyTotal, 0) || 1;
  const recentProdTotal = sortedProd.slice(prodMidIdx).reduce((s, p) => s + p.prodQtyTotal, 0) || 1;

  // 기간별 자재 집계
  type PeriodAgg = { qty: number; amount: number; count: number; name: string };
  const aggregate = (data: PurchaseData[]) => {
    const map = new Map<string, PeriodAgg>();
    for (const p of data) {
      const code = p.productCode?.trim();
      if (!code) continue;
      const agg = map.get(code) || { qty: 0, amount: 0, count: 0, name: p.productName || code };
      agg.qty += p.quantity || 0;
      agg.amount += p.total || 0;
      agg.count += 1;
      map.set(code, agg);
    }
    return map;
  };

  const baseAgg = aggregate(basePeriod);
  const recentAgg = aggregate(recentPeriod);

  // 이상 감지: 생산량 정규화 비율 비교 (전반기 vs 후반기)
  const items: BomConsumptionAnomalyItem[] = [];
  const overuseThresh = config.bomOveruseThreshold;
  const underuseThresh = config.bomUnderuseThreshold;
  const priceThresh = config.bomPriceDeviationThreshold;
  const minSpend = config.bomMinimumSpend;
  const medSev = config.bomMediumSeverity;
  const highSev = config.bomHighSeverity;

  // BOM 자재 중 구매 이력이 있는 것만 분석
  const allMatCodes = new Set([...baseAgg.keys(), ...recentAgg.keys()]);

  for (const matCode of allMatCodes) {
    const base = baseAgg.get(matCode);
    const recent = recentAgg.get(matCode);
    if (!base || !recent) continue;

    const totalSpend = base.amount + recent.amount;
    if (totalSpend < minSpend) continue;

    // 생산량 정규화: 자재 사용률 = 구매량 / 생산량
    const baseRate = base.qty / baseProdTotal;
    const recentRate = recent.qty / recentProdTotal;

    // 기대 소모량 = 전반기 비율 × 후반기 생산량 (전반기 패턴이 정상이라 가정)
    const expectedQty = Math.round(baseRate * recentProdTotal);
    const actualQty = recent.qty;

    if (expectedQty === 0) continue;

    const deviationPct = ((actualQty - expectedQty) / expectedQty) * 100;

    // 가격 비교: 전반기 평균단가 vs 후반기 평균단가
    const baseAvgPrice = base.qty > 0 ? base.amount / base.qty : 0;
    const recentAvgPrice = recent.qty > 0 ? recent.amount / recent.qty : 0;
    const bomUnitPrice = masterPriceMap.get(matCode) || baseAvgPrice;
    const priceDeviationPct = baseAvgPrice > 0 ? ((recentAvgPrice - baseAvgPrice) / baseAvgPrice) * 100 : 0;

    // 이상 유형 판별
    let anomalyType: BomAnomalyType | null = null;
    if (deviationPct > overuseThresh) {
      anomalyType = 'overuse';
    } else if (deviationPct < underuseThresh) {
      anomalyType = 'underuse';
    } else if (Math.abs(priceDeviationPct) > priceThresh) {
      anomalyType = 'price_deviation';
    }

    if (!anomalyType) continue;

    // 심각도
    const absDeviation = Math.abs(anomalyType === 'price_deviation' ? priceDeviationPct : deviationPct);
    const severity: BomAnomalySeverity = absDeviation >= highSev ? 'high' : absDeviation >= medSev ? 'medium' : 'low';

    // 비용 영향
    const costImpact = anomalyType === 'price_deviation'
      ? Math.round((recentAvgPrice - baseAvgPrice) * actualQty)
      : Math.round((actualQty - expectedQty) * (bomUnitPrice || recentAvgPrice));

    // 자재명: materialMaster 우선 → 구매 데이터 이름
    const materialName = masterNameMap.get(matCode) || recent.name || base.name || matCode;
    const productNames = bomProductNames.get(matCode);

    items.push({
      materialCode: matCode,
      materialName,
      productNames: productNames ? [...productNames] : [],
      expectedConsumption: expectedQty,
      actualConsumption: actualQty,
      deviationPct: Math.round(deviationPct * 10) / 10,
      bomUnitPrice: Math.round(bomUnitPrice),
      actualAvgPrice: Math.round(recentAvgPrice),
      priceDeviationPct: Math.round(priceDeviationPct * 10) / 10,
      anomalyType,
      severity,
      costImpact,
      totalSpend: Math.round(totalSpend),
      transactionCount: (base.count || 0) + (recent.count || 0),
    });
  }

  // 정렬: 심각도 > 비용 영향 순
  const severityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || Math.abs(b.costImpact) - Math.abs(a.costImpact));

  const overuseItems = items.filter(i => i.anomalyType === 'overuse');
  const underuseItems = items.filter(i => i.anomalyType === 'underuse');
  const priceItems = items.filter(i => i.anomalyType === 'price_deviation');

  return {
    items,
    summary: {
      totalAnomalies: items.length,
      overuseCount: overuseItems.length,
      underuseCount: underuseItems.length,
      priceAnomalyCount: priceItems.length,
      totalCostImpact: items.reduce((s, i) => s + i.costImpact, 0),
      highSeverityCount: items.filter(i => i.severity === 'high').length,
    },
    topOveruse: overuseItems.slice(0, 5),
    topUnderuse: underuseItems.slice(0, 5),
    topPriceDeviation: priceItems.slice(0, 5),
  };
}

// ==============================
// 통합 인사이트 계산
// ==============================

export function computeAllInsights(
  dailySales: DailySalesData[],
  salesDetail: SalesDetailData[],
  production: ProductionData[],
  purchases: PurchaseData[],
  utilities: UtilityData[],
  inventoryData?: InventorySafetyItem[],
  channelCosts: ChannelCostSummary[] = [],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  bomData: BomItemData[] = [],
  materialMaster: MaterialMasterItem[] = [],
  labor: LaborDailyData[] = [],
  inventorySnapshots: InventorySnapshotData[] = [],
  inventoryAdjustment?: InventoryAdjustment | null
): DashboardInsights {
  const channelRevenue = dailySales.length > 0 ? computeChannelRevenue(dailySales, purchases, channelCosts, config, salesDetail) : null;
  const productProfit = salesDetail.length > 0 ? computeProductProfit(salesDetail, purchases) : null;
  const revenueTrend = dailySales.length > 0 ? computeRevenueTrend(dailySales, purchases, channelCosts, config) : null;
  const materialPrices = purchases.length > 0 ? computeMaterialPrices(purchases) : null;
  const utilityCosts = utilities.length > 0 ? computeUtilityCosts(utilities, production) : null;
  const wasteAnalysis = production.length > 0 ? computeWasteAnalysis(production, config, purchases) : null;
  const productionEfficiency = production.length > 0 ? computeProductionEfficiency(production) : null;

  const costBreakdown = purchases.length > 0
    ? computeCostBreakdown(purchases, utilities, production, config, labor, inventoryAdjustment)
    : null;

  const statisticalOrder = (inventoryData && inventoryData.length > 0 && purchases.length > 0)
    ? computeStatisticalOrder(inventoryData, purchases, config)
    : null;

  const abcxyz = purchases.length > 0 ? computeABCXYZ(purchases, config) : null;

  const freshness = (purchases.length > 0 && inventoryData && inventoryData.length > 0)
    ? computeFreshness(purchases, inventoryData)
    : null;

  const limitPrice = purchases.length > 0 ? computeLimitPrice(purchases) : null;

  const bomVariance = (purchases.length > 0 && production.length > 0)
    ? computeBomVariance(purchases, production, bomData, materialMaster, inventorySnapshots, salesDetail)
    : null;

  const productBEP = productProfit
    ? computeProductBEP(productProfit, channelRevenue, config)
    : null;

  const yieldTracking = production.length > 0
    ? computeYieldTracking(production, purchases, config)
    : null;

  const cashFlow = (dailySales.length > 0 && purchases.length > 0)
    ? computeCashFlow(dailySales, purchases, utilities, inventoryData || [], channelRevenue, costBreakdown, config)
    : null;

  const inventoryCost = (purchases.length > 0 && inventoryData && inventoryData.length > 0)
    ? computeInventoryCost(purchases, inventoryData, statisticalOrder, abcxyz, wasteAnalysis, config)
    : null;

  const recommendations = generateRecommendations(
    materialPrices,
    wasteAnalysis,
    utilityCosts,
    productProfit,
    config
  );

  // 독립채산제 점수: 매출과 구매의 공통 기간만 사용 (기간 불일치 방지)
  let profitCenterScore: ProfitCenterScoreInsight | null = null;
  if (channelRevenue && costBreakdown && purchases.length > 0 && dailySales.length > 0) {
    const pDates = purchases.map(p => p.date).sort();
    const sDates = dailySales.map(d => d.date).sort();
    const pStart = pDates[0];
    const pEnd = pDates[pDates.length - 1];
    // 매출 기간이 구매 기간보다 넓으면 구매 기간에 맞춤
    if (sDates[0] < pStart || sDates[sDates.length - 1] > pEnd) {
      const alignedSales = dailySales.filter(d => d.date >= pStart && d.date <= pEnd);
      if (alignedSales.length > 0) {
        const alignedCR = computeChannelRevenue(alignedSales, purchases, channelCosts, config, salesDetail);
        const alignedProd = production.filter(p => p.date >= pStart && p.date <= pEnd);
        const alignedWA = alignedProd.length > 0 ? computeWasteAnalysis(alignedProd, config, purchases) : wasteAnalysis;
        profitCenterScore = computeProfitCenterScore(alignedCR, costBreakdown, alignedWA, alignedProd, config);
      }
    } else {
      profitCenterScore = computeProfitCenterScore(channelRevenue, costBreakdown, wasteAnalysis, production, config);
    }
  }

  const bomConsumptionAnomaly = (bomData.length > 0 && purchases.length > 0)
    ? computeBomConsumptionAnomaly(purchases, production, bomData, materialMaster, inventorySnapshots, config)
    : null;

  const dailyPerformance = (labor.length > 0 && dailySales.length > 0)
    ? computeDailyPerformance(labor, production, dailySales, purchases, config)
    : null;

  const materialPriceImpact = purchases.length > 0
    ? computeMaterialPriceImpact(purchases, bomData, materialMaster)
    : null;

  const bomYieldAnalysis = (production.length > 0 && bomData.length > 0)
    ? computeBomYieldAnalysis(production, bomData, materialMaster)
    : null;

  const inventoryDiscrepancy = (inventorySnapshots.length > 0 && purchases.length > 0)
    ? computeInventoryDiscrepancy(inventorySnapshots, purchases)
    : null;

  const budgetExpense = purchases.length > 0
    ? computeBudgetExpense(purchases, config)
    : null;

  return {
    channelRevenue,
    productProfit,
    revenueTrend,
    materialPrices,
    utilityCosts,
    wasteAnalysis,
    productionEfficiency,
    recommendations,
    costBreakdown,
    statisticalOrder,
    abcxyz,
    freshness,
    limitPrice,
    bomVariance,
    productBEP,
    yieldTracking,
    cashFlow,
    inventoryCost,
    profitCenterScore,
    bomConsumptionAnomaly,
    dailyPerformance,
    materialPriceImpact,
    bomYieldAnalysis,
    inventoryDiscrepancy,
    budgetExpense,
  };
}

// computeProfitCenterScore → profitService.ts로 이동

// CostVarianceDetailItem, CostVarianceCategory, CostVarianceBreakdown, computeCostVarianceBreakdown → costService.ts로 이동

// determineStatus, DAY_NAMES, computeDailyPerformance → costService.ts로 이동

// computeMaterialPriceImpact → costService.ts로 이동

// ==============================
// US-001: BOM Yield Analysis
// ==============================

export function computeBomYieldAnalysis(
  production: ProductionData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[],
): BomYieldAnalysisItem[] {
  if (production.length === 0 || bomData.length === 0) return [];

  // 제품코드 → BOM 자재 목록
  const bomByProduct = new Map<string, BomItemData[]>();
  for (const b of bomData) {
    const list = bomByProduct.get(b.productCode) || [];
    list.push(b);
    bomByProduct.set(b.productCode, list);
  }

  // 자재코드 → 단가
  const priceMap = new Map<string, number>();
  for (const m of materialMaster) {
    if (m.materialCode && m.unitPrice > 0) priceMap.set(m.materialCode.trim(), m.unitPrice);
  }

  // 자재코드 → 표준 수율(preprocessYield)
  const yieldMap = new Map<string, number>();
  for (const m of materialMaster) {
    if (m.materialCode && m.preprocessYield > 0) yieldMap.set(m.materialCode.trim(), m.preprocessYield);
  }

  const results: BomYieldAnalysisItem[] = [];
  let idx = 0;

  // 생산일별 제품별 수율 분석
  const prodByDate = new Map<string, ProductionData[]>();
  for (const p of production) {
    const list = prodByDate.get(p.date) || [];
    list.push(p);
    prodByDate.set(p.date, list);
  }

  for (const [date, prods] of prodByDate) {
    const totalProdQty = prods.reduce((s, p) => s + p.prodQtyTotal, 0);
    if (totalProdQty <= 0) continue;

    // BOM 기준 총 투입 예정량 vs 실제 생산량으로 수율 추정
    for (const [productCode, bomItems] of bomByProduct) {
      const totalBomInput = bomItems.reduce((s, b) => s + b.consumptionQty * b.productionQty, 0);
      if (totalBomInput <= 0) continue;

      const stdYield = bomItems[0]?.productionQty > 0
        ? yieldMap.get(bomItems[0].materialCode.trim()) ?? 95
        : 95;

      // 실제 수율: 생산량 / (BOM 투입량) × 100 (간소 추정)
      const actualYield = Math.min(100, Math.round((totalProdQty / totalBomInput) * 100 * 10) / 10);
      const yieldGap = Math.round((actualYield - stdYield) * 10) / 10;
      const absGap = Math.abs(yieldGap);

      const anomalyLevel: import('../types').AnomalyLevel =
        absGap > 5 ? 'critical' : absGap > 3 ? 'warning' : 'normal';

      // 원가 영향: 수율 차이 × 자재 단가 × 투입량
      const avgUnitPrice = bomItems.reduce((s, b) => s + (priceMap.get(b.materialCode.trim()) || 0), 0) / bomItems.length;
      const costImpact = Math.round(Math.abs(yieldGap / 100) * avgUnitPrice * totalBomInput);

      results.push({
        id: `yield-${++idx}`,
        productCode,
        productName: bomItems[0]?.productName || productCode,
        process: bomItems[0]?.location || '일반',
        stdYield,
        actualYield,
        yieldGap,
        transactionDate: date,
        anomalyLevel,
        costImpact,
      });
    }
  }

  return results.sort((a, b) => Math.abs(b.yieldGap) - Math.abs(a.yieldGap));
}

// ==============================
// US-002: Inventory Discrepancy
// ==============================

export function computeInventoryDiscrepancy(
  snapshots: InventorySnapshotData[],
  purchases: PurchaseData[],
): InventoryDiscrepancyItem[] {
  if (snapshots.length === 0) return [];

  // 자재코드별 스냅샷 시간순 정렬
  const byMaterial = new Map<string, InventorySnapshotData[]>();
  for (const s of snapshots) {
    const list = byMaterial.get(s.productCode) || [];
    list.push(s);
    byMaterial.set(s.productCode, list);
  }

  // 자재코드별 구매 수량 집계
  const purchaseQtyByMaterial = new Map<string, number>();
  for (const p of purchases) {
    purchaseQtyByMaterial.set(p.productCode, (purchaseQtyByMaterial.get(p.productCode) || 0) + p.quantity);
  }

  const results: InventoryDiscrepancyItem[] = [];
  let idx = 0;

  for (const [materialCode, snaps] of byMaterial) {
    if (snaps.length < 2) continue;
    const sorted = [...snaps].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const actualChange = last.balanceQty - first.balanceQty;

    // 전표상 수량: 해당 자재의 구매량 (기간 내)
    const transactionQty = purchaseQtyByMaterial.get(materialCode) || 0;
    if (transactionQty === 0 && actualChange === 0) continue;

    const discrepancyQty = actualChange - transactionQty;
    const discrepancyRate = transactionQty !== 0
      ? Math.round(Math.abs(discrepancyQty) / Math.abs(transactionQty) * 1000) / 10
      : (discrepancyQty !== 0 ? 100 : 0);

    const absRate = Math.abs(discrepancyRate);
    const anomalyLevel: import('../types').AnomalyLevel =
      absRate > 10 ? 'critical' : absRate > 5 ? 'warning' : 'normal';

    if (anomalyLevel === 'normal' && Math.abs(discrepancyQty) < 1) continue;

    results.push({
      id: `disc-${++idx}`,
      materialCode,
      materialName: first.productName || materialCode,
      warehouse: first.warehouseCode || '',
      transactionQty,
      physicalQty: last.balanceQty,
      discrepancyQty,
      discrepancyRate,
      actionStatus: 'pending',
      lastCheckedDate: last.snapshotDate,
    });
  }

  return results.sort((a, b) => Math.abs(b.discrepancyRate) - Math.abs(a.discrepancyRate));
}

// computeBudgetExpense → costService.ts로 이동
