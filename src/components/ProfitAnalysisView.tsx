import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie, LineChart, Line,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { formatCurrency, formatAxisKRW, formatPercent } from '../utils/format';
import type { DailySalesData, SalesDetailData } from '../services/googleSheetService';
import type { DashboardInsights } from '../services/insightService';
import { useBusinessConfig } from '../contexts/SettingsContext';

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
  const config = useBusinessConfig();
  const channelRevenue = insights?.channelRevenue;
  const productProfit = insights?.productProfit;
  const revenueTrend = insights?.revenueTrend;

  // 시뮬레이션 슬라이더 상태
  const [simMaterial, setSimMaterial] = useState(0);   // 재료비 변동률 (%)
  const [simSales, setSimSales] = useState(0);         // 판매량 변동률 (%)
  const [simCommission, setSimCommission] = useState(0); // 수수료율 변동 (%)

  const tabs = [
    { key: 'channel', label: '채널별 수익', icon: 'storefront' },
    { key: 'product', label: '품목별 랭킹', icon: 'leaderboard' },
    { key: 'trend', label: '수익 트렌드', icon: 'show_chart' },
    { key: 'simulation', label: '손익 시뮬레이션', icon: 'tune' },
  ];

  return (
    <SubTabLayout title="수익 분석" tabs={tabs}>
      {(activeTab) => {
        if (activeTab === 'channel') {
          const hasProfit = channelRevenue?.channels?.some(ch => ch.profit1 !== ch.revenue) ?? false;
          return (
            <div className="space-y-6">
              {/* KPI: 채널별 매출 + 3단계 이익 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(channelRevenue?.channels || []).map((ch, i) => (
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

              {/* 3단계 이익 비교 테이블 */}
              {hasProfit && channelRevenue && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 3단계 이익 분석</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">채널</th>
                          <th className="text-right py-2 px-3 text-gray-500">매출</th>
                          <th className="text-right py-2 px-3 text-gray-500">재료비</th>
                          <th className="text-right py-2 px-3 text-green-600">1단계(제품)</th>
                          <th className="text-right py-2 px-3 text-gray-500">채널변동비</th>
                          <th className="text-right py-2 px-3 text-blue-600">2단계(채널)</th>
                          <th className="text-right py-2 px-3 text-gray-500">채널고정비</th>
                          <th className="text-right py-2 px-3 text-emerald-600">3단계(사업부)</th>
                          <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelRevenue.channels.map((ch, i) => (
                          <tr key={ch.name} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 font-medium" style={{ color: CHANNEL_COLORS[i] }}>{ch.name}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(ch.revenue)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.directCost)}</td>
                            <td className={`py-2 px-3 text-right ${ch.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(ch.profit1)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.channelVariableCost)}</td>
                            <td className={`py-2 px-3 text-right ${ch.profit2 >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(ch.profit2)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.channelFixedCost)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${ch.profit3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(ch.profit3)}</td>
                            <td className={`py-2 px-3 text-right ${ch.marginRate3 >= config.profitMarginGood ? 'text-green-600' : ch.marginRate3 >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{ch.marginRate3.toFixed(1)}%</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                          <td className="py-2 px-3">합계</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(channelRevenue.totalRevenue)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(channelRevenue.totalDirectCost)}</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatCurrency(channelRevenue.totalProfit1)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">-</td>
                          <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(channelRevenue.totalProfit2)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">-</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(channelRevenue.totalProfit3)}</td>
                          <td className="py-2 px-3 text-right">{channelRevenue.totalRevenue > 0 ? (channelRevenue.totalProfit3 / channelRevenue.totalRevenue * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
            </div>
          );
        }

        // ========== 손익 시뮬레이션 ==========
        if (activeTab === 'simulation') {
          const baseRevenue = channelRevenue?.totalRevenue || 0;
          const baseDirectCost = channelRevenue?.totalDirectCost || 0;
          const baseVariableCost = (channelRevenue?.channels || []).reduce((s, ch) => s + ch.channelVariableCost, 0);
          const baseFixedCost = (channelRevenue?.channels || []).reduce((s, ch) => s + ch.channelFixedCost, 0);
          const baseProfit1 = channelRevenue?.totalProfit1 || 0;
          const baseProfit2 = channelRevenue?.totalProfit2 || 0;
          const baseProfit3 = channelRevenue?.totalProfit3 || 0;

          // 시뮬레이션 계산
          const salesMul = 1 + simSales / 100;
          const materialMul = 1 + simMaterial / 100;
          const commMul = 1 + simCommission / 100;

          const simRevenue = Math.round(baseRevenue * salesMul);
          const simDirectCost = Math.round(baseDirectCost * salesMul * materialMul);
          const simVarCost = Math.round(baseVariableCost * salesMul * commMul);
          const simFixCost = baseFixedCost; // 고정비 불변
          const simP1 = simRevenue - simDirectCost;
          const simP2 = simP1 - simVarCost;
          const simP3 = simP2 - simFixCost;
          const simMargin = simRevenue > 0 ? Math.round(simP3 / simRevenue * 1000) / 10 : 0;
          const baseMargin = baseRevenue > 0 ? Math.round(baseProfit3 / baseRevenue * 1000) / 10 : 0;

          const diffP3 = simP3 - baseProfit3;
          const diffMargin = simMargin - baseMargin;

          const rows = [
            { label: '매출', base: baseRevenue, sim: simRevenue },
            { label: '직접재료비', base: baseDirectCost, sim: simDirectCost },
            { label: '1단계 이익 (제품)', base: baseProfit1, sim: simP1 },
            { label: '채널 변동비', base: baseVariableCost, sim: simVarCost },
            { label: '2단계 이익 (채널)', base: baseProfit2, sim: simP2 },
            { label: '채널 고정비', base: baseFixedCost, sim: simFixCost },
            { label: '3단계 이익 (사업부)', base: baseProfit3, sim: simP3 },
          ];

          const SliderInput: React.FC<{
            label: string; value: number; onChange: (v: number) => void;
            min?: number; max?: number; unit?: string; color: string;
          }> = ({ label, value, onChange, min = -50, max = 50, unit = '%', color }) => (
            <div className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <span className={`text-lg font-bold ${value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {value > 0 ? '+' : ''}{value}{unit}
                </span>
              </div>
              <input
                type="range"
                min={min} max={max} step={1}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${color}33 0%, ${color} ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{min}{unit}</span>
                <button
                  onClick={() => onChange(0)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                >초기화</button>
                <span>{max}{unit}</span>
              </div>
            </div>
          );

          return (
            <div className="space-y-6">
              {/* 슬라이더 패널 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <span className="material-icons-outlined text-purple-500">tune</span>
                  "만약에?" 시뮬레이션
                </h3>
                <p className="text-xs text-gray-500 mb-5">슬라이더를 조절하여 비용/매출 변동이 이익에 미치는 영향을 실시간으로 확인하세요.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SliderInput
                    label="재료비 변동"
                    value={simMaterial}
                    onChange={setSimMaterial}
                    color="#EF4444"
                  />
                  <SliderInput
                    label="판매량 변동"
                    value={simSales}
                    onChange={setSimSales}
                    color="#3B82F6"
                  />
                  <SliderInput
                    label="수수료율 변동"
                    value={simCommission}
                    onChange={setSimCommission}
                    min={-20} max={20}
                    color="#F59E0B"
                  />
                </div>
              </div>

              {/* 결과 요약 KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">시뮬레이션 최종 이익</p>
                  <p className={`text-2xl font-bold mt-1 ${simP3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(simP3)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">이익 변동</p>
                  <p className={`text-2xl font-bold mt-1 ${diffP3 > 0 ? 'text-green-600' : diffP3 < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {diffP3 > 0 ? '+' : ''}{formatCurrency(diffP3)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">마진율 변동</p>
                  <p className={`text-2xl font-bold mt-1 ${diffMargin > 0 ? 'text-green-600' : diffMargin < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {diffMargin > 0 ? '+' : ''}{diffMargin.toFixed(1)}%p
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{baseMargin}% → {simMargin}%</p>
                </div>
              </div>

              {/* 비교 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-icons-outlined text-blue-500">compare</span>
                  현재 vs 시뮬레이션 비교
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">항목</th>
                        <th className="text-right py-2 px-3 text-gray-500">현재</th>
                        <th className="text-right py-2 px-3 text-blue-600">시뮬레이션</th>
                        <th className="text-right py-2 px-3 text-gray-500">차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const diff = row.sim - row.base;
                        const isProfit = row.label.includes('이익');
                        const isCost = row.label.includes('비');
                        // 이익 증가 = 유리(녹색), 비용 증가 = 불리(빨강)
                        const diffColor = diff === 0 ? 'text-gray-400'
                          : isProfit ? (diff > 0 ? 'text-green-600' : 'text-red-600')
                          : isCost ? (diff > 0 ? 'text-red-600' : 'text-green-600')
                          : (diff > 0 ? 'text-blue-600' : 'text-gray-600');
                        const isSummary = row.label.includes('3단계');
                        return (
                          <tr key={row.label} className={`border-b border-gray-100 dark:border-gray-800 ${isSummary ? 'bg-gray-50 dark:bg-gray-800/50 font-bold' : ''}`}>
                            <td className={`py-2.5 px-3 ${isSummary ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {row.label}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.base)}</td>
                            <td className={`py-2.5 px-3 text-right font-medium ${isSummary ? (row.sim >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-blue-600'}`}>
                              {formatCurrency(row.sim)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-medium ${diffColor}`}>
                              {diff !== 0 && (diff > 0 ? '+' : '')}{diff === 0 ? '-' : formatCurrency(diff)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">마진율</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{baseMargin}%</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${simMargin >= config.profitMarginGood ? 'text-green-600' : simMargin >= 0 ? 'text-orange-500' : 'text-red-600'}`}>
                          {simMargin}%
                        </td>
                        <td className={`py-2.5 px-3 text-right font-medium ${diffMargin > 0 ? 'text-green-600' : diffMargin < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {diffMargin !== 0 && (diffMargin > 0 ? '+' : '')}{diffMargin === 0 ? '-' : `${diffMargin.toFixed(1)}%p`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {baseRevenue === 0 && (
                  <p className="text-gray-400 text-center py-6 mt-4">매출 데이터가 없습니다. 채널별 수익 데이터를 먼저 동기화해주세요.</p>
                )}
              </div>

              {/* 채널별 시뮬레이션 */}
              {channelRevenue && channelRevenue.channels.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-indigo-500">storefront</span>
                    채널별 시뮬레이션 결과
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">채널</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재 매출</th>
                          <th className="text-right py-2 px-3 text-blue-600">예상 매출</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재 이익</th>
                          <th className="text-right py-2 px-3 text-blue-600">예상 이익</th>
                          <th className="text-right py-2 px-3 text-gray-500">이익 변동</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelRevenue.channels.map((ch, i) => {
                          const chSimRev = Math.round(ch.revenue * salesMul);
                          const chSimCost = Math.round(ch.directCost * salesMul * materialMul);
                          const chSimVarCost = Math.round(ch.channelVariableCost * salesMul * commMul);
                          const chSimP3 = chSimRev - chSimCost - chSimVarCost - ch.channelFixedCost;
                          const chDiff = chSimP3 - ch.profit3;
                          return (
                            <tr key={ch.name} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3 font-medium" style={{ color: CHANNEL_COLORS[i] }}>{ch.name}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(ch.revenue)}</td>
                              <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(chSimRev)}</td>
                              <td className={`py-2 px-3 text-right ${ch.profit3 >= 0 ? 'text-gray-600' : 'text-red-500'}`}>{formatCurrency(ch.profit3)}</td>
                              <td className={`py-2 px-3 text-right font-medium ${chSimP3 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(chSimP3)}</td>
                              <td className={`py-2 px-3 text-right font-medium ${chDiff > 0 ? 'text-green-600' : chDiff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {chDiff !== 0 && (chDiff > 0 ? '+' : '')}{chDiff === 0 ? '-' : formatCurrency(chDiff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                        <th className="text-right py-2 px-3 text-gray-500">재료비</th>
                        <th className="text-right py-2 px-3 text-green-600">제품이익</th>
                        <th className="text-right py-2 px-3 text-emerald-600">최종이익</th>
                        <th className="text-right py-2 px-3 text-gray-500">마진율</th>
                        <th className="text-right py-2 px-3 text-gray-500">전월 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map(m => (
                        <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.month}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(m.revenue)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(m.cost)}</td>
                          <td className={`py-2 px-3 text-right ${m.profit1 >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(m.profit1)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(m.profit)}</td>
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
