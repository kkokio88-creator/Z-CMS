/**
 * Profit Service — 수익성 분석 함수 및 타입
 * insightService.ts에서 분리된 profit 도메인 전용 모듈
 */

import type {
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
} from './googleSheetService';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG, ProfitCenterGoal } from '../config/businessConfig';
import type { ChannelCostSummary } from '../components/domain';
import { interpolateBracket } from '../utils/costScoring';
import type { CostBreakdownInsight, WasteAnalysisInsight } from './insightService';

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
  rawSupplyAmount: number;     // 공급가액 (ECOUNT 원본)
  promotionDiscountAmount: number; // 할인매출 (공급가액 × 할인매출비율)
  settlementRevenue: number;   // 정산매출 = 공급가액 - 할인매출
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
  totalRawSupplyAmount: number;
  totalPromotionDiscountAmount: number;
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
    recommendedRevenue: number;
    commissionRate: number;
    cost: number;
    margin: number;
    marginRate: number;
    quantity: number;
  }[];
  totalRevenue: number;
  totalRecommendedRevenue: number;
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
  deemedInputTaxCredit: number;
}

// ==============================
// 분석 함수
// ==============================

export function computeChannelRevenue(
  dailySales: DailySalesData[],
  purchases: PurchaseData[] = [],
  channelCosts: ChannelCostSummary[] = [],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  salesDetail: SalesDetailData[] = []
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

  // salesDetail에서 채널별 정산매출(공급가액) + 권장판매매출 직접 집계
  const channelSettlementMap = new Map<string, number>();
  const channelRecommendedMap = new Map<string, number>();
  if (salesDetail.length > 0) {
    salesDetail.forEach(s => {
      const ch = s.customer || '';
      channelSettlementMap.set(ch, (channelSettlementMap.get(ch) || 0) + (s.supplyAmount || 0));
      if (s.recommendedRevenue > 0) {
        channelRecommendedMap.set(ch, (channelRecommendedMap.get(ch) || 0) + s.recommendedRevenue);
      }
    });
  }

  // 채널명 매핑 (거래처명 → 채널명)
  const resolveChannelMap = (channelName: string, map: Map<string, number>): number => {
    // 직접 매치
    if (map.has(channelName)) return map.get(channelName)!;
    // 부분 매치 시도
    for (const [key, val] of map) {
      const lower = key.toLowerCase();
      if (channelName === '자사몰' && (lower.includes('자사') || lower.includes('jasa') || lower.includes('고도몰') || lower.includes('집반찬'))) return val;
      if (channelName === '쿠팡' && (lower.includes('쿠팡') || lower.includes('포워드'))) return val;
      if (channelName === '컬리' && lower.includes('컬리')) return val;
    }
    return 0;
  };

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
  let sumRawSupply = 0, sumPromoDiscount = 0;

  const hasDetailData = channelSettlementMap.size > 0 || channelRecommendedMap.size > 0;

  const channels: ChannelProfitDetail[] = channelData.map(ch => {
    const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
    const cc = costMap.get(ch.name);

    // === 5단계 수익 구조 ===
    const discountRate = (cc?.discountRate ?? 0) / 100;
    const commissionRate = (cc?.commissionRate ?? 0) / 100;

    // 공급가액: salesDetail 공급가액 합계 우선, 없으면 dailySales 폴백
    let rawSupplyAmount: number;
    if (hasDetailData && channelSettlementMap.size > 0) {
      const directSettlement = resolveChannelMap(ch.name, channelSettlementMap);
      rawSupplyAmount = directSettlement > 0 ? directSettlement : ch.revenue;
    } else {
      rawSupplyAmount = ch.revenue;
    }

    // 정산매출 = 공급가액 - 할인매출 (promotionDiscountRate 적용)
    const promoRate = (cc?.promotionDiscountRate ?? 0) / 100;
    const promotionDiscountAmount = Math.round(rawSupplyAmount * promoRate);
    const settlementRevenue = rawSupplyAmount - promotionDiscountAmount;

    // 권장판매매출: salesDetail 실측값 우선, 없으면 역산 폴백
    let recommendedRevenue: number;
    if (hasDetailData && channelRecommendedMap.size > 0) {
      const directRecommended = resolveChannelMap(ch.name, channelRecommendedMap);
      recommendedRevenue = directRecommended > 0 ? directRecommended : settlementRevenue;
    } else {
      const denominator = 1 - discountRate - commissionRate;
      recommendedRevenue = denominator > 0
        ? Math.round(settlementRevenue / denominator)
        : settlementRevenue;
    }
    const discountAmount = Math.round(recommendedRevenue * discountRate);
    const commissionAmount = recommendedRevenue - rawSupplyAmount - discountAmount;

    // 재료비 = (권장판매가 / 1.1) × 50%  (부가세 제외 후 50%)
    const materialCost = Math.round((recommendedRevenue / 1.1) * 0.5);

    // 기존 호환용 directCost
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
    sumRawSupply += rawSupplyAmount;
    sumPromoDiscount += promotionDiscountAmount;

    return {
      name: ch.name, revenue: ch.revenue, share,
      recommendedRevenue, discountAmount, commissionAmount,
      rawSupplyAmount, promotionDiscountAmount, settlementRevenue,
      materialCost, directCost, profit1, channelVariableCost, profit2, channelFixedCost, profit3,
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
    totalRawSupplyAmount: sumRawSupply,
    totalPromotionDiscountAmount: sumPromoDiscount,
    totalMaterialCost: sumMaterial,
    totalDirectCost: sumDirectCost,
    totalProfit1: sumProfit1, totalProfit2: sumProfit2, totalProfit3: sumProfit3,
  };
}

export function computeProductProfit(
  salesDetail: SalesDetailData[],
  purchases: PurchaseData[]
): ProductProfitInsight {
  // 품목별 매출 집계 (정산매출=공급가액, 권장판매매출)
  const revenueMap = new Map<string, { name: string; revenue: number; recommendedRevenue: number; qty: number }>();
  salesDetail.forEach(s => {
    const existing = revenueMap.get(s.productCode) || { name: s.productName, revenue: 0, recommendedRevenue: 0, qty: 0 };
    existing.revenue += s.supplyAmount;
    existing.recommendedRevenue += (s.recommendedRevenue || 0);
    existing.qty += s.quantity;
    revenueMap.set(s.productCode, existing);
  });

  // 품목별 구매비용 집계
  const costMap = new Map<string, number>();
  purchases.forEach(p => {
    costMap.set(p.productCode, (costMap.get(p.productCode) || 0) + p.total);
  });

  let totalRevenue = 0, totalRecommendedRevenue = 0, totalCost = 0;

  const items = Array.from(revenueMap.entries()).map(([code, data]) => {
    const cost = costMap.get(code) || 0;
    const margin = data.revenue - cost;
    const marginRate = data.revenue > 0 ? (margin / data.revenue) * 100 : 0;
    // 수수료율 역산: 1 - (정산매출 / 권장판매매출)
    const commissionRate = data.recommendedRevenue > 0
      ? Math.round((1 - data.revenue / data.recommendedRevenue) * 1000) / 10
      : 0;
    totalRevenue += data.revenue;
    totalRecommendedRevenue += data.recommendedRevenue;
    totalCost += cost;
    return {
      productCode: code,
      productName: data.name,
      revenue: data.revenue,
      recommendedRevenue: data.recommendedRevenue,
      commissionRate,
      cost,
      margin,
      marginRate: Math.round(marginRate * 10) / 10,
      quantity: data.qty,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    items,
    totalRevenue,
    totalRecommendedRevenue,
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

  // 매출구간 결정: 정산매출(공급가액 - 프로모할인) 기준, salesDetail 없으면 dailySales 폴백
  const settlementRevenue = channelRevenue.totalRawSupplyAmount > 0
    ? channelRevenue.totalRawSupplyAmount - channelRevenue.totalPromotionDiscountAmount
    : channelRevenue.totalRevenue;
  const monthlySettlement = Math.round(settlementRevenue * 30 / calendarDays);

  // 점수 계산용: 생산매출 (= 권장판매가 × 50%)
  const revenue = channelRevenue.totalProductionRevenue;
  const monthlyRevenue = monthlySettlement; // UI 표시용 = 정산매출 기준 월매출

  // 권장판매 매출 기준 선형 보간 (두 구간 사이 목표를 비례 산출)
  const monthlyRecommendedRevenue = Math.round(channelRevenue.totalRecommendedRevenue * 30 / calendarDays);
  const activeBracket = interpolateBracket(goals, monthlyRecommendedRevenue);

  const targets = activeBracket.targets;
  const comp = costBreakdown.composition;
  // composition 값은 computeCostBreakdown에서 이미 의제매입세 공제 + 재고조정 적용됨
  const rawMaterial = comp.find(c => c.name === '원재료')?.value || 0;
  const subMaterial = comp.find(c => c.name === '부재료')?.value || 0;
  const laborCost = comp.find(c => c.name === '노무비')?.value || 0;
  const overheadCost = comp.find(c => c.name === '수도광열전력')?.value || 0;

  // 의제 매입세액 공제액 (UI 표시용, 원재료에만 적용됨)
  const deemedInputTaxCredit = Math.round(
    rawMaterial * (config.deemedInputTaxRate || 0) / (1 - (config.deemedInputTaxRate || 0))
  );

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

  return { activeBracket, monthlyRevenue, calendarDays, scores, overallScore, deemedInputTaxCredit };
}
