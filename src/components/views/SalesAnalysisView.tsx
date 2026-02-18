import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, ComposedChart, Line, ScatterChart, Scatter,
  PieChart, Pie, AreaChart, Area,
} from 'recharts';
import { SubTabLayout } from '../layout';
import { formatCurrency, formatAxisKRW, formatPercent, formatQty } from '../../utils/format';
import type { DailySalesData, SalesDetailData, PurchaseData } from '../../services/googleSheetService';
import type { DashboardInsights } from '../../services/insightService';
import { computeProductProfit, computeChannelRevenue } from '../../services/insightService';
import { useBusinessConfig } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import { getDateRange, filterByDate } from '../../utils/dateRange';
import { groupByWeek, weekKeyToLabel, getSortedWeekEntries } from '../../utils/weeklyAggregation';
import { getChannelPricingSettings } from '../domain/ChannelCostAdmin';
import { getChannelCostSummaries } from '../domain';

interface Props {
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  onItemClick: (item: import('../../types').ModalItem) => void;
  onTabChange?: (tab: string) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const CHANNEL_COLORS: Record<string, string> = {
  '자사몰': '#3B82F6',
  '쿠팡': '#10B981',
  '컬리': '#F59E0B',
};
const QUADRANT_COLORS = {
  star: '#10B981',
  cashCow: '#3B82F6',
  volumeDriver: '#F59E0B',
  needsImprovement: '#EF4444',
};
const QUADRANT_LABELS = {
  star: '스타',
  cashCow: '캐시카우',
  volumeDriver: '볼륨드라이버',
  needsImprovement: '개선필요',
};
const QUADRANT_ICONS = {
  star: 'star',
  cashCow: 'savings',
  volumeDriver: 'trending_up',
  needsImprovement: 'warning',
};
const QUADRANT_DESC = {
  star: '고판매량 + 고마진',
  cashCow: '소량판매 + 고마진',
  volumeDriver: '고판매량 + 저마진',
  needsImprovement: '소량판매 + 저마진',
};

export const SalesAnalysisView: React.FC<Props> = ({ dailySales, salesDetail, purchases, insights, onItemClick, onTabChange }) => {
  const config = useBusinessConfig();
  const { dateRange } = useUI();
  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const filteredDailySales = useMemo(() => filterByDate(dailySales, rangeStart, rangeEnd), [dailySales, rangeStart, rangeEnd]);
  const filteredSalesDetail = useMemo(() => filterByDate(salesDetail, rangeStart, rangeEnd), [salesDetail, rangeStart, rangeEnd]);
  const filteredPurchases = useMemo(() => filterByDate(purchases, rangeStart, rangeEnd), [purchases, rangeStart, rangeEnd]);

  // 품목별 수익성 (기존 insightService 활용)
  const productProfit = useMemo(
    () => filteredSalesDetail.length > 0 ? computeProductProfit(filteredSalesDetail, filteredPurchases) : null,
    [filteredSalesDetail, filteredPurchases]
  );

  // ====== 공통 집계 데이터 ======

  // 품목별 매출/수량 집계
  const productAgg = useMemo(() => {
    const map = new Map<string, { code: string; name: string; revenue: number; quantity: number; channels: Map<string, number> }>();
    filteredSalesDetail.forEach(s => {
      const key = s.productCode || s.productName;
      const existing = map.get(key) || { code: s.productCode, name: s.productName, revenue: 0, quantity: 0, channels: new Map() };
      existing.revenue += s.total;
      existing.quantity += s.quantity;
      existing.channels.set(s.customer, (existing.channels.get(s.customer) || 0) + s.total);
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [filteredSalesDetail]);

  // 채널 목록 (동적)
  const channelList = useMemo(() => {
    const set = new Set<string>();
    filteredSalesDetail.forEach(s => { if (s.customer) set.add(s.customer); });
    return Array.from(set);
  }, [filteredSalesDetail]);

  // 채널별 품목별 집계 (정산매출 = 공급가액 기준)
  const channelProductAgg = useMemo(() => {
    const map = new Map<string, Map<string, { name: string; revenue: number; quantity: number }>>();
    filteredSalesDetail.forEach(s => {
      if (!map.has(s.customer)) map.set(s.customer, new Map());
      const chMap = map.get(s.customer)!;
      const key = s.productCode || s.productName;
      const ex = chMap.get(key) || { name: s.productName, revenue: 0, quantity: 0 };
      ex.revenue += s.supplyAmount;
      ex.quantity += s.quantity;
      chMap.set(key, ex);
    });
    return map;
  }, [filteredSalesDetail]);

  const [channelFilter, setChannelFilter] = useState('all');
  const [matrixView, setMatrixView] = useState<'chart' | 'table'>('chart');
  const [revenueType, setRevenueType] = useState<'settlement' | 'recommended' | 'independent'>('settlement');

  // 수익성 매트릭스 데이터 (탭과 무관하게 최상위에서 계산)
  const matrixData = useMemo(() => {
    if (!productProfit || productProfit.items.length === 0) return { items: [] as any[], stats: { star: 0, cashCow: 0, volumeDriver: 0, needsImprovement: 0 }, medianQty: 0, medianMargin: 0 };

    const items = productProfit.items.filter(p => p.quantity > 0 && p.revenue > 0);
    const medianQty = (() => {
      const sorted = [...items].sort((a, b) => a.quantity - b.quantity);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid].quantity : (sorted[mid - 1]?.quantity + sorted[mid]?.quantity) / 2 || 0;
    })();
    const medianMargin = (() => {
      const sorted = [...items].sort((a, b) => a.marginRate - b.marginRate);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid].marginRate : (sorted[mid - 1]?.marginRate + sorted[mid]?.marginRate) / 2 || 0;
    })();

    const classified = items.map(p => {
      let quadrant: 'star' | 'cashCow' | 'volumeDriver' | 'needsImprovement';
      if (p.quantity >= medianQty && p.marginRate >= medianMargin) quadrant = 'star';
      else if (p.quantity < medianQty && p.marginRate >= medianMargin) quadrant = 'cashCow';
      else if (p.quantity >= medianQty && p.marginRate < medianMargin) quadrant = 'volumeDriver';
      else quadrant = 'needsImprovement';
      return { ...p, quadrant, medianQty, medianMargin };
    });

    const stats = {
      star: classified.filter(c => c.quadrant === 'star').length,
      cashCow: classified.filter(c => c.quadrant === 'cashCow').length,
      volumeDriver: classified.filter(c => c.quadrant === 'volumeDriver').length,
      needsImprovement: classified.filter(c => c.quadrant === 'needsImprovement').length,
    };

    return { items: classified, stats, medianQty, medianMargin };
  }, [productProfit]);

  // 채널 심층분석 데이터 (정산매출 = 공급가액 기준)
  const channelMetrics = useMemo(() => {
    return channelList.map(ch => {
      const chItems = filteredSalesDetail.filter(s => s.customer === ch);
      const totalRevenue = chItems.reduce((s, d) => s + d.supplyAmount, 0);
      const totalQuantity = chItems.reduce((s, d) => s + d.quantity, 0);
      const uniqueProducts = new Set(chItems.map(s => s.productCode || s.productName)).size;
      const avgOrderValue = chItems.length > 0 ? Math.round(totalRevenue / chItems.length) : 0;

      const sorted = [...chItems].sort((a, b) => a.date.localeCompare(b.date));
      const mid = Math.floor(sorted.length / 2);
      const firstRev = sorted.slice(0, mid).reduce((s, d) => s + d.supplyAmount, 0);
      const secondRev = sorted.slice(mid).reduce((s, d) => s + d.supplyAmount, 0);
      const growthRate = firstRev > 0 ? Math.round(((secondRev - firstRev) / firstRev) * 1000) / 10 : 0;

      const chMap = channelProductAgg.get(ch);
      const topProduct = chMap
        ? Array.from(chMap.values()).sort((a, b) => b.revenue - a.revenue)[0]?.name || '-'
        : '-';

      return { channel: ch, totalRevenue, totalQuantity, uniqueProducts, avgOrderValue, growthRate, topProduct, txCount: chItems.length };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [channelList, filteredSalesDetail, channelProductAgg]);

  // salesDetail에서 채널/일자별 정산매출(공급가액) 집계 (settlement 유형용)
  const settlementByDateChannel = useMemo(() => {
    const map = new Map<string, { jasa: number; coupang: number; kurly: number }>();
    filteredSalesDetail.forEach(s => {
      const existing = map.get(s.date) || { jasa: 0, coupang: 0, kurly: 0 };
      const ch = (s.customer || '').toLowerCase();
      if (ch.includes('자사') || ch.includes('jasa') || ch.includes('고도몰') || ch.includes('집반찬')) existing.jasa += (s.supplyAmount || 0);
      else if (ch.includes('쿠팡') || ch.includes('포워드')) existing.coupang += (s.supplyAmount || 0);
      else if (ch.includes('컬리')) existing.kurly += (s.supplyAmount || 0);
      map.set(s.date, existing);
    });
    return map;
  }, [filteredSalesDetail]);

  // salesDetail에서 채널/일자별 권장판매매출 집계 (recommended 유형용)
  const recommendedByDateChannel = useMemo(() => {
    const map = new Map<string, { jasa: number; coupang: number; kurly: number }>();
    filteredSalesDetail.forEach(s => {
      if (!s.recommendedRevenue || s.recommendedRevenue <= 0) return;
      const existing = map.get(s.date) || { jasa: 0, coupang: 0, kurly: 0 };
      const ch = (s.customer || '').toLowerCase();
      if (ch.includes('자사') || ch.includes('jasa') || ch.includes('고도몰') || ch.includes('집반찬')) existing.jasa += s.recommendedRevenue;
      else if (ch.includes('쿠팡') || ch.includes('포워드')) existing.coupang += s.recommendedRevenue;
      else if (ch.includes('컬리')) existing.kurly += s.recommendedRevenue;
      map.set(s.date, existing);
    });
    return map;
  }, [filteredSalesDetail]);

  // 채널별 할인매출비율 (정산매출 계산용)
  const promoRates = useMemo(() => {
    const settings = getChannelPricingSettings();
    return {
      jasa: (settings.find(s => s.channelName === '자사몰')?.promotionDiscountRate ?? 0) / 100,
      coupang: (settings.find(s => s.channelName === '쿠팡')?.promotionDiscountRate ?? 0) / 100,
      kurly: (settings.find(s => s.channelName === '컬리')?.promotionDiscountRate ?? 0) / 100,
    };
  }, []);

  // 채널별 일자별 매출 데이터 (매출 유형별)
  const channelDailyData = useMemo(() => {
    return filteredDailySales
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => {
        let jasa: number, coupang: number, kurly: number;
        if (revenueType === 'recommended') {
          // salesDetail에서 직접 집계된 권장판매매출 우선, 없으면 역산 폴백
          const rec = recommendedByDateChannel.get(d.date);
          if (rec && (rec.jasa + rec.coupang + rec.kurly) > 0) {
            jasa = rec.jasa;
            coupang = rec.coupang;
            kurly = rec.kurly;
          } else {
            jasa = d.jasaHalf * 2;
            coupang = d.coupangHalf * 2;
            kurly = d.kurlyHalf * 2;
          }
        } else if (revenueType === 'independent') {
          jasa = d.jasaHalf;
          coupang = d.coupangHalf;
          kurly = d.kurlyHalf;
        } else {
          // 정산매출: salesDetail 공급가액에서 할인매출 차감
          const stl = settlementByDateChannel.get(d.date);
          if (stl && (stl.jasa + stl.coupang + stl.kurly) > 0) {
            jasa = Math.round(stl.jasa * (1 - promoRates.jasa));
            coupang = Math.round(stl.coupang * (1 - promoRates.coupang));
            kurly = Math.round(stl.kurly * (1 - promoRates.kurly));
          } else {
            jasa = d.jasaPrice;
            coupang = d.coupangPrice;
            kurly = d.kurlyPrice;
          }
        }
        return {
          date: d.date.slice(5),
          fullDate: d.date,
          자사몰: jasa,
          쿠팡: coupang,
          컬리: kurly,
          합계: jasa + coupang + kurly,
        };
      });
  }, [filteredDailySales, revenueType, recommendedByDateChannel, settlementByDateChannel]);

  // 채널별 매출 유형별 합계
  const channelRevenueSummary = useMemo(() => {
    const sum = { 자사몰: 0, 쿠팡: 0, 컬리: 0, 합계: 0 };
    channelDailyData.forEach(d => {
      sum['자사몰'] += d['자사몰'];
      sum['쿠팡'] += d['쿠팡'];
      sum['컬리'] += d['컬리'];
      sum['합계'] += d['합계'];
    });
    return sum;
  }, [channelDailyData]);

  // 채널별 품목 교차 분석
  const channelProductComparison = useMemo(() => {
    const allProducts = new Set<string>();
    channelProductAgg.forEach(chMap => {
      chMap.forEach((_, key) => allProducts.add(key));
    });

    return Array.from(allProducts).map(code => {
      const row: Record<string, any> = { code };
      let name = '';
      let totalRev = 0;
      channelList.forEach(ch => {
        const chMap = channelProductAgg.get(ch);
        const item = chMap?.get(code);
        row[ch] = item?.revenue || 0;
        totalRev += item?.revenue || 0;
        if (item?.name && !name) name = item.name;
      });
      row.name = name;
      row.totalRevenue = totalRev;
      return row;
    }).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 15);
  }, [channelList, channelProductAgg]);

  const tabs = [
    { key: 'trend', label: '매출 트렌드', icon: 'show_chart' },
    { key: 'bestseller', label: '베스트셀러', icon: 'emoji_events' },
    { key: 'surge', label: '급상승/급하락', icon: 'trending_up' },
    { key: 'matrix', label: '수익성 매트릭스', icon: 'grid_view' },
    { key: 'channel', label: '채널 심층분석', icon: 'store' },
  ];

  return (
    <SubTabLayout title="매출 분석" tabs={tabs} onTabChange={onTabChange}>
      {(activeTab) => {
        // ========== 매출 트렌드 ==========
        if (activeTab === 'trend') {
          // 정산매출 = computeChannelRevenue (채널 매핑 + promotionDiscount 적용)
          const channelCosts = getChannelCostSummaries();
          const cr = computeChannelRevenue(filteredDailySales, filteredPurchases, channelCosts, config, filteredSalesDetail);
          const totalRevenue = cr.totalRawSupplyAmount > 0
            ? cr.totalRawSupplyAmount - cr.totalPromotionDiscountAmount
            : filteredDailySales.reduce((s, d) => s + d.totalRevenue, 0);
          const totalDays = filteredDailySales.length || 1;
          const avgDailyRevenue = Math.round(totalRevenue / totalDays);
          const totalTxCount = filteredSalesDetail.length;
          const uniqueProducts = new Set(filteredSalesDetail.map(s => s.productCode || s.productName)).size;

          // 주간 매출 집계
          const weeklyRevenue = (() => {
            const weekMap = groupByWeek(filteredDailySales, 'date');
            const sorted = getSortedWeekEntries(weekMap);
            return sorted.map(([weekKey, items], idx) => {
              const rev = items.reduce((s, d) => s + d.totalRevenue, 0);
              const prevRev = idx > 0
                ? sorted[idx - 1][1].reduce((s, d) => s + d.totalRevenue, 0)
                : 0;
              const growthRate = prevRev > 0 ? Math.round(((rev - prevRev) / prevRev) * 1000) / 10 : 0;
              return {
                weekLabel: weekKeyToLabel(weekKey),
                revenue: rev,
                growthRate: idx > 0 ? growthRate : 0,
                jasa: items.reduce((s, d) => s + d.jasaPrice, 0),
                coupang: items.reduce((s, d) => s + d.coupangPrice, 0),
                kurly: items.reduce((s, d) => s + d.kurlyPrice, 0),
              };
            });
          })();

          // 요일별 평균 매출
          const dayOfWeekRevenue = (() => {
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            return dayNames.map((name, idx) => {
              const items = filteredDailySales.filter(d => new Date(d.date).getDay() === idx);
              const avg = items.length > 0 ? Math.round(items.reduce((s, d) => s + d.totalRevenue, 0) / items.length) : 0;
              return { day: name, avgRevenue: avg, count: items.length };
            });
          })();

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">정산매출</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">일 평균 매출</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(avgDailyRevenue)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">거래 건수</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalTxCount.toLocaleString()}건</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">취급 품목 수</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{uniqueProducts}개</p>
                </div>
              </div>

              {/* 주간 매출 추이 + 전주대비 성장률 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 매출 추이</h3>
                {weeklyRevenue.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyRevenue} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number, name: string) => name === '성장률' ? `${v}%` : formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="revenue" name="매출" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="growthRate" name="성장률" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">매출 데이터 없음</p>}
              </div>

              {/* 채널별 주간 추이 + 요일별 패턴 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 주간 매출</h3>
                  {weeklyRevenue.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyRevenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="jasa" name="자사몰" stackId="ch" fill="#3B82F6" />
                          <Bar dataKey="coupang" name="쿠팡" stackId="ch" fill="#10B981" />
                          <Bar dataKey="kurly" name="컬리" stackId="ch" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">요일별 평균 매출</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dayOfWeekRevenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="avgRevenue" name="평균매출" radius={[4, 4, 0, 0]}>
                          {dayOfWeekRevenue.map((_, i) => (
                            <Cell key={i} fill={i === 0 || i === 6 ? '#EF4444' : '#3B82F6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">주말(빨강) / 평일(파랑)</p>
                </div>
              </div>
            </div>
          );
        }

        // ========== 베스트셀러 ==========
        if (activeTab === 'bestseller') {
          const sortedByRevenue = [...productAgg].sort((a, b) => b.revenue - a.revenue);
          const sortedByQuantity = [...productAgg].sort((a, b) => b.quantity - a.quantity);
          const top10Revenue = sortedByRevenue.slice(0, 10);
          const top10Quantity = sortedByQuantity.slice(0, 10);

          // 파레토 분석
          const totalRev = sortedByRevenue.reduce((s, p) => s + p.revenue, 0);
          let cumulative = 0;
          const paretoData = sortedByRevenue.slice(0, 20).map(p => {
            cumulative += p.revenue;
            return {
              name: p.name.length > 10 ? p.name.slice(0, 10) + '..' : p.name,
              revenue: p.revenue,
              cumulativeShare: totalRev > 0 ? Math.round((cumulative / totalRev) * 1000) / 10 : 0,
            };
          });

          // 상위 20%가 전체 매출의 몇 %?
          const top20pctCount = Math.max(1, Math.ceil(productAgg.length * 0.2));
          const top20pctRevenue = sortedByRevenue.slice(0, top20pctCount).reduce((s, p) => s + p.revenue, 0);
          const top20pctShare = totalRev > 0 ? Math.round((top20pctRevenue / totalRev) * 1000) / 10 : 0;

          // 채널별 TOP 5
          const channelTops = channelList.map(ch => {
            const chMap = channelProductAgg.get(ch);
            if (!chMap) return { channel: ch, products: [] };
            const sorted = Array.from(chMap.values()).sort((a, b) => b.revenue - a.revenue);
            return { channel: ch, products: sorted.slice(0, 5) };
          });

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">취급 품목 수</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{productAgg.length}개</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">매출 집중도 (상위 20%)</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{top20pctShare}%</p>
                  <p className="text-xs text-gray-400 mt-1">{top20pctCount}개 품목</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">1위 품목 매출 비중</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {totalRev > 0 ? formatPercent(Math.round((top10Revenue[0]?.revenue || 0) / totalRev * 1000) / 10) : '0%'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{top10Revenue[0]?.name || '-'}</p>
                </div>
              </div>

              {/* 매출액 TOP 10 + 판매량 TOP 10 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">매출액 TOP 10</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={top10Revenue.map(p => ({ name: p.name.length > 10 ? p.name.slice(0, 10) + '..' : p.name, revenue: p.revenue }))}
                        layout="vertical" margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                          {top10Revenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">판매량 TOP 10</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={top10Quantity.map(p => ({ name: p.name.length > 10 ? p.name.slice(0, 10) + '..' : p.name, quantity: p.quantity }))}
                        layout="vertical" margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `${v.toLocaleString()}개`} />
                        <Bar dataKey="quantity" name="판매량" radius={[0, 4, 4, 0]}>
                          {top10Quantity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* 파레토 분석 (매출 집중도) */}
              {paretoData.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">매출 집중도 (파레토 분석)</h3>
                  <p className="text-xs text-gray-500 mb-4">상위 품목이 전체 매출에서 차지하는 누적 비중</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={paretoData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" height={50} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                        <Tooltip formatter={(v: number, name: string) => name === '누적 비중' ? `${v}%` : formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="revenue" name="매출" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeShare" name="누적 비중" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 채널별 TOP 5 */}
              {channelTops.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 인기 품목 TOP 5</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {channelTops.map(ct => (
                      <div key={ct.channel} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ct.channel] || '#6B7280' }} />
                          {ct.channel}
                        </h4>
                        {ct.products.length > 0 ? (
                          <div className="space-y-2">
                            {ct.products.map((p, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                                  <span className="font-bold text-gray-400 mr-1">{i + 1}.</span>
                                  {p.name}
                                </span>
                                <span className="text-gray-500 whitespace-nowrap">{formatCurrency(p.revenue)}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-400">데이터 없음</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ========== 급상승/급하락 ==========
        if (activeTab === 'surge') {
          // 전반기 vs 후반기 비교
          const surgeAnalysis = (() => {
            if (filteredSalesDetail.length === 0) return { surge: [], decline: [], newProducts: [], disappeared: [] };

            const sorted = [...filteredSalesDetail].sort((a, b) => a.date.localeCompare(b.date));
            const midIdx = Math.floor(sorted.length / 2);
            const firstHalf = sorted.slice(0, midIdx);
            const secondHalf = sorted.slice(midIdx);

            const aggregate = (data: SalesDetailData[]) => {
              const map = new Map<string, { name: string; quantity: number; revenue: number }>();
              data.forEach(s => {
                const key = s.productCode || s.productName;
                const ex = map.get(key) || { name: s.productName, quantity: 0, revenue: 0 };
                ex.quantity += s.quantity;
                ex.revenue += s.total;
                map.set(key, ex);
              });
              return map;
            };

            const firstAgg = aggregate(firstHalf);
            const secondAgg = aggregate(secondHalf);

            const allCodes = new Set([...firstAgg.keys(), ...secondAgg.keys()]);
            const surge: { code: string; name: string; prevQty: number; recentQty: number; prevRev: number; recentRev: number; qtyChangeRate: number; revChangeRate: number }[] = [];
            const decline: typeof surge = [];
            const newProducts: { code: string; name: string; quantity: number; revenue: number }[] = [];
            const disappeared: { code: string; name: string; quantity: number; revenue: number }[] = [];

            allCodes.forEach(code => {
              const first = firstAgg.get(code);
              const second = secondAgg.get(code);

              if (!first && second) {
                newProducts.push({ code, name: second.name, quantity: second.quantity, revenue: second.revenue });
                return;
              }
              if (first && !second) {
                disappeared.push({ code, name: first.name, quantity: first.quantity, revenue: first.revenue });
                return;
              }
              if (!first || !second) return;

              const qtyChangeRate = first.quantity > 0 ? Math.round(((second.quantity - first.quantity) / first.quantity) * 1000) / 10 : 0;
              const revChangeRate = first.revenue > 0 ? Math.round(((second.revenue - first.revenue) / first.revenue) * 1000) / 10 : 0;

              const item = {
                code, name: first.name,
                prevQty: first.quantity, recentQty: second.quantity,
                prevRev: first.revenue, recentRev: second.revenue,
                qtyChangeRate, revChangeRate,
              };

              if (qtyChangeRate > 20) surge.push(item);
              else if (qtyChangeRate < -20) decline.push(item);
            });

            surge.sort((a, b) => b.qtyChangeRate - a.qtyChangeRate);
            decline.sort((a, b) => a.qtyChangeRate - b.qtyChangeRate);
            newProducts.sort((a, b) => b.revenue - a.revenue);
            disappeared.sort((a, b) => b.revenue - a.revenue);

            return { surge, decline, newProducts, disappeared };
          })();

          const SurgeTable = ({ items, type }: { items: typeof surgeAnalysis.surge; type: 'surge' | 'decline' }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500">품목명</th>
                    <th className="text-right py-2 px-3 text-gray-500">전반기 수량</th>
                    <th className="text-right py-2 px-3 text-gray-500">후반기 수량</th>
                    <th className="text-right py-2 px-3 text-gray-500">수량 변화율</th>
                    <th className="text-right py-2 px-3 text-gray-500">전반기 매출</th>
                    <th className="text-right py-2 px-3 text-gray-500">후반기 매출</th>
                    <th className="text-right py-2 px-3 text-gray-500">매출 변화율</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 15).map(item => (
                    <tr key={item.code} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{item.prevQty.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{item.recentQty.toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right font-bold ${type === 'surge' ? 'text-green-600' : 'text-red-600'}`}>
                        {item.qtyChangeRate > 0 ? '+' : ''}{item.qtyChangeRate}%
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.prevRev)}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.recentRev)}</td>
                      <td className={`py-2 px-3 text-right font-medium ${item.revChangeRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.revChangeRate > 0 ? '+' : ''}{item.revChangeRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <p className="text-gray-400 text-center py-6">해당 품목 없음</p>}
            </div>
          );

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">급상승 품목</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{surgeAnalysis.surge.length}개</p>
                  <p className="text-xs text-gray-400 mt-1">판매량 +20% 이상</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">급하락 품목</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{surgeAnalysis.decline.length}개</p>
                  <p className="text-xs text-gray-400 mt-1">판매량 -20% 이상</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">신규 등장 품목</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{surgeAnalysis.newProducts.length}개</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">소멸 품목</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{surgeAnalysis.disappeared.length}개</p>
                </div>
              </div>

              {/* 급상승 TOP 차트 */}
              {surgeAnalysis.surge.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="material-icons-outlined text-green-500">trending_up</span>
                    급상승 품목 (판매량 +20% 이상)
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">기간 전반기 대비 후반기 판매량 증가율 기준</p>
                  <div className="h-56 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={surgeAnalysis.surge.slice(0, 10).map(s => ({
                          name: s.name.length > 10 ? s.name.slice(0, 10) + '..' : s.name,
                          변화율: s.qtyChangeRate,
                        }))}
                        layout="vertical" margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `+${v}%`} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `+${v}%`} />
                        <Bar dataKey="변화율" fill="#10B981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <SurgeTable items={surgeAnalysis.surge} type="surge" />
                </div>
              )}

              {/* 급하락 */}
              {surgeAnalysis.decline.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">trending_down</span>
                    급하락 품목 (판매량 -20% 이상)
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">기간 전반기 대비 후반기 판매량 감소율 기준</p>
                  <SurgeTable items={surgeAnalysis.decline} type="decline" />
                </div>
              )}

              {/* 신규 + 소멸 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {surgeAnalysis.newProducts.length > 0 && (
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-icons-outlined text-blue-500">fiber_new</span>
                      신규 등장 품목
                    </h3>
                    <div className="space-y-2">
                      {surgeAnalysis.newProducts.slice(0, 10).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                          <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                          <div className="text-right">
                            <span className="text-blue-600 font-medium">{formatCurrency(p.revenue)}</span>
                            <span className="text-gray-400 text-xs ml-2">{p.quantity.toLocaleString()}개</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {surgeAnalysis.disappeared.length > 0 && (
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-icons-outlined text-orange-500">remove_circle_outline</span>
                      소멸 품목
                    </h3>
                    <div className="space-y-2">
                      {surgeAnalysis.disappeared.slice(0, 10).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                          <span className="text-gray-500 line-through">{p.name}</span>
                          <div className="text-right">
                            <span className="text-orange-600 font-medium">{formatCurrency(p.revenue)}</span>
                            <span className="text-gray-400 text-xs ml-2">{p.quantity.toLocaleString()}개</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {filteredSalesDetail.length === 0 && (
                <p className="text-gray-400 text-center py-10">판매 데이터가 없습니다.</p>
              )}
            </div>
          );
        }

        // ========== 수익성 매트릭스 ==========
        if (activeTab === 'matrix') {
          const quadrantKeys = ['star', 'cashCow', 'volumeDriver', 'needsImprovement'] as const;

          return (
            <div className="space-y-6">
              {/* 4사분면 KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quadrantKeys.map(q => (
                  <div key={q} className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-icons-outlined text-sm" style={{ color: QUADRANT_COLORS[q] }}>{QUADRANT_ICONS[q]}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{QUADRANT_LABELS[q]}</p>
                    </div>
                    <p className="text-2xl font-bold mt-1" style={{ color: QUADRANT_COLORS[q] }}>{matrixData.stats[q]}개</p>
                    <p className="text-xs text-gray-400 mt-1">{QUADRANT_DESC[q]}</p>
                  </div>
                ))}
              </div>

              {/* 차트/테이블 토글 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMatrixView('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    matrixView === 'chart' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  매트릭스 차트
                </button>
                <button
                  onClick={() => setMatrixView('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    matrixView === 'table' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  상세 테이블
                </button>
              </div>

              {matrixView === 'chart' ? (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">수익성 매트릭스</h3>
                  <p className="text-xs text-gray-500 mb-4">X축: 판매량, Y축: 마진율 | 중앙값 기준 4사분면 분류</p>
                  {matrixData.items.length > 0 ? (
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" dataKey="quantity" name="판매량" tick={{ fontSize: 10 }} />
                          <YAxis type="number" dataKey="marginRate" name="마진율" tick={{ fontSize: 10 }} unit="%" />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg text-xs">
                                  <p className="font-bold text-gray-800 dark:text-white mb-1">{d.productName}</p>
                                  <p>판매량: {d.quantity.toLocaleString()}개</p>
                                  <p>매출: {formatCurrency(d.revenue)}</p>
                                  <p>마진율: {formatPercent(d.marginRate)}</p>
                                  <p className="mt-1 font-medium" style={{ color: QUADRANT_COLORS[d.quadrant as keyof typeof QUADRANT_COLORS] }}>
                                    {QUADRANT_LABELS[d.quadrant as keyof typeof QUADRANT_LABELS]}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          {quadrantKeys.map(q => (
                            <Scatter
                              key={q}
                              name={QUADRANT_LABELS[q]}
                              data={matrixData.items.filter(i => i.quadrant === q)}
                              fill={QUADRANT_COLORS[q]}
                            />
                          ))}
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">수익성 데이터가 없습니다.</p>}
                </div>
              ) : (
                /* 상세 테이블 뷰 */
                <div className="space-y-6">
                  {quadrantKeys.map(q => {
                    const items = matrixData.items.filter(i => i.quadrant === q);
                    if (items.length === 0) return null;
                    return (
                      <div key={q} className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: QUADRANT_COLORS[q] }}>
                          <span className="material-icons-outlined">{QUADRANT_ICONS[q]}</span>
                          {QUADRANT_LABELS[q]} — {QUADRANT_DESC[q]} ({items.length}개)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 px-3 text-gray-500">품목명</th>
                                <th className="text-right py-2 px-3 text-gray-500">판매량</th>
                                <th className="text-right py-2 px-3 text-gray-500">권장판매매출</th>
                                <th className="text-right py-2 px-3 text-gray-500">정산매출</th>
                                <th className="text-right py-2 px-3 text-gray-500">수수료율</th>
                                <th className="text-right py-2 px-3 text-gray-500">원가</th>
                                <th className="text-right py-2 px-3 text-gray-500">마진</th>
                                <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.sort((a, b) => b.revenue - a.revenue).slice(0, 15).map(item => (
                                <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                                  <td className="py-2 px-3 text-right text-gray-500">{item.quantity.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-blue-600">{item.recommendedRevenue > 0 ? formatCurrency(item.recommendedRevenue) : '-'}</td>
                                  <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.revenue)}</td>
                                  <td className="py-2 px-3 text-right text-orange-600">{item.commissionRate > 0 ? `${item.commissionRate}%` : '-'}</td>
                                  <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.cost)}</td>
                                  <td className={`py-2 px-3 text-right font-medium ${item.margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(item.margin)}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold ${item.marginRate >= 20 ? 'text-green-600' : item.marginRate >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                    {formatPercent(item.marginRate)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 볼륨드라이버 경고 (잘팔리는데 마진 낮은 품목) */}
              {matrixData.items.filter(i => i.quadrant === 'volumeDriver').length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                    <span className="material-icons-outlined">lightbulb</span>
                    마케팅 인사이트: 볼륨드라이버 개선 기회
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    다음 품목들은 판매량이 높지만 마진율이 낮습니다. 단가 조정, 원가 절감, 또는 번들 구성으로 수익성을 개선할 수 있습니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {matrixData.items
                      .filter(i => i.quadrant === 'volumeDriver')
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, 5)
                      .map(item => (
                        <span key={item.productCode} className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                          {item.productName} (마진율 {formatPercent(item.marginRate)})
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ========== 채널 심층분석 ==========
        if (activeTab === 'channel') {
          const totalAllChannelRevenue = channelMetrics.reduce((s, c) => s + c.totalRevenue, 0);

          // 채널별 매출 비중 파이
          const channelPie = channelMetrics.map(c => ({
            name: c.channel,
            value: c.totalRevenue,
            share: totalAllChannelRevenue > 0 ? Math.round((c.totalRevenue / totalAllChannelRevenue) * 1000) / 10 : 0,
          }));

          // 채널 집중도 (HHI: 허핀달-허쉬만 지수)
          const hhi = channelPie.reduce((s, c) => s + (c.share * c.share), 0);
          const diversification = hhi > 0 ? Math.round((10000 / hhi) * 10) / 10 : 0;

          const REVENUE_TYPE_LABELS = {
            settlement: '정산매출',
            recommended: '권장판매매출',
            independent: '독립채산제 매출',
          } as const;
          const REVENUE_TYPE_DESC = {
            settlement: '할인 + 플랫폼 수수료 차감 후 실수령액',
            recommended: '권장판매가 기준 매출 (정가)',
            independent: '권장판매가의 50% (독립채산제 기준)',
          } as const;

          // 일평균 계산
          const days = channelDailyData.length || 1;
          const dailyAvg = channelRevenueSummary['합계'] / days;

          return (
            <div className="space-y-6">
              {/* 매출 유형 선택 + KPI 요약 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">채널별 일자별 매출</h3>
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {(['settlement', 'recommended', 'independent'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setRevenueType(type)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          revenueType === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {REVENUE_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="material-icons-outlined text-xs align-middle mr-1">info</span>
                  {REVENUE_TYPE_DESC[revenueType]}
                </p>

                {/* 합계 KPI 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  {(['자사몰', '쿠팡', '컬리'] as const).map(ch => (
                    <div key={ch} className="rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ch] || '#6B7280' }} />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ch}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatCurrency(channelRevenueSummary[ch])}</p>
                    </div>
                  ))}
                  <div className="rounded-lg p-3 border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">합계</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(channelRevenueSummary['합계'])}</p>
                  </div>
                  <div className="rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">일평균</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatCurrency(dailyAvg)}</p>
                  </div>
                </div>

                {/* 채널별 일자별 매출 스택 차트 */}
                {channelDailyData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={channelDailyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(channelDailyData.length / 15))} />
                        <YAxis tickFormatter={formatAxisKRW} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: number, name: string) => [formatCurrency(v), name]}
                          labelFormatter={(label: string) => `${label}`}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="자사몰" stackId="1" fill={CHANNEL_COLORS['자사몰']} stroke={CHANNEL_COLORS['자사몰']} fillOpacity={0.6} />
                        <Area type="monotone" dataKey="쿠팡" stackId="1" fill={CHANNEL_COLORS['쿠팡']} stroke={CHANNEL_COLORS['쿠팡']} fillOpacity={0.6} />
                        <Area type="monotone" dataKey="컬리" stackId="1" fill={CHANNEL_COLORS['컬리']} stroke={CHANNEL_COLORS['컬리']} fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">일별 매출 데이터가 없습니다.</p>}
              </div>

              {/* 채널별 KPI 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {channelMetrics.map(c => (
                  <div key={c.channel} className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[c.channel] || '#6B7280' }} />
                        {c.channel}
                      </h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.growthRate > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : c.growthRate < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.growthRate > 0 ? '+' : ''}{c.growthRate}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">매출</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(c.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">판매량</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{c.totalQuantity.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">건당 단가</p>
                        <p className="font-medium text-gray-600 dark:text-gray-400">{formatCurrency(c.avgOrderValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">품목 수</p>
                        <p className="font-medium text-gray-600 dark:text-gray-400">{c.uniqueProducts}개</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400">주력 품목</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{c.topProduct}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 매출 비중 + 다각화 지수 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 매출 비중</h3>
                  {channelPie.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={channelPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={((props: any) => `${props.name} ${props.share ?? 0}%`) as any}>
                            {channelPie.map((c, i) => <Cell key={i} fill={CHANNEL_COLORS[c.name] || COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널 다각화 지수</h3>
                  <div className="flex flex-col items-center justify-center h-56">
                    <p className="text-5xl font-bold text-blue-600">{diversification}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {diversification >= 2.5 ? '균형 분산' : diversification >= 1.5 ? '보통' : '특정 채널 집중'}
                    </p>
                    <p className="text-xs text-gray-400 mt-4 text-center">
                      HHI(허핀달-허쉬만 지수) 기반<br />
                      1.0 = 단일채널 집중 / {channelList.length}.0 = 완벽 균등 분산
                    </p>
                    <div className="w-full max-w-xs mt-4">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (diversification / Math.max(channelList.length, 1)) * 100)}%`,
                            backgroundColor: diversification >= 2.5 ? '#10B981' : diversification >= 1.5 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 채널별 품목 교차 분석 */}
              {channelProductComparison.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">채널별 품목 매출 비교 (TOP 15)</h3>
                  <p className="text-xs text-gray-500 mb-4">각 채널에서 해당 품목이 차지하는 매출</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목명</th>
                          {channelList.map(ch => (
                            <th key={ch} className="text-right py-2 px-3 text-gray-500">{ch}</th>
                          ))}
                          <th className="text-right py-2 px-3 text-gray-500">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelProductComparison.map(row => (
                          <tr key={row.code} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{row.name}</td>
                            {channelList.map(ch => (
                              <td key={ch} className="py-2 px-3 text-right text-gray-500">
                                {row[ch] > 0 ? formatCurrency(row[ch]) : <span className="text-gray-300">-</span>}
                              </td>
                            ))}
                            <td className="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">{formatCurrency(row.totalRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {channelMetrics.length === 0 && (
                <p className="text-gray-400 text-center py-10">채널별 판매 데이터가 없습니다.</p>
              )}
            </div>
          );
        }

        return <p className="text-gray-400 text-center py-10">탭을 선택하세요.</p>;
      }}
    </SubTabLayout>
  );
};
