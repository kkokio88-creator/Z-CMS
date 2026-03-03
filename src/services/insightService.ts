/**
 * Insight Service — 통합 오케스트레이터 + Barrel Re-exports
 * 개별 분석은 profitService, costService, inventoryInsightService,
 * productionService, bomService에서 수행
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
// Barrel re-exports from inventoryInsightService
// ==============================
export {
  computeStatisticalOrder,
  computeABCXYZ,
  computeFreshness,
  computeInventoryCost,
  computeInventoryDiscrepancy,
  generateRecommendations,
} from './inventoryInsightService';

export type {
  StatisticalOrderItem,
  StatisticalOrderInsight,
  ABCClass,
  XYZClass,
  ABCXYZItem,
  ABCXYZInsight,
  FreshnessGrade,
  FreshnessItem,
  FreshnessInsight,
  InventoryCostInsight,
  CostRecommendation,
} from './inventoryInsightService';

import {
  computeStatisticalOrder,
  computeABCXYZ,
  computeFreshness,
  computeInventoryCost,
  computeInventoryDiscrepancy,
  generateRecommendations,
} from './inventoryInsightService';
import type {
  StatisticalOrderInsight,
  ABCXYZInsight,
  FreshnessInsight,
  InventoryCostInsight,
  CostRecommendation,
} from './inventoryInsightService';

// ==============================
// Barrel re-exports from productionService
// ==============================
export {
  computeWasteAnalysis,
  computeProductionEfficiency,
  computeYieldTracking,
} from './productionService';

export type {
  WasteAnalysisInsight,
  ProductionEfficiencyInsight,
  YieldDailyItem,
  YieldTrackingInsight,
} from './productionService';

import {
  computeWasteAnalysis,
  computeProductionEfficiency,
  computeYieldTracking,
} from './productionService';
import type {
  WasteAnalysisInsight,
  ProductionEfficiencyInsight,
  YieldTrackingInsight,
} from './productionService';

// ==============================
// Barrel re-exports from bomService
// ==============================
export {
  computeBomVariance,
  computeBomConsumptionAnomaly,
  computeBomYieldAnalysis,
  computeSalesBasedConsumption,
  computeConsumptionVariance,
  computeBomCoverage,
  validateBomData,
  computeBomHealthScore,
} from './bomService';

export type {
  BomVarianceItem,
  BomVarianceInsight,
  BomAnomalyType,
  BomAnomalySeverity,
  BomConsumptionAnomalyItem,
  BomConsumptionAnomalyInsight,
  ExpectedConsumption,
  ConsumptionVarianceItem,
  ConsumptionVarianceResult,
  BomDataValidationResult,
} from './bomService';

import {
  computeBomVariance,
  computeBomConsumptionAnomaly,
  computeBomYieldAnalysis,
} from './bomService';
import type {
  BomVarianceInsight,
  BomConsumptionAnomalyInsight,
} from './bomService';

// ==============================
// DashboardInsights 인터페이스
// ==============================

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
