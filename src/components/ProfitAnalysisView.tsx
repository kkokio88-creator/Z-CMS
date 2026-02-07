import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';
import { ChannelProfitData, ProfitRankItem } from '../types';

interface Props {
  profitData: ChannelProfitData[];
  topItems: ProfitRankItem[];
  bottomItems: ProfitRankItem[];
  onItemClick: (item: any) => void;
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export const ProfitAnalysisView: React.FC<Props> = ({ profitData, topItems, bottomItems, onItemClick }) => {
  const totalRevenue = profitData.reduce((sum, d) => sum + d.revenue, 0);
  const totalProfit = profitData.reduce((sum, d) => sum + d.profit, 0);
  const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">수익 분석</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">총 매출</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {(totalRevenue / 1_000_000).toFixed(0)}M
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">총 이익</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {(totalProfit / 1_000_000).toFixed(0)}M
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">평균 마진율</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{avgMargin}%</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">데이터 기간</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{profitData.length}일</p>
        </div>
      </div>

      {/* 매출/이익 트렌드 차트 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">채널별 매출 트렌드</h3>
        {profitData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="매출" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="profit" name="이익" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-10">매출 데이터를 불러오는 중...</p>
        )}
      </div>

      {/* 수익성 랭킹 — 상위/하위 나란히 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-green-500">trending_up</span>
            수익 상위 품목
          </h3>
          {topItems.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="skuName" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                  <Bar dataKey="profit" name="이익" radius={[0, 4, 4, 0]}>
                    {topItems.slice(0, 7).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">데이터 없음</p>
          )}
          <div className="mt-3 space-y-1">
            {topItems.slice(0, 5).map((item, i) => (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{item.skuName}</span>
                </span>
                <span className="text-green-600 dark:text-green-400 font-medium">₩{item.profit.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-red-500">trending_down</span>
            수익 하위 품목
          </h3>
          {bottomItems.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bottomItems.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="skuName" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                  <Bar dataKey="profit" name="이익" radius={[0, 4, 4, 0]}>
                    {bottomItems.slice(0, 7).map((_, i) => (
                      <Cell key={i} fill="#EF4444" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">데이터 없음</p>
          )}
          <div className="mt-3 space-y-1">
            {bottomItems.slice(0, 5).map((item, i) => (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{item.skuName}</span>
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">₩{item.profit.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
