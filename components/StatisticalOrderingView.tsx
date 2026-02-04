/**
 * Statistical Ordering View (통계적 발주 대시보드)
 *
 * 미래 식단 계획 기반 자동 발주 권고 시스템
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  OrderRecommendation,
  OrderCalculation,
  MealPlanItem,
  DayOfWeekStats,
  OrderingConfig,
} from '../types';
import {
  fetchOrderRecommendation,
  fetchMealPlan,
  fetchSalesStats,
  fetchOrderingConfig,
  updateOrderingConfig,
  getStatusColorClass,
  getStatusIcon,
  getStatusLabel,
  formatCurrency,
  exportToCSV,
  groupByCategory,
} from '../services/orderingService';

// 상태별 색상
const STATUS_COLORS = {
  shortage: '#EF4444',
  urgent: '#F59E0B',
  normal: '#10B981',
  overstock: '#3B82F6',
};

// 카테고리별 색상
const CATEGORY_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

// 탭 버튼 컴포넌트
const TabButton = ({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      active
        ? 'border-primary text-primary dark:text-green-400 dark:border-green-400 bg-white dark:bg-surface-dark'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
    }`}
  >
    {icon && <span className="material-icons-outlined text-lg">{icon}</span>}
    {children}
  </button>
);

// KPI 카드 컴포넌트
const KPICard = ({
  title,
  value,
  subValue,
  icon,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: string;
  color?: 'primary' | 'red' | 'orange' | 'blue';
}) => {
  const colorClasses = {
    primary: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subValue && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <span className="material-icons-outlined">{icon}</span>
        </div>
      </div>
    </div>
  );
};

const StatisticalOrderingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mealplan' | 'stats' | 'config'>(
    'overview'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<OrderRecommendation | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>([]);
  const [salesStats, setSalesStats] = useState<DayOfWeekStats[]>([]);
  const [config, setConfig] = useState<OrderingConfig | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recData, mealData, statsData, configData] = await Promise.all([
        fetchOrderRecommendation(),
        fetchMealPlan(),
        fetchSalesStats(4),
        fetchOrderingConfig(),
      ]);

      setRecommendation(recData);
      setMealPlan(mealData);
      setSalesStats(statsData);
      setConfig(configData);
    } catch (error) {
      console.error('Failed to load ordering data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (recommendation) {
      exportToCSV(recommendation);
    }
  };

  const handleConfigUpdate = async (newConfig: Partial<OrderingConfig>) => {
    const updated = await updateOrderingConfig(newConfig);
    if (updated) {
      setConfig(updated);
      // 설정 변경 후 재계산
      loadData();
    }
  };

  // 카테고리별 데이터 그룹화
  const categoryGroups = recommendation ? groupByCategory(recommendation.items) : new Map();
  const categoryData = Array.from(categoryGroups.entries()).map(([category, items]) => ({
    name: category,
    count: items.length,
    totalCost: items.reduce((sum, i) => sum + i.estimatedCost, 0),
    urgentCount: items.filter(i => i.status === 'urgent' || i.status === 'shortage').length,
  }));

  // 상태별 통계
  const statusData = recommendation
    ? [
        {
          name: '정상',
          value: recommendation.items.filter(i => i.status === 'normal').length,
          color: STATUS_COLORS.normal,
        },
        {
          name: '긴급',
          value: recommendation.items.filter(i => i.status === 'urgent').length,
          color: STATUS_COLORS.urgent,
        },
        {
          name: '부족',
          value: recommendation.items.filter(i => i.status === 'shortage').length,
          color: STATUS_COLORS.shortage,
        },
        {
          name: '과재고',
          value: recommendation.items.filter(i => i.status === 'overstock').length,
          color: STATUS_COLORS.overstock,
        },
      ].filter(d => d.value > 0)
    : [];

  // 필터된 아이템
  const filteredItems =
    recommendation?.items.filter(item => !selectedCategory || item.category === selectedCategory) ||
    [];

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-500">발주 데이터 분석 중...</p>
        </div>
      </div>
    );
  }

  // 개요 탭
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* 긴급 알림 배너 */}
      {recommendation && recommendation.shortageItems > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-red-500 text-2xl">warning</span>
            <div>
              <h4 className="font-bold text-red-800 dark:text-red-200">
                긴급 발주 필요: {recommendation.shortageItems}건
              </h4>
              <p className="text-sm text-red-600 dark:text-red-300">
                재고 부족 품목이 있습니다. 즉시 발주를 진행해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="총 발주 품목"
          value={recommendation?.totalItems || 0}
          subValue={`긴급 ${recommendation?.urgentItems || 0}건`}
          icon="shopping_cart"
          color="primary"
        />
        <KPICard
          title="예상 발주 금액"
          value={`₩${formatCurrency(recommendation?.totalEstimatedCost || 0)}`}
          icon="payments"
          color="blue"
        />
        <KPICard
          title="부족 품목"
          value={recommendation?.shortageItems || 0}
          icon="error"
          color="red"
        />
        <KPICard
          title="서비스 수준"
          value={`${recommendation?.serviceLevel || 95}%`}
          subValue={`리드타임 D+${recommendation?.leadTimeDays || 2}`}
          icon="verified"
          color="primary"
        />
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 발주 금액 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            카테고리별 발주 금액
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={v => `₩${(v / 10000).toFixed(0)}만`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `₩${formatCurrency(value)}`}
                  labelFormatter={label => `분류: ${label}`}
                />
                <Bar dataKey="totalCost" name="발주금액" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 상태별 분포 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">발주 상태 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 발주 권고 테이블 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">발주 권고 목록</h3>
          <div className="flex items-center gap-2">
            {/* 카테고리 필터 */}
            <select
              value={selectedCategory || ''}
              onChange={e => setSelectedCategory(e.target.value || null)}
              className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-1 px-2"
            >
              <option value="">전체 분류</option>
              {Array.from(categoryGroups.keys()).map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover"
            >
              <span className="material-icons-outlined text-sm">download</span>
              CSV 내보내기
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  품목명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  분류
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  총소요량
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  안전재고
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  현재고
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  입고예정
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  발주수량
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  예상금액
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.slice(0, 20).map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    item.status === 'shortage'
                      ? 'bg-red-50/50 dark:bg-red-900/10'
                      : item.status === 'urgent'
                        ? 'bg-orange-50/50 dark:bg-orange-900/10'
                        : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColorClass(item.status)}`}
                    >
                      <span className="material-icons-outlined text-sm">
                        {getStatusIcon(item.status)}
                      </span>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.ingredientName}
                      </p>
                      <p className="text-xs text-gray-500">{item.ingredientCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.category}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(item.grossRequirement)} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                    {formatCurrency(item.safetyStock)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(item.currentStock)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                    {formatCurrency(item.inTransit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-primary dark:text-green-400">
                    {item.orderQty > 0 ? formatCurrency(item.orderQty) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                    {item.estimatedCost > 0 ? `₩${formatCurrency(item.estimatedCost)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length > 20 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 text-center text-sm text-gray-500">
            외 {filteredItems.length - 20}건 더 있음 (CSV로 전체 내보내기 가능)
          </div>
        )}
      </div>
    </div>
  );

  // 식단 계획 탭
  const renderMealPlanTab = () => {
    // 날짜별 그룹화
    const mealsByDate = new Map<string, MealPlanItem[]>();
    mealPlan.forEach(meal => {
      if (!mealsByDate.has(meal.date)) {
        mealsByDate.set(meal.date, []);
      }
      mealsByDate.get(meal.date)!.push(meal);
    });

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              미래 식단 계획 (D+{recommendation?.leadTimeDays || 2} ~ D+
              {(recommendation?.leadTimeDays || 2) + 7})
            </h3>
            <span className="text-sm text-gray-500">
              {recommendation?.targetPeriodStart} ~ {recommendation?.targetPeriodEnd}
            </span>
          </div>

          {mealPlan.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <span className="material-icons-outlined text-4xl mb-2">calendar_today</span>
              <p>식단 계획 데이터가 없습니다.</p>
              <p className="text-sm mt-1">
                Google Sheets의 &apos;식단_히스토리&apos; 시트를 확인해주세요.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from(mealsByDate.entries()).map(([date, meals]) => (
                <div
                  key={date}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="material-icons-outlined text-primary">event</span>
                    <span className="font-bold text-gray-900 dark:text-white">{date}</span>
                    <span className="text-sm text-gray-500">({meals[0]?.dayOfWeek})</span>
                  </div>
                  <div className="space-y-2">
                    {meals.map((meal, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{meal.corner}</span>
                        <span className="text-gray-900 dark:text-white truncate ml-2">
                          {meal.menuName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 통계 탭
  const renderStatsTab = () => {
    // 요일별 평균 판매량 (상위 메뉴)
    const topMenusByDay = ['월', '화', '수', '목', '금'].map(day => {
      const dayStats = salesStats.filter(s => s.dayOfWeek === day);
      const topMenu = dayStats.sort((a, b) => b.avgSales - a.avgSales)[0];
      return {
        dayOfWeek: day,
        topMenu: topMenu?.menuName || '-',
        avgSales: topMenu?.avgSales || 0,
        stdDev: topMenu?.stdDev || 0,
      };
    });

    return (
      <div className="space-y-6">
        {/* 요일별 Top 메뉴 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            요일별 인기 메뉴 (최근 {recommendation?.forecastWeeks || 4}주 평균)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMenusByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayOfWeek" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow border">
                          <p className="font-bold">{data.dayOfWeek}요일</p>
                          <p className="text-sm">{data.topMenu}</p>
                          <p className="text-sm text-gray-500">평균: {data.avgSales}식</p>
                          <p className="text-sm text-gray-500">표준편차: ±{data.stdDev}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avgSales" name="평균 판매량" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 전체 통계 테이블 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-bold text-gray-900 dark:text-white">요일별 메뉴 판매 통계</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    요일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    메뉴
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    평균
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    표준편차
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    최소
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    최대
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    샘플수
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {salesStats.slice(0, 50).map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {stat.dayOfWeek}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {stat.menuName}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {stat.avgSales}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                      ±{stat.stdDev}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                      {stat.minSales}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                      {stat.maxSales}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {stat.sampleCount}주
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 설정 탭
  const renderConfigTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">발주 시스템 설정</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 서비스 수준 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              서비스 수준 (Service Level)
            </label>
            <select
              value={config?.serviceLevel || 95}
              onChange={e => handleConfigUpdate({ serviceLevel: parseInt(e.target.value) })}
              className="w-full border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={90}>90% (Z=1.28) - 비용 절감</option>
              <option value={95}>95% (Z=1.65) - 표준</option>
              <option value={97}>97% (Z=1.88) - 안전 우선</option>
              <option value={99}>99% (Z=2.33) - 최고 안전</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">높을수록 안전재고 증가, 결품률 감소</p>
          </div>

          {/* 예측 주수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              예측 주수 (Forecast Weeks)
            </label>
            <select
              value={config?.forecastWeeks || 4}
              onChange={e => handleConfigUpdate({ forecastWeeks: parseInt(e.target.value) })}
              className="w-full border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={2}>최근 2주</option>
              <option value={4}>최근 4주 (권장)</option>
              <option value={6}>최근 6주</option>
              <option value={8}>최근 8주</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">요일별 통계 계산에 사용할 과거 데이터 기간</p>
          </div>

          {/* 기본 리드타임 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기본 리드타임 (일)
            </label>
            <select
              value={config?.defaultLeadTime || 2}
              onChange={e => handleConfigUpdate({ defaultLeadTime: parseInt(e.target.value) })}
              className="w-full border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={1}>D+1 (당일발주 익일입고)</option>
              <option value={2}>D+2 (표준)</option>
              <option value={3}>D+3</option>
              <option value={5}>D+5</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">발주부터 입고까지 소요 일수</p>
          </div>

          {/* 안전재고 일수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              안전재고 일수
            </label>
            <select
              value={config?.safetyDays || 1}
              onChange={e => handleConfigUpdate({ safetyDays: parseInt(e.target.value) })}
              className="w-full border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={0}>0일 (안전재고 없음)</option>
              <option value={1}>1일</option>
              <option value={2}>2일</option>
              <option value={3}>3일</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">리드타임 외 추가 안전 버퍼</p>
          </div>
        </div>

        {/* 공식 설명 */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3">안전재고 계산 공식</h4>
          <div className="font-mono text-sm bg-white dark:bg-gray-900 p-3 rounded border">
            Safety Stock = Z × σ × √L
          </div>
          <ul className="mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>
              • <strong>Z</strong>: 서비스 계수 (현재 {config?.zScore || 1.65})
            </li>
            <li>
              • <strong>σ</strong>: 수요의 표준편차 (요일별 판매량 변동)
            </li>
            <li>
              • <strong>L</strong>: 리드타임 + 안전일수 (
              {(config?.defaultLeadTime || 2) + (config?.safetyDays || 1)}일)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            발주일: {recommendation?.orderDate} | 입고예정: {recommendation?.deliveryDate}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
        >
          <span className={`material-icons-outlined ${isLoading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          새로고침
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 overflow-x-auto">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon="dashboard"
          >
            발주 개요
          </TabButton>
          <TabButton
            active={activeTab === 'mealplan'}
            onClick={() => setActiveTab('mealplan')}
            icon="restaurant_menu"
          >
            식단 계획
          </TabButton>
          <TabButton
            active={activeTab === 'stats'}
            onClick={() => setActiveTab('stats')}
            icon="analytics"
          >
            판매 통계
          </TabButton>
          <TabButton
            active={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
            icon="settings"
          >
            설정
          </TabButton>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'mealplan' && renderMealPlanTab()}
      {activeTab === 'stats' && renderStatsTab()}
      {activeTab === 'config' && renderConfigTab()}
    </div>
  );
};

export default StatisticalOrderingView;
