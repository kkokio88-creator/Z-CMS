/**
 * Cost Analysis Service
 * 원가 관리 대시보드를 위한 데이터 조회 및 분석 서비스
 */

import {
  BomYieldAnalysisItem,
  InventoryDiscrepancyItem,
  MaterialPriceHistory,
  MaterialCostImpact,
  ChannelProfitabilityDetail,
  DailyPerformanceMetric,
  BudgetItem,
  ExpenseSummary,
  CostAnalysisSyncResult,
  AnomalyLevel,
  BudgetStatus,
  PerformanceStatus,
  StaffingSuggestion,
  BudgetAlert,
  DrilldownData,
  DrilldownType,
} from '../types';

import { loadBusinessConfig } from '../config/businessConfig';

// Backend API URL
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

/**
 * 원가 분석 전체 데이터 동기화
 */
export const syncCostAnalysisData = async (): Promise<CostAnalysisSyncResult | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      console.error('Cost analysis sync failed:', result.error);
      return null;
    }

    return result.data as CostAnalysisSyncResult;
  } catch (e: any) {
    console.error('Cost analysis sync error:', e);
    return null;
  }
};

/**
 * BOM Yield 분석 데이터 조회
 */
export const fetchBomYieldAnalysis = async (
  dateFrom?: string,
  dateTo?: string
): Promise<BomYieldAnalysisItem[]> => {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await fetch(`${BACKEND_URL}/cost-analysis/bom-yield?${params}`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('BOM yield fetch error:', e);
    return [];
  }
};

/**
 * 재고 괴리 데이터 조회
 */
export const fetchInventoryDiscrepancy = async (): Promise<InventoryDiscrepancyItem[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/inventory-discrepancy`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Inventory discrepancy fetch error:', e);
    return [];
  }
};

/**
 * 원재료 단가 이력 조회
 */
export const fetchMaterialPriceHistory = async (
  weeks: number = 12
): Promise<MaterialPriceHistory[]> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/cost-analysis/material-price-trend?weeks=${weeks}`
    );
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Material price history fetch error:', e);
    return [];
  }
};

/**
 * 원가 영향 분석 조회
 */
export const fetchMaterialCostImpacts = async (): Promise<MaterialCostImpact[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/material-impacts`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Material cost impacts fetch error:', e);
    return [];
  }
};

/**
 * 채널별 상세 수익성 조회
 */
export const fetchChannelProfitability = async (
  period: '7days' | '30days' | 'month' = '30days'
): Promise<ChannelProfitabilityDetail[]> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/cost-analysis/channel-profitability?period=${period}`
    );
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Channel profitability fetch error:', e);
    return [];
  }
};

/**
 * 일일 성과 지표 조회
 */
export const fetchDailyPerformance = async (
  dateFrom?: string,
  dateTo?: string
): Promise<DailyPerformanceMetric[]> => {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await fetch(`${BACKEND_URL}/cost-analysis/daily-performance?${params}`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Daily performance fetch error:', e);
    return [];
  }
};

/**
 * 예산 항목 조회
 */
export const fetchBudgetItems = async (period?: string): Promise<BudgetItem[]> => {
  try {
    const params = period ? `?period=${period}` : '';
    const response = await fetch(`${BACKEND_URL}/cost-analysis/budget-status${params}`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Budget items fetch error:', e);
    return [];
  }
};

/**
 * 경비 요약 조회
 */
export const fetchExpenseSummary = async (period?: string): Promise<ExpenseSummary | null> => {
  try {
    const params = period ? `?period=${period}` : '';
    const response = await fetch(`${BACKEND_URL}/cost-analysis/expense-summary${params}`);
    const result = await response.json();

    return result.success ? result.data : null;
  } catch (e) {
    console.error('Expense summary fetch error:', e);
    return null;
  }
};

/**
 * 드릴다운 상세 데이터 조회
 */
export const fetchDrilldownData = async (
  type: DrilldownType,
  targetId: string
): Promise<DrilldownData | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/drill-down`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, targetId }),
    });
    const result = await response.json();

    return result.success ? result.data : null;
  } catch (e) {
    console.error('Drilldown data fetch error:', e);
    return null;
  }
};

/**
 * 인력 배치 제안 조회
 */
export const fetchStaffingSuggestions = async (): Promise<StaffingSuggestion[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/staffing-suggestions`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Staffing suggestions fetch error:', e);
    return [];
  }
};

/**
 * 예산 경고 알림 조회
 */
export const fetchBudgetAlerts = async (): Promise<BudgetAlert[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-analysis/budget-alerts`);
    const result = await response.json();

    return result.success ? result.data : [];
  } catch (e) {
    console.error('Budget alerts fetch error:', e);
    return [];
  }
};

// ========================================
// 유틸리티 함수 (클라이언트 측 계산)
// ========================================

/**
 * Anomaly Level 결정
 */
export const determineAnomalyLevel = (
  gap: number,
  thresholds?: { warning: number; critical: number }
): AnomalyLevel => {
  const config = loadBusinessConfig();
  const t = thresholds || {
    warning: config.anomalyWarningThreshold,
    critical: config.anomalyCriticalThreshold,
  };
  const absGap = Math.abs(gap);
  if (absGap >= t.critical) return 'critical';
  if (absGap >= t.warning) return 'warning';
  return 'normal';
};

/**
 * Budget Status 결정
 */
export const determineBudgetStatus = (
  burnRate: number,
  daysElapsed: number,
  daysInMonth: number
): BudgetStatus => {
  const config = loadBusinessConfig();
  const expectedBurnRate = (daysElapsed / daysInMonth) * 100;
  const deviation = burnRate - expectedBurnRate;

  if (deviation > config.budgetWarningDeviation * 2 || burnRate > config.budgetCriticalBurnRate) return 'critical';
  if (deviation > config.budgetWarningDeviation || burnRate > config.budgetCriticalBurnRate - 15) return 'warning';
  return 'normal';
};

/**
 * Performance Status 결정
 */
export const determinePerformanceStatus = (
  actual: number,
  target: number,
  tolerance?: number
): PerformanceStatus => {
  if (tolerance === undefined) {
    tolerance = loadBusinessConfig().performanceTolerance;
  }
  const ratio = (actual / target) * 100;
  if (ratio > 100 + tolerance) return 'above-target';
  if (ratio < 100 - tolerance) return 'below-target';
  return 'on-target';
};

/**
 * 숫자를 통화 형식으로 포맷 (한국식 단위: 억, 만)
 */
export const formatCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 100000000) {
    return `${sign}${(absValue / 100000000).toFixed(1)}억`;
  } else if (absValue >= 10000) {
    return `${sign}${(absValue / 10000).toFixed(0)}만`;
  }
  return value.toLocaleString('ko-KR');
};

/**
 * 퍼센트 변화량 계산
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * 색상 클래스 반환 (조건부 서식)
 */
export const getMarginColorClass = (margin: number): string => {
  if (margin < 0) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (margin < 10) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  if (margin < 20) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
};

export const getDiscrepancyColorClass = (rate: number): string => {
  const absRate = Math.abs(rate);
  if (absRate > 15) return 'bg-red-500 text-white';
  if (absRate > 10) return 'bg-orange-400 text-white';
  if (absRate > 5) return 'bg-yellow-400 text-gray-900';
  return 'bg-green-500 text-white';
};

export const getBudgetStatusColorClass = (status: BudgetStatus): string => {
  switch (status) {
    case 'critical':
      return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    case 'warning':
      return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
    default:
      return 'border-green-500 bg-green-50 dark:bg-green-900/20';
  }
};

export const getPerformanceGaugeColor = (actual: number, target: number): string => {
  const ratio = actual / target;
  if (ratio > 1.1) return '#EF4444'; // 빨강 (초과 - 비용이므로 나쁨)
  if (ratio > 1.05) return '#F59E0B'; // 주황
  return '#10B981'; // 초록 (정상)
};

export const getAnomalyLevelColorClass = (level: AnomalyLevel): string => {
  switch (level) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'warning':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  }
};

/**
 * Top N 급등 자재 필터링
 */
export const getTopPriceIncreases = (
  materials: MaterialPriceHistory[],
  count: number = 5,
  type: 'week' | 'month' = 'week'
): MaterialPriceHistory[] => {
  const key = type === 'week' ? 'priceChangeWeek' : 'priceChangeMonth';
  return [...materials]
    .filter(m => m[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, count);
};

/**
 * 예산 초과 위험 항목 필터링
 */
export const getOverrunRiskItems = (budgets: BudgetItem[]): BudgetItem[] => {
  return budgets.filter(b => b.status === 'critical' || b.projectedOverrun > 0);
};

/**
 * 일일 성과 요약 계산
 */
export const calculatePerformanceSummary = (metrics: DailyPerformanceMetric[]) => {
  if (metrics.length === 0) {
    return {
      avgLaborRatio: 0,
      avgMaterialRatio: 0,
      avgEfficiency: 0,
      targetDays: 0,
      totalDays: 0,
    };
  }

  const sum = metrics.reduce(
    (acc, m) => ({
      labor: acc.labor + m.actualLaborRatio,
      material: acc.material + m.actualMaterialRatio,
      efficiency: acc.efficiency + m.efficiency,
      onTarget: acc.onTarget + (m.overallStatus === 'on-target' ? 1 : 0),
    }),
    { labor: 0, material: 0, efficiency: 0, onTarget: 0 }
  );

  return {
    avgLaborRatio: sum.labor / metrics.length,
    avgMaterialRatio: sum.material / metrics.length,
    avgEfficiency: sum.efficiency / metrics.length,
    targetDays: sum.onTarget,
    totalDays: metrics.length,
  };
};
