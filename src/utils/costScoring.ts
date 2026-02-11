/**
 * 원가관리 점수 평가 시스템
 * 매출/원가 배수 기반으로 4개 항목(원재료/부재료/노무비/수도광열전력)을 점수화
 */
import type { ProfitCenterGoal, BusinessConfig } from '../config/businessConfig';
import type { DailySalesData, PurchaseData, UtilityData, ProductionData, LaborDailyData } from '../services/googleSheetService';
import { isSubMaterial } from '../services/insightService';
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
): CostItemScore {
  const actualMultiplier = cost > 0 ? revenue / cost : (revenue > 0 ? 150 : 0);
  const score = targetMultiplier > 0
    ? Math.round((actualMultiplier / targetMultiplier) * 100)
    : (cost === 0 ? 150 : 0);
  const targetCost = targetMultiplier > 0 ? Math.round(revenue / targetMultiplier) : 0;
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
  config: BusinessConfig;
  rangeStart: string;
  rangeEnd: string;
  rangeDays: number;
}

const COST_COLORS = {
  rawMaterial: '#3B82F6',
  subMaterial: '#10B981',
  labor: '#F59E0B',
  overhead: '#EF4444',
};

export function computeCostScores(params: ComputeParams): CostScoringResult | null {
  const { dailySales, purchases, utilities, production, labor = [], config, rangeStart, rangeEnd, rangeDays } = params;

  const goals = config.profitCenterGoals;
  if (!goals || goals.length === 0) return null;

  // dateRange 필터 적용
  const fSales = filterByDate(dailySales, rangeStart, rangeEnd);
  const fPurchases = filterByDate(purchases, rangeStart, rangeEnd);
  const fUtilities = filterByDate(utilities, rangeStart, rangeEnd);
  const fProduction = filterByDate(production, rangeStart, rangeEnd);

  // 매출 계산
  const filteredRevenue = fSales.reduce((s, d) => s + d.totalRevenue, 0);
  if (filteredRevenue === 0) return null;

  // 월매출 추정
  const monthlyRevenue = Math.round(filteredRevenue * 30 / rangeDays);
  const activeBracket = findActiveBracket(goals, monthlyRevenue);
  const targets = activeBracket.targets;

  // 원가 계산
  const rawCost = fPurchases.filter(p => !isSubMaterial(p.productName, p.productCode)).reduce((s, p) => s + p.total, 0);
  const subCost = fPurchases.filter(p => isSubMaterial(p.productName, p.productCode)).reduce((s, p) => s + p.total, 0);

  // 노무비: Google Sheets labor 데이터 사용 (insightService와 동일)
  const fLabor = filterByDate(labor, rangeStart, rangeEnd);
  const laborCost = fLabor.length > 0
    ? fLabor.reduce((s, l) => s + l.totalPay, 0)
    : Math.round((rawCost + subCost) * config.laborCostRatio);

  // 수도광열전력: 유틸리티(전기+수도+가스)만 (insightService와 동일)
  const overheadCost = fUtilities.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);

  // 4개 항목 점수 계산
  const items: CostItemScore[] = [
    computeItem('원재료', filteredRevenue, rawCost, targets.revenueToRawMaterial, COST_COLORS.rawMaterial),
    computeItem('부재료', filteredRevenue, subCost, targets.revenueToSubMaterial, COST_COLORS.subMaterial),
    computeItem('노무비', filteredRevenue, laborCost, targets.productionToLabor, COST_COLORS.labor),
    computeItem('수도광열전력', filteredRevenue, overheadCost, targets.revenueToExpense, COST_COLORS.overhead),
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
  };
}

export function computeWeeklyCostScores(params: ComputeParams): WeeklyCostScore[] {
  const { dailySales, purchases, utilities, production, labor: laborData = [], config, rangeStart, rangeEnd } = params;

  const goals = config.profitCenterGoals;
  if (!goals || goals.length === 0) return [];

  const fSales = filterByDate(dailySales, rangeStart, rangeEnd);
  const fPurchases = filterByDate(purchases, rangeStart, rangeEnd);
  const fUtilities = filterByDate(utilities, rangeStart, rangeEnd);
  const fProduction = filterByDate(production, rangeStart, rangeEnd);
  const fLabor = filterByDate(laborData, rangeStart, rangeEnd);

  // 전체 기간 월매출 → 구간 결정 (전 주간에 동일 적용)
  const totalRev = fSales.reduce((s, d) => s + d.totalRevenue, 0);
  const rangeDays = Math.max(1, fSales.length);
  const monthlyRevenue = Math.round(totalRev * 30 / rangeDays);
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

    const rev = salesItems.reduce((s, d) => s + d.totalRevenue, 0);
    const raw = rawItems.reduce((s, p) => s + p.total, 0);
    const sub = subItems.reduce((s, p) => s + p.total, 0);
    const util = utilItems.reduce((s, u) => s + u.elecCost + u.waterCost + u.gasCost, 0);

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
