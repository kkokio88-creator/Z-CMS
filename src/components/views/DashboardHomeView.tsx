import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { KPICard } from '../common';
import type { SyncStatusInfo } from '../../services/supabaseClient';
import { formatCurrency } from '../../utils/format';
import type { ProfitCenterScoreInsight, ProfitCenterScoreMetric } from '../../services/insightService';
import type { DailySalesData, ProductionData, PurchaseData, SalesDetailData } from '../../services/googleSheetService';
import { useUI } from '../../contexts/UIContext';
import { getDateRange, filterByDate, getRangeLabel } from '../../utils/dateRange';
import { FormulaTooltip } from '../common';
import { FORMULAS } from '../../constants/formulaDescriptions';
import { InsightSection } from '../insight';

interface DashboardHomeViewProps {
  onSync: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
  dailySales: DailySalesData[];
  salesDetail?: SalesDetailData[];
  production: ProductionData[];
  purchases: PurchaseData[];
  onNavigate?: (view: string) => void;
  dataSource?: 'backend' | 'direct' | false;
  syncStatus?: SyncStatusInfo | null;
  profitCenterScore?: ProfitCenterScoreInsight | null;
}

/** 지표 카드 — 호버 시 공식+세부점수 툴팁 */
const ScoreCard: React.FC<{ s: ProfitCenterScoreMetric }> = ({ s }) => {
  const [hover, setHover] = useState(false);
  const statusStyle = s.status === 'excellent'
    ? { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400' }
    : s.status === 'good'
    ? { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-600 dark:text-blue-400' }
    : s.status === 'warning'
    ? { border: 'border-orange-200 dark:border-orange-800', bg: 'bg-orange-50 dark:bg-orange-900/10', text: 'text-orange-600 dark:text-orange-400' }
    : { border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-600 dark:text-red-400' };

  const formatDetail = (val: number, unit: string) => {
    if (unit === '원') return `₩${formatCurrency(val)}`;
    if (unit === '%') return `${val}%`;
    return `×${val}`;
  };

  return (
    <div
      className={`relative text-center p-2 rounded-lg border cursor-default ${statusStyle.border} ${statusStyle.bg}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="text-[10px] text-gray-500 dark:text-gray-400">{s.metric}</div>
      <div className={`text-xl font-black mt-0.5 ${statusStyle.text}`}>
        {s.score}<span className="text-xs font-normal">점</span>
      </div>

      {/* 호버 툴팁 */}
      {hover && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-xl p-3 text-left text-xs pointer-events-none">
          <div className="font-bold mb-1.5">{s.formula}</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-300">실적</span>
              <span className="font-medium">{formatDetail(s.actual, s.unit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">목표</span>
              <span className="font-medium">{formatDetail(s.target, s.unit)}</span>
            </div>
            {s.actualAmount != null && s.targetAmount != null && s.unit !== '원' && (
              <>
                <div className="border-t border-gray-600 my-1" />
                <div className="flex justify-between">
                  <span className="text-gray-300">실적액</span>
                  <span>₩{formatCurrency(s.actualAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">목표액</span>
                  <span>₩{formatCurrency(s.targetAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">{s.actualAmount <= s.targetAmount ? '절감' : '초과'}</span>
                  <span className={s.actualAmount <= s.targetAmount ? 'text-green-400' : 'text-red-400'}>
                    ₩{formatCurrency(Math.abs(s.targetAmount - s.actualAmount))}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}
    </div>
  );
};

/** 테이블명 → 한글 라벨 */
const TABLE_LABELS: Record<string, string> = {
  daily_sales: '매출',
  sales_detail: '판매',
  production_daily: '생산',
  purchases: '구매',
  inventory: '재고',
  utilities: '수도광열전력',
};

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  onSync,
  isSyncing,
  lastSyncTime,
  dailySales,
  salesDetail = [],
  production,
  purchases,
  dataSource,
  syncStatus,
  profitCenterScore,
  onNavigate,
}) => {
  const { dateRange } = useUI();
  const totalRecords = syncStatus
    ? Object.values(syncStatus.tableCounts).reduce((a, b) => a + b, 0)
    : 0;

  // dateRange 기반 날짜 필터
  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(dateRange), [dateRange]);
  const rangeLabel = getRangeLabel(dateRange);

  // 필터된 데이터
  const filteredSales = useMemo(
    () => filterByDate(dailySales, rangeStart, rangeEnd),
    [dailySales, rangeStart, rangeEnd]
  );
  const filteredProduction = useMemo(
    () => filterByDate(production, rangeStart, rangeEnd),
    [production, rangeStart, rangeEnd]
  );
  const filteredPurchases = useMemo(
    () => filterByDate(purchases, rangeStart, rangeEnd),
    [purchases, rangeStart, rangeEnd]
  );

  // 이전 기간 데이터 (같은 길이의 직전 기간)
  const prevRange = useMemo(() => {
    const days = Math.round((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / (86400000)) + 1;
    const prevEnd = new Date(new Date(rangeStart).getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      start: fmt(prevStart),
      end: fmt(prevEnd),
    };
  }, [rangeStart, rangeEnd]);

  const prevSales = useMemo(
    () => filterByDate(dailySales, prevRange.start, prevRange.end),
    [dailySales, prevRange]
  );
  const prevProduction = useMemo(
    () => filterByDate(production, prevRange.start, prevRange.end),
    [production, prevRange]
  );

  // salesDetail 날짜 필터 (반드시 기간별로 필터링)
  const filteredSalesDetail = useMemo(
    () => filterByDate(salesDetail, rangeStart, rangeEnd),
    [salesDetail, rangeStart, rangeEnd]
  );
  const prevSalesDetail = useMemo(
    () => filterByDate(salesDetail, prevRange.start, prevRange.end),
    [salesDetail, prevRange]
  );

  // KPI 계산
  const kpis = useMemo(() => {
    // 정산매출 = salesDetail 공급가액 직접 합산 (가장 정확한 원천 데이터)
    const calcSettlement = (sales: DailySalesData[], detail: SalesDetailData[]) => {
      if (detail.length > 0) return detail.filter(d => d.customer).reduce((s, d) => s + (d.supplyAmount || 0), 0);
      return sales.reduce((s, d) => s + d.totalRevenue, 0);
    };
    const totalRevenue = calcSettlement(filteredSales, filteredSalesDetail);
    const prevRevenue = calcSettlement(prevSales, prevSalesDetail);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;

    // 폐기율: 폐기수량 / 총생산수량
    const totalProdQty = filteredProduction.reduce((s, d) => s + (d.prodQtyTotal || 0), 0);
    const totalWaste = filteredProduction.reduce((s, d) => s + (d.wasteFinishedEa || 0), 0);
    const wasteRate = totalProdQty > 0 ? (totalWaste / totalProdQty * 100) : 0;
    const prevProdQty = prevProduction.reduce((s, d) => s + (d.prodQtyTotal || 0), 0);
    const prevWaste = prevProduction.reduce((s, d) => s + (d.wasteFinishedEa || 0), 0);
    const prevWasteRate = prevProdQty > 0 ? (prevWaste / prevProdQty * 100) : 0;
    const wasteRateChange = wasteRate - prevWasteRate;

    return {
      totalRevenue,
      revenueChange: parseFloat(revenueChange.toFixed(1)),
      wasteRate: parseFloat(wasteRate.toFixed(1)),
      wasteRateChange: parseFloat(wasteRateChange.toFixed(1)),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSales, filteredSalesDetail, filteredProduction, prevSales, prevSalesDetail, prevProduction]);

  // 차트 데이터 (날짜순 정렬)
  const revenueTrend = useMemo(
    () => [...filteredSales]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ value: d.totalRevenue })),
    [filteredSales]
  );
  const wasteTrend = useMemo(
    () => [...filteredProduction]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ value: d.wasteFinishedEa || 0 })),
    [filteredProduction]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 동기화 상태 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            dataSource === 'backend'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : dataSource === 'direct'
                ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              dataSource === 'backend' ? 'bg-green-500 animate-pulse' :
              dataSource === 'direct' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            {dataSource === 'backend' ? '서버 연동' : dataSource === 'direct' ? 'Supabase 직접' : '미연결'}
          </div>
          <span className="text-[11px] text-gray-400">{lastSyncTime}</span>
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-full transition-colors disabled:opacity-50"
        >
          <span className={`material-icons-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
          {isSyncing ? '동기화 중...' : '동기화'}
        </button>
      </div>

      {/* 데이터 연동 요약 (테이블별 건수를 한 줄로) */}
      {syncStatus && totalRecords > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
            <span className="material-icons-outlined text-sm text-green-500">cloud_done</span>
            {syncStatus.lastSyncTime
              ? new Date(syncStatus.lastSyncTime).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '기록 없음'}
          </span>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
          {Object.entries(syncStatus.tableCounts).map(([table, count]) => (
            <span key={table} className="flex items-center gap-1">
              <span className={`w-1 h-1 rounded-full ${count > 0 ? 'bg-green-400' : 'bg-gray-300'}`} />
              {TABLE_LABELS[table] || table} {count.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <InsightSection id={["home-revenue", "home-waste"]}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={`정산매출 (${rangeLabel})`}
          value={`₩${formatCurrency(kpis.totalRevenue)}`}
          change={`${kpis.revenueChange >= 0 ? '+' : ''}${kpis.revenueChange}%`}
          isPositive={kpis.revenueChange >= 0}
          icon="payments"
          chartData={revenueTrend}
          chartType="area"
          color="#10B981"
        />
        <KPICard
          title={`총 구매원가 (${rangeLabel})`}
          value={`₩${formatCurrency(filteredPurchases.reduce((s, d) => s + (d.total || 0), 0))}`}
          change={`${filteredPurchases.length}건`}
          isPositive={true}
          icon="receipt_long"
          color="#3B82F6"
        />
        <KPICard
          title="평균 폐기율"
          value={`${kpis.wasteRate}%`}
          change={`${kpis.wasteRateChange >= 0 ? '+' : ''}${kpis.wasteRateChange}%p`}
          isPositive={kpis.wasteRateChange <= 0}
          icon="delete_outline"
          chartData={wasteTrend}
          color="#F59E0B"
        />
        <KPICard
          title={`총 생산량 (${rangeLabel})`}
          value={`${filteredProduction.reduce((s, d) => s + (d.prodQtyTotal || 0), 0).toLocaleString('ko-KR')}개`}
          change={`${filteredProduction.length}일`}
          isPositive={true}
          icon="precision_manufacturing"
          chartData={wasteTrend}
          color="#EF4444"
        />
      </div>
      </InsightSection>

      {/* 독립채산제 성과 */}
      {profitCenterScore && (
      <InsightSection id="home-score">
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-icons-outlined text-purple-500">emoji_events</span>
              독립채산제 성과
              <FormulaTooltip {...FORMULAS.costScore} />
            </h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                {profitCenterScore.activeBracket.label} 구간
              </span>
              <span>월 정산매출 {formatCurrency(profitCenterScore.monthlyRevenue)} 추정 ({profitCenterScore.calendarDays}일 기준) | 보간 기준매출 {formatCurrency(profitCenterScore.activeBracket.revenueBracket)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 종합 점수 */}
            <div className="flex flex-col items-center justify-center">
              <div className={`text-6xl font-black ${
                profitCenterScore.overallScore >= 110 ? 'text-green-500' :
                profitCenterScore.overallScore >= 100 ? 'text-blue-500' :
                profitCenterScore.overallScore >= 90 ? 'text-orange-500' : 'text-red-500'
              }`}>
                {profitCenterScore.overallScore}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">종합 점수 (평균)</div>
              <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                profitCenterScore.overallScore >= 110 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                profitCenterScore.overallScore >= 100 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                profitCenterScore.overallScore >= 90 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {profitCenterScore.overallScore >= 110 ? '우수' :
                 profitCenterScore.overallScore >= 100 ? '달성' :
                 profitCenterScore.overallScore >= 90 ? '주의' : '미달'}
              </div>
            </div>

            {/* 지표별 점수 바 차트 */}
            <div className="lg:col-span-2">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitCenterScore.scores.map(s => ({
                      name: s.metric,
                      score: s.score,
                      target: 100,
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 150]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value}점`,
                        name === 'score' ? '달성률' : '목표',
                      ]}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                      {profitCenterScore.scores.map((s, i) => (
                        <Cell
                          key={i}
                          fill={
                            s.status === 'excellent' ? '#10B981' :
                            s.status === 'good' ? '#3B82F6' :
                            s.status === 'warning' ? '#F59E0B' : '#EF4444'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 지표 상세 — 호버 시 공식+세부점수 */}
          <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
            {profitCenterScore.scores.map(s => (
              <ScoreCard key={s.metric} s={s} />
            ))}
          </div>
        </div>
      </InsightSection>
      )}

      {/* Quick Actions */}
      <InsightSection id="home-rec">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { view: 'inventory', icon: 'inventory', label: '재고 발주', desc: '부족 재고 처리', iconClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
          { view: 'production', icon: 'precision_manufacturing', label: '생산 분석', desc: 'BOM/폐기/수율', iconClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
          { view: 'profit', icon: 'assessment', label: '수익 분석', desc: '채널/품목/트렌드', iconClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
          { view: 'cost', icon: 'account_balance', label: '원가 관리', desc: '4요소 분석', iconClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
        ].map(({ view, icon, label, desc, iconClass }) => (
          <button
            key={view}
            onClick={() => onNavigate?.(view)}
            className="flex items-center gap-3 p-4 bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className={`p-2.5 rounded-full ${iconClass} group-hover:scale-110 transition-transform`}>
              <span className="material-icons-outlined text-lg">{icon}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{label}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
          </button>
        ))}
      </div>
      </InsightSection>
    </div>
  );
};
