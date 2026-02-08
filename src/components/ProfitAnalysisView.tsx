import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie, LineChart, Line,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { formatCurrency, formatAxisKRW, formatPercent } from '../utils/format';
import type { DailySalesData, SalesDetailData } from '../services/googleSheetService';
import type { DashboardInsights } from '../services/insightService';

interface Props {
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  insights: DashboardInsights | null;
  onItemClick: (item: any) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const CHANNEL_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

const formatDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
};

export const ProfitAnalysisView: React.FC<Props> = ({ dailySales, salesDetail, insights, onItemClick }) => {
  const channelRevenue = insights?.channelRevenue;
  const productProfit = insights?.productProfit;
  const revenueTrend = insights?.revenueTrend;

  const tabs = [
    { key: 'channel', label: '채널별 수익', icon: 'storefront' },
    { key: 'product', label: '품목별 랭킹', icon: 'leaderboard' },
    { key: 'trend', label: '수익 트렌드', icon: 'show_chart' },
  ];

  return (
    <SubTabLayout title="수익 분석" tabs={tabs}>
      {(activeTab) => {
        if (activeTab === 'channel') {
          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(channelRevenue?.channels || []).map((ch, i) => (
                  <div key={ch.name} className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ch.name} 매출</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: CHANNEL_COLORS[i] }}>
                      {formatCurrency(ch.revenue)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">점유율 {ch.share.toFixed(1)}%</p>
                  </div>
                ))}
              </div>

              {/* 일별 채널 Stacked Bar */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">일별 채널별 매출</h3>
                {(channelRevenue?.dailyTrend?.length || 0) > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={channelRevenue!.dailyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatDate} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} labelFormatter={formatDate} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="jasa" name="자사몰" stackId="a" fill="#3B82F6" />
                        <Bar dataKey="coupang" name="쿠팡" stackId="a" fill="#10B981" />
                        <Bar dataKey="kurly" name="컬리" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">매출 데이터 없음</p>}
              </div>

              {/* 점유율 Pie */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널 점유율</h3>
                {(channelRevenue?.channels?.length || 0) > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={channelRevenue!.channels} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="revenue" nameKey="name">
                          {channelRevenue!.channels.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
              </div>
            </div>
          );
        }

        if (activeTab === 'product') {
          const topItems = productProfit?.items.slice(0, 10) || [];
          const bottomItems = [...(productProfit?.items || [])].reverse().slice(0, 10);
          return (
            <div className="space-y-6">
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
                          <tr key={item.productCode} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick({ ...item, skuName: item.productName, margin: item.marginRate })}>
                            <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.revenue)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.cost)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.margin)}</td>
                            <td className={`py-2 px-3 text-right ${item.marginRate >= 20 ? 'text-green-600' : item.marginRate >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                              {formatPercent(item.marginRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>
            </div>
          );
        }

        // trend tab
        const monthly = revenueTrend?.monthly || [];
        const lastMonth = monthly[monthly.length - 1];
        const prevMonth = monthly.length >= 2 ? monthly[monthly.length - 2] : null;
        return (
          <div className="space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">최근월 매출</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(lastMonth?.revenue || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">전월 대비 증감</p>
                <p className={`text-2xl font-bold mt-1 ${(lastMonth?.prevMonthChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(lastMonth?.prevMonthChange || 0) >= 0 ? '+' : ''}{lastMonth?.prevMonthChange || 0}%
                </p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">데이터 기간</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{monthly.length}개월</p>
              </div>
            </div>

            {/* 월별 매출 Line + 마진율 듀얼축 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 매출 추이</h3>
              {monthly.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
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

            {/* 월별 요약 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 요약</h3>
              {monthly.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">월</th>
                        <th className="text-right py-2 px-3 text-gray-500">매출</th>
                        <th className="text-right py-2 px-3 text-gray-500">이익</th>
                        <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                        <th className="text-right py-2 px-3 text-gray-500">전월 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map(m => (
                        <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.month}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(m.revenue)}</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.profit)}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatPercent(m.marginRate)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${m.prevMonthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.prevMonthChange >= 0 ? '+' : ''}{m.prevMonthChange}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
            </div>
          </div>
        );
      }}
    </SubTabLayout>
  );
};
