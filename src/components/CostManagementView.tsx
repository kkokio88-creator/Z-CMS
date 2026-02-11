import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { Pagination } from './Pagination';
import { formatCurrency, formatAxisKRW, formatPercent } from '../utils/format';
import type { PurchaseData, UtilityData, ProductionData, DailySalesData, LaborDailyData } from '../services/googleSheetService';
import type { DashboardInsights, CostRecommendation, ProfitCenterScoreInsight, ProfitCenterScoreMetric } from '../services/insightService';
import { isSubMaterial, computeCostBreakdown, computeMaterialPrices, computeUtilityCosts, computeLimitPrice, computeChannelRevenue, type InventoryAdjustment } from '../services/insightService';
import { getChannelCostSummaries } from './ChannelCostAdmin';
import { useBusinessConfig } from '../contexts/SettingsContext';
// getLaborMonthlySummaries 수동입력 대신 labor prop(Google Sheets 실데이터) 사용
import { groupByWeek, weekKeyToLabel, getSortedWeekEntries } from '../utils/weeklyAggregation';
import { useUI } from '../contexts/UIContext';
import { getDateRange, filterByDate } from '../utils/dateRange';
import { computeWeeklyCostScores } from '../utils/costScoring';
import FormulaTooltip from './FormulaTooltip';
import { FORMULAS } from '../constants/formulaDescriptions';

interface Props {
  purchases: PurchaseData[];
  utilities: UtilityData[];
  production: ProductionData[];
  dailySales: DailySalesData[];
  labor?: LaborDailyData[];
  insights: DashboardInsights | null;
  profitCenterScore?: ProfitCenterScoreInsight | null;
  inventoryAdjustment?: InventoryAdjustment | null;
  onItemClick: (item: any) => void;
  onTabChange?: (tab: string) => void;
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const COST_COLORS = { rawMaterial: '#3B82F6', subMaterial: '#10B981', labor: '#F59E0B', overhead: '#EF4444' };

const InsightCards: React.FC<{ items: CostRecommendation[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <span className="material-icons-outlined text-yellow-500 text-base">lightbulb</span>
        비용 절감 인사이트
      </h3>
      <div className="space-y-2">
        {items.map(rec => (
          <div key={rec.id} className={`p-3 rounded-lg border-l-4 ${
            rec.priority === 'high' ? 'bg-red-50 dark:bg-red-900/10 border-red-500'
            : rec.priority === 'medium' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-500'
            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-500'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  rec.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : rec.priority === 'medium' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {rec.priority === 'high' ? '긴급' : rec.priority === 'medium' ? '주의' : '참고'}
                </span>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">{rec.title}</p>
                <p className="text-xs text-gray-500 mt-1">{rec.description}</p>
              </div>
              <span className="text-sm font-bold text-green-600 whitespace-nowrap ml-3">{formatCurrency(rec.estimatedSaving)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FilterBar: React.FC<{
  filters: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}> = ({ filters, active, onChange }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    {filters.map(f => (
      <button
        key={f.key}
        onClick={() => onChange(f.key)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          active === f.key
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        {f.label}
      </button>
    ))}
  </div>
);

/** 점수 요약 헤더 — 각 서브탭 상단에 표시 (대시보드와 동일한 ProfitCenterScoreMetric 사용) */
const ScoreHeader: React.FC<{ item: ProfitCenterScoreMetric | undefined }> = ({ item }) => {
  if (!item) return null;
  const statusColors = {
    excellent: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    good: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
    warning: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
    danger: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
  };
  const METRIC_COLORS: Record<string, string> = { '원재료': '#3B82F6', '부재료': '#10B981', '노무비': '#F59E0B', '수도광열전력': '#EF4444' };
  const statusEmoji = { excellent: '🟢', good: '🔵', warning: '🟡', danger: '🔴' };
  const color = METRIC_COLORS[item.metric] || '#6B7280';
  return (
    <div className={`rounded-lg p-3 border ${statusColors[item.status]} flex items-center justify-between flex-wrap gap-2`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-black" style={{ color }}>{item.score}점</span>
        <span className="text-lg">{statusEmoji[item.status]}</span>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          실적 {item.actual}{item.unit} / 목표 {item.target}{item.unit}
        </span>
      </div>
      {item.targetAmount != null && item.actualAmount != null && (
        <span className={`text-sm font-bold ${(item.targetAmount - item.actualAmount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {(item.targetAmount - item.actualAmount) >= 0 ? '절감 +' : '초과 '}{formatCurrency(Math.abs(item.targetAmount - item.actualAmount))}
        </span>
      )}
    </div>
  );
};

export const CostManagementView: React.FC<Props> = ({
  purchases,
  utilities,
  production,
  dailySales,
  labor = [],
  insights,
  profitCenterScore = null,
  inventoryAdjustment = null,
  onItemClick,
  onTabChange,
}) => {
  const config = useBusinessConfig();
  const { dateRange } = useUI();
  const { start: rangeStart, end: rangeEnd, days: rangeDays } = useMemo(() => getDateRange(dateRange), [dateRange]);

  // 글로벌 날짜 필터 적용
  const filteredPurchases = useMemo(() => filterByDate(purchases, rangeStart, rangeEnd), [purchases, rangeStart, rangeEnd]);
  const filteredUtilities = useMemo(() => filterByDate(utilities, rangeStart, rangeEnd), [utilities, rangeStart, rangeEnd]);
  const filteredProduction = useMemo(() => filterByDate(production, rangeStart, rangeEnd), [production, rangeStart, rangeEnd]);

  // profitCenterScore는 App.tsx에서 prop으로 전달받음 (대시보드와 동일한 값 보장)

  // 노무비: Google Sheets labor 실데이터 기반 반별 분석
  const filteredLabor = useMemo(() => {
    if (!labor || labor.length === 0) return [];
    return filterByDate(labor, rangeStart, rangeEnd);
  }, [labor, rangeStart, rangeEnd]);

  // 생산매출 = 권장판매가 매출 × 50% (computeChannelRevenue에서 계산)
  const filteredDailySales = useMemo(() => filterByDate(dailySales, rangeStart, rangeEnd), [dailySales, rangeStart, rangeEnd]);
  const productionRevenue = useMemo(() => {
    if (filteredDailySales.length === 0) return 0;
    const channelCosts = getChannelCostSummaries();
    const cr = computeChannelRevenue(filteredDailySales, filteredPurchases, channelCosts, config);
    return cr.totalProductionRevenue;
  }, [filteredDailySales, filteredPurchases, config]);

  // 주간 점수 (기존 costScoring 유지 — 주간 추세 그래프용)
  const scoringParams = useMemo(() => ({
    dailySales: filteredDailySales, purchases: filteredPurchases, utilities: filteredUtilities, production: filteredProduction, labor: filteredLabor, config, rangeStart, rangeEnd, rangeDays,
    channelCosts: getChannelCostSummaries(),
  }), [filteredDailySales, filteredPurchases, filteredUtilities, filteredProduction, filteredLabor, config, rangeStart, rangeEnd, rangeDays]);
  const weeklyScores = useMemo(() => computeWeeklyCostScores(scoringParams), [scoringParams]);

  // 날짜 필터된 데이터로 로컬 계산 (기간 변경 시 반응)
  const costBreakdown = useMemo(() =>
    filteredPurchases.length > 0
      ? computeCostBreakdown(filteredPurchases, filteredUtilities, filteredProduction, config, filteredLabor, inventoryAdjustment)
      : insights?.costBreakdown ?? null,
    [filteredPurchases, filteredUtilities, filteredProduction, config, filteredLabor, inventoryAdjustment, insights?.costBreakdown]);
  const materialPrices = useMemo(() =>
    filteredPurchases.length > 0
      ? computeMaterialPrices(filteredPurchases)
      : insights?.materialPrices ?? null,
    [filteredPurchases, insights?.materialPrices]);
  const utilityCosts = useMemo(() =>
    filteredUtilities.length > 0
      ? computeUtilityCosts(filteredUtilities, filteredProduction)
      : insights?.utilityCosts ?? null,
    [filteredUtilities, filteredProduction, insights?.utilityCosts]);
  const recommendations = insights?.recommendations || [];
  const limitPrice = useMemo(() =>
    filteredPurchases.length > 0
      ? computeLimitPrice(filteredPurchases)
      : insights?.limitPrice ?? null,
    [filteredPurchases, insights?.limitPrice]);

  const [rawFilter, setRawFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [overheadFilter, setOverheadFilter] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [rawPage, setRawPage] = useState(1);
  const RAW_PAGE_SIZE = 20;

  const laborByDept = useMemo(() => {
    if (filteredLabor.length === 0) return [];
    const deptMap = new Map<string, {
      name: string; totalPay: number; headcountSum: number; dayCount: number;
      weekdayRegular: number; weekdayOvertime: number; weekdayNight: number;
      holidayRegular: number; holidayOvertime: number; holidayNight: number;
      weekdayRegularPay: number; weekdayOvertimePay: number; weekdayNightPay: number;
      holidayRegularPay: number; holidayOvertimePay: number; holidayNightPay: number;
    }>();
    filteredLabor.forEach(l => {
      const d = deptMap.get(l.department) || {
        name: l.department, totalPay: 0, headcountSum: 0, dayCount: 0,
        weekdayRegular: 0, weekdayOvertime: 0, weekdayNight: 0,
        holidayRegular: 0, holidayOvertime: 0, holidayNight: 0,
        weekdayRegularPay: 0, weekdayOvertimePay: 0, weekdayNightPay: 0,
        holidayRegularPay: 0, holidayOvertimePay: 0, holidayNightPay: 0,
      };
      d.totalPay += l.totalPay;
      d.headcountSum += l.headcount;
      d.dayCount += 1;
      d.weekdayRegular += l.weekdayRegularHours;
      d.weekdayOvertime += l.weekdayOvertimeHours;
      d.weekdayNight += l.weekdayNightHours;
      d.holidayRegular += l.holidayRegularHours;
      d.holidayOvertime += l.holidayOvertimeHours;
      d.holidayNight += l.holidayNightHours;
      d.weekdayRegularPay += l.weekdayRegularPay;
      d.weekdayOvertimePay += l.weekdayOvertimePay;
      d.weekdayNightPay += l.weekdayNightPay;
      d.holidayRegularPay += l.holidayRegularPay;
      d.holidayOvertimePay += l.holidayOvertimePay;
      d.holidayNightPay += l.holidayNightPay;
      deptMap.set(l.department, d);
    });
    return Array.from(deptMap.values()).sort((a, b) => b.totalPay - a.totalPay);
  }, [filteredLabor]);

  // =============================================
  // 주간 집계 데이터 (B1/B3: 모든 그래프 주간 단위)
  // =============================================
  const weeklyData = useMemo(() => {
    // purchases를 원재료/부재료로 분류
    const rawPurchases = filteredPurchases.filter(p => !isSubMaterial(p.productName, p.productCode));
    const subPurchases = filteredPurchases.filter(p => isSubMaterial(p.productName, p.productCode));

    // 주간별 그룹핑
    const rawWeeks = groupByWeek(rawPurchases, 'date');
    const subWeeks = groupByWeek(subPurchases, 'date');
    const utilWeeks = groupByWeek(filteredUtilities, 'date');
    const prodWeeks = groupByWeek(filteredProduction, 'date');
    const laborWeeks = groupByWeek(filteredLabor, 'date');

    // 모든 주간 키 수집
    const allWeekKeys = new Set<string>();
    [rawWeeks, subWeeks, utilWeeks, prodWeeks, laborWeeks].forEach(m => m.forEach((_, k) => allWeekKeys.add(k)));
    const sortedKeys = Array.from(allWeekKeys).sort();

    const weeklyEntries = sortedKeys.map(wk => {
      const rawItems = rawWeeks.get(wk) || [];
      const subItems = subWeeks.get(wk) || [];
      const utilItems = utilWeeks.get(wk) || [];
      const prodItems = prodWeeks.get(wk) || [];

      const rawTotal = rawItems.reduce((s, p) => s + p.total, 0);
      const subTotal = subItems.reduce((s, p) => s + p.total, 0);
      const elec = utilItems.reduce((s, u) => s + u.elecCost, 0);
      const water = utilItems.reduce((s, u) => s + u.waterCost, 0);
      const gas = utilItems.reduce((s, u) => s + u.gasCost, 0);
      const utilTotal = elec + water + gas;
      const prodQty = prodItems.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
      const prodQuantity = prodItems.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);

      // 노무비: 실데이터 우선, 없으면 추정
      const laborItems = laborWeeks.get(wk) || [];
      const labor = laborItems.length > 0
        ? laborItems.reduce((s, l) => s + l.totalPay, 0)
        : Math.round((rawTotal + subTotal + utilTotal) * config.laborCostRatio);
      // 경비
      const hasFixed = config.monthlyFixedOverhead > 0 || config.variableOverheadPerUnit > 0;
      const weekFixedOverhead = hasFixed ? Math.round(config.monthlyFixedOverhead / 4.33) : 0;
      const weekVarOverhead = hasFixed ? Math.round(prodQuantity * config.variableOverheadPerUnit) : 0;
      const otherOverhead = hasFixed
        ? weekFixedOverhead + weekVarOverhead
        : Math.round((rawTotal + subTotal) * config.overheadRatio);
      const overhead = utilTotal + otherOverhead;
      const total = rawTotal + subTotal + labor + overhead;

      return {
        weekKey: wk,
        weekLabel: weekKeyToLabel(wk),
        rawMaterial: rawTotal,
        subMaterial: subTotal,
        labor,
        overhead,
        total,
        electricity: elec,
        water,
        gas,
        utilityTotal: utilTotal,
        prodQty,
        prodQuantity,
        perUnit: prodQty > 0 ? Math.round(utilTotal / prodQty) : 0,
        perUnitElec: prodQty > 0 ? Math.round(elec / prodQty) : 0,
        perUnitWater: prodQty > 0 ? Math.round(water / prodQty) : 0,
        perUnitGas: prodQty > 0 ? Math.round(gas / prodQty) : 0,
      };
    });

    return weeklyEntries;
  }, [filteredPurchases, filteredUtilities, filteredProduction, filteredLabor, config]);

  // 주간 원재료비/부재료비 차트 데이터
  const weeklyRaw = useMemo(() => weeklyData.map(w => ({
    week: w.weekLabel, 원재료비: w.rawMaterial,
  })), [weeklyData]);

  const weeklySub = useMemo(() => weeklyData.map(w => ({
    week: w.weekLabel, 부재료비: w.subMaterial,
  })), [weeklyData]);

  // 주간 원가율 차트 데이터
  const weeklyCostRate = useMemo(() => {
    const totalWeeks = weeklyData.length || 1;
    const weeklyRev = productionRevenue / totalWeeks;
    return weeklyData.map(w => ({
      week: w.weekLabel,
      원재료율: weeklyRev > 0 ? Math.round((w.rawMaterial / weeklyRev) * 1000) / 10 : 0,
      부재료율: weeklyRev > 0 ? Math.round((w.subMaterial / weeklyRev) * 1000) / 10 : 0,
      노무비율: weeklyRev > 0 ? Math.round((w.labor / weeklyRev) * 1000) / 10 : 0,
      경비율: weeklyRev > 0 ? Math.round((w.overhead / weeklyRev) * 1000) / 10 : 0,
      총원가율: weeklyRev > 0 ? Math.round((w.total / weeklyRev) * 1000) / 10 : 0,
      rawMaterial: w.rawMaterial,
      subMaterial: w.subMaterial,
      labor: w.labor,
      overhead: w.overhead,
      total: w.total,
    }));
  }, [weeklyData, productionRevenue]);

  // Pre-compute filtered data
  const allRawItems = materialPrices?.items || [];
  const filteredRawItems = (() => {
    switch (rawFilter) {
      case 'priceUp': return allRawItems.filter(m => m.changeRate >= config.priceIncreaseThreshold);
      case 'priceDown': return allRawItems.filter(m => m.changeRate < 0);
      case 'top10': return [...allRawItems].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
      default: return allRawItems;
    }
  })();

  const allSubItems = costBreakdown?.subMaterialDetail?.items || [];
  const filteredSubItems = (() => {
    switch (subFilter) {
      case 'top5': return [...allSubItems].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
      default: return allSubItems;
    }
  })();

  // 노무비 주간 데이터 — Google Sheets 실데이터 기반
  const weeklyLabor = useMemo(() => {
    const laborWeeks = groupByWeek(filteredLabor, 'date');
    const prodWeeks = groupByWeek(filteredProduction, 'date');
    const allKeys = new Set<string>();
    laborWeeks.forEach((_, k) => allKeys.add(k));
    prodWeeks.forEach((_, k) => allKeys.add(k));
    const sortedKeys = Array.from(allKeys).sort();
    const totalWeeks = sortedKeys.length || 1;
    const weeklyRev = productionRevenue / totalWeeks;

    return sortedKeys.map(wk => {
      const laborItems = laborWeeks.get(wk) || [];
      const prodItems = prodWeeks.get(wk) || [];
      const cost = laborItems.reduce((s, l) => s + l.totalPay, 0);
      const prodQty = prodItems.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
      // 해당 주 일별 인원 평균
      const dailyHeadcounts = new Map<string, number>();
      laborItems.forEach(l => {
        const cur = dailyHeadcounts.get(l.date) || 0;
        dailyHeadcounts.set(l.date, cur + l.headcount);
      });
      const avgHc = dailyHeadcounts.size > 0
        ? Math.round(Array.from(dailyHeadcounts.values()).reduce((s, v) => s + v, 0) / dailyHeadcounts.size)
        : 0;
      return {
        week: weekKeyToLabel(wk),
        노무비: cost,
        생산량: prodQty,
        인원: avgHc,
        인당생산성: avgHc > 0 ? Math.round(prodQty / avgHc) : 0,
        노무비율: weeklyRev > 0 ? Math.round((cost / weeklyRev) * 1000) / 10 : 0,
      };
    });
  }, [filteredLabor, filteredProduction, productionRevenue]);

  // Filter recommendations by type
  const materialRecs = recommendations.filter(r => r.type === 'material');
  const utilityRecs = recommendations.filter(r => r.type === 'utility');
  const marginRecs = recommendations.filter(r => r.type === 'margin' || r.type === 'waste');

  const tabs = [
    { key: 'overview', label: '원가 총괄', icon: 'account_balance' },
    { key: 'raw', label: '원재료', icon: 'inventory_2' },
    { key: 'sub', label: '부재료', icon: 'category' },
    { key: 'labor', label: '노무비', icon: 'people' },
    { key: 'overhead', label: '수도광열전력', icon: 'bolt' },
  ];

  return (
    <SubTabLayout title="원가 관리" tabs={tabs} onTabChange={onTabChange}>
      {(activeTab) => {
        try {
        // ========== 원가 총괄 ==========
        if (activeTab === 'overview') {
          const composition = costBreakdown?.composition || [];
          const totalCost = composition.reduce((s, c) => s + c.value, 0);
          const sc = profitCenterScore;
          const METRIC_COLORS: Record<string, string> = { '원재료': '#3B82F6', '부재료': '#10B981', '노무비': '#F59E0B', '수도광열전력': '#EF4444', '폐기율': '#6B7280' };

          return (
            <div className="space-y-6">
              {/* 점수 카드 섹션 — 대시보드와 동일한 computeProfitCenterScore 기반 */}
              {sc ? (
                <>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold">
                          {sc.activeBracket.label} 구간
                        </span>
                        <span className={`text-4xl font-black ${
                          sc.overallScore >= 110 ? 'text-green-500' :
                          sc.overallScore >= 100 ? 'text-blue-500' :
                          sc.overallScore >= 90 ? 'text-orange-500' : 'text-red-500'
                        }`}>{sc.overallScore}<span className="text-lg font-bold text-gray-400">점</span></span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          sc.overallScore >= 110 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          sc.overallScore >= 100 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          sc.overallScore >= 90 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {sc.overallScore >= 110 ? '우수' : sc.overallScore >= 100 ? '달성' : sc.overallScore >= 90 ? '주의' : '미달'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        월 정산매출 {formatCurrency(sc.monthlyRevenue)} 추정 ({sc.calendarDays}일 기준)
                      </div>
                    </div>

                    {/* 5개 항목 점수 카드 — 대시보드와 동일 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {sc.scores.map(item => {
                        const statusEmoji: Record<string, string> = { excellent: '🟢', good: '🔵', warning: '🟡', danger: '🔴' };
                        const color = METRIC_COLORS[item.metric] || '#6B7280';
                        return (
                          <div key={item.metric} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold" style={{ color }}>{item.metric}</span>
                              <span>{statusEmoji[item.status]}</span>
                            </div>
                            <div className="text-2xl font-black" style={{ color }}>{item.score}<span className="text-xs text-gray-400 font-normal">점</span></div>
                            <div className="text-[11px] text-gray-500 mt-1">
                              {item.unit === '배' ? `${item.actual}x / ${item.target}x` :
                               item.unit === '%' ? `${item.actual}% / ${item.target}%` :
                               `${formatCurrency(item.actual)} / ${formatCurrency(item.target)}`}
                            </div>
                            {item.targetAmount != null && item.actualAmount != null && (
                              <div className={`text-xs font-bold mt-0.5 ${(item.actualAmount - item.targetAmount) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                실적: {formatCurrency(item.actualAmount)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <span className="material-icons-outlined text-base">info</span>
                    매출 데이터가 없어 점수를 계산할 수 없습니다. 구글시트에서 매출 데이터를 확인하세요.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 주간 점수 추이 */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 점수 추이 <FormulaTooltip {...FORMULAS.costScore} /></h3>
                  {weeklyScores.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyScores}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} domain={[0, 150]} tickFormatter={v => `${v}`} />
                          <Tooltip formatter={(v: number, name: string) => [`${v}점`, name]} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {/* 100점 기준선 */}
                          <Line type="monotone" dataKey={() => 100} name="기준(100)" stroke="#9CA3AF" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                          <Line type="monotone" dataKey="rawScore" name="원재료" stroke={COST_COLORS.rawMaterial} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="subScore" name="부재료" stroke={COST_COLORS.subMaterial} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="laborScore" name="노무비" stroke={COST_COLORS.labor} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="overheadScore" name="수도광열전력" stroke={COST_COLORS.overhead} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="overallScore" name="종합" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">주간 데이터 없음</p>}
                </div>
                {/* 원가 구성비 Pie */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">원가 구성비 <FormulaTooltip {...FORMULAS.costOverview} /></h3>
                  {composition.length > 0 && totalCost > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={composition} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value"
                            label={({ name, value }) => {
                              const pct = totalCost > 0 ? Math.round((value / totalCost) * 1000) / 10 : 0;
                              return `${name} ${pct}%`;
                            }}>
                            {composition.map((_, i) => <Cell key={i} fill={Object.values(COST_COLORS)[i] || PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${formatCurrency(v)} (${totalCost > 0 ? (v / totalCost * 100).toFixed(1) : 0}%)`, '원가']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구성비 데이터 없음</p>}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span className="material-icons-outlined text-base">info</span>
                  점수 = (실적배수 / 목표배수) x 100 | 100점 이상 = 목표 달성 | 절감 = 목표원가 - 실제원가
                </p>
              </div>

              {recommendations.length > 0 && (
                <InsightCards items={recommendations.slice(0, 3)} />
              )}
            </div>
          );
        }

        // ========== 원재료 ==========
        if (activeTab === 'raw') {
          const rawDetail = costBreakdown?.rawMaterialDetail;
          const priceUpCount = allRawItems.filter(m => m.changeRate >= config.priceIncreaseThreshold).length;
          const selectedItem = selectedMaterial ? allRawItems.find(m => m.productCode === selectedMaterial) : null;

          const filteredBarData = filteredRawItems.slice(0, 15).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
            변동률: item.changeRate,
          }));

          return (
            <div className="space-y-6">
              <ScoreHeader item={profitCenterScore?.scores?.find(s => s.metric === '원재료')} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원재료비 <FormulaTooltip {...FORMULAS.rawMaterialTotal} /></p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(rawDetail?.total || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">단가 {config.priceIncreaseThreshold}%↑ 품목</p>
                  <p className={`text-2xl font-bold mt-1 ${priceUpCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{priceUpCount}건</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">필터 결과</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredRawItems.length}개</p>
                </div>
              </div>

              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'priceUp', label: `단가상승(${config.priceIncreaseThreshold}%↑)` },
                  { key: 'priceDown', label: '단가하락' },
                  { key: 'top10', label: '상위10(금액순)' },
                ]}
                active={rawFilter}
                onChange={setRawFilter}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 원재료비 추이</h3>
                  {weeklyRaw.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyRaw}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="원재료비" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    {rawFilter === 'priceUp' ? '단가상승 품목' : rawFilter === 'priceDown' ? '단가하락 품목' : rawFilter === 'top10' ? '상위10 품목' : '품목별 구매액'}
                  </h3>
                  {filteredBarData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="금액" radius={[0, 4, 4, 0]}>
                            {filteredBarData.map((entry, i) => (
                              <Cell key={i} fill={entry.변동률 >= config.priceIncreaseThreshold ? '#EF4444' : entry.변동률 < 0 ? '#10B981' : '#3B82F6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">해당 조건의 품목 없음</p>}
                </div>
              </div>

              {selectedItem && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{selectedItem.productName} 단가 이력</h3>
                  {selectedItem.priceHistory.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedItem.priceHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="price" name="단가" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">이력 없음</p>}
                </div>
              )}

              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  원재료 상세 내역 <span className="text-sm text-gray-400 font-normal">({filteredRawItems.length}건)</span>
                </h3>
                {filteredRawItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재 단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">평균 단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">변동률</th>
                          <th className="text-right py-2 px-3 text-gray-500">총 구매액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRawItems.slice((rawPage - 1) * RAW_PAGE_SIZE, rawPage * RAW_PAGE_SIZE).map(item => (
                          <tr
                            key={item.productCode}
                            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${selectedMaterial === item.productCode ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            onClick={() => setSelectedMaterial(item.productCode === selectedMaterial ? null : item.productCode)}
                          >
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">₩{item.currentPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-gray-500">₩{item.avgPrice.toLocaleString()}</td>
                            <td className={`py-2 px-3 text-right font-medium ${item.changeRate > 0 ? 'text-red-600' : item.changeRate < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              {item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.totalSpent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredRawItems.length > RAW_PAGE_SIZE && (
                      <Pagination
                        currentPage={rawPage}
                        totalPages={Math.ceil(filteredRawItems.length / RAW_PAGE_SIZE)}
                        totalItems={filteredRawItems.length}
                        startIndex={(rawPage - 1) * RAW_PAGE_SIZE}
                        endIndex={Math.min(rawPage * RAW_PAGE_SIZE, filteredRawItems.length)}
                        onPrev={() => setRawPage(p => Math.max(1, p - 1))}
                        onNext={() => setRawPage(p => Math.min(Math.ceil(filteredRawItems.length / RAW_PAGE_SIZE), p + 1))}
                        onGoToPage={setRawPage}
                      />
                    )}
                  </div>
                ) : <p className="text-gray-400 text-center py-6">해당 조건의 품목이 없습니다.</p>}
              </div>

              {limitPrice && limitPrice.items.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">price_change</span>
                    한계단가 분석
                    <FormulaTooltip {...FORMULAS.limitPrice} />
                    {limitPrice.exceedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {limitPrice.exceedCount}건 초과
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    한계단가 = 평균단가 + 1 표준편차 | 초과 품목은 가격 이상 징후
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">평균단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">한계단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">초과율</th>
                          <th className="text-center py-2 px-3 text-gray-500">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {limitPrice.items.slice(0, 15).map(item => (
                          <tr key={item.productCode} className={`border-b border-gray-100 dark:border-gray-800 ${
                            item.isExceeding ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                          }`}>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.avgUnitPrice)}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.limitPrice)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${item.isExceeding ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                              {formatCurrency(item.currentPrice)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              item.exceedRate > 0 ? 'text-red-600' : item.exceedRate < -5 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {item.exceedRate > 0 ? '+' : ''}{item.exceedRate.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                item.isExceeding
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {item.isExceeding ? '초과' : '정상'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <InsightCards items={materialRecs} />
            </div>
          );
        }

        // ========== 부재료 ==========
        if (activeTab === 'sub') {
          const subDetail = costBreakdown?.subMaterialDetail;

          const filteredSubBarData = filteredSubItems.slice(0, 10).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
          }));

          return (
            <div className="space-y-6">
              <ScoreHeader item={profitCenterScore?.scores?.find(s => s.metric === '부재료')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 부재료비 <FormulaTooltip {...FORMULAS.subMaterialTotal} /></p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(subDetail?.total || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">필터 결과</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredSubItems.length}개</p>
                </div>
              </div>

              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'top5', label: '상위5(금액순)' },
                ]}
                active={subFilter}
                onChange={setSubFilter}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 부재료비 추이</h3>
                  {weeklySub.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklySub}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="부재료비" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">부재료 데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 부재료 지출</h3>
                  {filteredSubBarData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredSubBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="금액" fill="#10B981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">부재료 품목 없음</p>}
                </div>
              </div>

              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  부재료 상세 내역 <span className="text-sm text-gray-400 font-normal">({filteredSubItems.length}건)</span>
                </h3>
                {filteredSubItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">수량</th>
                          <th className="text-right py-2 px-3 text-gray-500">평균 단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">총 금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubItems.map(item => (
                          <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.quantity.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">₩{item.avgUnitPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.totalSpent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-400">부재료 품목이 없습니다.</p>
                    <p className="text-xs text-gray-400 mt-1">포장재, 비닐, 라벨 등의 구매 데이터가 수집되면 표시됩니다.</p>
                  </div>
                )}
              </div>

              <InsightCards items={materialRecs} />
            </div>
          );
        }

        // ========== 노무비 (반별 분석) — Google Sheets 실데이터 기반 ==========
        if (activeTab === 'labor') {
          const hasLaborData = filteredLabor.length > 0;
          const totalLaborCost = hasLaborData
            ? filteredLabor.reduce((s, l) => s + l.totalPay, 0)
            : (costBreakdown?.laborDetail?.estimated || 0);

          // 근로시간 합산
          const totalRegularHours = filteredLabor.reduce((s, l) => s + l.weekdayRegularHours + l.holidayRegularHours, 0);
          const totalOvertimeHours = filteredLabor.reduce((s, l) => s + l.weekdayOvertimeHours + l.weekdayNightHours + l.holidayOvertimeHours + l.holidayNightHours, 0);
          const totalHours = totalRegularHours + totalOvertimeHours;
          const overtimeRate = totalHours > 0 ? Math.round((totalOvertimeHours / totalHours) * 1000) / 10 : 0;

          // 일별 인원 평균
          const dailyHc = new Map<string, number>();
          filteredLabor.forEach(l => dailyHc.set(l.date, (dailyHc.get(l.date) || 0) + l.headcount));
          const avgHeadcount = dailyHc.size > 0 ? Math.round(Array.from(dailyHc.values()).reduce((s, v) => s + v, 0) / dailyHc.size) : 0;

          const totalProdQty = filteredProduction.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
          const prodPerPerson = avgHeadcount > 0 ? Math.round(totalProdQty / avgHeadcount) : 0;
          const laborCostPerUnit = totalProdQty > 0 ? Math.round(totalLaborCost / totalProdQty) : 0;
          const laborRate = productionRevenue > 0 ? Math.round((totalLaborCost / productionRevenue) * 1000) / 10 : 0;

          const DEPT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

          return (
            <div className="space-y-6">
              <ScoreHeader item={profitCenterScore?.scores?.find(s => s.metric === '노무비')} />

              {/* KPI 카드 6개 */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 노무비{hasLaborData ? '' : ' (추정)'}</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(totalLaborCost)}</p>
                  <p className="text-xs text-gray-400 mt-1">노무비율 {laborRate}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 근로시간</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{Math.round(totalHours).toLocaleString()}h</p>
                  <p className="text-xs text-gray-400 mt-1">정규 {Math.round(totalRegularHours).toLocaleString()}h</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">초과근무</p>
                  <p className={`text-2xl font-bold mt-1 ${overtimeRate > 15 ? 'text-red-600' : 'text-orange-600'}`}>
                    {Math.round(totalOvertimeHours).toLocaleString()}h
                  </p>
                  <p className="text-xs text-gray-400 mt-1">비율 {overtimeRate}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">평균 인원/일</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{avgHeadcount}명</p>
                  <p className="text-xs text-gray-400 mt-1">{laborByDept.length}개 반</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">인당 생산성</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{prodPerPerson.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">개/인(기간합)</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">단위당 노무비</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">₩{laborCostPerUnit.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">원/개</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 주간 노무비 & 노무비율 */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 노무비 & 노무비율</h3>
                  {weeklyLabor.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={weeklyLabor}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: number, name: string) => name === '노무비율' ? `${v}%` : formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar yAxisId="left" dataKey="노무비" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="노무비율" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                </div>

                {/* 반별 노무비 비교 — Google Sheets 실데이터 */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">반별 노무비 비교</h3>
                  {laborByDept.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={laborByDept.map(d => ({
                          name: d.name,
                          노무비: d.totalPay,
                          인원: d.dayCount > 0 ? Math.round(d.headcountSum / d.dayCount) : 0,
                        }))} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number, name: string) => name === '인원' ? `${v}명` : formatCurrency(v)} />
                          <Bar dataKey="노무비" radius={[0, 4, 4, 0]}>
                            {laborByDept.map((_, i) => (
                              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10">
                      <span className="material-icons-outlined text-4xl text-gray-300 mb-2">groups</span>
                      <p className="text-gray-400 text-sm">노무비 데이터가 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 주간 인당 생산성 차트 */}
              {weeklyLabor.length > 0 && avgHeadcount > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 생산량 & 인당 생산성</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyLabor}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="생산량" fill="#3B82F6" name="생산량" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="인당생산성" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="인당 생산성" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 반별 상세 분석 테이블 */}
              {laborByDept.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">반별 상세 분석</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">반</th>
                          <th className="text-right py-2 px-3 text-gray-500">평균인원</th>
                          <th className="text-right py-2 px-3 text-gray-500">정규시간</th>
                          <th className="text-right py-2 px-3 text-gray-500">초과시간</th>
                          <th className="text-right py-2 px-3 text-gray-500">초과율</th>
                          <th className="text-right py-2 px-3 text-gray-500">정규급여</th>
                          <th className="text-right py-2 px-3 text-gray-500">초과급여</th>
                          <th className="text-right py-2 px-3 text-gray-500">총 노무비</th>
                          <th className="text-right py-2 px-3 text-gray-500">비율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {laborByDept.map((dept, i) => {
                          const avgHc = dept.dayCount > 0 ? Math.round(dept.headcountSum / dept.dayCount) : 0;
                          const regHrs = Math.round(dept.weekdayRegular + dept.holidayRegular);
                          const otHrs = Math.round(dept.weekdayOvertime + dept.weekdayNight + dept.holidayOvertime + dept.holidayNight);
                          const otRate = (regHrs + otHrs) > 0 ? Math.round((otHrs / (regHrs + otHrs)) * 1000) / 10 : 0;
                          const regPay = dept.weekdayRegularPay + dept.holidayRegularPay;
                          const otPay = dept.weekdayOvertimePay + dept.weekdayNightPay + dept.holidayOvertimePay + dept.holidayNightPay;
                          const share = totalLaborCost > 0 ? Math.round((dept.totalPay / totalLaborCost) * 1000) / 10 : 0;
                          return (
                            <tr key={dept.name} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3">
                                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                                <span className="text-gray-800 dark:text-gray-200">{dept.name}</span>
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{avgHc}명</td>
                              <td className="py-2 px-3 text-right text-blue-600">{regHrs.toLocaleString()}h</td>
                              <td className="py-2 px-3 text-right text-orange-600">{otHrs.toLocaleString()}h</td>
                              <td className={`py-2 px-3 text-right font-medium ${otRate > 15 ? 'text-red-600' : 'text-gray-600'}`}>{otRate}%</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(regPay)}</td>
                              <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(otPay)}</td>
                              <td className="py-2 px-3 text-right font-bold text-yellow-600">{formatCurrency(dept.totalPay)}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{share}%</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                          <td className="py-2 px-3 text-gray-900 dark:text-white">합계</td>
                          <td className="py-2 px-3 text-right">{avgHeadcount}명</td>
                          <td className="py-2 px-3 text-right text-blue-600">{Math.round(totalRegularHours).toLocaleString()}h</td>
                          <td className="py-2 px-3 text-right text-orange-600">{Math.round(totalOvertimeHours).toLocaleString()}h</td>
                          <td className={`py-2 px-3 text-right ${overtimeRate > 15 ? 'text-red-600' : 'text-gray-600'}`}>{overtimeRate}%</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(laborByDept.reduce((s, d) => s + d.weekdayRegularPay + d.holidayRegularPay, 0))}</td>
                          <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(laborByDept.reduce((s, d) => s + d.weekdayOvertimePay + d.weekdayNightPay + d.holidayOvertimePay + d.holidayNightPay, 0))}</td>
                          <td className="py-2 px-3 text-right text-yellow-600">{formatCurrency(totalLaborCost)}</td>
                          <td className="py-2 px-3 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 주간 노무비 상세 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 노무비 추이</h3>
                {weeklyLabor.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">주간</th>
                          <th className="text-right py-2 px-3 text-gray-500">인원</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산량</th>
                          <th className="text-right py-2 px-3 text-gray-500">인당생산성</th>
                          <th className="text-right py-2 px-3 text-gray-500">노무비</th>
                          <th className="text-right py-2 px-3 text-gray-500">노무비율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyLabor.map(m => (
                          <tr key={m.week} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.week}</td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{m.인원}명</td>
                            <td className="py-2 px-3 text-right text-blue-600">{m.생산량.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-green-600 font-medium">
                              {m.인당생산성 > 0 ? m.인당생산성.toLocaleString() : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-yellow-600">{formatCurrency(m.노무비)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${m.노무비율 > 30 ? 'text-red-600' : 'text-gray-600'}`}>{m.노무비율}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>

              {!hasLaborData && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <span className="material-icons-outlined text-base">info</span>
                    노무비는 현재 추정값입니다. 구글시트 '노무비' 시트에 근태 데이터를 입력하면 반별 상세 분석이 가능합니다.
                  </p>
                </div>
              )}

              <InsightCards items={marginRecs} />
            </div>
          );
        }

        // ========== 경비 (B4: perUnit 버그 수정 + B5: 생산매출/생산량 대비) ==========
        const overheadDetail = costBreakdown?.overheadDetail;

        // 주간 에너지 데이터 (B4: 필터별 perUnit 재계산)
        const weeklyUtility = weeklyData.map(w => {
          let filteredTotal: number;
          let filteredPerUnit: number;
          switch (overheadFilter) {
            case 'electricity':
              filteredTotal = w.electricity;
              filteredPerUnit = w.perUnitElec;
              break;
            case 'water':
              filteredTotal = w.water;
              filteredPerUnit = w.perUnitWater;
              break;
            case 'gas':
              filteredTotal = w.gas;
              filteredPerUnit = w.perUnitGas;
              break;
            default:
              filteredTotal = w.utilityTotal;
              filteredPerUnit = w.perUnit;
          }
          return {
            week: w.weekLabel,
            전기: w.electricity,
            수도: w.water,
            가스: w.gas,
            합계: filteredTotal,
            perUnit: filteredPerUnit,
            생산량: w.prodQty,
          };
        });

        // B5: 총 생산량 / 매출 대비
        const totalEnergy = weeklyData.reduce((s, w) => s + w.utilityTotal, 0);
        const totalProdQtyAll = weeklyData.reduce((s, w) => s + w.prodQty, 0);
        const energyRevenueRatio = productionRevenue > 0 ? Math.round((totalEnergy / productionRevenue) * 10000) / 100 : 0;
        const energyPerUnitTotal = totalProdQtyAll > 0 ? Math.round(totalEnergy / totalProdQtyAll) : 0;

        // 필터별 KPI perUnit (B4 수정)
        const lastWeek = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null;
        const kpiPerUnit = lastWeek
          ? (overheadFilter === 'electricity' ? lastWeek.perUnitElec
            : overheadFilter === 'water' ? lastWeek.perUnitWater
            : overheadFilter === 'gas' ? lastWeek.perUnitGas
            : lastWeek.perUnit)
          : 0;

        return (
          <div className="space-y-6">
            <ScoreHeader item={profitCenterScore?.scores?.find(s => s.metric === '수도광열전력')} />
            {/* KPI — B5: 생산매출/생산량 대비 추가 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">총 수도광열전력</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(overheadDetail?.total || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">공과금</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(overheadDetail?.utilities || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">기타 간접비</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(overheadDetail?.other || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  단위당 {overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : overheadFilter === 'gas' ? '가스' : '에너지'}비용
                </p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {kpiPerUnit > 0 ? `₩${kpiPerUnit.toLocaleString()}` : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">최근 주간 기준</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">매출 대비 에너지</p>
                <p className={`text-2xl font-bold mt-1 ${energyRevenueRatio > 5 ? 'text-red-600' : 'text-blue-600'}`}>
                  {energyRevenueRatio}%
                </p>
                <p className="text-xs text-gray-400 mt-1">에너지/생산매출</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">평균 단위당 에너지</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">
                  {energyPerUnitTotal > 0 ? `₩${energyPerUnitTotal.toLocaleString()}` : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">전체 기간 평균</p>
              </div>
            </div>

            <FilterBar
              filters={[
                { key: 'all', label: '전체' },
                { key: 'electricity', label: '전기' },
                { key: 'water', label: '수도' },
                { key: 'gas', label: '가스' },
              ]}
              active={overheadFilter}
              onChange={setOverheadFilter}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  {overheadFilter === 'all' ? '주간 공과금 추이' : `주간 ${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용 추이`}
                </h3>
                {weeklyUtility.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {overheadFilter === 'all' ? (
                        <AreaChart data={weeklyUtility}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="전기" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="수도" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="가스" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                        </AreaChart>
                      ) : (
                        <LineChart data={weeklyUtility}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="합계"
                            stroke={overheadFilter === 'electricity' ? '#F59E0B' : overheadFilter === 'water' ? '#3B82F6' : '#EF4444'}
                            strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">공과금 데이터 없음</p>}
              </div>
              {/* B5: 단위당 에너지 비용 + 매출 대비 비율 (우축) */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  단위당 {overheadFilter !== 'all' ? (overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스') : '에너지'} 비용
                </h3>
                {weeklyUtility.filter(m => m.perUnit > 0).length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyUtility.filter(m => m.perUnit > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `₩${v.toLocaleString()}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number, name: string) => name === '생산량' ? v.toLocaleString() : `₩${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="perUnit" name="단위당 비용" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                        <Bar yAxisId="right" dataKey="생산량" fill="#E5E7EB" name="생산량" radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">생산량 데이터 필요</p>}
              </div>
            </div>

            {/* 주간 공과금 상세 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {overheadFilter === 'all' ? '주간 공과금 상세' : `주간 ${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용`}
              </h3>
              {weeklyUtility.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">주간</th>
                        {(overheadFilter === 'all' || overheadFilter === 'electricity') && <th className="text-right py-2 px-3 text-gray-500">전기</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'water') && <th className="text-right py-2 px-3 text-gray-500">수도</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'gas') && <th className="text-right py-2 px-3 text-gray-500">가스</th>}
                        <th className="text-right py-2 px-3 text-gray-500">합계</th>
                        <th className="text-right py-2 px-3 text-gray-500">생산량</th>
                        <th className="text-right py-2 px-3 text-gray-500">단위당</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyUtility.map(m => (
                        <tr key={m.week} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.week}</td>
                          {(overheadFilter === 'all' || overheadFilter === 'electricity') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.전기)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'water') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.수도)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'gas') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.가스)}</td>}
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(m.합계)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{m.생산량.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{m.perUnit > 0 ? `₩${m.perUnit.toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
            </div>

            <InsightCards items={utilityRecs} />
          </div>
        );
        } catch (err) {
          console.error('[CostManagementView] 렌더링 오류:', err);
          return (
            <div className="flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
              <span className="material-icons-outlined text-5xl text-red-400 mb-4">error_outline</span>
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">화면 로드 중 오류가 발생했습니다</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{err instanceof Error ? err.message : '알 수 없는 오류'}</p>
            </div>
          );
        }
      }}
    </SubTabLayout>
  );
};
