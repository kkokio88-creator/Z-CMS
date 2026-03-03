/**
 * Cost Service — 원가 분석 함수 및 타입
 * insightService.ts에서 분리된 cost 도메인 전용 모듈
 */

import type {
  DailySalesData,
  PurchaseData,
  UtilityData,
  LaborDailyData,
  ProductionData,
  BomItemData,
  MaterialMasterItem,
} from './googleSheetService';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG } from '../config/businessConfig';
import type { InventorySafetyItem, DailyPerformanceMetric, StaffingSuggestion, MaterialPriceHistory, MaterialCostImpact, AffectedProduct, PricePoint, BudgetItem, ExpenseSummary, BudgetAlert } from '../types';
import { formatCurrency } from '../utils/format';
import type { ChannelRevenueInsight } from './profitService';
import type { ProfitCenterScoreInsight } from './profitService';
import type { BomVarianceInsight } from './insightService';

// ==============================
// 타입 정의
// ==============================

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
// 원가 초과 원인 분석 타입
// ==============================

export interface CostVarianceDetailItem {
  code: string;
  name: string;
  amount: number;       // 양수=초과, 음수=절감
  description?: string; // 세부설명
}

export interface CostVarianceCategory {
  category: string;     // 카테고리명 (e.g., '원재료 단가 상승', 'BOM 미준수')
  icon: string;         // material icon
  color: string;        // css color
  amount: number;       // 합산 금액
  items: CostVarianceDetailItem[];
}

export interface CostVarianceBreakdown {
  totalExcess: number;           // 총 초과금액 (양수=초과, 음수=절감)
  targetTotal: number;           // 목표 총원가
  actualTotal: number;           // 실제 총원가
  categories: CostVarianceCategory[];
  reconciled: boolean;           // 카테고리합 ≈ totalExcess 여부
}

export interface DailyPerformanceInsight {
  metrics: DailyPerformanceMetric[];
  staffingSuggestions: StaffingSuggestion[];
  avgLaborRatio: number;
  avgMaterialRatio: number;
  onTargetDays: number;
  totalDays: number;
}

export interface MaterialPriceImpactInsight {
  priceHistory: MaterialPriceHistory[];
  impacts: MaterialCostImpact[];
  totalImpact: number;
  highUrgencyCount: number;
}

export interface BudgetExpenseInsight {
  items: BudgetItem[];
  summary: ExpenseSummary;
  alerts: BudgetAlert[];
}

// ==============================
// 분석 함수
// ==============================

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

// ==============================
// 원가 4요소 분석
// ==============================

const SUB_MATERIAL_KEYWORDS = ['포장', '박스', '비닐', '라벨', '테이프', '봉투', '스티커', '밴드', '용기', '캡', '뚜껑'];

/** 부재료 판별: 품목코드 ZIP_S_ 우선, 없으면 키워드 폴백. excludeCodes로 제외 가능 */
export function isSubMaterial(
  productName: string,
  productCode?: string,
  excludeCodes?: string[],
): boolean {
  if (excludeCodes?.length && productCode && excludeCodes.includes(productCode)) return false;
  if (productCode) return productCode.startsWith('ZIP_S_');
  return SUB_MATERIAL_KEYWORDS.some(kw => productName.includes(kw));
}

/** 원가계산 제외 대상 판별 */
export function isCostExcluded(productCode: string, costExcludeCodes?: string[]): boolean {
  return !!costExcludeCodes?.length && costExcludeCodes.includes(productCode);
}

/**
 * 부재료 분류 역산 진단
 * 목표 부재료비에 맞추기 위해 어떤 품목을 제외해야 하는지 분석
 */
export function diagnoseSubMaterialClassification(
  purchases: PurchaseData[],
  targetSubCost: number,
  inventoryAdjustment?: InventoryAdjustment | null,
): {
  currentSubTotal: number;
  targetPurchaseSub: number;
  excess: number;
  subItems: { code: string; name: string; supplyAmt: number; reason: string }[];
  suggestedExclusions: { code: string; name: string; supplyAmt: number; reason: string }[];
} {
  // 역산: targetSubCost = 기초 + purchaseSub - 기말 → purchaseSub = targetSubCost - 기초 + 기말
  const targetPurchaseSub = inventoryAdjustment
    ? targetSubCost - inventoryAdjustment.beginningSubInventoryValue + inventoryAdjustment.endingSubInventoryValue
    : targetSubCost;

  // 현재 부재료 품목 집계 (productCode 기준 그룹)
  const subMap = new Map<string, { name: string; supplyAmt: number; reason: string }>();
  purchases.forEach(p => {
    if (isSubMaterial(p.productName, p.productCode)) {
      const key = p.productCode || `__NAME__${p.productName}`;
      const existing = subMap.get(key) || { name: p.productName, supplyAmt: 0, reason: '' };
      existing.supplyAmt += p.supplyAmount;
      existing.reason = p.productCode?.startsWith('ZIP_S_') ? 'ZIP_S_ 코드' : `키워드(${SUB_MATERIAL_KEYWORDS.find(kw => p.productName.includes(kw)) || '?'})`;
      subMap.set(key, existing);
    }
  });

  const subItems = Array.from(subMap.entries())
    .map(([code, d]) => ({ code, ...d }))
    .sort((a, b) => b.supplyAmt - a.supplyAmt);

  const currentSubTotal = subItems.reduce((s, i) => s + i.supplyAmt, 0);
  const excess = currentSubTotal - targetPurchaseSub;

  // 역산: excess 만큼 제거해야 할 품목 조합 찾기 (greedy: 큰 것부터 제거)
  const suggestedExclusions: typeof subItems = [];
  if (excess > 0) {
    let remaining = excess;
    // 1차: 키워드 매칭 품목 우선 제거 (코드 기반보다 불확실)
    const keywordItems = subItems.filter(i => !i.reason.startsWith('ZIP_S_'));
    const codeItems = subItems.filter(i => i.reason.startsWith('ZIP_S_'));

    for (const item of keywordItems) {
      if (remaining <= 0) break;
      suggestedExclusions.push(item);
      remaining -= item.supplyAmt;
    }
    // 키워드 제거로 부족하면 코드 기반도 제거 시도
    for (const item of codeItems) {
      if (remaining <= 0) break;
      suggestedExclusions.push(item);
      remaining -= item.supplyAmt;
    }
  }

  return { currentSubTotal, targetPurchaseSub, excess, subItems, suggestedExclusions };
}

export function computeCostBreakdown(
  purchases: PurchaseData[],
  utilities: UtilityData[],
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  labor: LaborDailyData[] = [],
  inventoryAdjustment?: InventoryAdjustment | null
): CostBreakdownInsight {
  // 원가계산 제외 품목 필터 + 원재료/부재료 분류
  const rawItems: PurchaseData[] = [];
  const subItems: PurchaseData[] = [];
  purchases.forEach(p => {
    if (isCostExcluded(p.productCode, config.costExcludeCodes)) return; // 원가 제외
    if (isSubMaterial(p.productName, p.productCode, config.subMaterialExcludeCodes)) {
      subItems.push(p);
    } else {
      rawItems.push(p);
    }
  });

  const purchaseRaw = rawItems.reduce((s, p) => s + p.supplyAmount, 0);
  const purchaseSub = subItems.reduce((s, p) => s + p.supplyAmount, 0);

  // 의제 매입세액 공제: 원재료 당기 매입액(공급가액) × 공제율 (원재료에만 적용)
  const rawDeduction = Math.round(purchaseRaw * (config.deemedInputTaxRate || 0));

  // 실제 사용액 = 기초재고 + 당기매입(공급가액) - 기말재고 - 의제매입세 공제
  const totalRaw = (inventoryAdjustment
    ? inventoryAdjustment.beginningRawInventoryValue + purchaseRaw - inventoryAdjustment.endingRawInventoryValue
    : purchaseRaw) - rawDeduction;

  // 부재료: 의제매입세 공제 미적용
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
    existing.raw += p.supplyAmount;
    monthlyMap.set(month, existing);
  });
  subItems.forEach(p => {
    const month = p.date.slice(0, 7);
    const existing = monthlyMap.get(month) || { raw: 0, sub: 0, utility: 0, laborPay: 0 };
    existing.sub += p.supplyAmount;
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

  // 원재료 상세 (공급가액 기준)
  const rawDetailMap = new Map<string, { name: string; total: number; qty: number }>();
  rawItems.forEach(p => {
    const existing = rawDetailMap.get(p.productCode) || { name: p.productName, total: 0, qty: 0 };
    existing.total += p.supplyAmount;
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

  // 부재료 상세 (공급가액 기준)
  const subDetailMap = new Map<string, { name: string; total: number; qty: number }>();
  subItems.forEach(p => {
    const existing = subDetailMap.get(p.productCode) || { name: p.productName, total: 0, qty: 0 };
    existing.total += p.supplyAmount;
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
// P4-4 현금 흐름 대시보드
// ==============================

export function computeCashFlow(
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
// 원가 초과 원인 분석 (Cost Variance Breakdown)
// ==============================

/**
 * 원가 초과 원인 분석
 * profitCenterScore의 목표/실적 차이를 카테고리별로 분해
 * bomVariance가 있으면 원재료를 단가차이/수량차이로 세분화
 */
export function computeCostVarianceBreakdown(
  profitCenterScore: ProfitCenterScoreInsight,
  bomVariance: BomVarianceInsight | null,
): CostVarianceBreakdown {
  const categories: CostVarianceCategory[] = [];
  let targetTotal = 0;
  let actualTotal = 0;

  // 금액 기반 항목만 처리 (폐기율 제외 — 비율 지표)
  const costMetrics = profitCenterScore.scores.filter(
    s => s.targetAmount != null && s.actualAmount != null && s.unit === '배'
  );

  for (const metric of costMetrics) {
    const target = metric.targetAmount!;
    const actual = metric.actualAmount!;
    targetTotal += target;
    actualTotal += actual;
  }

  const totalExcess = actualTotal - targetTotal;

  // 원재료: bomVariance가 있으면 단가/수량 분해, 없으면 단일 카테고리
  const rawMetric = costMetrics.find(m => m.metric === '원재료');
  if (rawMetric) {
    const rawExcess = rawMetric.actualAmount! - rawMetric.targetAmount!;

    if (bomVariance && bomVariance.items.length > 0) {
      // BOM 비율 기반: 단가차이 vs 수량차이 비율을 구하고 rawExcess에 스케일링
      const bomPriceRaw = bomVariance.totalPriceVariance;
      const bomQtyRaw = bomVariance.totalQtyVariance;
      const bomTotalRaw = bomPriceRaw + bomQtyRaw;

      // 스케일 팩터: BOM 분석 비율로 rawExcess를 분해
      // bomTotal이 0이면 (차이 없음) rawExcess를 그대로 기타로
      const scale = bomTotalRaw !== 0 ? rawExcess / bomTotalRaw : 0;
      const scaledPrice = Math.round(bomPriceRaw * scale);
      const scaledQty = rawExcess - scaledPrice; // 나머지를 수량에 배정 (합산 보장)

      // 품목별 세부내역 (스케일 적용)
      const priceItems: CostVarianceDetailItem[] = [];
      const qtyItems: CostVarianceDetailItem[] = [];

      for (const item of bomVariance.items) {
        if (item.priceVariance !== 0) {
          const scaledAmt = bomPriceRaw !== 0 ? Math.round(item.priceVariance / bomPriceRaw * scaledPrice) : 0;
          priceItems.push({
            code: item.productCode,
            name: item.productName,
            amount: scaledAmt,
            description: `단가 ${formatCurrency(item.standardPrice)} → ${formatCurrency(item.actualPrice)} (${item.actualQty.toLocaleString()}${item.unit})`,
          });
        }
        if (item.qtyVariance !== 0) {
          const scaledAmt = bomQtyRaw !== 0 ? Math.round(item.qtyVariance / bomQtyRaw * scaledQty) : 0;
          qtyItems.push({
            code: item.productCode,
            name: item.productName,
            amount: scaledAmt,
            description: `기준 ${item.standardQty.toLocaleString()} → 실제 ${item.actualQty.toLocaleString()} ${item.unit}`,
          });
        }
      }

      priceItems.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      qtyItems.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      if (scaledPrice !== 0) {
        categories.push({
          category: '원재료 단가 변동',
          icon: 'trending_up',
          color: '#3B82F6',
          amount: scaledPrice,
          items: priceItems,
        });
      }
      if (scaledQty !== 0) {
        categories.push({
          category: 'BOM 미준수 (수량 차이)',
          icon: 'science',
          color: '#8B5CF6',
          amount: scaledQty,
          items: qtyItems,
        });
      }
    } else {
      // BOM 없이 원재료 단일 카테고리
      categories.push({
        category: '원재료비 차이',
        icon: 'inventory_2',
        color: '#3B82F6',
        amount: rawExcess,
        items: [{
          code: 'raw_total',
          name: '원재료비 (목표 대비)',
          amount: rawExcess,
          description: `목표 ${formatCurrency(rawMetric.targetAmount!)} / 실적 ${formatCurrency(rawMetric.actualAmount!)}`,
        }],
      });
    }
  }

  // 부재료
  const subMetric = costMetrics.find(m => m.metric === '부재료');
  if (subMetric) {
    const subExcess = subMetric.actualAmount! - subMetric.targetAmount!;
    categories.push({
      category: '부재료비 차이',
      icon: 'category',
      color: '#10B981',
      amount: subExcess,
      items: [{
        code: 'sub_total',
        name: '부재료비 (목표 대비)',
        amount: subExcess,
        description: `목표 ${formatCurrency(subMetric.targetAmount!)} / 실적 ${formatCurrency(subMetric.actualAmount!)}`,
      }],
    });
  }

  // 노무비
  const laborMetric = costMetrics.find(m => m.metric === '노무비');
  if (laborMetric) {
    const laborExcess = laborMetric.actualAmount! - laborMetric.targetAmount!;
    categories.push({
      category: '노무비 차이',
      icon: 'groups',
      color: '#F59E0B',
      amount: laborExcess,
      items: [{
        code: 'labor_total',
        name: '노무비 (목표 대비)',
        amount: laborExcess,
        description: `목표 ${formatCurrency(laborMetric.targetAmount!)} / 실적 ${formatCurrency(laborMetric.actualAmount!)}`,
      }],
    });
  }

  // 수도광열전력
  const overheadMetric = costMetrics.find(m => m.metric === '수도광열전력');
  if (overheadMetric) {
    const ohExcess = overheadMetric.actualAmount! - overheadMetric.targetAmount!;
    categories.push({
      category: '수도광열전력 차이',
      icon: 'bolt',
      color: '#EF4444',
      amount: ohExcess,
      items: [{
        code: 'overhead_total',
        name: '수도광열전력 (목표 대비)',
        amount: ohExcess,
        description: `목표 ${formatCurrency(overheadMetric.targetAmount!)} / 실적 ${formatCurrency(overheadMetric.actualAmount!)}`,
      }],
    });
  }

  // 카테고리합 vs 총초과 정합성 확인
  const categorySum = categories.reduce((s, c) => s + c.amount, 0);
  const reconciled = Math.abs(categorySum - totalExcess) < 10000; // 1만원 이내 오차 허용

  return { totalExcess, targetTotal, actualTotal, categories, reconciled };
}

// ──── US-001: 일별 성과 분석 ────

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function determineStatus(actual: number, target: number, tolerance: number = 5): import('../types').PerformanceStatus {
  const diff = actual - target;
  if (Math.abs(diff) <= tolerance) return 'on-target';
  return diff > 0 ? 'above-target' : 'below-target';
}

export function computeDailyPerformance(
  labor: LaborDailyData[],
  production: ProductionData[],
  dailySales: DailySalesData[],
  purchases: PurchaseData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG
): DailyPerformanceInsight | null {
  if (labor.length === 0 || dailySales.length === 0) return null;

  const targetLaborRatio = (config as any).targetLaborRatio ?? 25;
  const targetMaterialRatio = (config as any).targetMaterialRatio ?? 45;

  // 일별 매출 맵
  const salesByDate = new Map<string, number>();
  for (const s of dailySales) salesByDate.set(s.date, (salesByDate.get(s.date) || 0) + s.totalRevenue);

  // 일별 노무비 맵
  const laborByDate = new Map<string, { totalPay: number; headcount: number; departments: Set<string> }>();
  for (const l of labor) {
    const agg = laborByDate.get(l.date) || { totalPay: 0, headcount: 0, departments: new Set<string>() };
    agg.totalPay += l.totalPay;
    agg.headcount += l.headcount;
    agg.departments.add(l.department);
    laborByDate.set(l.date, agg);
  }

  // 일별 구매비 맵
  const purchaseByDate = new Map<string, number>();
  for (const p of purchases) purchaseByDate.set(p.date, (purchaseByDate.get(p.date) || 0) + p.total);

  // 일별 생산량 맵
  const prodByDate = new Map<string, number>();
  for (const p of production) prodByDate.set(p.date, (prodByDate.get(p.date) || 0) + p.prodQtyTotal);

  // 전체 날짜 집합 (매출 기준)
  const allDates = [...salesByDate.keys()].sort();

  const metrics: DailyPerformanceMetric[] = [];
  const suggestions: StaffingSuggestion[] = [];

  for (const date of allDates) {
    const revenue = salesByDate.get(date) || 0;
    if (revenue <= 0) continue;

    const laborData = laborByDate.get(date);
    const laborCost = laborData?.totalPay || 0;
    const materialCost = purchaseByDate.get(date) || 0;
    const productionQty = prodByDate.get(date) || 0;

    const actualLaborRatio = revenue > 0 ? Math.round((laborCost / revenue) * 1000) / 10 : 0;
    const actualMaterialRatio = revenue > 0 ? Math.round((materialCost / revenue) * 1000) / 10 : 0;

    const laborVariance = Math.round((actualLaborRatio - targetLaborRatio) * 10) / 10;
    const materialVariance = Math.round((actualMaterialRatio - targetMaterialRatio) * 10) / 10;

    const laborStatus = determineStatus(actualLaborRatio, targetLaborRatio);
    const materialStatus = determineStatus(actualMaterialRatio, targetMaterialRatio);

    const efficiency = productionQty > 0 && revenue > 0
      ? Math.round((productionQty / (revenue / 10000)) * 10) / 10 // 만원당 생산량
      : 0;

    const overallStatus = laborStatus === 'on-target' && materialStatus === 'on-target'
      ? 'on-target'
      : (laborStatus === 'above-target' || materialStatus === 'above-target') ? 'above-target' : 'below-target';

    const dayOfWeek = DAY_NAMES[new Date(date).getDay()];

    metrics.push({
      date,
      dayOfWeek,
      productionQty,
      productionTarget: 0, // 생산 목표는 설정에 없으므로 0
      productionAchievement: 0,
      targetLaborRatio,
      actualLaborRatio,
      laborCost,
      laborVariance,
      laborStatus,
      targetMaterialRatio,
      actualMaterialRatio,
      materialCost,
      materialVariance,
      materialStatus,
      efficiency,
      overallStatus,
    });

    // 노무비 목표 초과 시 인력 조정 제안
    if (laborStatus === 'above-target' && laborData) {
      const suggestedCost = revenue * (targetLaborRatio / 100);
      const reduction = Math.ceil((laborCost - suggestedCost) / (laborCost / laborData.headcount));
      if (reduction > 0) {
        suggestions.push({
          date,
          department: [...laborData.departments].join(', '),
          currentHeadcount: laborData.headcount,
          suggestedHeadcount: Math.max(1, laborData.headcount - reduction),
          reason: `노무비율 ${actualLaborRatio}% (목표 ${targetLaborRatio}%)`,
          priority: laborVariance > 10 ? 'high' : laborVariance > 5 ? 'medium' : 'low',
        });
      }
    }
  }

  const avgLaborRatio = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.actualLaborRatio, 0) / metrics.length * 10) / 10
    : 0;
  const avgMaterialRatio = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.actualMaterialRatio, 0) / metrics.length * 10) / 10
    : 0;
  const onTargetDays = metrics.filter(m => m.overallStatus === 'on-target').length;

  return {
    metrics,
    staffingSuggestions: suggestions,
    avgLaborRatio,
    avgMaterialRatio,
    onTargetDays,
    totalDays: metrics.length,
  };
}

// ──── US-002: 자재 단가 영향 분석 ────

export function computeMaterialPriceImpact(
  purchases: PurchaseData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[]
): MaterialPriceImpactInsight | null {
  if (purchases.length === 0) return null;

  // 자재별 일별 단가 이력 수집
  const materialMap = new Map<string, {
    name: string; category: string; unit: string;
    points: PricePoint[];
  }>();

  for (const p of purchases) {
    const code = p.productCode?.trim();
    if (!code || p.quantity <= 0) continue;
    const unitPrice = Math.round(p.total / p.quantity);
    let entry = materialMap.get(code);
    if (!entry) {
      const mm = materialMaster.find(m => m.materialCode?.trim() === code);
      entry = {
        name: p.productName || code,
        category: mm?.category || '',
        unit: mm?.unit || '',
        points: [],
      };
      materialMap.set(code, entry);
    }
    entry.points.push({ date: p.date, unitPrice, supplierName: p.supplierName });
  }

  const now = new Date();
  const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
  const oneMonthAgo = new Date(now); oneMonthAgo.setDate(now.getDate() - 30);
  const weekStr = oneWeekAgo.toISOString().slice(0, 10);
  const monthStr = oneMonthAgo.toISOString().slice(0, 10);

  const priceHistory: MaterialPriceHistory[] = [];

  for (const [code, entry] of materialMap) {
    if (entry.points.length < 2) continue;
    const sorted = [...entry.points].sort((a, b) => a.date.localeCompare(b.date));
    const currentPrice = sorted[sorted.length - 1].unitPrice;

    // 최근 1주/1개월 평균
    const weekPoints = sorted.filter(p => p.date >= weekStr);
    const monthPoints = sorted.filter(p => p.date >= monthStr);
    const olderWeekPoints = sorted.filter(p => p.date < weekStr);
    const olderMonthPoints = sorted.filter(p => p.date < monthStr);

    const previousWeekPrice = olderWeekPoints.length > 0
      ? Math.round(olderWeekPoints.slice(-5).reduce((s, p) => s + p.unitPrice, 0) / Math.min(olderWeekPoints.length, 5))
      : currentPrice;
    const previousMonthPrice = olderMonthPoints.length > 0
      ? Math.round(olderMonthPoints.slice(-10).reduce((s, p) => s + p.unitPrice, 0) / Math.min(olderMonthPoints.length, 10))
      : currentPrice;

    const avgPrice30Days = monthPoints.length > 0
      ? Math.round(monthPoints.reduce((s, p) => s + p.unitPrice, 0) / monthPoints.length)
      : currentPrice;

    const priceChangeWeek = previousWeekPrice > 0
      ? Math.round((currentPrice - previousWeekPrice) / previousWeekPrice * 1000) / 10
      : 0;
    const priceChangeMonth = previousMonthPrice > 0
      ? Math.round((currentPrice - previousMonthPrice) / previousMonthPrice * 1000) / 10
      : 0;

    priceHistory.push({
      materialCode: code,
      materialName: entry.name,
      category: entry.category,
      unit: entry.unit,
      priceHistory: sorted,
      currentPrice,
      previousWeekPrice,
      previousMonthPrice,
      priceChangeWeek,
      priceChangeMonth,
      avgPrice30Days,
    });
  }

  // 단가 변동 5% 이상인 자재의 BOM 연결 제품 영향 분석
  const impacts: MaterialCostImpact[] = [];

  for (const mat of priceHistory) {
    if (Math.abs(mat.priceChangeMonth) < 5) continue;

    const priceIncrease = mat.currentPrice - mat.previousMonthPrice;

    // BOM에서 해당 자재를 사용하는 제품 조회
    const relatedBom = bomData.filter(b => b.materialCode?.trim() === mat.materialCode);
    const affectedProducts: AffectedProduct[] = relatedBom.map(bom => {
      const bomQty = (bom.consumptionQty || 0) / (bom.productionQty || 1);
      const currentCost = Math.round(bomQty * mat.previousMonthPrice);
      const newCost = Math.round(bomQty * mat.currentPrice);
      return {
        productCode: bom.productCode || '',
        productName: bom.productName || bom.productCode || '',
        bomQty: Math.round(bomQty * 100) / 100,
        currentCost,
        newCost,
        deltaCost: newCost - currentCost,
        deltaPercent: currentCost > 0 ? Math.round((newCost - currentCost) / currentCost * 1000) / 10 : 0,
      };
    });

    const totalDeltaCost = affectedProducts.reduce((s, p) => s + p.deltaCost, 0);
    const absPct = Math.abs(mat.priceChangeMonth);
    const urgencyLevel: import('../types').AnomalyLevel = absPct >= 10 ? 'critical' : absPct >= 5 ? 'warning' : 'normal';

    impacts.push({
      materialCode: mat.materialCode,
      materialName: mat.materialName,
      priceIncrease,
      priceIncreasePercent: mat.priceChangeMonth,
      affectedProducts,
      totalDeltaCost,
      urgencyLevel,
    });
  }

  impacts.sort((a, b) => Math.abs(b.totalDeltaCost) - Math.abs(a.totalDeltaCost));

  return {
    priceHistory: priceHistory.sort((a, b) => Math.abs(b.priceChangeMonth) - Math.abs(a.priceChangeMonth)),
    impacts,
    totalImpact: impacts.reduce((s, i) => s + i.totalDeltaCost, 0),
    highUrgencyCount: impacts.filter(i => i.urgencyLevel === 'critical').length,
  };
}

// ==============================
// US-004: Budget Expense Analysis
// ==============================

export function computeBudgetExpense(
  purchases: PurchaseData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
): BudgetExpenseInsight {
  // 공급처별 집계 → BudgetItem으로 변환
  // 변동비(원재료/부재료): 대부분 구매 항목, 고정비: 임대/관리 등
  const isFixed = (name: string): boolean => {
    const n = name.toLowerCase();
    return n.includes('임대') || n.includes('보험') || n.includes('감가') || n.includes('리스');
  };

  // 공급처별 집계
  const vendorTotals = new Map<string, { name: string; total: number; category: 'fixed' | 'variable' }>();
  for (const p of purchases) {
    const vendorKey = p.supplierName || p.productName || '기타';
    const existing = vendorTotals.get(vendorKey);
    if (existing) {
      existing.total += p.total;
    } else {
      vendorTotals.set(vendorKey, {
        name: vendorKey,
        total: p.total,
        category: isFixed(p.productName) ? 'fixed' : 'variable',
      });
    }
  }

  // 월간 예산 추정 (실적의 110%)
  const totalUsed = purchases.reduce((s, p) => s + p.total, 0);
  const monthlyBudget = (config as any).monthlyBudget ?? Math.round(totalUsed * 1.1);

  // 경과일 / 잔여일 계산
  const now = new Date();
  const daysElapsed = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDay - daysElapsed;

  const items: BudgetItem[] = [];
  let itemIdx = 0;
  for (const [vendorKey, vendor] of vendorTotals) {
    const budgetRatio = totalUsed > 0 ? vendor.total / totalUsed : 0;
    const budget = Math.round(monthlyBudget * budgetRatio);
    const burnRate = budget > 0 ? Math.round(vendor.total / budget * 1000) / 10 : 0;
    const dailyBurn = daysElapsed > 0 ? Math.round(vendor.total / daysElapsed) : 0;
    const projectedTotal = dailyBurn * lastDay;
    const projectedOverrun = Math.max(0, projectedTotal - budget);
    const status: import('../types').BudgetStatus = burnRate > 90 ? 'critical' : burnRate > 80 ? 'warning' : 'normal';

    items.push({
      id: `budget-${++itemIdx}`,
      category: vendor.category,
      accountCode: `ACC-${String(itemIdx).padStart(3, '0')}`,
      accountName: vendor.name,
      vendorId: vendorKey,
      vendorName: vendor.name,
      budgetAmount: budget,
      usedAmount: vendor.total,
      remainingAmount: budget - vendor.total,
      burnRate,
      dailyBurnRate: dailyBurn,
      projectedTotal,
      projectedOverrun,
      daysElapsed,
      daysRemaining,
      status,
      lastUpdated: now.toISOString(),
    });
  }

  items.sort((a, b) => b.burnRate - a.burnRate);

  const fixedItems = items.filter(i => i.category === 'fixed');
  const variableItems = items.filter(i => i.category === 'variable');
  const totalBudget = items.reduce((s, i) => s + i.budgetAmount, 0);
  const totalUsedAmt = items.reduce((s, i) => s + i.usedAmount, 0);
  const overallBurnRate = totalBudget > 0 ? Math.round(totalUsedAmt / totalBudget * 1000) / 10 : 0;
  const dailyAvgAll = daysElapsed > 0 ? Math.round(totalUsedAmt / daysElapsed) : 0;
  const projectedMonthEnd = dailyAvgAll * lastDay;

  const summary: ExpenseSummary = {
    period: now.toISOString().slice(0, 7),
    totalBudget,
    totalUsed: totalUsedAmt,
    totalRemaining: totalBudget - totalUsedAmt,
    overallBurnRate,
    fixedCostBudget: fixedItems.reduce((s, i) => s + i.budgetAmount, 0),
    fixedCostUsed: fixedItems.reduce((s, i) => s + i.usedAmount, 0),
    variableCostBudget: variableItems.reduce((s, i) => s + i.budgetAmount, 0),
    variableCostUsed: variableItems.reduce((s, i) => s + i.usedAmount, 0),
    overrunRisk: projectedMonthEnd > totalBudget,
    projectedMonthEnd,
    healthScore: Math.max(0, Math.min(100, Math.round(100 - overallBurnRate + 10))),
  };

  const alerts: BudgetAlert[] = items
    .filter(i => i.burnRate > 80)
    .map((i, idx) => ({
      id: `alert-${idx + 1}`,
      budgetItemId: i.id,
      accountName: i.accountName,
      alertType: (i.burnRate > 100 ? 'exceeded' : 'approaching') as 'approaching' | 'exceeded' | 'irregular',
      message: i.burnRate > 100
        ? `${i.accountName} 예산 초과 (${i.burnRate}%)`
        : `${i.accountName} 예산 소진율 ${i.burnRate}% 도달`,
      severity: (i.burnRate > 90 ? 'critical' : 'warning') as import('../types').BudgetStatus,
      createdAt: now.toISOString(),
      acknowledged: false,
    }));

  return { items, summary, alerts };
}
