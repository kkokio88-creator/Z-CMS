/**
 * 원가관리 점수 평가 시스템
 * 매출/원가 배수 기반으로 4개 항목(원재료/부재료/노무비/수도광열전력)을 점수화
 */
import type { ProfitCenterGoal, BusinessConfig } from '../config/businessConfig';
import { deriveMultipliersFromTargets } from '../config/businessConfig';
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

/**
 * 권장판매 매출 기준 선형 보간 — 두 구간 사이 목표를 비례 산출
 * @exported — insightService.computeProfitCenterScore에서도 사용
 * 실제 권장판매 매출(월환산)이 두 구간의 targetRecommendedRevenue 사이에 있으면
 * 모든 목표금액을 선형 보간하고, 배수는 보간된 금액에서 재계산
 */
export function interpolateBracket(goals: ProfitCenterGoal[], monthlyRecommendedRevenue: number): ProfitCenterGoal {
  const sorted = [...goals]
    .filter(g => g.targets.targetRecommendedRevenue != null && g.targets.targetRecommendedRevenue > 0)
    .sort((a, b) => (a.targets.targetRecommendedRevenue || 0) - (b.targets.targetRecommendedRevenue || 0));

  // targetRecommendedRevenue 데이터가 없으면 기존 방식 폴백
  if (sorted.length === 0) return findActiveBracket(goals, monthlyRecommendedRevenue);

  // 최하 구간 미만 → 최하 구간 그대로
  const first = sorted[0];
  if (monthlyRecommendedRevenue <= (first.targets.targetRecommendedRevenue || 0)) return first;

  // 최상 구간 초과 → 최상 구간 그대로
  const last = sorted[sorted.length - 1];
  if (monthlyRecommendedRevenue >= (last.targets.targetRecommendedRevenue || 0)) return last;

  // 상/하 구간 결정
  let lower = sorted[0];
  let upper = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (monthlyRecommendedRevenue >= (sorted[i].targets.targetRecommendedRevenue || 0) &&
        monthlyRecommendedRevenue < (sorted[i + 1].targets.targetRecommendedRevenue || 0)) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const lowerRev = lower.targets.targetRecommendedRevenue || 0;
  const upperRev = upper.targets.targetRecommendedRevenue || 0;
  const ratio = upperRev > lowerRev
    ? (monthlyRecommendedRevenue - lowerRev) / (upperRev - lowerRev)
    : 0;

  const lerp = (a?: number, b?: number): number | undefined => {
    if (a == null && b == null) return undefined;
    return Math.round((a || 0) + ratio * ((b || 0) - (a || 0)));
  };

  const lt = lower.targets;
  const ut = upper.targets;

  // 모든 절대 목표금액을 보간
  const interpolated: ProfitCenterGoal = {
    revenueBracket: Math.round(lower.revenueBracket + ratio * (upper.revenueBracket - lower.revenueBracket)),
    label: `${lower.label}~${upper.label}`,
    targets: {
      ...lt,
      targetRecommendedRevenue: lerp(lt.targetRecommendedRevenue, ut.targetRecommendedRevenue),
      targetProductionRevenue: lerp(lt.targetProductionRevenue, ut.targetProductionRevenue),
      targetRawMaterialCost: lerp(lt.targetRawMaterialCost, ut.targetRawMaterialCost),
      targetSubMaterialCost: lerp(lt.targetSubMaterialCost, ut.targetSubMaterialCost),
      targetLaborCost: lerp(lt.targetLaborCost, ut.targetLaborCost),
      targetOverheadCost: lerp(lt.targetOverheadCost, ut.targetOverheadCost),
      wasteRateTarget: Math.round((lt.wasteRateTarget + ratio * (ut.wasteRateTarget - lt.wasteRateTarget)) * 10) / 10,
    },
  };

  // 보간된 금액에서 배수 재계산 (deriveMultipliersFromTargets 활용)
  return deriveMultipliersFromTargets(interpolated);
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

  // 매출구간 결정: 권장판매 매출(월환산) 기준 선형 보간
  const settlementRev = cr.totalRawSupplyAmount > 0
    ? cr.totalRawSupplyAmount - cr.totalPromotionDiscountAmount
    : cr.totalRevenue;
  const monthlyRevenue = Math.round(settlementRev * 30 / rangeDays);
  const monthlyRecommendedRevenue = Math.round(cr.totalRecommendedRevenue * 30 / rangeDays);
  const activeBracket = interpolateBracket(goals, monthlyRecommendedRevenue);
  const targets = activeBracket.targets;

  // 원가 계산: 매입액 (공급가액 기준, VAT 제외)
  const subExcl = config.subMaterialExcludeCodes || [];
  const costExcl = config.costExcludeCodes || [];
  const costPurchases = costExcl.length > 0 ? fPurchases.filter(p => !costExcl.includes(p.productCode)) : fPurchases;
  const purchaseRaw = costPurchases.filter(p => !isSubMaterial(p.productName, p.productCode, subExcl)).reduce((s, p) => s + p.supplyAmount, 0);
  const purchaseSub = costPurchases.filter(p => isSubMaterial(p.productName, p.productCode, subExcl)).reduce((s, p) => s + p.supplyAmount, 0);

  // 의제 매입세액 공제: 원재료 당기 매입액 × 공제율 (원재료에만 적용, insightService와 동일)
  const rawDeduction = Math.round(purchaseRaw * (config.deemedInputTaxRate || 0));
  const deemedInputTaxCredit = rawDeduction;

  // 실제 사용액 = 기초재고 + 당기매입 - 기말재고 - 의제매입세 공제(원재료만)
  const rawCost = (inventoryAdjustment
    ? inventoryAdjustment.beginningRawInventoryValue + purchaseRaw - inventoryAdjustment.endingRawInventoryValue
    : purchaseRaw) - rawDeduction;
  const subCost = inventoryAdjustment
    ? inventoryAdjustment.beginningSubInventoryValue + purchaseSub - inventoryAdjustment.endingSubInventoryValue
    : purchaseSub;

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
  // 주간 배분용 비율: 생산매출 / 정산매출
  const weeklySettlement = overallCR.totalRawSupplyAmount > 0
    ? overallCR.totalRawSupplyAmount - overallCR.totalPromotionDiscountAmount
    : overallCR.totalRevenue;
  const prodRatio = weeklySettlement > 0 ? overallCR.totalProductionRevenue / weeklySettlement : 0.5;
  const rangeDays = Math.max(1, fSales.length);
  // 매출구간 결정: 권장판매 매출(월환산) 기준 선형 보간
  const monthlyRecommendedRevenue = Math.round(overallCR.totalRecommendedRevenue * 30 / rangeDays);
  const activeBracket = interpolateBracket(goals, monthlyRecommendedRevenue);
  const targets = activeBracket.targets;

  // 주간 그룹핑
  const salesWeeks = groupByWeek(fSales, 'date');
  const subExcl2 = config.subMaterialExcludeCodes || [];
  const costExcl2 = config.costExcludeCodes || [];
  const costPurchases2 = costExcl2.length > 0 ? fPurchases.filter(p => !costExcl2.includes(p.productCode)) : fPurchases;
  const rawPurchases = costPurchases2.filter(p => !isSubMaterial(p.productName, p.productCode, subExcl2));
  const subPurchases = costPurchases2.filter(p => isSubMaterial(p.productName, p.productCode, subExcl2));
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

    // 의제 매입세액 공제: 원재료에만 적용 (insightService와 동일)
    const raw = rawPurchase - Math.round(rawPurchase * (config.deemedInputTaxRate || 0));
    const sub = subPurchase;

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
