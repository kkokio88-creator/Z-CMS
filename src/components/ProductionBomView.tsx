import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, PieChart, Pie, ComposedChart,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { Pagination } from './Pagination';
import { formatCurrency, formatAxisKRW, formatPercent, formatQty } from '../utils/format';
import type { ProductionData, PurchaseData } from '../services/googleSheetService';
import type { DashboardInsights, BomVarianceInsight, YieldTrackingInsight } from '../services/insightService';
import { useBusinessConfig } from '../contexts/SettingsContext';

interface Props {
  production: ProductionData[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  onItemClick: (item: any) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  all: '#6B7280',
  normal: '#3B82F6',
  preprocess: '#10B981',
  frozen: '#F59E0B',
  sauce: '#EF4444',
  bibimbap: '#8B5CF6',
};

const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  normal: '일반',
  preprocess: '전처리',
  frozen: '냉동',
  sauce: '소스',
  bibimbap: '비빔밥',
};

const CATEGORY_KEYS = ['normal', 'preprocess', 'frozen', 'sauce', 'bibimbap'] as const;

const formatDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
};

const FilterBar: React.FC<{
  filters: { key: string; label: string; color: string }[];
  active: string;
  onChange: (key: string) => void;
}> = ({ filters, active, onChange }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    {filters.map(f => (
      <button
        key={f.key}
        onClick={() => onChange(f.key)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
          active === f.key
            ? 'text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        style={active === f.key ? { backgroundColor: f.color } : undefined}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
        {f.label}
      </button>
    ))}
  </div>
);

export const ProductionBomView: React.FC<Props> = ({ production, purchases, insights, onItemClick }) => {
  const config = useBusinessConfig();
  const wasteAnalysis = insights?.wasteAnalysis;
  const prodEfficiency = insights?.productionEfficiency;
  const bomVariance = insights?.bomVariance || null;
  const yieldTracking = insights?.yieldTracking || null;

  const [prodFilter, setProdFilter] = useState('all');
  const [wasteFilter, setWasteFilter] = useState('all');
  const [effFilter, setEffFilter] = useState('all');
  const [prodPage, setProdPage] = useState(1);
  const [effPage, setEffPage] = useState(1);
  const PROD_PAGE_SIZE = 20;

  const categoryFilters = [
    { key: 'all', label: '전체', color: CATEGORY_COLORS.all },
    ...CATEGORY_KEYS.map(k => ({ key: k, label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k] })),
  ];

  // 주간 집계 (일별 데이터를 주간으로 요약)
  const weeklyData = useMemo(() => {
    const daily = prodEfficiency?.daily || [];
    if (daily.length === 0) return [];
    const weeks: { weekLabel: string; normal: number; preprocess: number; frozen: number; sauce: number; bibimbap: number; total: number; days: number }[] = [];
    let currentWeek = { weekLabel: '', normal: 0, preprocess: 0, frozen: 0, sauce: 0, bibimbap: 0, total: 0, days: 0 };

    daily.forEach((d, i) => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay();
      // 월요일 시작 또는 첫 데이터
      if (i === 0 || dayOfWeek === 1) {
        if (currentWeek.days > 0) weeks.push(currentWeek);
        currentWeek = { weekLabel: formatDate(d.date), normal: 0, preprocess: 0, frozen: 0, sauce: 0, bibimbap: 0, total: 0, days: 0 };
      }
      currentWeek.normal += d.normal;
      currentWeek.preprocess += d.preprocess;
      currentWeek.frozen += d.frozen;
      currentWeek.sauce += d.sauce;
      currentWeek.bibimbap += d.bibimbap;
      currentWeek.total += d.total;
      currentWeek.days++;
    });
    if (currentWeek.days > 0) weeks.push(currentWeek);
    return weeks;
  }, [prodEfficiency?.daily]);

  // 일별 원본 데이터 (필터된 리스트용)
  const dailyData = prodEfficiency?.daily || [];

  const tabs = [
    { key: 'production', label: '생산 현황', icon: 'precision_manufacturing' },
    { key: 'waste', label: '폐기 분석', icon: 'delete_outline' },
    { key: 'efficiency', label: '생산성 분석', icon: 'speed' },
    { key: 'bomVariance', label: 'BOM 오차', icon: 'compare_arrows' },
    { key: 'yield', label: '수율 추적', icon: 'science' },
  ];

  return (
    <SubTabLayout title="생산/BOM 관리" tabs={tabs}>
      {(activeTab) => {
        // ========== 생산 현황 ==========
        if (activeTab === 'production') {
          const totalProd = prodEfficiency?.totalProduction || 0;
          const avgDaily = prodEfficiency?.avgDaily || 0;
          const dataRange = prodEfficiency?.dataRange;

          // 카테고리 비율 파이 데이터
          const categoryPie = (prodEfficiency?.categoryStats || [])
            .filter(c => c.total > 0)
            .map(c => ({ name: c.category, value: c.total }));

          // 필터에 따른 주간 차트 데이터 키
          const chartDataKey = prodFilter === 'all' ? 'total' : prodFilter;

          // 필터된 일별 상세 리스트
          const filteredDailyList = prodFilter === 'all'
            ? dailyData
            : dailyData.filter(d => d[prodFilter as keyof typeof d] as number > 0);

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 생산량</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatQty(totalProd)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">일 평균</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatQty(avgDaily)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">데이터 기간</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{dataRange?.days || 0}일</p>
                  <p className="text-xs text-gray-400 mt-1">{dataRange?.from || ''} ~ {dataRange?.to || ''}</p>
                </div>
              </div>

              {/* 필터 */}
              <FilterBar filters={categoryFilters} active={prodFilter} onChange={setProdFilter} />

              {/* 주간 생산 추이 (간소화) + 카테고리 Pie */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    주간 생산 추이 {prodFilter !== 'all' && <span className="text-sm text-gray-400 font-normal">({CATEGORY_LABELS[prodFilter]})</span>}
                  </h3>
                  {weeklyData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        {prodFilter === 'all' ? (
                          <AreaChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Area type="monotone" dataKey="normal" name="일반" stackId="1" stroke={CATEGORY_COLORS.normal} fill={CATEGORY_COLORS.normal} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="preprocess" name="전처리" stackId="1" stroke={CATEGORY_COLORS.preprocess} fill={CATEGORY_COLORS.preprocess} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="frozen" name="냉동" stackId="1" stroke={CATEGORY_COLORS.frozen} fill={CATEGORY_COLORS.frozen} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="sauce" name="소스" stackId="1" stroke={CATEGORY_COLORS.sauce} fill={CATEGORY_COLORS.sauce} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="bibimbap" name="비빔밥" stackId="1" stroke={CATEGORY_COLORS.bibimbap} fill={CATEGORY_COLORS.bibimbap} fillOpacity={0.6} />
                          </AreaChart>
                        ) : (
                          <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: number) => `${v.toLocaleString()}개`} />
                            <Bar dataKey={chartDataKey} name={CATEGORY_LABELS[prodFilter]} fill={CATEGORY_COLORS[prodFilter]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">생산 데이터 없음</p>}
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">카테고리 비율</h3>
                  {categoryPie.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                            {categoryPie.map((entry, i) => {
                              const key = CATEGORY_KEYS.find(k => CATEGORY_LABELS[k] === entry.name);
                              return <Cell key={i} fill={key ? CATEGORY_COLORS[key] : CATEGORY_COLORS[CATEGORY_KEYS[i % CATEGORY_KEYS.length]]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(v: number) => `${v.toLocaleString()}개`} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                </div>
              </div>

              {/* 필터된 일별 상세 리스트 */}
              {prodFilter !== 'all' && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    {CATEGORY_LABELS[prodFilter]} 일별 생산 내역 <span className="text-sm text-gray-400 font-normal">({filteredDailyList.length}건)</span>
                  </h3>
                  {filteredDailyList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                            <th className="text-right py-2 px-3 text-gray-500">{CATEGORY_LABELS[prodFilter]} 생산량</th>
                            <th className="text-right py-2 px-3 text-gray-500">전체 생산량</th>
                            <th className="text-right py-2 px-3 text-gray-500">비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDailyList.slice((prodPage - 1) * PROD_PAGE_SIZE, prodPage * PROD_PAGE_SIZE).map(d => {
                            const catQty = d[prodFilter as keyof typeof d] as number;
                            const ratio = d.total > 0 ? Math.round((catQty / d.total) * 1000) / 10 : 0;
                            return (
                              <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{d.date}</td>
                                <td className="py-2 px-3 text-right font-medium" style={{ color: CATEGORY_COLORS[prodFilter] }}>{formatQty(catQty)}</td>
                                <td className="py-2 px-3 text-right text-gray-500">{formatQty(d.total)}</td>
                                <td className="py-2 px-3 text-right text-gray-500">{ratio}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredDailyList.length > PROD_PAGE_SIZE && (
                        <Pagination
                          currentPage={prodPage}
                          totalPages={Math.ceil(filteredDailyList.length / PROD_PAGE_SIZE)}
                          totalItems={filteredDailyList.length}
                          startIndex={(prodPage - 1) * PROD_PAGE_SIZE}
                          endIndex={Math.min(prodPage * PROD_PAGE_SIZE, filteredDailyList.length)}
                          onPrev={() => setProdPage(p => Math.max(1, p - 1))}
                          onNext={() => setProdPage(p => Math.min(Math.ceil(filteredDailyList.length / PROD_PAGE_SIZE), p + 1))}
                          onGoToPage={setProdPage}
                        />
                      )}
                    </div>
                  ) : <p className="text-gray-400 text-center py-6">해당 카테고리 생산 데이터 없음</p>}
                </div>
              )}
            </div>
          );
        }

        // ========== 폐기 분석 ==========
        if (activeTab === 'waste') {
          const daily = wasteAnalysis?.daily || [];
          const avgRate = wasteAnalysis?.avgWasteRate || 0;
          const highDays = wasteAnalysis?.highWasteDays || [];
          const totalCost = wasteAnalysis?.totalEstimatedCost || 0;

          // 주간 폐기율 집계
          const weeklyWaste = (() => {
            if (daily.length === 0) return [];
            const weeks: { weekLabel: string; avgWasteRate: number; totalProduction: number; totalWaste: number; days: number }[] = [];
            let curr = { weekLabel: '', totalProd: 0, totalWaste: 0, totalRate: 0, days: 0 };
            daily.forEach((d, i) => {
              const date = new Date(d.date);
              if (i === 0 || date.getDay() === 1) {
                if (curr.days > 0) weeks.push({
                  weekLabel: curr.weekLabel,
                  avgWasteRate: Math.round((curr.totalRate / curr.days) * 10) / 10,
                  totalProduction: curr.totalProd,
                  totalWaste: curr.totalWaste,
                  days: curr.days,
                });
                curr = { weekLabel: formatDate(d.date), totalProd: 0, totalWaste: 0, totalRate: 0, days: 0 };
              }
              curr.totalProd += d.productionQty;
              curr.totalWaste += d.wasteFinishedEa;
              curr.totalRate += d.wasteFinishedPct;
              curr.days++;
            });
            if (curr.days > 0) weeks.push({
              weekLabel: curr.weekLabel,
              avgWasteRate: Math.round((curr.totalRate / curr.days) * 10) / 10,
              totalProduction: curr.totalProd,
              totalWaste: curr.totalWaste,
              days: curr.days,
            });
            return weeks;
          })();

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">평균 폐기율</p>
                  <p className={`text-2xl font-bold mt-1 ${avgRate > config.wasteThresholdPct ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercent(avgRate)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">목표: {config.wasteThresholdPct}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{config.wasteThresholdPct}% 초과일</p>
                  <p className={`text-2xl font-bold mt-1 ${highDays.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {highDays.length}일
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">추정 폐기비용</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalCost)}</p>
                </div>
              </div>

              {/* C3: 주간 생산량(LineChart) + 폐기율(우축 Line) */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 생산량 & 폐기율 추이</h3>
                {weeklyWaste.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyWaste} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number, name: string) => name === '폐기율' ? `${v}%` : v.toLocaleString()} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="totalProduction" name="생산량" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="avgWasteRate" name="폐기율" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">생산 데이터 없음</p>}
              </div>

              {/* 폐기율 분포 + 요일별 분석 */}
              {daily.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 폐기율 분포 */}
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">폐기율 분포</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { range: '0~1%', count: daily.filter(d => d.wasteFinishedPct < 1).length, color: '#10B981' },
                          { range: '1~2%', count: daily.filter(d => d.wasteFinishedPct >= 1 && d.wasteFinishedPct < 2).length, color: '#3B82F6' },
                          { range: '2~3%', count: daily.filter(d => d.wasteFinishedPct >= 2 && d.wasteFinishedPct < 3).length, color: '#F59E0B' },
                          { range: '3~5%', count: daily.filter(d => d.wasteFinishedPct >= 3 && d.wasteFinishedPct < 5).length, color: '#EF4444' },
                          { range: '5%+', count: daily.filter(d => d.wasteFinishedPct >= 5).length, color: '#7C3AED' },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `${v}일`} />
                          <Bar dataKey="count" name="일수" radius={[4, 4, 0, 0]}>
                            {[
                              { color: '#10B981' }, { color: '#3B82F6' }, { color: '#F59E0B' }, { color: '#EF4444' }, { color: '#7C3AED' },
                            ].map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 요일별 평균 폐기율 */}
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">요일별 평균 폐기율</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                          const dayData = dayNames.map((name, idx) => {
                            const dayItems = daily.filter(d => new Date(d.date).getDay() === idx);
                            const avg = dayItems.length > 0
                              ? Math.round(dayItems.reduce((s, d) => s + d.wasteFinishedPct, 0) / dayItems.length * 10) / 10
                              : 0;
                            return { 요일: name, 평균폐기율: avg, days: dayItems.length };
                          });
                          return dayData;
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="요일" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: number) => `${v}%`} />
                          <Bar dataKey="평균폐기율" radius={[4, 4, 0, 0]}>
                            {[0,1,2,3,4,5,6].map((_, i) => <Cell key={i} fill={i === 0 || i === 6 ? '#EF4444' : '#3B82F6'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">주말(빨강) / 평일(파랑) 폐기율 패턴 분석</p>
                  </div>
                </div>
              )}

              {/* 폐기율 초과일 테이블 */}
              {highDays.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">warning</span>
                    폐기율 {config.wasteThresholdPct}% 초과일
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                          <th className="text-left py-2 px-3 text-gray-500">요일</th>
                          <th className="text-right py-2 px-3 text-gray-500">폐기율</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산량</th>
                          <th className="text-right py-2 px-3 text-gray-500">폐기 수량</th>
                          <th className="text-right py-2 px-3 text-gray-500">추정 비용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {highDays.map(d => {
                          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(d.date).getDay()];
                          return (
                            <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800 bg-red-50/50 dark:bg-red-900/10">
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{d.date}</td>
                              <td className="py-2 px-3 text-gray-500 text-xs">{dayOfWeek}</td>
                              <td className="py-2 px-3 text-right font-medium text-red-600">{formatPercent(d.rate)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatQty(d.productionQty || 0)}</td>
                              <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatQty(d.qty)}</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(d.cost || d.qty * config.wasteUnitCost)}</td>
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

        // ========== 생산성 분석 ==========
        if (activeTab === 'efficiency') {
        const catStats = prodEfficiency?.categoryStats || [];
        const maxDay = prodEfficiency?.maxDay;

        // 주간 추이 (필터 적용)
        const chartKey = effFilter === 'all' ? 'total' : effFilter;

        // 필터된 일별 리스트
        const filteredEffList = effFilter === 'all'
          ? dailyData
          : dailyData.filter(d => d[effFilter as keyof typeof d] as number > 0);

        return (
          <div className="space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">최대 생산일</p>
                <p className="text-lg font-bold text-blue-600 mt-1">{maxDay?.date || '-'}</p>
                <p className="text-xs text-gray-400 mt-1">{formatQty(maxDay?.qty || 0)} 생산</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">일 평균 생산량</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatQty(prodEfficiency?.avgDaily || 0)}</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">카테고리 수</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{catStats.filter(c => c.total > 0).length}개</p>
              </div>
            </div>

            {/* 필터 */}
            <FilterBar filters={categoryFilters} active={effFilter} onChange={setEffFilter} />

            {/* 주간 생산 추이 (필터 적용, 간소화) */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                주간 생산 추이 {effFilter !== 'all' && <span className="text-sm text-gray-400 font-normal">({CATEGORY_LABELS[effFilter]})</span>}
              </h3>
              {weeklyData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()}개`} />
                      {effFilter === 'all' ? (
                        <>
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {CATEGORY_KEYS.map(k => (
                            <Line key={k} type="monotone" dataKey={k} name={CATEGORY_LABELS[k]} stroke={CATEGORY_COLORS[k]} strokeWidth={2} dot={false} />
                          ))}
                        </>
                      ) : (
                        <Line type="monotone" dataKey={chartKey} name={CATEGORY_LABELS[effFilter]} stroke={CATEGORY_COLORS[effFilter]} strokeWidth={2} dot={{ r: 3 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-400 text-center py-10">생산 데이터 없음</p>}
            </div>

            {/* 카테고리별 통계 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">카테고리별 통계</h3>
              {catStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">카테고리</th>
                        <th className="text-right py-2 px-3 text-gray-500">총 생산량</th>
                        <th className="text-right py-2 px-3 text-gray-500">일 평균</th>
                        <th className="text-right py-2 px-3 text-gray-500">최대 생산</th>
                        <th className="text-left py-2 px-3 text-gray-500">최대일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catStats.filter(c => c.total > 0).map((c, i) => (
                        <tr key={c.category} className={`border-b border-gray-100 dark:border-gray-800 ${
                          effFilter !== 'all' && CATEGORY_LABELS[effFilter] === c.category ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}>
                          <td className="py-2 px-3">
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[CATEGORY_KEYS[i % CATEGORY_KEYS.length]] }}></span>
                              <span className="text-gray-800 dark:text-gray-200">{c.category}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatQty(c.total)}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatQty(c.avg)}</td>
                          <td className="py-2 px-3 text-right text-blue-600">{formatQty(c.max)}</td>
                          <td className="py-2 px-3 text-gray-500 text-xs">{c.maxDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
            </div>

            {/* 필터된 일별 상세 리스트 */}
            {effFilter !== 'all' && (
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  {CATEGORY_LABELS[effFilter]} 일별 상세 <span className="text-sm text-gray-400 font-normal">({filteredEffList.length}건)</span>
                </h3>
                {filteredEffList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                          <th className="text-right py-2 px-3 text-gray-500">{CATEGORY_LABELS[effFilter]} 생산량</th>
                          <th className="text-right py-2 px-3 text-gray-500">전체 생산량</th>
                          <th className="text-right py-2 px-3 text-gray-500">비율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEffList.slice((effPage - 1) * PROD_PAGE_SIZE, effPage * PROD_PAGE_SIZE).map(d => {
                          const catQty = d[effFilter as keyof typeof d] as number;
                          const ratio = d.total > 0 ? Math.round((catQty / d.total) * 1000) / 10 : 0;
                          return (
                            <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{d.date}</td>
                              <td className="py-2 px-3 text-right font-medium" style={{ color: CATEGORY_COLORS[effFilter] }}>{formatQty(catQty)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatQty(d.total)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{ratio}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredEffList.length > PROD_PAGE_SIZE && (
                      <Pagination
                        currentPage={effPage}
                        totalPages={Math.ceil(filteredEffList.length / PROD_PAGE_SIZE)}
                        totalItems={filteredEffList.length}
                        startIndex={(effPage - 1) * PROD_PAGE_SIZE}
                        endIndex={Math.min(effPage * PROD_PAGE_SIZE, filteredEffList.length)}
                        onPrev={() => setEffPage(p => Math.max(1, p - 1))}
                        onNext={() => setEffPage(p => Math.min(Math.ceil(filteredEffList.length / PROD_PAGE_SIZE), p + 1))}
                        onGoToPage={setEffPage}
                      />
                    )}
                  </div>
                ) : <p className="text-gray-400 text-center py-6">해당 카테고리 데이터 없음</p>}
              </div>
            )}
          </div>
        );
        }

        // ========== BOM 오차 분석 ==========
        if (activeTab === 'bomVariance') {
          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 차이 금액</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (bomVariance?.totalVariance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(bomVariance?.totalVariance || 0) > 0 ? '+' : ''}{formatCurrency(bomVariance?.totalVariance || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">가격 차이</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (bomVariance?.totalPriceVariance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(bomVariance?.totalPriceVariance || 0) > 0 ? '+' : ''}{formatCurrency(bomVariance?.totalPriceVariance || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">수량 차이</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (bomVariance?.totalQtyVariance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(bomVariance?.totalQtyVariance || 0) > 0 ? '+' : ''}{formatCurrency(bomVariance?.totalQtyVariance || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">유리/불리 품목</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                    <span className="text-green-600">{bomVariance?.favorableCount || 0}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600">{bomVariance?.unfavorableCount || 0}</span>
                  </p>
                </div>
              </div>

              {/* C2: 상위/하위 5 수평 BarChart + 분포도 */}
              {bomVariance && bomVariance.items.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">상위/하위 5 품목 (차이 금액)</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(() => {
                            const sorted = [...bomVariance.items].sort((a, b) => b.totalVariance - a.totalVariance);
                            const top5 = sorted.slice(0, 5);
                            const bot5 = sorted.slice(-5).reverse();
                            return [...top5, ...bot5].map(item => ({
                              name: item.productName.length > 8 ? item.productName.slice(0, 8) + '..' : item.productName,
                              차이금액: item.totalVariance,
                            }));
                          })()}
                          layout="vertical"
                          margin={{ left: 10, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="차이금액" radius={[0, 4, 4, 0]}>
                            {(() => {
                              const sorted = [...bomVariance.items].sort((a, b) => b.totalVariance - a.totalVariance);
                              const combined = [...sorted.slice(0, 5), ...sorted.slice(-5).reverse()];
                              return combined.map((item, i) => (
                                <Cell key={i} fill={item.totalVariance > 0 ? '#EF4444' : '#10B981'} />
                              ));
                            })()}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">BOM 오차 분포</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const items = bomVariance.items;
                          return [
                            { range: '~-50만', count: items.filter(i => i.totalVariance < -500000).length, color: '#10B981' },
                            { range: '-50~-10', count: items.filter(i => i.totalVariance >= -500000 && i.totalVariance < -100000).length, color: '#34D399' },
                            { range: '-10~0', count: items.filter(i => i.totalVariance >= -100000 && i.totalVariance < 0).length, color: '#6EE7B7' },
                            { range: '0~10', count: items.filter(i => i.totalVariance >= 0 && i.totalVariance < 100000).length, color: '#FCA5A5' },
                            { range: '10~50', count: items.filter(i => i.totalVariance >= 100000 && i.totalVariance < 500000).length, color: '#F87171' },
                            { range: '50만~', count: items.filter(i => i.totalVariance >= 500000).length, color: '#EF4444' },
                          ];
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `${v}개 품목`} />
                          <Bar dataKey="count" name="품목 수" radius={[4, 4, 0, 0]}>
                            {[
                              { color: '#10B981' }, { color: '#34D399' }, { color: '#6EE7B7' },
                              { color: '#FCA5A5' }, { color: '#F87171' }, { color: '#EF4444' },
                            ].map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">음수=유리(녹색) / 양수=불리(빨강) 단위: 만원</p>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-icons-outlined text-purple-500">compare_arrows</span>
                  레시피 대비 투입 오차 분석
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  전반기 평균을 기준(Standard)으로 후반기 실제(Actual) 비교 | 양수=불리(초과), 음수=유리(절감)
                </p>

                {bomVariance && bomVariance.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">기준단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">실제단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">기준수량</th>
                          <th className="text-right py-2 px-3 text-gray-500">실제수량</th>
                          <th className="text-right py-2 px-3 text-gray-500">가격차이</th>
                          <th className="text-right py-2 px-3 text-gray-500">수량차이</th>
                          <th className="text-right py-2 px-3 text-gray-500">총 차이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomVariance.items.slice(0, 20).map(item => (
                          <tr key={item.productCode} className={`border-b border-gray-100 dark:border-gray-800 ${
                            item.totalVariance > 0 ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                          }`}>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.standardPrice)}</td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.actualPrice)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatQty(item.standardQty)}</td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatQty(item.actualQty)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              item.priceVariance > 0 ? 'text-red-600' : item.priceVariance < 0 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {item.priceVariance > 0 ? '+' : ''}{formatCurrency(item.priceVariance)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              item.qtyVariance > 0 ? 'text-red-600' : item.qtyVariance < 0 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {item.qtyVariance > 0 ? '+' : ''}{formatCurrency(item.qtyVariance)}
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${
                              item.totalVariance > 0 ? 'text-red-600' : item.totalVariance < 0 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {item.totalVariance > 0 ? '+' : ''}{formatCurrency(item.totalVariance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">구매/생산 데이터가 충분하지 않습니다.</p>}
              </div>
            </div>
          );
        }

        // ========== 수율 추적 ==========
        if (activeTab === 'yield') {
          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">기준 수율</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{yieldTracking?.standardYield || 0}%</p>
                  <p className="text-xs text-gray-400 mt-1">폐기 허용 {config.wasteThresholdPct}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">실제 수율</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (yieldTracking?.avgYieldRate || 0) >= (yieldTracking?.standardYield || 0) ? 'text-green-600' : 'text-red-600'
                  }`}>{yieldTracking?.avgYieldRate || 0}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">수율 차이</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    (yieldTracking?.yieldGap || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(yieldTracking?.yieldGap || 0) > 0 ? '+' : ''}{yieldTracking?.yieldGap || 0}%p
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">환산단가</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(yieldTracking?.avgAdjustedUnitCost || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">원가 {formatCurrency(yieldTracking?.avgUnitCost || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">수율 손실 비용</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(yieldTracking?.costImpact || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">기준 미달 {yieldTracking?.lowYieldDays || 0}/{yieldTracking?.totalDays || 0}일</p>
                </div>
              </div>

              {/* 주간 수율 추이 차트 */}
              {yieldTracking && yieldTracking.weekly.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-green-500">show_chart</span>
                    주간 수율 추이
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yieldTracking.weekly} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} domain={[85, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                        <Tooltip formatter={(v: number, name: string) =>
                          name === '환산단가' ? formatCurrency(v) : `${v}%`
                        } />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="avgYield" name="실제 수율" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="left" type="monotone" dataKey="standardYield" name="기준 수율" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="avgAdjustedCost" name="환산단가" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* C4: 주간 생산량 vs 폐기량 — LineChart + 폐기율 우축 */}
              {yieldTracking && yieldTracking.weekly.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-blue-500">show_chart</span>
                    주간 생산량 vs 폐기량 & 폐기율
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={yieldTracking.weekly.map(w => ({
                        ...w,
                        폐기율: w.totalQty > 0 ? Math.round((w.totalWaste / w.totalQty) * 1000) / 10 : 0,
                      }))} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatQty} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number, name: string) => name === '폐기율' ? `${v}%` : formatQty(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="totalQty" name="생산량" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="left" type="monotone" dataKey="totalWaste" name="폐기량" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="폐기율" name="폐기율" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 일별 수율 상세 테이블 */}
              {yieldTracking && yieldTracking.daily.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="material-icons-outlined text-orange-500">science</span>
                    일별 수율 상세
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    환산단가 = 단위원가 / 수율 | 수율 기준 미달일은 빨간 배경
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산(ea)</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산(kg)</th>
                          <th className="text-right py-2 px-3 text-gray-500">폐기(ea)</th>
                          <th className="text-right py-2 px-3 text-gray-500">수율(%)</th>
                          <th className="text-right py-2 px-3 text-gray-500">기준</th>
                          <th className="text-right py-2 px-3 text-gray-500">차이</th>
                          <th className="text-right py-2 px-3 text-gray-500">단위원가</th>
                          <th className="text-right py-2 px-3 text-gray-500">환산단가</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yieldTracking.daily.slice(-30).reverse().map(d => (
                          <tr key={d.date} className={`border-b border-gray-100 dark:border-gray-800 ${
                            d.yieldGap < 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                          }`}>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{d.date}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatQty(d.productionQty)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{d.productionKg > 0 ? formatQty(d.productionKg) : '-'}</td>
                            <td className="py-2 px-3 text-right text-red-500">{d.wasteQty > 0 ? formatQty(d.wasteQty) : '-'}</td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              d.yieldRate >= d.standardYield ? 'text-green-600' : 'text-red-600'
                            }`}>{d.yieldRate}%</td>
                            <td className="py-2 px-3 text-right text-gray-400">{d.standardYield}%</td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              d.yieldGap >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {d.yieldGap > 0 ? '+' : ''}{d.yieldGap}%p
                            </td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(d.unitCost)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              d.adjustedUnitCost > d.unitCost * 1.1 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'
                            }`}>{formatCurrency(d.adjustedUnitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(!yieldTracking || yieldTracking.daily.length === 0) && (
                <p className="text-gray-400 text-center py-10">생산 데이터가 없습니다.</p>
              )}
            </div>
          );
        }

        return null;
      }}
    </SubTabLayout>
  );
};
