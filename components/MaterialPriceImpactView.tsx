import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';
import { MaterialPriceHistory, MaterialCostImpact, AnomalyLevel } from '../types';

interface Props {
  priceHistory?: MaterialPriceHistory[];
  impacts?: MaterialCostImpact[];
  onItemClick?: (item: MaterialPriceHistory | MaterialCostImpact) => void;
}

const COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

const MaterialPriceImpactView: React.FC<Props> = ({
  priceHistory = [],
  impacts = [],
  onItemClick,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  // KPI 계산
  const kpis = useMemo(() => {
    const topIncreases = [...priceHistory]
      .filter(m => (timeRange === 'week' ? m.priceChangeWeek > 0 : m.priceChangeMonth > 0))
      .sort((a, b) =>
        timeRange === 'week'
          ? b.priceChangeWeek - a.priceChangeWeek
          : b.priceChangeMonth - a.priceChangeMonth
      )
      .slice(0, 5);

    const avgIncrease =
      topIncreases.length > 0
        ? topIncreases.reduce(
            (sum, m) => sum + (timeRange === 'week' ? m.priceChangeWeek : m.priceChangeMonth),
            0
          ) / topIncreases.length
        : 0;

    const totalImpact = impacts.reduce((sum, i) => sum + i.totalDeltaCost, 0);
    const criticalCount = impacts.filter(i => i.urgencyLevel === 'critical').length;
    const affectedProductCount = impacts.reduce((sum, i) => sum + i.affectedProducts.length, 0);

    return {
      topIncreases,
      avgIncrease,
      totalImpact,
      criticalCount,
      affectedProductCount,
    };
  }, [priceHistory, impacts, timeRange]);

  // 선택된 자재의 가격 추이 데이터
  const selectedPriceData = useMemo(() => {
    if (!selectedMaterial) {
      // 상위 3개 자재 표시
      return kpis.topIncreases.slice(0, 3).map(m => ({
        code: m.materialCode,
        name: m.materialName,
        history: m.priceHistory.slice(-12),
      }));
    }
    const material = priceHistory.find(m => m.materialCode === selectedMaterial);
    if (!material) return [];
    return [
      {
        code: material.materialCode,
        name: material.materialName,
        history: material.priceHistory.slice(-12),
      },
    ];
  }, [selectedMaterial, priceHistory, kpis.topIncreases]);

  // 차트용 데이터 변환
  const chartData = useMemo(() => {
    if (selectedPriceData.length === 0) return [];

    // 모든 날짜 수집
    const allDates = new Set<string>();
    selectedPriceData.forEach(m => m.history.forEach(h => allDates.add(h.date)));

    // 날짜별 데이터 생성
    return Array.from(allDates)
      .sort()
      .map(date => {
        const point: any = { date: date.slice(5) }; // MM-DD 형식
        selectedPriceData.forEach(m => {
          const pricePoint = m.history.find(h => h.date === date);
          point[m.code] = pricePoint?.unitPrice || null;
        });
        return point;
      });
  }, [selectedPriceData]);

  // Top 5 급등 자재 바 차트 데이터
  const topIncreaseBarData = kpis.topIncreases.map(m => ({
    name: m.materialName.length > 8 ? m.materialName.slice(0, 8) + '...' : m.materialName,
    fullName: m.materialName,
    change: timeRange === 'week' ? m.priceChangeWeek : m.priceChangeMonth,
    currentPrice: m.currentPrice,
    code: m.materialCode,
    original: m,
  }));

  // 색상 헬퍼
  const getUrgencyColor = (level: AnomalyLevel): string => {
    switch (level) {
      case 'critical':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      default:
        return '#10B981';
    }
  };

  const getUrgencyBadgeClass = (level: AnomalyLevel): string => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warning':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            원재료 단가 변동 분석
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            자재별 단가 추세 및 원가 영향도 분석
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeRange === 'week'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              전주 대비
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeRange === 'month'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              전월 대비
            </button>
          </div>
        </div>
      </div>

      {/* 경고 배너 */}
      {kpis.criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-red-500 text-2xl">trending_up</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-200">
                {kpis.criticalCount}개 자재 가격 급등 감지
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">
                총 {kpis.affectedProductCount}개 제품에 영향, 예상 원가 상승 ₩
                {formatCurrency(kpis.totalImpact)}
              </p>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
              대응 방안 검토
            </button>
          </div>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">급등 자재 수</span>
            <span className="material-icons-outlined text-red-500">arrow_upward</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {kpis.topIncreases.length}개
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {timeRange === 'week' ? '전주' : '전월'} 대비 상승
          </p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">평균 상승률</span>
            <span className="material-icons-outlined text-orange-500">percent</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            +{kpis.avgIncrease.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Top 5 평균</p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">총 원가 영향</span>
            <span className="material-icons-outlined text-blue-500">payments</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            ₩{formatCurrency(kpis.totalImpact)}
          </p>
          <p className="text-xs text-gray-500 mt-1">예상 추가 비용</p>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">영향 제품 수</span>
            <span className="material-icons-outlined text-purple-500">inventory_2</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {kpis.affectedProductCount}개
          </p>
          <p className="text-xs text-gray-500 mt-1">BOM 연결 제품</p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 단가 추이 차트 */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              자재별 단가 추이
            </h3>
            <select
              value={selectedMaterial || ''}
              onChange={e => setSelectedMaterial(e.target.value || null)}
              className="text-xs px-2 py-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Top 3 자재</option>
              {priceHistory.map(m => (
                <option key={m.materialCode} value={m.materialCode}>
                  {m.materialName}
                </option>
              ))}
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₩${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => `₩${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {selectedPriceData.map((m, idx) => (
                  <Line
                    key={m.code}
                    type="monotone"
                    dataKey={m.code}
                    name={m.name}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 급등 자재 */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            가격 급등 자재 Top 5
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topIncreaseBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={v => `+${v}%`} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-gray-900 text-white text-xs rounded p-2">
                          <p className="font-semibold">{data.fullName}</p>
                          <p>상승률: +{data.change.toFixed(1)}%</p>
                          <p>현재가: ₩{data.currentPrice.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="change"
                  name="상승률"
                  radius={[0, 4, 4, 0]}
                  onClick={data => onItemClick?.(data.original)}
                  cursor="pointer"
                >
                  {topIncreaseBarData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.change > 15 ? '#EF4444' : entry.change > 10 ? '#F59E0B' : '#3B82F6'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 원가 영향 상세 테이블 */}
      <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          원가 영향 분석 상세
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300">자재명</th>
                <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">단가 상승</th>
                <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">상승률</th>
                <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">영향 제품</th>
                <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                  총 원가 영향
                </th>
                <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">긴급도</th>
                <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {impacts.slice(0, 10).map(item => (
                <tr
                  key={item.materialCode}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => onItemClick?.(item)}
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                    {item.materialName}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    +₩{item.priceIncrease.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    +{item.priceIncreasePercent.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {item.affectedProducts.length}개
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    ₩{formatCurrency(item.totalDeltaCost)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${getUrgencyBadgeClass(item.urgencyLevel)}`}
                    >
                      {item.urgencyLevel === 'critical'
                        ? '긴급'
                        : item.urgencyLevel === 'warning'
                          ? '주의'
                          : '정상'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200"
                        onClick={e => {
                          e.stopPropagation();
                          onItemClick?.(item);
                        }}
                      >
                        상세
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 권장 조치 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-outlined text-blue-500">edit_note</span>
            <span className="font-semibold text-blue-800 dark:text-blue-200">BOM 레시피 수정</span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-300">
            대체 원자재로 레시피를 조정하여 원가 상승을 완화할 수 있습니다.
          </p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-outlined text-orange-500">sell</span>
            <span className="font-semibold text-orange-800 dark:text-orange-200">
              판매가 인상 검토
            </span>
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-300">
            원가 상승분을 반영하여 판매가 조정을 검토해보세요.
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-outlined text-green-500">shopping_cart</span>
            <span className="font-semibold text-green-800 dark:text-green-200">구매처 다변화</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-300">
            대체 공급처를 발굴하여 구매 단가를 낮출 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaterialPriceImpactView;
