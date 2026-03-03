/**
 * Production Service — 생산 관련 분석 함수 (insightService에서 분리)
 * computeWasteAnalysis, computeProductionEfficiency, computeYieldTracking
 */

import type {
  ProductionData,
  PurchaseData,
} from './googleSheetService';
import { BusinessConfig, DEFAULT_BUSINESS_CONFIG } from '../config/businessConfig';

// ==============================
// 타입 정의
// ==============================

export interface WasteAnalysisInsight {
  daily: {
    date: string;
    wasteFinishedPct: number;
    wasteSemiPct: number;
    wasteFinishedEa: number;
    wasteSemiKg: number;
    productionQty: number;
    productionKg: number;
    estimatedCost: number;
  }[];
  avgWasteRate: number;
  highWasteDays: { date: string; rate: number; qty: number; cost?: number; productionQty?: number }[];
  totalEstimatedCost: number;
  /** true=구매 데이터 기반 실제 원가, false=설정값 기반 추정 원가 */
  actualUnitCostUsed: boolean;
  /** 사용된 단위 원가 */
  unitCostUsed: number;
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

export function computeWasteAnalysis(
  production: ProductionData[],
  config: BusinessConfig = DEFAULT_BUSINESS_CONFIG,
  purchases: PurchaseData[] = []
): WasteAnalysisInsight {
  // US-004: 실제 구매 데이터 기반 평균 단위 원가 산출
  // avgUnitCost = 총 구매금액 / 총 생산수량
  const totalPurchaseCost = purchases.reduce((s, p) => s + (p.total || 0), 0);
  const totalProductionQty = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  const purchaseBasedUnitCost = totalProductionQty > 0 ? Math.round(totalPurchaseCost / totalProductionQty) : 0;

  // 구매 데이터가 있고 유효한 원가가 나오면 실제 원가 사용, 아니면 설정값 폴백
  const actualUnitCostUsed = purchaseBasedUnitCost > 0;
  const unitCost = actualUnitCostUsed ? purchaseBasedUnitCost : config.wasteUnitCost;
  let totalEstimatedCost = 0;

  const daily = production.map(p => {
    const estimatedCost = p.wasteFinishedEa * unitCost;
    totalEstimatedCost += estimatedCost;
    return {
      date: p.date,
      wasteFinishedPct: p.wasteFinishedPct,
      wasteSemiPct: p.wasteSemiPct,
      wasteFinishedEa: p.wasteFinishedEa,
      wasteSemiKg: p.wasteSemiKg,
      productionQty: p.prodQtyTotal,
      productionKg: p.prodKgTotal || 0,
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
    .map(d => ({ date: d.date, rate: d.wasteFinishedPct, qty: d.wasteFinishedEa, cost: d.estimatedCost, productionQty: d.productionQty }));

  return { daily, avgWasteRate, highWasteDays, totalEstimatedCost, actualUnitCostUsed, unitCostUsed: unitCost };
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
