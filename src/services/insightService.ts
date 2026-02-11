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
import type { InventorySafetyItem } from '../types';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG, ProfitCenterGoal } from '../config/businessConfig';
import type { ChannelCostSummary } from '../components/ChannelCostAdmin';

// ==============================
// 타입 정의
// ==============================

export interface ChannelProfitDetail {
  name: string;
  revenue: number;             // 정산매출 (= 기존 매출 데이터)
  share: number;
  recommendedRevenue: number;  // 권장판매가 매출
  discountAmount: number;      // 할인금액
  commissionAmount: number;    // 플랫폼 수수료
  settlementRevenue: number;   // 정산매출 (= revenue)
  materialCost: number;        // 재료비 (권장판매가/1.1 × 50%)
  directCost: number;          // 직접재료비 (매출비례 배분) — 기존 호환
  profit1: number;             // 1단계: 제품이익 = 정산매출 - 재료비
  channelVariableCost: number; // 채널 변동비 합계
  profit2: number;             // 2단계: 채널이익 = 1단계 - 채널변동비
  channelFixedCost: number;    // 채널 고정비 (일할계산)
  profit3: number;             // 3단계: 사업부이익 = 2단계 - 채널고정비
  marginRate1: number;         // 1단계 마진율 (정산매출 기준)
  marginRate2: number;         // 2단계 마진율
  marginRate3: number;         // 3단계 마진율
}

export interface ChannelRevenueInsight {
  channels: ChannelProfitDetail[];
  dailyTrend: { date: string; jasa: number; coupang: number; kurly: number; total: number }[];
  totalRevenue: number;
  totalProductionRevenue: number;
  totalRecommendedRevenue: number;
  totalDiscountAmount: number;
  totalCommissionAmount: number;
  totalMaterialCost: number;
  totalDirectCost: number;
  totalProfit1: number;
  totalProfit2: number;
  totalProfit3: number;
}

export interface ProductProfitInsight {
  items: {
    productCode: string;
    productName: string;
    revenue: number;
    cost: number;
    margin: number;
    marginRate: number;
    quantity: number;
  }[];
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
}

export interface WeeklyTrendEntry {
  weekLabel: string;
  revenue: number;
  cost: number;
  profit1: number;
  profit2: number;
  profit: number;
  marginRate: number;
  prevWeekChange: number;
}

export interface RevenueTrendInsight {
  monthly: {
    month: string;
    revenue: number;
    cost: number;        // 직접재료비
    profit1: number;     // 1단계 이익
    profit2: number;     // 2단계 이익 (채널변동비 차감)
    profit: number;      // 3단계 이익 (= profit3, 기존 필드 유지)
    marginRate: number;  // 3단계 마진율
    prevMonthChange: number;
  }[];
  weekly: WeeklyTrendEntry[];
}

export interface MaterialPriceInsight {
  items: {
    productCode: string;
    productName: string;
    currentPrice: number;
    avgPrice: number;
    priceChange: number;
    changeRate: number;
    totalSpent: number;
    priceHistory: { date: string; price: number }[];
  }[];
}

export interface UtilityCostInsight {
  monthly: {
    month: string;
    electricity: number;
    water: number;
    gas: number;
    total: number;
    perUnit: number;
  }[];
  totalCost: number;
}

export interface WasteAnalysisInsight {
  daily: {
    date: string;
    wasteFinishedPct: number;
    wasteSemiPct: number;
    wasteFinishedEa: number;
    productionQty: number;
    estimatedCost: number;
  }[];
  avgWasteRate: number;
  highWasteDays: { date: string; rate: number; qty: number }[];
  totalEstimatedCost: number;
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

export interface MaterialDetailItem {
  productCode: string;
  productName: string;
  totalSpent: number;
  quantity: number;
  avgUnitPrice: number;
}

/** 재고 조정 데이터: 기초재고 + 당기매입 - 기말재고 방식 원가 계산용 */
export interface InventoryAdjustment {
  beginningRawInventoryValue: number;   // 기초 원재료 재고 금액
  endingRawInventoryValue: number;      // 기말 원재료 재고 금액
  beginningSubInventoryValue: number;   // 기초 부재료 재고 금액
  endingSubInventoryValue: number;      // 기말 부재료 재고 금액
}

export interface CostBreakdownInsight {
  monthly: {
    month: string;
    rawMaterial: number;
    subMaterial: number;
    labor: number;
    overhead: number;
    total: number;
  }[];
  composition: { name: string; value: number; rate: number }[];
  rawMaterialDetail: { items: MaterialDetailItem[]; total: number };
  subMaterialDetail: { items: MaterialDetailItem[]; total: number };
  laborDetail: { estimated: number; note: string };
  overheadDetail: { utilities: number; other: number; total: number };
}

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

export interface LimitPriceItem {
  productCode: string;
  productName: string;
  avgUnitPrice: number;      // 평균 단가
  limitPrice: number;        // 한계단가 (평균 + 1σ)
  currentPrice: number;      // 최근 단가
  exceedRate: number;        // 초과율 (%)
  isExceeding: boolean;      // 한계 초과 여부
}

export interface LimitPriceInsight {
  items: LimitPriceItem[];
  exceedCount: number;       // 초과 품목 수
  totalItems: number;
}

export interface BomVarianceItem {
  productCode: string;
  productName: string;
  standardPrice: number;     // 기준단가 (전체 평균)
  actualPrice: number;       // 실제단가 (최근 기간)
  standardQty: number;       // 기준수량 (생산 비례 기대치)
  actualQty: number;         // 실제수량 (최근 기간)
  priceVariance: number;     // 가격차이 금액
  qtyVariance: number;       // 수량차이 금액
  totalVariance: number;     // 총 차이 금액
}

export interface BomVarianceInsight {
  items: BomVarianceItem[];
  totalPriceVariance: number;
  totalQtyVariance: number;
  totalVariance: number;
  favorableCount: number;    // 유리 (비용 절감) 품목
  unfavorableCount: number;  // 불리 (비용 초과) 품목
}

export interface ProductBEPItem {
  productCode: string;
  productName: string;
  unitPrice: number;           // 판매 단가
  unitVariableCost: number;    // 변동 단가 (재료비)
  unitContribution: number;    // 단위 기여이익
  contributionRate: number;    // 기여이익률 (%)
  allocatedFixedCost: number;  // 매출비례 배분 고정비
  bepUnits: number;            // 손익분기 수량
  bepSales: number;            // 손익분기 매출
  actualUnits: number;         // 실제 판매량
  actualSales: number;         // 실제 매출
  achievementRate: number;     // BEP 달성률 (%)
  safetyMargin: number;        // 여유비율 (%)
}

export interface ProductBEPInsight {
  items: ProductBEPItem[];
  totalFixedCost: number;
  overallBEPSales: number;
  overallAchievementRate: number;
  overallSafetyMargin: number;
  avgContributionRate: number;
}

// ==============================
// P4-4 현금 흐름 타입
// ==============================

interface CashFlowMonthly {
  month: string;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  cumulativeCash: number;
}

interface ChannelCashCycle {
  channelName: string;
  revenue: number;
  collectionDays: number;
  monthlyCollected: number;
}

export interface CashFlowInsight {
  monthly: CashFlowMonthly[];
  channelCycles: ChannelCashCycle[];
  inventoryTurnover: number;
  inventoryTurnoverDays: number;
  avgCollectionPeriod: number;
  cashConversionCycle: number;
  totalCashInflow: number;
  totalCashOutflow: number;
  netCashPosition: number;
}

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

export interface ProfitCenterScoreMetric {
  metric: string;          // 간소화된 라벨 (예: '원재료')
  formula: string;         // 공식 설명 (예: '매출 ÷ 원재료비')
  target: number;
  actual: number;
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'danger';
  unit: string;            // 표시 단위 (예: '배', '%', '원')
  targetAmount?: number;   // 목표 금액 (원)
  actualAmount?: number;   // 실적 금액 (원)
}

export interface ProfitCenterScoreInsight {
  activeBracket: ProfitCenterGoal;
  monthlyRevenue: number;
  calendarDays: number;
  scores: ProfitCenterScoreMetric[];
  overallScore: number;
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
}

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

export function computeChannelRevenue(
  dailySales: DailySalesData[],
  purchases: PurchaseData[] = [],
  channelCosts: ChannelCostSummary[] = [],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): ChannelRevenueInsight {
  let totalJasa = 0, totalCoupang = 0, totalKurly = 0;

  const dailyTrend = dailySales.map(d => {
    totalJasa += d.jasaPrice;
    totalCoupang += d.coupangPrice;
    totalKurly += d.kurlyPrice;
    return {
      date: d.date,
      jasa: d.jasaPrice,
      coupang: d.coupangPrice,
      kurly: d.kurlyPrice,
      total: d.totalRevenue,
    };
  });

  const totalRevenue = totalJasa + totalCoupang + totalKurly;
  // 조회 기간 일수 (고정비 일할계산용)
  const periodDays = dailySales.length || 1;

  // 채널별 비용 요약 맵
  const costMap = new Map<string, ChannelCostSummary>();
  channelCosts.forEach(c => costMap.set(c.channelName, c));

  const channelData: { name: string; revenue: number }[] = [
    { name: '자사몰', revenue: totalJasa },
    { name: '쿠팡', revenue: totalCoupang },
    { name: '컬리', revenue: totalKurly },
  ];

  let sumProfit1 = 0, sumProfit2 = 0, sumProfit3 = 0;
  let sumRecommended = 0, sumDiscount = 0, sumCommission = 0, sumMaterial = 0, sumDirectCost = 0;

  const channels: ChannelProfitDetail[] = channelData.map(ch => {
    const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
    const cc = costMap.get(ch.name);

    // === 5단계 수익 구조 ===
    // jasaPrice 등 = 채널 매출 (정산매출)
    const settlementRevenue = ch.revenue;
    const discountRate = (cc?.discountRate ?? 0) / 100;
    const commissionRate = (cc?.commissionRate ?? 0) / 100;

    // 권장판매가 매출 = 정산매출 / (1 - 할인율 - 수수료율)
    const denominator = 1 - discountRate - commissionRate;
    const recommendedRevenue = denominator > 0
      ? Math.round(settlementRevenue / denominator)
      : settlementRevenue;
    const discountAmount = Math.round(recommendedRevenue * discountRate);
    const commissionAmount = Math.round(recommendedRevenue * commissionRate);

    // 재료비 = (권장판매가 / 1.1) × 50%  (부가세 제외 후 50%)
    const materialCost = Math.round((recommendedRevenue / 1.1) * 0.5);

    // 기존 호환용 directCost (매출비례 배분 방식은 유지하되 materialCost를 우선 사용)
    const directCost = materialCost;

    // 1단계: 제품이익 = 정산매출 - 재료비
    const profit1 = settlementRevenue - materialCost;

    // 2단계: 채널 변동비 계산
    let channelVariableCost = 0;
    if (cc) {
      channelVariableCost += Math.round(ch.revenue * cc.totalVariableRatePct / 100);
      if (cc.totalVariablePerOrder > 0 && config.averageOrderValue > 0) {
        const estimatedOrders = Math.round(ch.revenue / config.averageOrderValue);
        channelVariableCost += estimatedOrders * cc.totalVariablePerOrder;
      }
    }
    const profit2 = profit1 - channelVariableCost;

    // 3단계: 채널 고정비 (월고정비를 일할계산)
    let channelFixedCost = 0;
    if (cc && cc.totalFixedMonthly > 0) {
      channelFixedCost = Math.round(cc.totalFixedMonthly * periodDays / 30);
    }
    const profit3 = profit2 - channelFixedCost;

    // 마진율 (정산매출 기준)
    const marginRate1 = settlementRevenue > 0 ? Math.round((profit1 / settlementRevenue) * 1000) / 10 : 0;
    const marginRate2 = settlementRevenue > 0 ? Math.round((profit2 / settlementRevenue) * 1000) / 10 : 0;
    const marginRate3 = settlementRevenue > 0 ? Math.round((profit3 / settlementRevenue) * 1000) / 10 : 0;

    sumRecommended += recommendedRevenue;
    sumDiscount += discountAmount;
    sumCommission += commissionAmount;
    sumMaterial += materialCost;
    sumDirectCost += directCost;
    sumProfit1 += profit1;
    sumProfit2 += profit2;
    sumProfit3 += profit3;

    return {
      name: ch.name, revenue: ch.revenue, share,
      recommendedRevenue, discountAmount, commissionAmount, settlementRevenue, materialCost,
      directCost, profit1, channelVariableCost, profit2, channelFixedCost, profit3,
      marginRate1, marginRate2, marginRate3,
    };
  });

  // 생산매출 = 권장판매가 매출의 50%
  const totalProductionRevenue = Math.round(sumRecommended * 0.5);

  return {
    channels, dailyTrend, totalRevenue,
    totalProductionRevenue,
    totalRecommendedRevenue: sumRecommended,
    totalDiscountAmount: sumDiscount,
    totalCommissionAmount: sumCommission,
    totalMaterialCost: sumMaterial,
    totalDirectCost: sumDirectCost,
    totalProfit1: sumProfit1, totalProfit2: sumProfit2, totalProfit3: sumProfit3,
  };
}

export function computeProductProfit(
  salesDetail: SalesDetailData[],
  purchases: PurchaseData[]
): ProductProfitInsight {
  // 품목별 매출 집계
  const revenueMap = new Map<string, { name: string; revenue: number; qty: number }>();
  salesDetail.forEach(s => {
    const existing = revenueMap.get(s.productCode) || { name: s.productName, revenue: 0, qty: 0 };
    existing.revenue += s.total;
    existing.qty += s.quantity;
    revenueMap.set(s.productCode, existing);
  });

  // 품목별 구매비용 집계
  const costMap = new Map<string, number>();
  purchases.forEach(p => {
    costMap.set(p.productCode, (costMap.get(p.productCode) || 0) + p.total);
  });

  let totalRevenue = 0, totalCost = 0;

  const items = Array.from(revenueMap.entries()).map(([code, data]) => {
    const cost = costMap.get(code) || 0;
    const margin = data.revenue - cost;
    const marginRate = data.revenue > 0 ? (margin / data.revenue) * 100 : 0;
    totalRevenue += data.revenue;
    totalCost += cost;
    return {
      productCode: code,
      productName: data.name,
      revenue: data.revenue,
      cost,
      margin,
      marginRate: Math.round(marginRate * 10) / 10,
      quantity: data.qty,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    items,
    totalRevenue,
    totalCost,
    totalMargin: totalRevenue - totalCost,
  };
}

export function computeRevenueTrend(
  dailySales: DailySalesData[],
  purchases: PurchaseData[] = [],
  channelCosts: ChannelCostSummary[] = [],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): RevenueTrendInsight {
  // 월별 매출 그룹핑
  const monthlyMap = new Map<string, { revenue: number; count: number }>();
  dailySales.forEach(d => {
    const month = d.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { revenue: 0, count: 0 };
    existing.revenue += d.totalRevenue;
    existing.count++;
    monthlyMap.set(month, existing);
  });

  // 월별 구매비용 그룹핑
  const monthlyCostMap = new Map<string, number>();
  purchases.forEach(p => {
    const month = p.date.slice(0, 7);
    monthlyCostMap.set(month, (monthlyCostMap.get(month) || 0) + p.total);
  });

  // 채널 변동비율 합계, 건당 변동비 합계, 월 고정비 합계
  let totalVarRatePct = 0;
  let totalVarPerOrder = 0;
  let totalFixedMonthly = 0;
  channelCosts.forEach(c => {
    totalVarRatePct += c.totalVariableRatePct;
    totalVarPerOrder += c.totalVariablePerOrder;
    totalFixedMonthly += c.totalFixedMonthly;
  });
  // 가중평균 비율: 채널별 합산 (3채널 전체 합이 아닌 비중 가중평균은 revenue 기반이 정확하지만, 간편하게 전체 합산 사용)

  const hasPurchases = purchases.length > 0;

  const months = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      const cost = monthlyCostMap.get(month) || 0;
      // 1단계: 매출 - 직접재료비
      const profit1 = hasPurchases ? data.revenue - cost : Math.round(data.revenue * config.defaultMarginRate);
      // 2단계: 채널 변동비 차감
      let channelVar = 0;
      if (channelCosts.length > 0) {
        // 매출대비% 변동비 (채널별 비율의 가중평균 → 간소화: 전체 합 적용)
        // 각 채널의 매출 비중에 따른 실제 비율은 computeChannelRevenue에서 정확히 계산
        // 여기서는 전체 채널 평균으로 추정
        const avgVarRate = totalVarRatePct / (channelCosts.length || 1);
        channelVar += Math.round(data.revenue * avgVarRate / 100);
        // 건당 변동비
        if (totalVarPerOrder > 0 && config.averageOrderValue > 0) {
          const avgPerOrder = totalVarPerOrder / (channelCosts.length || 1);
          const estOrders = Math.round(data.revenue / config.averageOrderValue);
          channelVar += estOrders * avgPerOrder;
        }
      }
      const profit2 = profit1 - channelVar;
      // 3단계: 채널 고정비 (월단위 → 그대로 차감)
      const profit3 = profit2 - totalFixedMonthly;
      const profit = channelCosts.length > 0 ? profit3 : profit1; // 채널비용 없으면 1단계만
      const marginRate = data.revenue > 0 ? Math.round((profit / data.revenue) * 1000) / 10 : 0;

      return { month, revenue: data.revenue, cost, profit1, profit2, profit, marginRate, count: data.count };
    });

  const monthly = months.map((m, idx) => ({
    month: m.month,
    revenue: m.revenue,
    cost: m.cost,
    profit1: m.profit1,
    profit2: m.profit2,
    profit: m.profit,
    marginRate: m.marginRate,
    prevMonthChange: idx > 0 && months[idx - 1].revenue > 0
      ? Math.round(((m.revenue - months[idx - 1].revenue) / months[idx - 1].revenue) * 1000) / 10
      : 0,
  }));

  // 주간 집계
  const weeklyMap = new Map<string, { revenue: number; cost: number }>();
  dailySales.forEach(d => {
    const dt = new Date(d.date);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt.getFullYear(), dt.getMonth(), diff);
    const key = monday.toISOString().slice(0, 10);
    const existing = weeklyMap.get(key) || { revenue: 0, cost: 0 };
    existing.revenue += d.totalRevenue;
    weeklyMap.set(key, existing);
  });
  purchases.forEach(p => {
    const dt = new Date(p.date);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt.getFullYear(), dt.getMonth(), diff);
    const key = monday.toISOString().slice(0, 10);
    const existing = weeklyMap.get(key) || { revenue: 0, cost: 0 };
    existing.cost += p.total;
    weeklyMap.set(key, existing);
  });

  const weeklyRaw = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, data]) => {
      const monday = new Date(key);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const label = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}~${String(sunday.getMonth() + 1).padStart(2, '0')}/${String(sunday.getDate()).padStart(2, '0')}`;
      const profit1 = hasPurchases ? data.revenue - data.cost : Math.round(data.revenue * config.defaultMarginRate);
      let channelVar = 0;
      if (channelCosts.length > 0) {
        const avgVarRate = totalVarRatePct / (channelCosts.length || 1);
        channelVar += Math.round(data.revenue * avgVarRate / 100);
      }
      const profit2 = profit1 - channelVar;
      const weeklyFixed = Math.round(totalFixedMonthly * 7 / 30);
      const profit3 = profit2 - weeklyFixed;
      const profit = channelCosts.length > 0 ? profit3 : profit1;
      const marginRate = data.revenue > 0 ? Math.round((profit / data.revenue) * 1000) / 10 : 0;
      return { weekLabel: label, revenue: data.revenue, cost: data.cost, profit1, profit2, profit, marginRate };
    });

  const weekly: WeeklyTrendEntry[] = weeklyRaw.map((w, idx) => ({
    ...w,
    prevWeekChange: idx > 0 && weeklyRaw[idx - 1].revenue > 0
      ? Math.round(((w.revenue - weeklyRaw[idx - 1].revenue) / weeklyRaw[idx - 1].revenue) * 1000) / 10
      : 0,
  }));

  return { monthly, weekly };
}

export function computeMaterialPrices(purchases: PurchaseData[]): MaterialPriceInsight {
  // 품목별 구매 이력 집계
  const priceMap = new Map<string, {
    name: string;
    entries: { date: string; price: number; total: number; qty: number }[];
  }>();

  purchases.forEach(p => {
    if (!p.productCode || p.quantity === 0) return;
    const existing = priceMap.get(p.productCode) || { name: p.productName, entries: [] };
    existing.entries.push({
      date: p.date,
      price: p.unitPrice,
      total: p.total,
      qty: p.quantity,
    });
    priceMap.set(p.productCode, existing);
  });

  const items = Array.from(priceMap.entries()).map(([code, data]) => {
    const sorted = [...data.entries].sort((a, b) => a.date.localeCompare(b.date));
    const totalSpent = sorted.reduce((s, e) => s + e.total, 0);
    const totalQty = sorted.reduce((s, e) => s + e.qty, 0);
    const avgPrice = totalQty > 0 ? Math.round(totalSpent / totalQty) : 0;
    const currentPrice = sorted.length > 0 ? sorted[sorted.length - 1].price : 0;
    const firstPrice = sorted.length > 0 ? sorted[0].price : 0;
    const priceChange = currentPrice - firstPrice;
    const changeRate = firstPrice > 0 ? Math.round((priceChange / firstPrice) * 1000) / 10 : 0;

    // 일별 단가 이력
    const priceHistory = sorted.map(e => ({ date: e.date, price: e.price }));

    return {
      productCode: code,
      productName: data.name,
      currentPrice,
      avgPrice,
      priceChange,
      changeRate,
      totalSpent,
      priceHistory,
    };
  }).sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));

  return { items };
}

export function computeUtilityCosts(
  utilities: UtilityData[],
  production: ProductionData[]
): UtilityCostInsight {
  // 월별 공과금 집계
  const monthlyMap = new Map<string, { elec: number; water: number; gas: number; prodQty: number }>();

  utilities.forEach(u => {
    const month = u.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { elec: 0, water: 0, gas: 0, prodQty: 0 };
    existing.elec += u.elecCost;
    existing.water += u.waterCost;
    existing.gas += u.gasCost;
    monthlyMap.set(month, existing);
  });

  // 월별 생산량 합산
  production.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month);
    if (existing) {
      existing.prodQty += p.prodQtyTotal;
    }
  });

  let totalCost = 0;

  const monthly = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      const total = data.elec + data.water + data.gas;
      totalCost += total;
      return {
        month,
        electricity: data.elec,
        water: data.water,
        gas: data.gas,
        total,
        perUnit: data.prodQty > 0 ? Math.round(total / data.prodQty) : 0,
      };
    });

  return { monthly, totalCost };
}

export function computeWasteAnalysis(
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  purchases: PurchaseData[] = []
): WasteAnalysisInsight {
  // 품목별 평균 단가 맵 (purchases 데이터가 있으면 활용)
  const unitPriceMap = new Map<string, number>();
  if (purchases.length > 0) {
    const qtyMap = new Map<string, { total: number; qty: number }>();
    purchases.forEach(p => {
      const existing = qtyMap.get(p.productName) || { total: 0, qty: 0 };
      existing.total += p.total;
      existing.qty += p.quantity;
      qtyMap.set(p.productName, existing);
    });
    qtyMap.forEach((v, k) => {
      if (v.qty > 0) unitPriceMap.set(k, Math.round(v.total / v.qty));
    });
  }
  const fallbackCost = config.wasteUnitCost;
  let totalEstimatedCost = 0;

  const daily = production.map(p => {
    // 품목별 실제 단가 우선, 없으면 config 폴백
    const unitCost = unitPriceMap.get(p.productName) || fallbackCost;
    const estimatedCost = p.wasteFinishedEa * unitCost;
    totalEstimatedCost += estimatedCost;
    return {
      date: p.date,
      wasteFinishedPct: p.wasteFinishedPct,
      wasteSemiPct: p.wasteSemiPct,
      wasteFinishedEa: p.wasteFinishedEa,
      productionQty: p.prodQtyTotal,
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
    .map(d => ({ date: d.date, rate: d.wasteFinishedPct, qty: d.wasteFinishedEa, cost: d.estimatedCost }));

  return { daily, avgWasteRate, highWasteDays, totalEstimatedCost };
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

// ==============================
// 원가 4요소 분석
// ==============================

const SUB_MATERIAL_KEYWORDS = ['포장', '박스', '비닐', '라벨', '테이프', '봉투', '스티커', '밴드', '용기', '캡', '뚜껑'];

/** 부재료 판별: 품목코드 ZIP_S_ 우선, 없으면 키워드 폴백 */
export function isSubMaterial(productName: string, productCode?: string): boolean {
  if (productCode) return productCode.startsWith('ZIP_S_');
  return SUB_MATERIAL_KEYWORDS.some(kw => productName.includes(kw));
}

export function computeCostBreakdown(
  purchases: PurchaseData[],
  utilities: UtilityData[],
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  labor: LaborDailyData[] = [],
  inventoryAdjustment?: InventoryAdjustment | null
): CostBreakdownInsight {
  // 원재료 / 부재료 분류
  const rawItems: PurchaseData[] = [];
  const subItems: PurchaseData[] = [];
  purchases.forEach(p => {
    if (isSubMaterial(p.productName, p.productCode)) {
      subItems.push(p);
    } else {
      rawItems.push(p);
    }
  });

  const purchaseRaw = rawItems.reduce((s, p) => s + p.total, 0);
  const purchaseSub = subItems.reduce((s, p) => s + p.total, 0);

  // 실제 사용액 = 기초재고 + 당기매입 - 기말재고 (ECOUNT 재고 연동 시)
  const totalRaw = inventoryAdjustment
    ? inventoryAdjustment.beginningRawInventoryValue + purchaseRaw - inventoryAdjustment.endingRawInventoryValue
    : purchaseRaw;  // ECOUNT 불가 시 기존 매입액 방식 폴백

  const totalSub = inventoryAdjustment
    ? inventoryAdjustment.beginningSubInventoryValue + purchaseSub - inventoryAdjustment.endingSubInventoryValue
    : purchaseSub;
  // 경비 = 수도광열비 + 전력비 (유틸리티만, 고정비/변동비 제외)
  const totalUtility = utilities.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);

  // 노무비: 노무비 시트 실데이터 (급여만, 잡급·퇴직급여 제외)
  const totalLabor = labor.length > 0
    ? labor.reduce((s, l) => s + l.totalPay, 0)
    : Math.round((totalRaw + totalSub + totalUtility) * config.laborCostRatio);

  // 경비 = 유틸리티(전기+수도+가스)만
  const totalOverhead = totalUtility;

  // 월별 4요소 원가 추이
  const monthlyMap = new Map<string, { raw: number; sub: number; utility: number; laborPay: number }>();

  rawItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, laborPay: 0 };
    existing.raw += p.total;
    monthlyMap.set(month, existing);
  });
  subItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, laborPay: 0 };
    existing.sub += p.total;
    monthlyMap.set(month, existing);
  });
  utilities.forEach(u => {
    const month = u.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, laborPay: 0 };
    existing.utility += u.elecCost + u.waterCost + u.gasCost;
    monthlyMap.set(month, existing);
  });
  // 노무비 시트 데이터를 월별로 집계
  labor.forEach(l => {
    const month = l.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, laborPay: 0 };
    existing.laborPay += l.totalPay;
    monthlyMap.set(month, existing);
  });

  const monthly = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      // 노무비: 노무비 시트 실데이터 우선, 없으면 비율 추정
      const laborCostForMonth = data.laborPay > 0
        ? data.laborPay
        : Math.round((data.raw + data.sub + data.utility) * config.laborCostRatio);
      // 경비 = 유틸리티(전기+수도+가스)만
      const overhead = data.utility;
      return {
        month,
        rawMaterial: data.raw,
        subMaterial: data.sub,
        labor: laborCostForMonth,
        overhead,
        total: data.raw + data.sub + laborCostForMonth + overhead,
      };
    });

  // 원가 구성비
  const grandTotal = totalRaw + totalSub + totalLabor + totalOverhead;
  const composition = [
    { name: '원재료', value: totalRaw, rate: grandTotal > 0 ? Math.round((totalRaw / grandTotal) * 1000) / 10 : 0 },
    { name: '부재료', value: totalSub, rate: grandTotal > 0 ? Math.round((totalSub / grandTotal) * 1000) / 10 : 0 },
    { name: '노무비', value: totalLabor, rate: grandTotal > 0 ? Math.round((totalLabor / grandTotal) * 1000) / 10 : 0 },
    { name: '수도광열전력', value: totalOverhead, rate: grandTotal > 0 ? Math.round((totalOverhead / grandTotal) * 1000) / 10 : 0 },
  ];

  // 원재료 상세
  const rawDetailMap = new Map<string, { name: string; total: number; qty: number }>();
  rawItems.forEach(p => {
    const existing = rawDetailMap.get(p.productCode) || { name: p.productName, total: 0, qty: 0 };
    existing.total += p.total;
    existing.qty += p.quantity;
    rawDetailMap.set(p.productCode, existing);
  });
  const rawMaterialDetail = {
    items: Array.from(rawDetailMap.entries())
      .map(([code, data]) => ({
        productCode: code,
        productName: data.name,
        totalSpent: data.total,
        quantity: data.qty,
        avgUnitPrice: data.qty > 0 ? Math.round(data.total / data.qty) : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent),
    total: totalRaw,
  };

  // 부재료 상세
  const subDetailMap = new Map<string, { name: string; total: number; qty: number }>();
  subItems.forEach(p => {
    const existing = subDetailMap.get(p.productCode) || { name: p.productName, total: 0, qty: 0 };
    existing.total += p.total;
    existing.qty += p.quantity;
    subDetailMap.set(p.productCode, existing);
  });
  const subMaterialDetail = {
    items: Array.from(subDetailMap.entries())
      .map(([code, data]) => ({
        productCode: code,
        productName: data.name,
        totalSpent: data.total,
        quantity: data.qty,
        avgUnitPrice: data.qty > 0 ? Math.round(data.total / data.qty) : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent),
    total: totalSub,
  };

  return {
    monthly,
    composition,
    rawMaterialDetail,
    subMaterialDetail,
    laborDetail: {
      estimated: totalLabor,
      note: labor.length > 0
        ? '노무비 시트 기반 실제 급여 합계'
        : `총 원가(원재료+부재료+경비)의 ${Math.round(config.laborCostRatio * 100)}% 추정값`,
    },
    overheadDetail: {
      utilities: totalUtility,
      other: 0,
      total: totalOverhead,
    },
  };
}

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
    const key = inv.skuCode || inv.skuName;
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

// ==============================
// P3-5 한계단가 + 초과 경고
// ==============================

export function computeLimitPrice(purchases: PurchaseData[]): LimitPriceInsight {
  if (purchases.length === 0) {
    return { items: [], exceedCount: 0, totalItems: 0 };
  }

  // 품목별 단가 이력
  const priceMap = new Map<string, { name: string; prices: number[]; lastPrice: number }>();
  purchases.forEach(p => {
    if (!p.productCode || p.quantity === 0) return;
    const unitPrice = p.total / p.quantity;
    const existing = priceMap.get(p.productCode) || { name: p.productName, prices: [], lastPrice: 0 };
    existing.prices.push(unitPrice);
    existing.lastPrice = unitPrice; // 마지막 단가 (시간순 정렬 가정)
    priceMap.set(p.productCode, existing);
  });

  const items: LimitPriceItem[] = Array.from(priceMap.entries())
    .filter(([_, data]) => data.prices.length >= 2)
    .map(([code, data]) => {
      const n = data.prices.length;
      const mean = data.prices.reduce((s, v) => s + v, 0) / n;
      const variance = data.prices.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // 한계단가 = 평균 + 1σ
      const limitPrice = Math.round(mean + stdDev);
      const currentPrice = Math.round(data.lastPrice);
      const exceedRate = limitPrice > 0 ? Math.round(((currentPrice - limitPrice) / limitPrice) * 1000) / 10 : 0;

      return {
        productCode: code,
        productName: data.name,
        avgUnitPrice: Math.round(mean),
        limitPrice,
        currentPrice,
        exceedRate,
        isExceeding: currentPrice > limitPrice,
      };
    })
    .sort((a, b) => b.exceedRate - a.exceedRate);

  return {
    items,
    exceedCount: items.filter(i => i.isExceeding).length,
    totalItems: items.length,
  };
}

// ==============================
// P3-4 레시피 대비 투입 오차 분석
// ==============================

export function computeBomVariance(
  purchases: PurchaseData[],
  production: ProductionData[],
  bomData: BomItemData[] = [],
  materialMaster: MaterialMasterItem[] = [],
  inventorySnapshots: InventorySnapshotData[] = []
): BomVarianceInsight {
  if (purchases.length === 0 || production.length === 0) {
    return { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
  }

  // 총 생산량
  const totalProduction = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  if (totalProduction === 0) {
    return { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
  }

  // materialMaster → 이름 매핑 (BOM 이름이 빈 문자열인 경우 보완)
  const masterNameMap = new Map<string, string>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (code && mm.materialName) masterNameMap.set(code, mm.materialName);
  }

  // BOM에 포함된 자재코드 집합 (BOM 관련 자재만 표시하기 위해)
  const bomMaterialCodes = new Set<string>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (matCode) bomMaterialCodes.add(matCode);
  }

  // 재고 잔량 (자재코드별)
  const inventoryBalance = new Map<string, number>();
  for (const inv of inventorySnapshots) {
    const code = inv.productCode?.trim();
    if (!code) continue;
    inventoryBalance.set(code, (inventoryBalance.get(code) || 0) + inv.balanceQty);
  }

  // 기간 분할: 전반기(기준) vs 후반기(실제)
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

  // 품목별 기준 기간 집계
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

  // 양쪽 모두 데이터가 있는 품목만 비교
  const allCodes = new Set([...baseAgg.keys(), ...recentAgg.keys()]);
  let totalPriceVar = 0;
  let totalQtyVar = 0;

  const items: BomVarianceItem[] = [];
  allCodes.forEach(code => {
    const base = baseAgg.get(code);
    const recent = recentAgg.get(code);
    if (!base || !recent || base.qty === 0 || recent.qty === 0) return;

    // BOM 자재만 필터 (BOM 데이터가 있을 때)
    if (bomMaterialCodes.size > 0 && !bomMaterialCodes.has(code)) return;

    const standardPrice = Math.round(base.total / base.qty);
    const actualPrice = Math.round(recent.total / recent.qty);

    // 기준 수량 = (기준 기간 투입량 / 기준 기간 생산량) × 최근 기간 생산량
    const standardRatio = base.qty / baseProdTotal;
    const standardQty = Math.round(standardRatio * recentProdTotal);

    // 실제수량: 구매량 - 재고 잔량 보정 (후반기 구매 중 미소진분)
    const balance = inventoryBalance.get(code) || 0;
    const actualQty = balance > 0 ? Math.max(0, recent.qty - balance) : recent.qty;

    // 가격차이 = (실제단가 - 기준단가) × 실제수량
    const priceVariance = (actualPrice - standardPrice) * actualQty;
    // 수량차이 = (실제수량 - 기준수량) × 기준단가
    const qtyVariance = (actualQty - standardQty) * standardPrice;
    const totalVariance = priceVariance + qtyVariance;

    totalPriceVar += priceVariance;
    totalQtyVar += qtyVariance;

    // 이름: materialMaster 우선 → 구매 데이터 이름
    const name = masterNameMap.get(code) || base.name || recent.name;

    items.push({
      productCode: code,
      productName: name,
      standardPrice, actualPrice,
      standardQty, actualQty,
      priceVariance, qtyVariance, totalVariance,
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

// ==============================
// P4-2 BEP(손익분기점) 자동 계산
// ==============================

export function computeProductBEP(
  productProfit: ProductProfitInsight,
  channelRevenue: ChannelRevenueInsight | null,
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): ProductBEPInsight {
  // 고정비 합산: 채널 고정비 + 월 고정경비
  const channelFixedTotal = channelRevenue
    ? channelRevenue.channels.reduce((s, ch) => s + ch.channelFixedCost, 0)
    : 0;
  const totalFixedCost = channelFixedTotal + (config.monthlyFixedOverhead || 0);
  const totalRevenue = productProfit.totalRevenue || 1;

  // 전체 변동비 = 직접재료비 + 채널변동비
  const totalVariableCost = productProfit.totalCost
    + (channelRevenue ? channelRevenue.channels.reduce((s, ch) => s + ch.channelVariableCost, 0) : 0);

  // 전체 기여이익률
  const avgContributionRate = totalRevenue > 0
    ? Math.round(((totalRevenue - totalVariableCost) / totalRevenue) * 1000) / 10
    : 0;

  // 전체 BEP 매출
  const overallBEPSales = avgContributionRate > 0
    ? Math.round(totalFixedCost / (avgContributionRate / 100))
    : 0;

  const overallAchievementRate = overallBEPSales > 0
    ? Math.round((productProfit.totalRevenue / overallBEPSales) * 1000) / 10
    : 0;

  const overallSafetyMargin = productProfit.totalRevenue > 0 && overallBEPSales > 0
    ? Math.round(((productProfit.totalRevenue - overallBEPSales) / productProfit.totalRevenue) * 1000) / 10
    : 0;

  // 품목별 BEP
  const items: ProductBEPItem[] = productProfit.items
    .filter(item => item.quantity > 0 && item.revenue > 0)
    .map(item => {
      const unitPrice = Math.round(item.revenue / item.quantity);
      const unitVariableCost = Math.round(item.cost / item.quantity);
      const unitContribution = unitPrice - unitVariableCost;
      const contributionRate = unitPrice > 0
        ? Math.round((unitContribution / unitPrice) * 1000) / 10
        : 0;

      // 고정비 배분: 매출 비중에 따라
      const revenueShare = item.revenue / totalRevenue;
      const allocatedFixedCost = Math.round(totalFixedCost * revenueShare);

      // BEP 수량 = 배분 고정비 / 단위 기여이익
      const bepUnits = unitContribution > 0
        ? Math.ceil(allocatedFixedCost / unitContribution)
        : 0;
      const bepSales = bepUnits * unitPrice;

      const achievementRate = bepUnits > 0
        ? Math.round((item.quantity / bepUnits) * 1000) / 10
        : 0;

      const safetyMargin = item.quantity > 0 && bepUnits > 0
        ? Math.round(((item.quantity - bepUnits) / item.quantity) * 1000) / 10
        : 0;

      return {
        productCode: item.productCode,
        productName: item.productName,
        unitPrice,
        unitVariableCost,
        unitContribution,
        contributionRate,
        allocatedFixedCost,
        bepUnits,
        bepSales,
        actualUnits: item.quantity,
        actualSales: item.revenue,
        achievementRate,
        safetyMargin,
      };
    })
    .sort((a, b) => a.safetyMargin - b.safetyMargin); // 여유비율 낮은 순 (위험 우선)

  return {
    items,
    totalFixedCost,
    overallBEPSales,
    overallAchievementRate,
    overallSafetyMargin,
    avgContributionRate,
  };
}

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

// ==============================
// P4-4 현금 흐름 대시보드
// ==============================

function computeCashFlow(
  dailySales: DailySalesData[],
  purchases: PurchaseData[],
  utilities: UtilityData[],
  inventoryData: InventorySafetyItem[],
  channelRevenue: ChannelRevenueInsight | null,
  costBreakdown: CostBreakdownInsight | null,
  config: BusinessConfig
): CashFlowInsight {
  // 월별 유입/유출 집계
  const monthlyInflowMap = new Map<string, number>();
  const monthlyOutflowMap = new Map<string, number>();

  dailySales.forEach(d => {
    const month = d.date.slice(0, 7);
    monthlyInflowMap.set(month, (monthlyInflowMap.get(month) || 0) + d.totalRevenue);
  });

  purchases.forEach(p => {
    const month = p.date.slice(0, 7);
    monthlyOutflowMap.set(month, (monthlyOutflowMap.get(month) || 0) + p.total);
  });

  utilities.forEach(u => {
    const month = u.date.slice(0, 7);
    const utilCost = u.elecCost + u.waterCost + u.gasCost;
    monthlyOutflowMap.set(month, (monthlyOutflowMap.get(month) || 0) + utilCost);
  });

  // 노무비 추정 (costBreakdown이 있으면 활용)
  if (costBreakdown) {
    costBreakdown.monthly.forEach(m => {
      const existing = monthlyOutflowMap.get(m.month) || 0;
      // 유출에 구매+경비는 이미 위에서 집계됨. 노무비만 추가
      monthlyOutflowMap.set(m.month, existing + m.labor);
    });
  }

  // 모든 월 수집
  const allMonths = new Set([...monthlyInflowMap.keys(), ...monthlyOutflowMap.keys()]);
  const sortedMonths = Array.from(allMonths).sort();

  let cumulativeCash = 0;
  let totalCashInflow = 0;
  let totalCashOutflow = 0;

  const monthly: CashFlowMonthly[] = sortedMonths.map(month => {
    const cashInflow = monthlyInflowMap.get(month) || 0;
    const cashOutflow = monthlyOutflowMap.get(month) || 0;
    const netCashFlow = cashInflow - cashOutflow;
    cumulativeCash += netCashFlow;
    totalCashInflow += cashInflow;
    totalCashOutflow += cashOutflow;
    return { month, cashInflow, cashOutflow, netCashFlow, cumulativeCash };
  });

  // 채널별 현금회수 주기
  const channelCycles: ChannelCashCycle[] = [];
  if (channelRevenue) {
    const channelCollectionMap: Record<string, number> = {
      '자사몰': config.channelCollectionDaysJasa,
      '쿠팡': config.channelCollectionDaysCoupang,
      '컬리': config.channelCollectionDaysKurly,
    };
    channelRevenue.channels.forEach(ch => {
      const collectionDays = channelCollectionMap[ch.name] ?? 0;
      // 월 기준 회수예정액 = 매출 / 조회기간일수 * 30
      const periodDays = dailySales.length || 1;
      const monthlyCollected = Math.round(ch.revenue / periodDays * 30);
      channelCycles.push({
        channelName: ch.name,
        revenue: ch.revenue,
        collectionDays,
        monthlyCollected,
      });
    });
  }

  // 재고회전율 = 연간매출원가 / 평균재고금액
  const totalPurchaseCost = purchases.reduce((s, p) => s + p.total, 0);
  const allDates = purchases.length > 0 ? purchases.map(p => p.date).sort() : [];
  const periodDaysP = allDates.length > 1
    ? Math.max(1, Math.ceil((new Date(allDates[allDates.length - 1]).getTime() - new Date(allDates[0]).getTime()) / (1000 * 60 * 60 * 24)))
    : 30;
  const annualizedCOGS = totalPurchaseCost * (365 / periodDaysP);

  // 평균재고금액: 각 재고 품목의 currentStock * 평균단가
  const unitPriceMap = new Map<string, number>();
  purchases.forEach(p => {
    if (p.quantity > 0 && p.unitPrice > 0) {
      unitPriceMap.set(p.productName, p.unitPrice);
    }
  });

  let avgInventoryValue = 0;
  inventoryData.forEach(inv => {
    const price = unitPriceMap.get(inv.skuName) || 0;
    avgInventoryValue += inv.currentStock * price;
  });

  const inventoryTurnover = avgInventoryValue > 0
    ? Math.round((annualizedCOGS / avgInventoryValue) * 10) / 10
    : 0;
  const inventoryTurnoverDays = inventoryTurnover > 0
    ? Math.round(365 / inventoryTurnover)
    : 0;

  // 평균 현금회수기간
  const avgCollectionPeriod = channelCycles.length > 0
    ? Math.round(
        channelCycles.reduce((s, c) => s + c.collectionDays * c.revenue, 0) /
        Math.max(1, channelCycles.reduce((s, c) => s + c.revenue, 0))
      )
    : 0;

  // CCC = 재고회전일수 + 평균회수기간 - 매입결제기간(defaultLeadTime)
  const cashConversionCycle = inventoryTurnoverDays + avgCollectionPeriod - config.defaultLeadTime;

  return {
    monthly,
    channelCycles,
    inventoryTurnover,
    inventoryTurnoverDays,
    avgCollectionPeriod,
    cashConversionCycle,
    totalCashInflow,
    totalCashOutflow,
    netCashPosition: totalCashInflow - totalCashOutflow,
  };
}

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
  inventorySnapshots: InventorySnapshotData[] = []
): DashboardInsights {
  const channelRevenue = dailySales.length > 0 ? computeChannelRevenue(dailySales, purchases, channelCosts, config) : null;
  const productProfit = salesDetail.length > 0 ? computeProductProfit(salesDetail, purchases) : null;
  const revenueTrend = dailySales.length > 0 ? computeRevenueTrend(dailySales, purchases, channelCosts, config) : null;
  const materialPrices = purchases.length > 0 ? computeMaterialPrices(purchases) : null;
  const utilityCosts = utilities.length > 0 ? computeUtilityCosts(utilities, production) : null;
  const wasteAnalysis = production.length > 0 ? computeWasteAnalysis(production, config, purchases) : null;
  const productionEfficiency = production.length > 0 ? computeProductionEfficiency(production) : null;

  const costBreakdown = purchases.length > 0
    ? computeCostBreakdown(purchases, utilities, production, config, labor)
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
    ? computeBomVariance(purchases, production, bomData, materialMaster, inventorySnapshots)
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
        const alignedCR = computeChannelRevenue(alignedSales, purchases, channelCosts, config);
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
  };
}

/**
 * 독립채산제 점수 계산
 * 현재 월매출에 해당하는 구간을 찾아 6개 지표를 목표 대비 100점 만점 점수화
 * costBreakdown의 필터된 값을 그대로 사용 (원가관리 페이지와 동일 기준)
 */
export function computeProfitCenterScore(
  channelRevenue: ChannelRevenueInsight | null,
  costBreakdown: CostBreakdownInsight | null,
  wasteAnalysis: WasteAnalysisInsight | null,
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
): ProfitCenterScoreInsight | null {
  if (!channelRevenue || !costBreakdown) return null;

  const goals = config.profitCenterGoals;
  if (!goals || goals.length === 0) return null;

  // 조회 기간 캘린더 일수
  const dates = channelRevenue.dailyTrend.map(d => d.date).sort();
  const calendarDays = dates.length >= 2
    ? Math.max(1, Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000) + 1)
    : channelRevenue.dailyTrend.length || 1;

  // 매출구간 결정: 정산매출(실결제 금액) 기준
  const settlementRevenue = channelRevenue.totalRevenue;
  const monthlySettlement = Math.round(settlementRevenue * 30 / calendarDays);

  // 점수 계산용: 생산매출 (= 권장판매가 × 50%)
  const revenue = channelRevenue.totalProductionRevenue;
  const monthlyRevenue = monthlySettlement; // UI 표시용 = 정산매출 기준 월매출

  // 가장 가까운 하위 구간 선택 (정산매출 기준)
  const sorted = [...goals].sort((a, b) => a.revenueBracket - b.revenueBracket);
  let activeBracket = sorted[0];
  for (const goal of sorted) {
    if (monthlySettlement >= goal.revenueBracket) {
      activeBracket = goal;
    } else {
      break;
    }
  }

  const targets = activeBracket.targets;
  const comp = costBreakdown.composition;
  const rawMaterial = comp.find(c => c.name === '원재료')?.value || 0;
  const subMaterial = comp.find(c => c.name === '부재료')?.value || 0;
  const laborCost = comp.find(c => c.name === '노무비')?.value || 0;
  const overheadCost = comp.find(c => c.name === '수도광열전력')?.value || 0;

  const totalExpense = overheadCost;

  function getStatus(score: number): 'excellent' | 'good' | 'warning' | 'danger' {
    if (score >= 110) return 'excellent';
    if (score >= 100) return 'good';
    if (score >= 90) return 'warning';
    return 'danger';
  }

  // 점수 = actual / target × 100 (100점 만점, 100 초과 가능)
  const safeScore = (actual: number, target: number) =>
    target > 0 ? Math.round(actual / target * 100) : 0;

  // 모든 비율 계산에 생산매출(revenue) 사용
  // 1. 매출/원재료
  const actualRevToRaw = rawMaterial > 0 ? revenue / rawMaterial : 0;
  const targetRevToRaw = targets.revenueToRawMaterial ?? (targets.revenueToMaterial * 1.08);

  // 2. 매출/부재료
  const actualRevToSub = subMaterial > 0 ? revenue / subMaterial : 0;
  const targetRevToSub = targets.revenueToSubMaterial ?? (targets.revenueToMaterial * 14.8);

  // 3. 매출/노무비
  const actualProdToLabor = laborCost > 0 ? revenue / laborCost : 0;

  // 4. 매출/경비
  const actualRevToExpense = totalExpense > 0 ? revenue / totalExpense : 0;

  // 5. 폐기율 (역방향: 낮을수록 좋음 → target/actual)
  const actualWasteRate = wasteAnalysis?.avgWasteRate ?? 0;
  const scoreWaste = actualWasteRate > 0 && targets.wasteRateTarget > 0
    ? Math.round(targets.wasteRateTarget / actualWasteRate * 100) : 100;

  // 절대 목표금액: config에서 가져와서 기간 비례 조정
  const prorationFactor = calendarDays / 30;
  const proratedTarget = (t?: number) => t ? Math.round(t * prorationFactor) : undefined;

  // 폴백: 절대금액 미설정 시 기존 방식 (매출/목표배수)
  const fallbackTarget = (multiplier: number) => multiplier > 0 ? Math.round(revenue / multiplier) : 0;

  const scores: ProfitCenterScoreMetric[] = [
    { metric: '원재료', formula: '생산매출 ÷ 원재료비', target: Math.round(targetRevToRaw * 100) / 100, actual: Math.round(actualRevToRaw * 100) / 100, score: safeScore(actualRevToRaw, targetRevToRaw), status: getStatus(safeScore(actualRevToRaw, targetRevToRaw)), unit: '배', targetAmount: proratedTarget(targets.targetRawMaterialCost) ?? fallbackTarget(targetRevToRaw), actualAmount: rawMaterial },
    { metric: '부재료', formula: '생산매출 ÷ 부재료비', target: Math.round(targetRevToSub * 100) / 100, actual: Math.round(actualRevToSub * 100) / 100, score: safeScore(actualRevToSub, targetRevToSub), status: getStatus(safeScore(actualRevToSub, targetRevToSub)), unit: '배', targetAmount: proratedTarget(targets.targetSubMaterialCost) ?? fallbackTarget(targetRevToSub), actualAmount: subMaterial },
    { metric: '노무비', formula: '생산매출 ÷ 노무비', target: Math.round(targets.productionToLabor * 100) / 100, actual: Math.round(actualProdToLabor * 100) / 100, score: safeScore(actualProdToLabor, targets.productionToLabor), status: getStatus(safeScore(actualProdToLabor, targets.productionToLabor)), unit: '배', targetAmount: proratedTarget(targets.targetLaborCost) ?? fallbackTarget(targets.productionToLabor), actualAmount: laborCost },
    { metric: '수도광열전력', formula: '생산매출 ÷ 수도광열전력비', target: Math.round(targets.revenueToExpense * 100) / 100, actual: Math.round(actualRevToExpense * 100) / 100, score: safeScore(actualRevToExpense, targets.revenueToExpense), status: getStatus(safeScore(actualRevToExpense, targets.revenueToExpense)), unit: '배', targetAmount: proratedTarget(targets.targetOverheadCost) ?? fallbackTarget(targets.revenueToExpense), actualAmount: overheadCost },
    { metric: '폐기율', formula: '폐기수량 ÷ 생산수량', target: Math.round(targets.wasteRateTarget * 10) / 10, actual: Math.round(actualWasteRate * 10) / 10, score: scoreWaste, status: getStatus(scoreWaste), unit: '%' },
  ];

  // 종합점수 = 5개 지표 점수의 평균
  const overallScore = Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length);

  return { activeBracket, monthlyRevenue, calendarDays, scores, overallScore };
}
