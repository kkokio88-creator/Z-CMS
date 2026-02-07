import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  MaterialPriceHistory,
  MaterialCostImpact,
  DailyPerformanceMetric,
  StaffingSuggestion,
  BudgetItem,
  ExpenseSummary,
} from '../types';

interface Props {
  materialPriceHistory: MaterialPriceHistory[];
  materialCostImpacts: MaterialCostImpact[];
  dailyPerformance: DailyPerformanceMetric[];
  staffingSuggestions: StaffingSuggestion[];
  budgetItems: BudgetItem[];
  expenseSummary: ExpenseSummary | null;
  onItemClick: (item: any) => void;
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const CostManagementView: React.FC<Props> = ({
  materialPriceHistory,
  materialCostImpacts,
  dailyPerformance,
  budgetItems,
  expenseSummary,
}) => {
  // KPI 계산
  const totalBudget = budgetItems.reduce((s, b) => s + b.budgetAmount, 0);
  const totalActual = budgetItems.reduce((s, b) => s + b.usedAmount, 0);
  const budgetUtil = totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : '0';
  const priceAlerts = materialCostImpacts.filter(m => m.urgencyLevel === 'critical' || m.urgencyLevel === 'warning').length;
  const avgPerformance = dailyPerformance.length > 0
    ? (dailyPerformance.reduce((s, d) => s + (d.actualLaborRatio || 0), 0) / dailyPerformance.length).toFixed(1)
    : '0';

  // 예산 항목별 데이터 (차트용)
  const budgetChartData = budgetItems.slice(0, 8).map(b => ({
    name: b.accountName.length > 8 ? b.accountName.slice(0, 8) + '…' : b.accountName,
    예산: b.budgetAmount,
    실적: b.usedAmount,
  }));

  // 비용 구조 파이차트
  const costStructure = expenseSummary ? [
    { name: '고정비', value: expenseSummary.fixedCostUsed || 0 },
    { name: '변동비', value: expenseSummary.variableCostUsed || 0 },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">원가 관리</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">예산 집행률</p>
          <p className={`text-2xl font-bold mt-1 ${Number(budgetUtil) > 90 ? 'text-red-600' : 'text-blue-600'}`}>
            {budgetUtil}%
          </p>
          <p className="text-xs text-gray-400 mt-1">₩{(totalActual / 1_000_000).toFixed(0)}M / ₩{(totalBudget / 1_000_000).toFixed(0)}M</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">단가 변동 경보</p>
          <p className={`text-2xl font-bold mt-1 ${priceAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {priceAlerts}건
          </p>
          <p className="text-xs text-gray-400 mt-1">긴급/주요 변동</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">평균 노무비율</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{avgPerformance}%</p>
          <p className="text-xs text-gray-400 mt-1">목표: 25%</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">모니터링 항목</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{materialPriceHistory.length}건</p>
          <p className="text-xs text-gray-400 mt-1">원자재 단가 추적</p>
        </div>
      </div>

      {/* 비용 구조 + 예산 대비 실적 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 비용 구조 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">비용 구조</h3>
          {costStructure.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costStructure} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {costStructure.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">비용 데이터 없음</p>
          )}
        </div>

        {/* 예산 대비 실적 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">예산 대비 실적</h3>
          {budgetChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} />
                  <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="예산" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="실적" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">예산 데이터 없음</p>
          )}
        </div>
      </div>

      {/* 단가 변동 주요 항목 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-orange-500">trending_up</span>
          단가 변동 주요 항목
        </h3>
        {materialCostImpacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">품목</th>
                  <th className="text-right py-2 px-3 text-gray-500">변동률</th>
                  <th className="text-right py-2 px-3 text-gray-500">영향금액</th>
                  <th className="text-center py-2 px-3 text-gray-500">심각도</th>
                </tr>
              </thead>
              <tbody>
                {materialCostImpacts.slice(0, 10).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.materialName}</td>
                    <td className={`py-2 px-3 text-right font-medium ${item.priceIncreasePercent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {item.priceIncreasePercent > 0 ? '+' : ''}{item.priceIncreasePercent.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">₩{item.totalDeltaCost.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.urgencyLevel === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : item.urgencyLevel === 'warning' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>{item.urgencyLevel === 'critical' ? '심각' : item.urgencyLevel === 'warning' ? '주의' : '정상'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-6">단가 변동 데이터 없음</p>
        )}
      </div>
    </div>
  );
};
