import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { formatCurrency, formatAxisKRW } from '../utils/format';
import type { PurchaseData, UtilityData, ProductionData } from '../services/googleSheetService';
import type { DashboardInsights, CostRecommendation } from '../services/insightService';

interface Props {
  purchases: PurchaseData[];
  utilities: UtilityData[];
  production: ProductionData[];
  insights: DashboardInsights | null;
  onItemClick: (item: any) => void;
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

export const CostManagementView: React.FC<Props> = ({
  purchases,
  utilities,
  production,
  insights,
  onItemClick,
}) => {
  const costBreakdown = insights?.costBreakdown;
  const materialPrices = insights?.materialPrices;
  const utilityCosts = insights?.utilityCosts;
  const recommendations = insights?.recommendations || [];

  const [rawFilter, setRawFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [overheadFilter, setOverheadFilter] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // Pre-compute filtered data (avoid conditional hooks)
  const allRawItems = materialPrices?.items || [];
  const filteredRawItems = (() => {
    switch (rawFilter) {
      case 'priceUp': return allRawItems.filter(m => m.changeRate >= 10);
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

  const utilityMonthly = utilityCosts?.monthly || [];

  // Filter recommendations by type
  const materialRecs = recommendations.filter(r => r.type === 'material');
  const utilityRecs = recommendations.filter(r => r.type === 'utility');
  const marginRecs = recommendations.filter(r => r.type === 'margin' || r.type === 'waste');

  const tabs = [
    { key: 'overview', label: '원가 총괄', icon: 'account_balance' },
    { key: 'raw', label: '원재료', icon: 'inventory_2' },
    { key: 'sub', label: '부재료', icon: 'category' },
    { key: 'labor', label: '노무비', icon: 'people' },
    { key: 'overhead', label: '경비', icon: 'bolt' },
  ];

  return (
    <SubTabLayout title="원가 관리" tabs={tabs}>
      {(activeTab) => {
        // ========== 원가 총괄 ==========
        if (activeTab === 'overview') {
          const monthly = costBreakdown?.monthly || [];
          const composition = costBreakdown?.composition || [];
          const totalCost = composition.reduce((s, c) => s + c.value, 0);
          const rawRate = composition.find(c => c.name === '원재료')?.rate || 0;

          let prevMonthChange = 0;
          if (monthly.length >= 2) {
            const last = monthly[monthly.length - 1].total;
            const prev = monthly[monthly.length - 2].total;
            prevMonthChange = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;
          }

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원가</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalCost)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">원재료 비율</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{rawRate}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">전월 대비</p>
                  <p className={`text-2xl font-bold mt-1 ${prevMonthChange > 0 ? 'text-red-600' : prevMonthChange < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {prevMonthChange > 0 ? '+' : ''}{prevMonthChange}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">원가 4요소 추이</h3>
                  {monthly.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthly}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="rawMaterial" name="원재료" stackId="1" stroke={COST_COLORS.rawMaterial} fill={COST_COLORS.rawMaterial} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="subMaterial" name="부재료" stackId="1" stroke={COST_COLORS.subMaterial} fill={COST_COLORS.subMaterial} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="labor" name="노무비" stackId="1" stroke={COST_COLORS.labor} fill={COST_COLORS.labor} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="overhead" name="경비" stackId="1" stroke={COST_COLORS.overhead} fill={COST_COLORS.overhead} fillOpacity={0.7} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">원가 데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">원가 구성비</h3>
                  {composition.length > 0 && totalCost > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={composition} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, rate }) => `${name} ${rate}%`}>
                            {composition.map((_, i) => <Cell key={i} fill={Object.values(COST_COLORS)[i] || PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구성비 데이터 없음</p>}
                </div>
              </div>

              {/* 전체 인사이트 요약 */}
              {recommendations.length > 0 && (
                <InsightCards items={recommendations.slice(0, 3)} />
              )}
            </div>
          );
        }

        // ========== 원재료 ==========
        if (activeTab === 'raw') {
          const rawDetail = costBreakdown?.rawMaterialDetail;
          const priceUpCount = allRawItems.filter(m => m.changeRate >= 10).length;
          const selectedItem = selectedMaterial ? allRawItems.find(m => m.productCode === selectedMaterial) : null;

          // 필터에 따른 월별 데이터
          const monthlyRaw = (costBreakdown?.monthly || []).map(m => ({
            month: m.month,
            원재료비: m.rawMaterial,
          }));

          // 필터된 품목들의 Bar 차트 데이터
          const filteredBarData = filteredRawItems.slice(0, 15).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
            변동률: item.changeRate,
          }));

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원재료비</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(rawDetail?.total || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">단가 10%↑ 품목</p>
                  <p className={`text-2xl font-bold mt-1 ${priceUpCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{priceUpCount}건</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">필터 결과</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredRawItems.length}개</p>
                </div>
              </div>

              {/* 필터 */}
              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'priceUp', label: '단가상승(10%↑)' },
                  { key: 'priceDown', label: '단가하락' },
                  { key: 'top10', label: '상위10(금액순)' },
                ]}
                active={rawFilter}
                onChange={setRawFilter}
              />

              {/* 차트: 필터에 따라 변경 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 원재료비 추이</h3>
                  {monthlyRaw.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyRaw}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="원재료비" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
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
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="금액" radius={[0, 4, 4, 0]}>
                            {filteredBarData.map((entry, i) => (
                              <Cell key={i} fill={entry.변동률 >= 10 ? '#EF4444' : entry.변동률 < 0 ? '#10B981' : '#3B82F6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">해당 조건의 품목 없음</p>}
                </div>
              </div>

              {/* 선택 품목 단가 이력 */}
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
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Line type="monotone" dataKey="price" name="단가" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">이력 없음</p>}
                </div>
              )}

              {/* 필터된 상세 테이블 */}
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
                        {filteredRawItems.slice(0, 20).map(item => (
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
                  </div>
                ) : <p className="text-gray-400 text-center py-6">해당 조건의 품목이 없습니다.</p>}
              </div>

              {/* 인사이트 */}
              <InsightCards items={materialRecs} />
            </div>
          );
        }

        // ========== 부재료 ==========
        if (activeTab === 'sub') {
          const subDetail = costBreakdown?.subMaterialDetail;

          const monthlySub = (costBreakdown?.monthly || []).map(m => ({
            month: m.month,
            부재료비: m.subMaterial,
          }));

          const filteredSubBarData = filteredSubItems.slice(0, 10).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
          }));

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 부재료비</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(subDetail?.total || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">필터 결과</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredSubItems.length}개</p>
                </div>
              </div>

              {/* 필터 */}
              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'top5', label: '상위5(금액순)' },
                ]}
                active={subFilter}
                onChange={setSubFilter}
              />

              {/* 차트 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 부재료비 추이</h3>
                  {monthlySub.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySub}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="부재료비" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
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
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="금액" fill="#10B981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">부재료 품목 없음</p>}
                </div>
              </div>

              {/* 필터된 상세 테이블 */}
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

        // ========== 노무비 ==========
        if (activeTab === 'labor') {
          const laborDetail = costBreakdown?.laborDetail;
          const monthly = costBreakdown?.monthly || [];

          // 월별 노무비 추이
          const monthlyLabor = monthly.map(m => ({
            month: m.month,
            노무비: m.labor,
            총원가대비: m.total > 0 ? Math.round((m.labor / m.total) * 1000) / 10 : 0,
          }));

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">노무비 (추정)</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(laborDetail?.estimated || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">산출 근거</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{laborDetail?.note || '-'}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">월 평균 노무비</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatCurrency(monthly.length > 0 ? Math.round(monthly.reduce((s, m) => s + m.labor, 0) / monthly.length) : 0)}
                  </p>
                </div>
              </div>

              {/* 월별 노무비 추이 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 노무비 추이</h3>
                {monthlyLabor.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyLabor}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number, name: string) => name === '총원가대비' ? `${v}%` : `₩${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="노무비" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
              </div>

              {/* 월별 노무비 상세 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 노무비 상세</h3>
                {monthlyLabor.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">월</th>
                          <th className="text-right py-2 px-3 text-gray-500">노무비 (추정)</th>
                          <th className="text-right py-2 px-3 text-gray-500">총원가 대비</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyLabor.map(m => (
                          <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.month}</td>
                            <td className="py-2 px-3 text-right font-medium text-yellow-600">{formatCurrency(m.노무비)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{m.총원가대비}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                  <span className="material-icons-outlined text-base">info</span>
                  노무비는 실제 급여 데이터가 연동되지 않아 추정값입니다. 정확한 관리를 위해 급여 데이터 연동을 권장합니다.
                </p>
              </div>

              <InsightCards items={marginRecs} />
            </div>
          );
        }

        // ========== 경비 ==========
        const overheadDetail = costBreakdown?.overheadDetail;

        // 필터에 따른 공과금 차트 데이터
        const filteredUtilityData = utilityMonthly.map(m => {
          switch (overheadFilter) {
            case 'electricity': return { month: m.month, 전기: m.electricity, 합계: m.electricity, perUnit: m.perUnit };
            case 'water': return { month: m.month, 수도: m.water, 합계: m.water, perUnit: m.perUnit };
            case 'gas': return { month: m.month, 가스: m.gas, 합계: m.gas, perUnit: m.perUnit };
            default: return { month: m.month, 전기: m.electricity, 수도: m.water, 가스: m.gas, 합계: m.total, perUnit: m.perUnit };
          }
        });

        return (
          <div className="space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">총 경비</p>
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
                <p className="text-xs text-gray-500 dark:text-gray-400">단위당 에너지비용</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {utilityMonthly.length > 0 && utilityMonthly[utilityMonthly.length - 1].perUnit > 0
                    ? `₩${utilityMonthly[utilityMonthly.length - 1].perUnit.toLocaleString()}`
                    : '-'}
                </p>
              </div>
            </div>

            {/* 필터 */}
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

            {/* 차트 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  {overheadFilter === 'all' ? '공과금 추이' : `${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용 추이`}
                </h3>
                {filteredUtilityData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {overheadFilter === 'all' ? (
                        <AreaChart data={filteredUtilityData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="전기" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="수도" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="가스" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                        </AreaChart>
                      ) : (
                        <BarChart data={filteredUtilityData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                          <Bar dataKey="합계" fill={overheadFilter === 'electricity' ? '#F59E0B' : overheadFilter === 'water' ? '#3B82F6' : '#EF4444'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">공과금 데이터 없음</p>}
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">단위당 에너지 비용</h3>
                {utilityMonthly.filter(m => m.perUnit > 0).length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={utilityMonthly.filter(m => m.perUnit > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₩${v.toLocaleString()}`} />
                        <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}/단위`} />
                        <Line type="monotone" dataKey="perUnit" name="단위당 비용" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">생산량 데이터 필요</p>}
              </div>
            </div>

            {/* 필터된 상세 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {overheadFilter === 'all' ? '월별 공과금 상세' : `월별 ${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용`}
              </h3>
              {utilityMonthly.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">월</th>
                        {(overheadFilter === 'all' || overheadFilter === 'electricity') && <th className="text-right py-2 px-3 text-gray-500">전기</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'water') && <th className="text-right py-2 px-3 text-gray-500">수도</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'gas') && <th className="text-right py-2 px-3 text-gray-500">가스</th>}
                        <th className="text-right py-2 px-3 text-gray-500">합계</th>
                        <th className="text-right py-2 px-3 text-gray-500">단위당</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilityMonthly.map(m => (
                        <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.month}</td>
                          {(overheadFilter === 'all' || overheadFilter === 'electricity') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.electricity)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'water') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.water)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'gas') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.gas)}</td>}
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(overheadFilter === 'electricity' ? m.electricity : overheadFilter === 'water' ? m.water : overheadFilter === 'gas' ? m.gas : m.total)}
                          </td>
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
      }}
    </SubTabLayout>
  );
};
