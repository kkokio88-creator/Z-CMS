/**
 * Inventory Insight Service — 재고 분석 함수 및 타입
 * insightService.ts에서 분리된 inventory 도메인 전용 모듈
 */

import type {
  PurchaseData,
  InventorySnapshotData,
} from './googleSheetService';
import { getZScore } from './orderingService';
import type { InventorySafetyItem, InventoryDiscrepancyItem } from '../types';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG } from '../config/businessConfig';
import type { MaterialPriceInsight, UtilityCostInsight } from './costService';
import type { ProductProfitInsight } from './profitService';
import type { WasteAnalysisInsight } from './insightService';

// ==============================
// 타입 정의
// ==============================

export interface CostRecommendation {
  id: string;
  type: 'material' | 'waste' | 'utility' | 'margin';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSaving: number;
  evidence: string;
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

// ==============================
// P4-5 재고비용 최적화
// ==============================

export function computeInventoryCost(
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
