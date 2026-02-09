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
} from './googleSheetService';
import { getZScore } from './orderingService';
import type { InventorySafetyItem } from '../types';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG } from '../config/businessConfig';
import type { ChannelCostSummary } from '../components/ChannelCostAdmin';
import { getLaborMonthlySummaries, getMonthlyLaborCost, getTotalLaborCost } from '../components/LaborRecordAdmin';

// ==============================
// 타입 정의
// ==============================

export interface ChannelProfitDetail {
  name: string;
  revenue: number;
  share: number;
  directCost: number;        // 직접재료비 (매출비례 배분)
  profit1: number;            // 1단계: 제품이익 = 매출 - 직접재료비
  channelVariableCost: number; // 채널 변동비 합계
  profit2: number;            // 2단계: 채널이익 = 1단계 - 채널변동비
  channelFixedCost: number;   // 채널 고정비 (일할계산)
  profit3: number;            // 3단계: 사업부이익 = 2단계 - 채널고정비
  marginRate1: number;        // 1단계 마진율
  marginRate2: number;        // 2단계 마진율
  marginRate3: number;        // 3단계 마진율
}

export interface ChannelRevenueInsight {
  channels: ChannelProfitDetail[];
  dailyTrend: { date: string; jasa: number; coupang: number; kurly: number; total: number }[];
  totalRevenue: number;
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
  // 직접재료비: 모든 구매비용 합계
  const totalDirectCost = purchases.reduce((sum, p) => sum + p.total, 0);
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

  const channels: ChannelProfitDetail[] = channelData.map(ch => {
    const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;

    // 1단계: 직접재료비를 매출비례로 배분
    const directCost = totalRevenue > 0
      ? Math.round(totalDirectCost * (ch.revenue / totalRevenue))
      : 0;
    const profit1 = ch.revenue - directCost;

    // 2단계: 채널 변동비 계산
    const cc = costMap.get(ch.name);
    let channelVariableCost = 0;
    if (cc) {
      // 매출대비% 변동비
      channelVariableCost += Math.round(ch.revenue * cc.totalVariableRatePct / 100);
      // 건당 변동비: 추정 주문 건수 = 매출 / 평균주문단가
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

    const marginRate1 = ch.revenue > 0 ? Math.round((profit1 / ch.revenue) * 1000) / 10 : 0;
    const marginRate2 = ch.revenue > 0 ? Math.round((profit2 / ch.revenue) * 1000) / 10 : 0;
    const marginRate3 = ch.revenue > 0 ? Math.round((profit3 / ch.revenue) * 1000) / 10 : 0;

    sumProfit1 += profit1;
    sumProfit2 += profit2;
    sumProfit3 += profit3;

    return {
      name: ch.name, revenue: ch.revenue, share,
      directCost, profit1, channelVariableCost, profit2, channelFixedCost, profit3,
      marginRate1, marginRate2, marginRate3,
    };
  });

  return {
    channels, dailyTrend, totalRevenue,
    totalDirectCost, totalProfit1: sumProfit1, totalProfit2: sumProfit2, totalProfit3: sumProfit3,
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

  return { monthly };
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

function isSubMaterial(productName: string): boolean {
  return SUB_MATERIAL_KEYWORDS.some(kw => productName.includes(kw));
}

export function computeCostBreakdown(
  purchases: PurchaseData[],
  utilities: UtilityData[],
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): CostBreakdownInsight {
  // 원재료 / 부재료 분류
  const rawItems: PurchaseData[] = [];
  const subItems: PurchaseData[] = [];
  purchases.forEach(p => {
    if (isSubMaterial(p.productName)) {
      subItems.push(p);
    } else {
      rawItems.push(p);
    }
  });

  const totalRaw = rawItems.reduce((s, p) => s + p.total, 0);
  const totalSub = subItems.reduce((s, p) => s + p.total, 0);
  const totalUtility = utilities.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);
  const totalProduction = production.reduce((s, p) => s + p.quantity, 0);

  // 노무비: 실제 기록이 있으면 사용, 없으면 비율 추정
  const actualLaborCost = getTotalLaborCost(config.avgHourlyWage, config.overtimeMultiplier);
  const totalLabor = actualLaborCost > 0
    ? actualLaborCost
    : Math.round((totalRaw + totalSub + totalUtility) * config.laborCostRatio);
  const laborIsActual = actualLaborCost > 0;

  // 경비 계산: 고정비 + 변동비 + 공과금
  // 고정비: 월 고정경비 설정값 (설정되지 않으면 기존 overheadRatio 방식 폴백)
  // 변동비: 변동경비단가 × 총 생산량
  const hasFixedOverhead = config.monthlyFixedOverhead > 0 || config.variableOverheadPerUnit > 0;
  const fixedOverhead = config.monthlyFixedOverhead; // 월 단위 (조회 기간에 따라 비례 배분은 추후)
  const variableOverhead = Math.round(totalProduction * config.variableOverheadPerUnit);
  const otherOverhead = hasFixedOverhead
    ? fixedOverhead + variableOverhead
    : Math.round((totalRaw + totalSub) * config.overheadRatio);
  const totalOverhead = totalUtility + otherOverhead;

  // 월별 4요소 원가 추이
  const monthlyMap = new Map<string, { raw: number; sub: number; utility: number; prodQty: number }>();

  rawItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, prodQty: 0 };
    existing.raw += p.total;
    monthlyMap.set(month, existing);
  });
  subItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, prodQty: 0 };
    existing.sub += p.total;
    monthlyMap.set(month, existing);
  });
  utilities.forEach(u => {
    const month = u.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, prodQty: 0 };
    existing.utility += u.elecCost + u.waterCost + u.gasCost;
    monthlyMap.set(month, existing);
  });
  production.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, prodQty: 0 };
    existing.prodQty += p.quantity;
    monthlyMap.set(month, existing);
  });

  const monthly = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      // 노무비: 해당 월 실제 기록 우선, 없으면 비율 추정
      const monthlyActualLabor = getMonthlyLaborCost(month, config.avgHourlyWage, config.overtimeMultiplier);
      const labor = monthlyActualLabor !== null
        ? monthlyActualLabor
        : Math.round((data.raw + data.sub + data.utility) * config.laborCostRatio);
      // 경비: 고정비+변동비 방식 또는 기존 비율 방식
      const monthlyOther = hasFixedOverhead
        ? config.monthlyFixedOverhead + Math.round(data.prodQty * config.variableOverheadPerUnit)
        : Math.round((data.raw + data.sub) * config.overheadRatio);
      const overhead = data.utility + monthlyOther;
      return {
        month,
        rawMaterial: data.raw,
        subMaterial: data.sub,
        labor,
        overhead,
        total: data.raw + data.sub + labor + overhead,
      };
    });

  // 원가 구성비
  const grandTotal = totalRaw + totalSub + totalLabor + totalOverhead;
  const composition = [
    { name: '원재료', value: totalRaw, rate: grandTotal > 0 ? Math.round((totalRaw / grandTotal) * 1000) / 10 : 0 },
    { name: '부재료', value: totalSub, rate: grandTotal > 0 ? Math.round((totalSub / grandTotal) * 1000) / 10 : 0 },
    { name: '노무비', value: totalLabor, rate: grandTotal > 0 ? Math.round((totalLabor / grandTotal) * 1000) / 10 : 0 },
    { name: '경비', value: totalOverhead, rate: grandTotal > 0 ? Math.round((totalOverhead / grandTotal) * 1000) / 10 : 0 },
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
      note: laborIsActual
        ? '반별 근무 기록 기반 실제 노무비'
        : `총 원가(원재료+부재료+경비)의 ${Math.round(config.laborCostRatio * 100)}% 추정값`,
    },
    overheadDetail: {
      utilities: totalUtility,
      other: otherOverhead,
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
  production: ProductionData[]
): BomVarianceInsight {
  if (purchases.length === 0 || production.length === 0) {
    return { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
  }

  // 총 생산량
  const totalProduction = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  if (totalProduction === 0) {
    return { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
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

    const standardPrice = Math.round(base.total / base.qty);
    const actualPrice = Math.round(recent.total / recent.qty);

    // 기준 수량 = (기준 기간 투입량 / 기준 기간 생산량) × 최근 기간 생산량
    const standardRatio = base.qty / baseProdTotal;
    const standardQty = Math.round(standardRatio * recentProdTotal);
    const actualQty = recent.qty;

    // 가격차이 = (실제단가 - 기준단가) × 실제수량
    const priceVariance = (actualPrice - standardPrice) * actualQty;
    // 수량차이 = (실제수량 - 기준수량) × 기준단가
    const qtyVariance = (actualQty - standardQty) * standardPrice;
    const totalVariance = priceVariance + qtyVariance;

    totalPriceVar += priceVariance;
    totalQtyVar += qtyVariance;

    items.push({
      productCode: code,
      productName: base.name || recent.name,
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
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): DashboardInsights {
  const channelRevenue = dailySales.length > 0 ? computeChannelRevenue(dailySales, purchases, channelCosts, config) : null;
  const productProfit = salesDetail.length > 0 ? computeProductProfit(salesDetail, purchases) : null;
  const revenueTrend = dailySales.length > 0 ? computeRevenueTrend(dailySales, purchases, channelCosts, config) : null;
  const materialPrices = purchases.length > 0 ? computeMaterialPrices(purchases) : null;
  const utilityCosts = utilities.length > 0 ? computeUtilityCosts(utilities, production) : null;
  const wasteAnalysis = production.length > 0 ? computeWasteAnalysis(production, config, purchases) : null;
  const productionEfficiency = production.length > 0 ? computeProductionEfficiency(production) : null;

  const costBreakdown = purchases.length > 0
    ? computeCostBreakdown(purchases, utilities, production, config)
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
    ? computeBomVariance(purchases, production)
    : null;

  const recommendations = generateRecommendations(
    materialPrices,
    wasteAnalysis,
    utilityCosts,
    productProfit,
    config
  );

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
  };
}
