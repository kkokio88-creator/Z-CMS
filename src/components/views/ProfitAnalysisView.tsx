import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie, LineChart, Line, ComposedChart,
} from 'recharts';
import { SubTabLayout } from '../layout';
import { formatCurrency, formatAxisKRW, formatPercent } from '../../utils/format';
import type { DailySalesData, SalesDetailData, PurchaseData } from '../../services/googleSheetService';
import type { DashboardInsights } from '../../services/insightService';
import {
  computeChannelRevenue,
  computeProductProfit,
  computeRevenueTrend,
  computeProductBEP,
  computeCostBreakdown,
} from '../../services/insightService';
import { useBusinessConfig } from '../../contexts/SettingsContext';
import { getChannelCostSummaries } from '../domain';
import { groupByWeek, weekKeyToLabel, getSortedWeekEntries } from '../../utils/weeklyAggregation';
import { useUI } from '../../contexts/UIContext';
import { InsightSection } from '../insight';
import { getDateRange, filterByDate, getRangeLabel } from '../../utils/dateRange';
import { FormulaTooltip } from '../common';
import { FORMULAS } from '../../constants/formulaDescriptions';

interface Props {
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  onItemClick: (item: import('../../types').ModalItem) => void;
  onTabChange?: (tab: string) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const CHANNEL_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
const BUDGET_COLORS = { rawMaterial: '#3B82F6', subMaterial: '#10B981', labor: '#F59E0B', overhead: '#EF4444' };

export const ProfitAnalysisView: React.FC<Props> = ({ dailySales, salesDetail, purchases, insights, onItemClick, onTabChange }) => {
  const config = useBusinessConfig();
  const { dateRange } = useUI();

  // ─── 날짜 범위에 따라 데이터 필터 ───
  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const filteredDailySales = useMemo(
    () => filterByDate(dailySales, rangeStart, rangeEnd),
    [dailySales, rangeStart, rangeEnd]
  );
  const filteredSalesDetail = useMemo(
    () => filterByDate(salesDetail, rangeStart, rangeEnd),
    [salesDetail, rangeStart, rangeEnd]
  );
  const filteredPurchases = useMemo(
    () => filterByDate(purchases, rangeStart, rangeEnd),
    [purchases, rangeStart, rangeEnd]
  );

  // ─── 필터된 데이터로 인사이트 재계산 ───
  const channelCosts = useMemo(() => getChannelCostSummaries(), []);

  const channelRevenue = useMemo(
    () => filteredDailySales.length > 0 ? computeChannelRevenue(filteredDailySales, filteredPurchases, channelCosts, config, filteredSalesDetail) : null,
    [filteredDailySales, filteredPurchases, channelCosts, config, filteredSalesDetail]
  );
  const productProfit = useMemo(
    () => filteredSalesDetail.length > 0 ? computeProductProfit(filteredSalesDetail, filteredPurchases) : null,
    [filteredSalesDetail, filteredPurchases]
  );
  const revenueTrend = useMemo(
    () => filteredDailySales.length > 0 ? computeRevenueTrend(filteredDailySales, filteredPurchases, channelCosts, config) : null,
    [filteredDailySales, filteredPurchases, channelCosts, config]
  );
  const productBEP = useMemo(
    () => productProfit ? computeProductBEP(productProfit, channelRevenue, config) : null,
    [productProfit, channelRevenue, config]
  );
  const costBreakdown = useMemo(
    () => filteredPurchases.length > 0 ? computeCostBreakdown(filteredPurchases, [], [], config) : null,
    [filteredPurchases, config]
  );

  // 날짜 라벨
  const rangeLabelText = getRangeLabel(dateRange);

  // A2: 주간 채널 매출 집계
  const weeklyChannelTrend = useMemo(() => {
    const daily = channelRevenue?.dailyTrend || [];
    if (daily.length === 0) return [];
    const weekMap = groupByWeek(daily, 'date');
    return getSortedWeekEntries(weekMap).map(([key, items]) => ({
      weekLabel: weekKeyToLabel(key),
      jasa: items.reduce((s, d) => s + d.jasa, 0),
      coupang: items.reduce((s, d) => s + d.coupang, 0),
      kurly: items.reduce((s, d) => s + d.kurly, 0),
      total: items.reduce((s, d) => s + d.total, 0),
    }));
  }, [channelRevenue]);

  // A5: 예산 대비 실적 계산
  const budgetActual = useMemo(() => {
    if (!costBreakdown) return null;
    const totalBudget = config.budgetRawMaterial + config.budgetSubMaterial + config.budgetLabor + config.budgetOverhead;
    const comp = costBreakdown.composition;
    const rawActual = comp.find(c => c.name === '원재료')?.value || 0;
    const subActual = comp.find(c => c.name === '부재료')?.value || 0;
    const laborActual = comp.find(c => c.name === '노무비')?.value || 0;
    const overheadActual = comp.find(c => c.name === '수도광열전력')?.value || 0;
    const totalActual = rawActual + subActual + laborActual + overheadActual;
    const achievementRate = totalBudget > 0 ? Math.round(totalActual / totalBudget * 1000) / 10 : 0;

    const items = [
      { name: '원재료', budget: config.budgetRawMaterial, actual: rawActual, color: BUDGET_COLORS.rawMaterial },
      { name: '부재료', budget: config.budgetSubMaterial, actual: subActual, color: BUDGET_COLORS.subMaterial },
      { name: '노무비', budget: config.budgetLabor, actual: laborActual, color: BUDGET_COLORS.labor },
      { name: '수도광열전력', budget: config.budgetOverhead, actual: overheadActual, color: BUDGET_COLORS.overhead },
    ].map(item => ({
      ...item,
      diff: item.actual - item.budget,
      rate: item.budget > 0 ? Math.round(item.actual / item.budget * 1000) / 10 : 0,
    }));

    // 일별 누적 지출 (필터된 purchases 기반)
    const dailySpend = filteredPurchases
      .filter(p => p.date && p.total > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyCumulative: { date: string; actual: number; budget: number }[] = [];
    let cumActual = 0;
    const daysSet = new Set(dailySpend.map(p => p.date));
    const sortedDays = Array.from(daysSet).sort();
    const totalDays = sortedDays.length || 30;
    const dailyBudget = totalBudget / totalDays;

    sortedDays.forEach((day, idx) => {
      const dayTotal = dailySpend.filter(p => p.date === day).reduce((s, p) => s + p.total, 0);
      cumActual += dayTotal;
      dailyCumulative.push({
        date: day.slice(5), // MM-DD
        actual: cumActual,
        budget: Math.round(dailyBudget * (idx + 1)),
      });
    });

    return { totalBudget, totalActual, diff: totalActual - totalBudget, achievementRate, items, dailyCumulative };
  }, [costBreakdown, filteredPurchases, config]);

  const tabs = [
    { key: 'channel', label: '채널별 수익', icon: 'storefront' },
    { key: 'product', label: '품목별 랭킹', icon: 'leaderboard' },
    { key: 'trend', label: '수익 트렌드', icon: 'show_chart' },
    { key: 'budget', label: '예산 대비 실적', icon: 'account_balance_wallet' },
    { key: 'cashflow', label: '현금 흐름', icon: 'account_balance' },
  ];

  return (
    <SubTabLayout title="수익 분석" tabs={tabs} onTabChange={onTabChange}>
      {(activeTab) => {
        if (activeTab === 'channel') {
          const hasProfit = channelRevenue?.channels?.some(ch => ch.profit1 !== ch.revenue) ?? false;
          const channels = channelRevenue?.channels || [];
          const totals = channelRevenue ? {
            revenue: channelRevenue.totalRevenue,
            directCost: channelRevenue.totalDirectCost,
            profit1: channelRevenue.totalProfit1,
            profit2: channelRevenue.totalProfit2,
            profit3: channelRevenue.totalProfit3,
          } : null;

          return (
            <InsightSection id="profit-ch">
            <div className="space-y-6">
              {/* KPI: 채널별 매출 + 3단계 이익 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {channels.map((ch, i) => (
                  <div key={ch.name} className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ch.name}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: CHANNEL_COLORS[i] }}>
                      {formatCurrency(ch.revenue)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">점유율 {ch.share.toFixed(1)}%</p>
                    {hasProfit && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">제품이익</span>
                          <span className={ch.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}>{formatCurrency(ch.profit1)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">채널이익</span>
                          <span className={ch.profit2 >= 0 ? 'text-blue-600' : 'text-red-500'}>{formatCurrency(ch.profit2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-gray-500">사업부이익</span>
                          <span className={ch.profit3 >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(ch.profit3)}</span>
                        </div>
                        <p className="text-xs text-right text-gray-400">마진율 {ch.marginRate3.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* A1: 5단계 수익 분석 테이블 — 권장판매가 → 할인/수수료 → 정산매출 → 이익 */}
              {channelRevenue && totals && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 수익 구조 분석 <FormulaTooltip {...FORMULAS.channelRevenue} /></h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                          <th className="text-left py-2 px-3 text-gray-500 w-48">구분</th>
                          {channels.map((ch, i) => (
                            <th key={ch.name} className="text-right py-2 px-3" style={{ color: CHANNEL_COLORS[i] }}>{ch.name}</th>
                          ))}
                          <th className="text-right py-2 px-3 text-gray-900 dark:text-white font-bold">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 매출 산출 구간 */}
                        <tr className="bg-amber-50/50 dark:bg-amber-900/10 border-b border-gray-200 dark:border-gray-700">
                          <td colSpan={channels.length + 2} className="py-1.5 px-3 text-xs font-bold text-amber-700 dark:text-amber-400">매출 산출</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400">권장판매가 매출</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right">{formatCurrency(ch.recommendedRevenue)}</td>)}
                          <td className="py-2 px-3 text-right font-bold">{formatCurrency(channelRevenue.totalRecommendedRevenue)}</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 할인금액</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-red-400">{ch.discountAmount > 0 ? `-${formatCurrency(ch.discountAmount)}` : '-'}</td>)}
                          <td className="py-2 px-3 text-right text-red-400">{channelRevenue.totalDiscountAmount > 0 ? `-${formatCurrency(channelRevenue.totalDiscountAmount)}` : '-'}</td>
                        </tr>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 플랫폼 수수료</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-red-400">{ch.commissionAmount > 0 ? `-${formatCurrency(ch.commissionAmount)}` : '-'}</td>)}
                          <td className="py-2 px-3 text-right text-red-400">{channelRevenue.totalCommissionAmount > 0 ? `-${formatCurrency(channelRevenue.totalCommissionAmount)}` : '-'}</td>
                        </tr>
                        {channelRevenue.totalPromotionDiscountAmount > 0 && (
                          <>
                            <tr className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">공급가액</td>
                              {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right">{formatCurrency(ch.rawSupplyAmount)}</td>)}
                              <td className="py-2 px-3 text-right font-medium">{formatCurrency(channelRevenue.totalRawSupplyAmount)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 할인매출</td>
                              {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-red-400">{ch.promotionDiscountAmount > 0 ? `-${formatCurrency(ch.promotionDiscountAmount)}` : '-'}</td>)}
                              <td className="py-2 px-3 text-right text-red-400">{channelRevenue.totalPromotionDiscountAmount > 0 ? `-${formatCurrency(channelRevenue.totalPromotionDiscountAmount)}` : '-'}</td>
                            </tr>
                          </>
                        )}
                        <tr className="border-b border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
                          <td className="py-2 px-3 font-bold text-gray-900 dark:text-white">정산매출</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right font-bold">{formatCurrency(ch.settlementRevenue)}</td>)}
                          <td className="py-2 px-3 text-right font-bold">{formatCurrency(channels.reduce((s, ch) => s + ch.settlementRevenue, 0))}</td>
                        </tr>

                        {/* 1단계: 제품이익 */}
                        <tr className="bg-green-50/50 dark:bg-green-900/10 border-b border-gray-200 dark:border-gray-700">
                          <td colSpan={channels.length + 2} className="py-1.5 px-3 text-xs font-bold text-green-700 dark:text-green-400">1단계: 제품이익</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 재료비 <span className="text-xs text-gray-400">(권장판매가/1.1×50%)</span></td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.materialCost)}</td>)}
                          <td className="py-2 px-3 text-right font-bold text-gray-500">{formatCurrency(channelRevenue.totalMaterialCost)}</td>
                        </tr>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-3 font-medium text-green-700 dark:text-green-400">제품이익</td>
                          {channels.map(ch => <td key={ch.name} className={`py-2 px-3 text-right font-medium ${ch.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(ch.profit1)}</td>)}
                          <td className={`py-2 px-3 text-right font-bold ${totals.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(totals.profit1)}</td>
                        </tr>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-1 px-3 text-gray-400 text-xs">마진율</td>
                          {channels.map(ch => <td key={ch.name} className="py-1 px-3 text-right text-xs text-gray-400">{ch.marginRate1.toFixed(1)}%</td>)}
                          <td className="py-1 px-3 text-right text-xs text-gray-400">{totals.revenue > 0 ? (totals.profit1 / totals.revenue * 100).toFixed(1) : '0.0'}%</td>
                        </tr>

                        {/* 2단계: 채널이익 */}
                        <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700">
                          <td colSpan={channels.length + 2} className="py-1.5 px-3 text-xs font-bold text-blue-700 dark:text-blue-400">2단계: 채널이익</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 채널 변동비</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.channelVariableCost)}</td>)}
                          <td className="py-2 px-3 text-right font-bold text-gray-500">{formatCurrency(channels.reduce((s, c) => s + c.channelVariableCost, 0))}</td>
                        </tr>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-3 font-medium text-blue-700 dark:text-blue-400">채널이익</td>
                          {channels.map(ch => <td key={ch.name} className={`py-2 px-3 text-right font-medium ${ch.profit2 >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(ch.profit2)}</td>)}
                          <td className={`py-2 px-3 text-right font-bold ${totals.profit2 >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(totals.profit2)}</td>
                        </tr>

                        {/* 3단계: 사업부이익 */}
                        <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-gray-200 dark:border-gray-700">
                          <td colSpan={channels.length + 2} className="py-1.5 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">3단계: 사업부이익</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 pl-6">(-) 채널 고정비</td>
                          {channels.map(ch => <td key={ch.name} className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.channelFixedCost)}</td>)}
                          <td className="py-2 px-3 text-right font-bold text-gray-500">{formatCurrency(channels.reduce((s, c) => s + c.channelFixedCost, 0))}</td>
                        </tr>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                          <td className="py-2 px-3 font-bold text-emerald-700 dark:text-emerald-400">사업부이익</td>
                          {channels.map(ch => <td key={ch.name} className={`py-2 px-3 text-right font-bold ${ch.profit3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(ch.profit3)}</td>)}
                          <td className={`py-2 px-3 text-right font-bold ${totals.profit3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totals.profit3)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-3 text-gray-400 text-xs">마진율</td>
                          {channels.map(ch => (
                            <td key={ch.name} className={`py-1 px-3 text-right text-xs font-medium ${ch.marginRate3 >= config.profitMarginGood ? 'text-green-600' : ch.marginRate3 >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{ch.marginRate3.toFixed(1)}%</td>
                          ))}
                          <td className="py-1 px-3 text-right text-xs font-bold">{totals.revenue > 0 ? (totals.profit3 / totals.revenue * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* A2: 주간 채널별 매출 LineChart */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 채널별 매출 추이</h3>
                {weeklyChannelTrend.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyChannelTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="jasa" name="자사몰" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="coupang" name="쿠팡" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="kurly" name="컬리" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="total" name="합계" stroke="#6B7280" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">매출 데이터 없음</p>}
              </div>

              {/* 점유율 Pie + 마진율 비교 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널 점유율</h3>
                  {channels.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={channels} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="revenue" nameKey="name">
                            {channels.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                </div>

                {hasProfit && channelRevenue && (
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 마진율 비교</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={channels.map(ch => ({
                          name: ch.name,
                          '제품마진': ch.revenue > 0 ? Math.round(ch.profit1 / ch.revenue * 1000) / 10 : 0,
                          '채널마진': ch.revenue > 0 ? Math.round(ch.profit2 / ch.revenue * 1000) / 10 : 0,
                          '사업부마진': ch.marginRate3,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: number) => `${v}%`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="제품마진" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="채널마진" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="사업부마진" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      마진율 = 이익 / 매출 x 100 | 기준: {config.profitMarginGood}% 이상 양호
                    </p>
                  </div>
                )}
              </div>
            </div>
            </InsightSection>
          );
        }

        if (activeTab === 'product') {
          const topItems = productProfit?.items.slice(0, 10) || [];
          const bottomItems = [...(productProfit?.items || [])].reverse().slice(0, 10);
          return (
            <InsightSection id={["profit-product-top", "profit-product-loss", "profit-bep"]}>
            <div className="space-y-6">
              {/* A3: 최근 30일 기반 표시 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
                <span className="material-icons-outlined text-blue-500 text-lg">info</span>
                <p className="text-sm text-blue-700 dark:text-blue-300">{rangeLabelText} 판매 데이터 기준 품목별 매출/마진 분석입니다.</p>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 품목 수</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{productProfit?.items.length || 0}개</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">1위 품목</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 truncate">{topItems[0]?.productName || '-'}</p>
                  <p className="text-xs text-gray-400 mt-1">매출 {formatCurrency(topItems[0]?.revenue || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 매출</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(productProfit?.totalRevenue || 0)}</p>
                </div>
              </div>

              {/* Top / Bottom Bar Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-green-500">trending_up</span>
                    매출 상위 품목
                    <FormulaTooltip {...FORMULAS.productProfit} />
                  </h3>
                  {topItems.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="productName" width={100} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                            {topItems.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-8">데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">trending_down</span>
                    매출 하위 품목
                  </h3>
                  {bottomItems.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bottomItems.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="productName" width={100} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                            {bottomItems.slice(0, 7).map((_, i) => <Cell key={i} fill="#EF4444" />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-8">데이터 없음</p>}
                </div>
              </div>

              {/* 품목별 매출/마진 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">품목별 매출/마진</h3>
                {(productProfit?.items.length || 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">#</th>
                          <th className="text-left py-2 px-3 text-gray-500">품목명</th>
                          <th className="text-right py-2 px-3 text-gray-500">매출</th>
                          <th className="text-right py-2 px-3 text-gray-500">비용</th>
                          <th className="text-right py-2 px-3 text-gray-500">마진</th>
                          <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productProfit!.items.slice(0, 20).map((item, i) => (
                          <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick({ id: item.productCode, rank: i + 1, skuName: item.productName, channel: '', profit: item.margin, margin: item.marginRate, kind: 'profit' })}>
                            <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.revenue)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.cost)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.margin)}</td>
                            <td className={`py-2 px-3 text-right ${item.marginRate >= config.profitMarginGood ? 'text-green-600' : item.marginRate >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                              {formatPercent(item.marginRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>

              {/* BEP 분석 섹션 */}
              {productBEP && productBEP.items.length > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">전체 BEP 매출</p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(productBEP.overallBEPSales)}</p>
                    </div>
                    <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">BEP 달성률</p>
                      <p className={`text-2xl font-bold mt-1 ${productBEP.overallAchievementRate >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {productBEP.overallAchievementRate}%
                      </p>
                    </div>
                    <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">여유비율</p>
                      <p className={`text-2xl font-bold mt-1 ${productBEP.overallSafetyMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {productBEP.overallSafetyMargin}%
                      </p>
                    </div>
                    <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">평균 기여이익률</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-1">{productBEP.avgContributionRate}%</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="material-icons-outlined text-orange-500">balance</span>
                      품목별 손익분기점 (BEP)
                      <FormulaTooltip {...FORMULAS.productBEP} />
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      고정비 {formatCurrency(productBEP.totalFixedCost)}을 매출비중으로 배분 | 여유비율 낮은 순 정렬
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">품목</th>
                            <th className="text-right py-2 px-3 text-gray-500">판매단가</th>
                            <th className="text-right py-2 px-3 text-gray-500">변동단가</th>
                            <th className="text-right py-2 px-3 text-gray-500">기여이익률</th>
                            <th className="text-right py-2 px-3 text-blue-600">BEP 수량</th>
                            <th className="text-right py-2 px-3 text-gray-500">실제 수량</th>
                            <th className="text-right py-2 px-3 text-gray-500">달성률</th>
                            <th className="text-right py-2 px-3 text-gray-500">여유비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productBEP.items.slice(0, 20).map(item => (
                            <tr key={item.productCode} className={`border-b border-gray-100 dark:border-gray-800 ${item.safetyMargin < 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                              <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.unitVariableCost)}</td>
                              <td className={`py-2 px-3 text-right font-medium ${item.contributionRate >= 30 ? 'text-green-600' : item.contributionRate >= 10 ? 'text-orange-500' : 'text-red-600'}`}>{item.contributionRate}%</td>
                              <td className="py-2 px-3 text-right text-blue-600 font-medium">{item.bepUnits.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{item.actualUnits.toLocaleString()}</td>
                              <td className={`py-2 px-3 text-right font-medium ${item.achievementRate >= 100 ? 'text-green-600' : 'text-red-600'}`}>{item.achievementRate}%</td>
                              <td className={`py-2 px-3 text-right font-bold ${item.safetyMargin >= 20 ? 'text-green-600' : item.safetyMargin >= 0 ? 'text-orange-500' : 'text-red-600'}`}>
                                {item.safetyMargin > 0 ? '+' : ''}{item.safetyMargin}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            </InsightSection>
          );
        }

        // ========== A5: 예산 대비 실적 ==========
        if (activeTab === 'budget') {
          if (!budgetActual) {
            return <p className="text-gray-400 text-center py-20">비용 데이터가 없습니다. 데이터 동기화 후 확인하세요.</p>;
          }

          return (
            <InsightSection id="profit-budget">
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 예산</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(budgetActual.totalBudget)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 실적</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(budgetActual.totalActual)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">차이 ({budgetActual.diff <= 0 ? '절감' : '초과'})</p>
                  <p className={`text-2xl font-bold mt-1 ${budgetActual.diff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {budgetActual.diff > 0 ? '+' : ''}{formatCurrency(budgetActual.diff)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">달성률</p>
                  <p className={`text-2xl font-bold mt-1 ${budgetActual.achievementRate <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {budgetActual.achievementRate}%
                  </p>
                </div>
              </div>

              {/* 비용 요소별 예산 vs 실적 Bar */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">비용 요소별 예산 vs 실적</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetActual.items} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="budget" name="예산" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="실적" radius={[4, 4, 0, 0]}>
                        {budgetActual.items.map((item, i) => (
                          <Cell key={i} fill={item.actual > item.budget ? '#EF4444' : item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 일별 누적 지출 LineChart */}
              {budgetActual.dailyCumulative.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">일별 누적 지출</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={budgetActual.dailyCumulative} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="budget" name="예산(누적)" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="actual" name="실적(누적)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 요소별 상세 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">요소별 예산 상세</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">항목</th>
                        <th className="text-right py-2 px-3 text-gray-500">예산</th>
                        <th className="text-right py-2 px-3 text-blue-600">실적</th>
                        <th className="text-right py-2 px-3 text-gray-500">차이</th>
                        <th className="text-right py-2 px-3 text-gray-500">달성률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetActual.items.map(item => (
                        <tr key={item.name} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium" style={{ color: item.color }}>{item.name}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(item.budget)}</td>
                          <td className="py-2 px-3 text-right text-blue-600 font-medium">{formatCurrency(item.actual)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${item.diff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                          </td>
                          <td className={`py-2 px-3 text-right ${item.rate <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.rate}%
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                        <td className="py-2 px-3">합계</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(budgetActual.totalBudget)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(budgetActual.totalActual)}</td>
                        <td className={`py-2 px-3 text-right ${budgetActual.diff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {budgetActual.diff > 0 ? '+' : ''}{formatCurrency(budgetActual.diff)}
                        </td>
                        <td className={`py-2 px-3 text-right ${budgetActual.achievementRate <= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {budgetActual.achievementRate}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  예산 설정은 설정 &gt; 월간 예산 설정에서 변경할 수 있습니다.
                </p>
              </div>
            </div>
            </InsightSection>
          );
        }

        // ========== A6: 현금 흐름 ==========
        if (activeTab === 'cashflow') {
          const cf = insights?.cashFlow;
          return (
            <InsightSection id="profit-cashflow">
            <div className="space-y-6">
              {/* 안내 배너 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
                <span className="material-icons-outlined text-blue-500 text-lg">info</span>
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">매출/매입 데이터 기반 추정 현금흐름입니다.</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">채널별 정산주기는 설정 &gt; 채널 정산주기 설정에서 변경할 수 있습니다. (자사몰: {config.channelCollectionDaysJasa}일, 쿠팡: {config.channelCollectionDaysCoupang}일, 컬리: {config.channelCollectionDaysKurly}일)</p>
                </div>
              </div>

              {/* KPI 카드 4개 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">순현금포지션</p>
                  <p className={`text-2xl font-bold mt-1 ${(cf?.netCashPosition || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(cf?.netCashPosition || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">현금전환주기 (CCC)</p>
                  <p className={`text-2xl font-bold mt-1 ${(cf?.cashConversionCycle || 0) <= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                    {cf?.cashConversionCycle ?? 0}일
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">재고회전율</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{cf?.inventoryTurnover ?? 0}회</p>
                  <p className="text-xs text-gray-400 mt-1">{cf?.inventoryTurnoverDays ?? 0}일</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">평균 회수기간</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{cf?.avgCollectionPeriod ?? 0}일</p>
                </div>
              </div>

              {/* 월별 현금흐름 차트 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-icons-outlined text-blue-500">waterfall_chart</span>
                  월별 현금흐름
                </h3>
                {(cf?.monthly?.length || 0) > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={cf!.monthly} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="cashInflow" name="유입(매출)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="cashOutflow" name="유출(비용)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="left" type="monotone" dataKey="netCashFlow" name="순현금흐름" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeCash" name="누적현금" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">현금흐름 데이터 없음</p>}
              </div>

              {/* 채널별 현금회수 */}
              {(cf?.channelCycles?.length || 0) > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-green-500">schedule</span>
                    채널별 현금회수 주기
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {cf!.channelCycles.map((cycle, i) => (
                      <div key={cycle.channelName} className="rounded-lg p-4 border border-gray-200 dark:border-gray-700" style={{ borderLeftWidth: 4, borderLeftColor: CHANNEL_COLORS[i] }}>
                        <p className="font-medium text-gray-900 dark:text-white">{cycle.channelName}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">입금 주기</span>
                            <span className="font-bold" style={{ color: CHANNEL_COLORS[i] }}>
                              {cycle.collectionDays === 0 ? '즉시' : `${cycle.collectionDays}일`}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">월 회수예정</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(cycle.monthlyCollected)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">기간 매출</span>
                            <span className="text-gray-600 dark:text-gray-400">{formatCurrency(cycle.revenue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 월별 현금흐름 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 현금흐름 상세</h3>
                {(cf?.monthly?.length || 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">월</th>
                          <th className="text-right py-2 px-3 text-blue-600">유입(매출)</th>
                          <th className="text-right py-2 px-3 text-red-600">유출(비용)</th>
                          <th className="text-right py-2 px-3 text-green-600">순현금흐름</th>
                          <th className="text-right py-2 px-3 text-purple-600">누적현금</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cf!.monthly.map(m => (
                          <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.month}</td>
                            <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(m.cashInflow)}</td>
                            <td className="py-2 px-3 text-right text-red-500">{formatCurrency(m.cashOutflow)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${m.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {m.netCashFlow >= 0 ? '+' : ''}{formatCurrency(m.netCashFlow)}
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${m.cumulativeCash >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                              {formatCurrency(m.cumulativeCash)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>
            </div>
            </InsightSection>
          );
        }

        // A4: trend tab — 주간 전환
        const weekly = revenueTrend?.weekly || [];
        const lastWeek = weekly[weekly.length - 1];
        return (
          <InsightSection id="profit-trend">
          <div className="space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">최근주 매출</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(lastWeek?.revenue || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">전주 대비 증감</p>
                <p className={`text-2xl font-bold mt-1 ${(lastWeek?.prevWeekChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(lastWeek?.prevWeekChange || 0) >= 0 ? '+' : ''}{lastWeek?.prevWeekChange || 0}%
                </p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">데이터 기간</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{weekly.length}주</p>
              </div>
            </div>

            {/* 주간 매출 Line + 마진율 듀얼축 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 매출 추이</h3>
              {weekly.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weekly} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number, name: string) => name === '마진율' ? `${v}%` : `₩${v.toLocaleString()}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="매출" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="profit" name="이익" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="marginRate" name="마진율" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
            </div>

            {/* 주간 요약 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 요약</h3>
              {weekly.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">주차</th>
                        <th className="text-right py-2 px-3 text-gray-500">매출</th>
                        <th className="text-right py-2 px-3 text-gray-500">재료비</th>
                        <th className="text-right py-2 px-3 text-green-600">제품이익</th>
                        <th className="text-right py-2 px-3 text-emerald-600">최종이익</th>
                        <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                        <th className="text-right py-2 px-3 text-gray-500">전주 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekly.map(w => (
                        <tr key={w.weekLabel} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200 text-xs">{w.weekLabel}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(w.revenue)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(w.cost)}</td>
                          <td className={`py-2 px-3 text-right ${w.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(w.profit1)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${w.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(w.profit)}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatPercent(w.marginRate)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${w.prevWeekChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {w.prevWeekChange >= 0 ? '+' : ''}{w.prevWeekChange}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
            </div>
          </div>
          </InsightSection>
        );
      }}
    </SubTabLayout>
  );
};
