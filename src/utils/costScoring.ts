/**
 * 원가관리 점수 평가 시스템
 * 매출/원가 배수 기반으로 4개 항목(원재료/부재료/노무비/수도광열전력)을 점수화
 */
import type { ProfitCenterGoal, BusinessConfig } from '../config/businessConfig';
import type { DailySalesData, PurchaseData, UtilityData, ProductionData, LaborDailyData, SalesDetailData } from '../services/googleSheetService';
import type { ChannelCostSummary } from '../components/domain';
import { isSubMaterial, computeChannelRevenue, type InventoryAdjustment } from '../services/insightService';
import { filterByDate } from './dateRange';
import { groupByWeek, weekKeyToLabel } from './weeklyAggregation';

export type ScoreStatus = 'excellent' | 'good' | 'warning' | 'danger';

export interface CostItemScore {
  label: string;               // '원재료' | '부재료' | '노무비' | '수도광열전력'
  actualMultiplier: number;    // 매출/원가 실적배수
  targetMultiplier: number;    // 목표배수
  score: number;               // (실적/목표) × 100
  status: ScoreStatus;
  actualCost: number;          // 실제 원가액
  targetCost: number;          // 목표 원가액 = 매출/목표배수
  surplus: number;             // 절감/초과 = 목표원가 - 실제원가
  color: string;
}

export interface CostScoringResult {
  activeBracket: ProfitCenterGoal;
  filteredRevenue: number;
  monthlyRevenue: number;
  overallScore: number;        // 4항목 평균
  items: CostItemScore[];      // [원재료, 부재료, 노무비, 수도광열전력]
  totalSurplus: number;
  totalCost: number;
  deemedInputTaxCredit: number;  // 의제 매입세액 공제액
}

export interface WeeklyCostScore {
  weekLabel: string;
  rawScore: number;
  subScore: number;
  laborScore: number;
  overheadScore: number;
  overallScore: number;
}

// isSubMaterial은 insightService에서 import (품목코드 ZIP_S_ 기반 + 키워드 폴백)

function getStatus(score: number): ScoreStatus {
  if (score >= 110) return 'excellent';
  if (score >= 100) return 'good';
  if (score >= 90) return 'warning';
  return 'danger';
}

function findActiveBracket(goals: ProfitCenterGoal[], monthlyRevenue: number): ProfitCenterGoal {
  const sorted = [...goals].sort((a, b) => a.revenueBracket - b.revenueBracket);
  let active = sorted[0];
  for (const goal of sorted) {
    if (monthlyRevenue >= goal.revenueBracket) {
      active = goal;
    } else {
      break;
    }
  }
  return active;
}

function computeItem(
  label: string,
  revenue: number,
  cost: number,
  targetMultiplier: number,
  color: string,
  absoluteTargetAmount?: number,
): CostItemScore {
  const actualMultiplier = cost > 0 ? revenue / cost : (revenue > 0 ? 150 : 0);
  const score = targetMultiplier > 0
    ? Math.round((actualMultiplier / targetMultiplier) * 100)
    : (cost === 0 ? 150 : 0);
  // 절대 목표금액 우선, 없으면 기존 방식 (매출/목표배수)
  const targetCost = absoluteTargetAmount ?? (targetMultiplier > 0 ? Math.round(revenue / targetMultiplier) : 0);
  const surplus = targetCost - cost;
  return {
    label,
    actualMultiplier: Math.round(actualMultiplier * 100) / 100,
    targetMultiplier,
    score,
    status: getStatus(score),
    actualCost: cost,
    targetCost,
    surplus,
    color,
  };
}

interface ComputeParams {
  dailySales: DailySalesData[];
  purchases: PurchaseData[];
  utilities: UtilityData[];
  production: ProductionData[];
  labor?: LaborDailyData[];
  salesDetail?: SalesDetailData[];
  config: BusinessConfig;
  rangeStart: string;
  rangeEnd: string;
  rangeDays: number;
  channelCosts?: ChannelCostSummary[];
  inventoryAdjustment?: InventoryAdjustment | null;
}

const COST_COLORS = {
  rawMaterial: '#3B82F6',
  subMaterial: '#10B981',
  labor: '#F59E0B',
  overhead: '#EF4444',
};

export function computeCostScores(params: ComputeParams): CostScoringResult | null {
  const { dailySales, purchases, utilities, production, labor = [], salesDetail = [], config, rangeStart, rangeEnd, rangeDays, channelCosts = [], inventoryAdjustment } = params;

  const goals = config.profitCenterGoals;
  if (!goals || goals.length === 0) return null;

  // dateRange 필터 적용
  const fSales = filterByDate(dailySales, rangeStart, rangeEnd);
  const fPurchases = filterByDate(purchases, rangeStart, rangeEnd);
  const fUtilities = filterByDate(utilities, rangeStart, rangeEnd);
  const fProduction = filterByDate(production, rangeStart, rangeEnd);

  // 매출 계산 (computeChannelRevenue 경유, salesDetail 포함)
  const cr = computeChannelRevenue(fSales, fPurchases, channelCosts, config, salesDetail);
  const filteredRevenue = cr.totalProductionRevenue; // 점수 계산용 = 생산매출
  if (filteredRevenue === 0) return null;

  // 매출구간 결정: 정산매출(실결제 금액) 기준
  const monthlyRevenue = Math.round(cr.totalRevenue * 30 / rangeDays);
  const activeBracket = findActiveBracket(goals, monthlyRevenue);
  const targets = activeBracket.targets;

  // 원가 계산: 매입액 (공급가액 기준, VAT 제외)
  const purchaseRaw = fPurchases.filter(p => !isSubMaterial(p.productName, p.productCode)).reduce((s, p) => s + p.supplyAmount, 0);
  const purchaseSub = fPurchases.filter(p => isSubMaterial(p.productName, p.productCode)).reduce((s, p) => s + p.supplyAmount, 0);

  // 의제 매입세액 공제: 당기 매입액 × 공제율 (총 원가에서 차감)
  const totalPurchase = purchaseRaw + purchaseSub;
  const deemedInputTaxCredit = Math.round(totalPurchase * (config.deemedInputTaxRate || 0));
  const rawShare = totalPurchase > 0 ? purchaseRaw / totalPurchase : 0.5;
  const rawDeduction = Math.round(deemedInputTaxCredit * rawShare);
  const subDeduction = deemedInputTaxCredit - rawDeduction;

  // 실제 사용액 = 기초재고 + 당기매입 - 기말재고 (재고 조정 있을 때)
  const rawCost = (inventoryAdjustment
    ? inventoryAdjustment.beginningRawInventoryValue + purchaseRaw - inventoryAdjustment.endingRawInventoryValue
    : purchaseRaw) - rawDeduction;
  const subCost = (inventoryAdjustment
    ? inventoryAdjustment.beginningSubInventoryValue + purchaseSub - inventoryAdjustment.endingSubInventoryValue
    : purchaseSub) - subDeduction;

  // 노무비: Google Sheets labor 데이터 사용 (insightService와 동일)
  const fLabor = filterByDate(labor, rangeStart, rangeEnd);
  const laborCost = fLabor.length > 0
    ? fLabor.reduce((s, l) => s + l.totalPay, 0)
    : Math.round((rawCost + subCost) * config.laborCostRatio);

  // 수도광열전력: 유틸리티(전기+수도+가스)만 (insightService와 동일)
  const overheadCost = fUtilities.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);

  // 절대 목표금액: config에서 가져와서 기간 비례 조정
  const prorationFactor = rangeDays / 30;
  const proratedTarget = (t?: number) => t ? Math.round(t * prorationFactor) : undefined;

  // 4개 항목 점수 계산
  const items: CostItemScore[] = [
    computeItem('원재료', filteredRevenue, rawCost, targets.revenueToRawMaterial, COST_COLORS.rawMaterial, proratedTarget(targets.targetRawMaterialCost)),
    computeItem('부재료', filteredRevenue, subCost, targets.revenueToSubMaterial, COST_COLORS.subMaterial, proratedTarget(targets.targetSubMaterialCost)),
    computeItem('노무비', filteredRevenue, laborCost, targets.productionToLabor, COST_COLORS.labor, proratedTarget(targets.targetLaborCost)),
    computeItem('수도광열전력', filteredRevenue, overheadCost, targets.revenueToExpense, COST_COLORS.overhead, proratedTarget(targets.targetOverheadCost)),
  ];

  const overallScore = Math.round(items.reduce((s, it) => s + it.score, 0) / items.length);
  const totalSurplus = items.reduce((s, it) => s + it.surplus, 0);
  const totalCost = rawCost + subCost + laborCost + overheadCost;

  return {
    activeBracket,
    filteredRevenue,
    monthlyRevenue,
    overallScore,
    items,
    totalSurplus,
    totalCost,
    deemedInputTaxCredit,
  };
}

export function computeWeeklyCostScores(params: ComputeParams): WeeklyCostScore[] {
  const { dailySales, purchases, utilities, production, labor: laborData = [], salesDetail = [], config, rangeStart, rangeEnd, channelCosts = [] } = params;

  const goals = config.profitCenterGoals;
  if (!goals || goals.length === 0) return [];

  const fSales = filterByDate(dailySales, rangeStart, rangeEnd);
  const fPurchases = filterByDate(purchases, rangeStart, rangeEnd);
  const fUtilities = filterByDate(utilities, rangeStart, rangeEnd);
  const fProduction = filterByDate(production, rangeStart, rangeEnd);
  const fLabor = filterByDate(laborData, rangeStart, rangeEnd);

  // 매출 계산 (salesDetail 포함)
  const overallCR = computeChannelRevenue(fSales, fPurchases, channelCosts, config, salesDetail);
  const totalRev = overallCR.totalProductionRevenue; // 점수 계산용 = 생산매출
  // 주간 배분용 비율: 생산매출 / 채널정산매출
  const prodRatio = overallCR.totalRevenue > 0 ? overallCR.totalProductionRevenue / overallCR.totalRevenue : 0.5;
  const rangeDays = Math.max(1, fSales.length);
  // 매출구간 결정: 정산매출(실결제 금액) 기준
  const monthlyRevenue = Math.round(overallCR.totalRevenue * 30 / rangeDays);
  const activeBracket = findActiveBracket(goals, monthlyRevenue);
  const targets = activeBracket.targets;

  // 주간 그룹핑
  const salesWeeks = groupByWeek(fSales, 'date');
  const rawPurchases = fPurchases.filter(p => !isSubMaterial(p.productName, p.productCode));
  const subPurchases = fPurchases.filter(p => isSubMaterial(p.productName, p.productCode));
  const rawWeeks = groupByWeek(rawPurchases, 'date');
  const subWeeks = groupByWeek(subPurchases, 'date');
  const utilWeeks = groupByWeek(fUtilities, 'date');
  const laborWeeks = groupByWeek(fLabor, 'date');

  const allWeekKeys = new Set<string>();
  [salesWeeks, rawWeeks, subWeeks, utilWeeks, laborWeeks].forEach(m => m.forEach((_, k) => allWeekKeys.add(k)));
  const sortedKeys = Array.from(allWeekKeys).sort();

  const hasLaborData = fLabor.length > 0;

  return sortedKeys.map(wk => {
    const salesItems = salesWeeks.get(wk) || [];
    const rawItems = rawWeeks.get(wk) || [];
    const subItems = subWeeks.get(wk) || [];
    const utilItems = utilWeeks.get(wk) || [];
    const laborItems = laborWeeks.get(wk) || [];

    // 주간 생산매출 = 주간 채널정산매출 × 비율
    const weekSettlement = salesItems.reduce((s, d) => s + d.jasaPrice + d.coupangPrice + d.kurlyPrice, 0);
    const rev = Math.round(weekSettlement * prodRatio);
    const rawPurchase = rawItems.reduce((s, p) => s + p.supplyAmount, 0);
    const subPurchase = subItems.reduce((s, p) => s + p.supplyAmount, 0);
    const util = utilItems.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);

    // 의제 매입세액 공제
    const wkTotalPurchase = rawPurchase + subPurchase;
    const wkDeemed = Math.round(wkTotalPurchase * (config.deemedInputTaxRate || 0));
    const wkRawShare = wkTotalPurchase > 0 ? rawPurchase / wkTotalPurchase : 0.5;
    const raw = rawPurchase - Math.round(wkDeemed * wkRawShare);
    const sub = subPurchase - (wkDeemed - Math.round(wkDeemed * wkRawShare));

    const laborCost = hasLaborData
      ? laborItems.reduce((s, l) => s + l.totalPay, 0)
      : Math.round((raw + sub) * config.laborCostRatio);

    // 수도광열전력 = 유틸리티만
    const overhead = util;

    const calcScore = (cost: number, target: number) => {
      if (rev === 0) return 0;
      if (cost === 0) return 150;
      const mult = rev / cost;
      return target > 0 ? Math.round((mult / target) * 100) : 0;
    };

    const rawScore = calcScore(raw, targets.revenueToRawMaterial);
    const subScore = calcScore(sub, targets.revenueToSubMaterial);
    const laborScore = calcScore(laborCost, targets.productionToLabor);
    const overheadScore = calcScore(overhead, targets.revenueToExpense);
    const overallScore = Math.round((rawScore + subScore + laborScore + overheadScore) / 4);

    return {
      weekLabel: weekKeyToLabel(wk),
      rawScore,
      subScore,
      laborScore,
      overheadScore,
      overallScore,
    };
  });
}
