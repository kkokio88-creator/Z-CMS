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

// ==============================
// 타입 정의
// ==============================

export interface ChannelRevenueInsight {
  channels: { name: string; revenue: number; share: number }[];
  dailyTrend: { date: string; jasa: number; coupang: number; kurly: number; total: number }[];
  totalRevenue: number;
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
    profit: number;
    marginRate: number;
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
}

// ==============================
// 분석 함수
// ==============================

export function computeChannelRevenue(dailySales: DailySalesData[]): ChannelRevenueInsight {
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

  const channels = [
    { name: '자사몰', revenue: totalJasa, share: totalRevenue > 0 ? (totalJasa / totalRevenue) * 100 : 0 },
    { name: '쿠팡', revenue: totalCoupang, share: totalRevenue > 0 ? (totalCoupang / totalRevenue) * 100 : 0 },
    { name: '컬리', revenue: totalKurly, share: totalRevenue > 0 ? (totalKurly / totalRevenue) * 100 : 0 },
  ];

  return { channels, dailyTrend, totalRevenue };
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
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): RevenueTrendInsight {
  const marginRate = config.defaultMarginRate;
  // 월별 그룹핑
  const monthlyMap = new Map<string, { revenue: number; count: number }>();
  dailySales.forEach(d => {
    const month = d.date.slice(0, 7); // YYYY-MM
    const existing = monthlyMap.get(month) || { revenue: 0, count: 0 };
    existing.revenue += d.totalRevenue;
    existing.count++;
    monthlyMap.set(month, existing);
  });

  const months = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      profit: Math.round(data.revenue * marginRate),
      marginRate: Math.round(marginRate * 100),
      count: data.count,
    }));

  // 전월 대비 변동률 계산
  const monthly = months.map((m, idx) => ({
    month: m.month,
    revenue: m.revenue,
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
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): WasteAnalysisInsight {
  const costPerUnit = config.wasteUnitCost;
  let totalEstimatedCost = 0;

  const daily = production.map(p => {
    const estimatedCost = p.wasteFinishedEa * costPerUnit;
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
    .map(d => ({ date: d.date, rate: d.wasteFinishedPct, qty: d.wasteFinishedEa }));

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
  // 노무비 추정: 총 원가(원재료+부재료+공과금)의 설정 비율로 추정
  const totalLabor = Math.round((totalRaw + totalSub + totalUtility) * config.laborCostRatio);
  // 경비 = 공과금 + 기타 간접비(총 구매비의 설정 비율)
  const otherOverhead = Math.round((totalRaw + totalSub) * config.overheadRatio);
  const totalOverhead = totalUtility + otherOverhead;

  // 월별 4요소 원가 추이
  const monthlyMap = new Map<string, { raw: number; sub: number; overhead: number }>();

  rawItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, overhead: 0 };
    existing.raw += p.total;
    monthlyMap.set(month, existing);
  });
  subItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, overhead: 0 };
    existing.sub += p.total;
    monthlyMap.set(month, existing);
  });
  utilities.forEach(u => {
    const month = u.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, overhead: 0 };
    existing.overhead += u.elecCost + u.waterCost + u.gasCost;
    monthlyMap.set(month, existing);
  });

  const monthly = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      const labor = Math.round((data.raw + data.sub + data.overhead) * config.laborCostRatio);
      const overhead = data.overhead + Math.round((data.raw + data.sub) * config.overheadRatio);
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
      note: `총 원가(원재료+부재료+경비)의 ${Math.round(config.laborCostRatio * 100)}% 추정값`,
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
// 통합 인사이트 계산
// ==============================

export function computeAllInsights(
  dailySales: DailySalesData[],
  salesDetail: SalesDetailData[],
  production: ProductionData[],
  purchases: PurchaseData[],
  utilities: UtilityData[],
  inventoryData?: InventorySafetyItem[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): DashboardInsights {
  const channelRevenue = dailySales.length > 0 ? computeChannelRevenue(dailySales) : null;
  const productProfit = salesDetail.length > 0 ? computeProductProfit(salesDetail, purchases) : null;
  const revenueTrend = dailySales.length > 0 ? computeRevenueTrend(dailySales, config) : null;
  const materialPrices = purchases.length > 0 ? computeMaterialPrices(purchases) : null;
  const utilityCosts = utilities.length > 0 ? computeUtilityCosts(utilities, production) : null;
  const wasteAnalysis = production.length > 0 ? computeWasteAnalysis(production, config) : null;
  const productionEfficiency = production.length > 0 ? computeProductionEfficiency(production) : null;

  const costBreakdown = purchases.length > 0
    ? computeCostBreakdown(purchases, utilities, production, config)
    : null;

  const statisticalOrder = (inventoryData && inventoryData.length > 0 && purchases.length > 0)
    ? computeStatisticalOrder(inventoryData, purchases, config)
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
  };
}
