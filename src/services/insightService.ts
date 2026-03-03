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
// 타입 정의
// ==============================

// WasteAnalysisInsight, ProductionEfficiencyInsight → productionService.ts로 이동

// CostRecommendation, StatisticalOrderItem, StatisticalOrderInsight,
// ABCClass, XYZClass, ABCXYZItem, ABCXYZInsight,
// FreshnessGrade, FreshnessItem, FreshnessInsight → inventoryInsightService.ts로 이동

// MaterialDetailItem, InventoryAdjustment, CostBreakdownInsight → costService.ts로 이동

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

// InventoryCostItem, InventoryCostInsight → inventoryInsightService.ts로 이동

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

// YieldDailyItem, YieldTrackingInsight → productionService.ts로 이동

// ==============================
// 분석 함수
// ==============================

// computeChannelRevenue, computeProductProfit, computeRevenueTrend
// → profitService.ts로 이동 (barrel re-export는 파일 상단 참조)

// computeMaterialPrices, computeUtilityCosts → costService.ts로 이동
// computeWasteAnalysis, computeProductionEfficiency → productionService.ts로 이동

// isSubMaterial, isCostExcluded, diagnoseSubMaterialClassification, computeCostBreakdown → costService.ts로 이동

// computeStatisticalOrder, generateRecommendations, computeABCXYZ,
// getFreshnessGrade, computeFreshness → inventoryInsightService.ts로 이동

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

// computeYieldTracking → productionService.ts로 이동

// computeCashFlow → costService.ts로 이동

// computeInventoryCost → inventoryInsightService.ts로 이동

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

// computeInventoryDiscrepancy → inventoryInsightService.ts로 이동

// computeBudgetExpense → costService.ts로 이동
