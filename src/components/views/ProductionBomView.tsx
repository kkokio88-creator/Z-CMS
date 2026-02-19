import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, PieChart, Pie, ComposedChart,
} from 'recharts';
import { SubTabLayout, Pagination } from '../layout';
import { formatCurrency, formatAxisKRW, formatPercent, formatQty } from '../../utils/format';
import type { ProductionData, PurchaseData, BomItemData, MaterialMasterItem } from '../../services/googleSheetService';
import type { DashboardInsights, BomVarianceInsight, BomVarianceItem, YieldTrackingInsight, BomConsumptionAnomalyInsight, BomConsumptionAnomalyItem } from '../../services/insightService';
import { computeWasteAnalysis, computeProductionEfficiency, computeBomVariance, computeYieldTracking } from '../../services/insightService';
import { useBusinessConfig } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import { getDateRange, filterByDate } from '../../utils/dateRange';
import { FormulaTooltip } from '../common';
import { FORMULAS } from '../../constants/formulaDescriptions';
import { InsightSection } from '../insight';
import { FilterBar } from '../common';

interface Props {
  production: ProductionData[];
  purchases: PurchaseData[];
  insights: DashboardInsights | null;
  bomData?: BomItemData[];
  materialMaster?: MaterialMasterItem[];
  onItemClick: (item: import('../../types').ModalItem) => void;
  onTabChange?: (tab: string) => void;
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

export const ProductionBomView: React.FC<Props> = ({ production, purchases, insights, bomData = [], materialMaster = [], onItemClick, onTabChange }) => {
  const config = useBusinessConfig();
  const { dateRange } = useUI();
  const { start: rangeStart, end: rangeEnd } = useMemo(() => getDateRange(dateRange), [dateRange]);
  const filteredProduction = useMemo(() => filterByDate(production, rangeStart, rangeEnd), [production, rangeStart, rangeEnd]);
  const filteredPurchases = useMemo(() => filterByDate(purchases, rangeStart, rangeEnd), [purchases, rangeStart, rangeEnd]);

  // dateRange 기반 인사이트 로컬 재계산
  const wasteAnalysis = useMemo(
    () => filteredProduction.length > 0 ? computeWasteAnalysis(filteredProduction, config, filteredPurchases) : null,
    [filteredProduction, filteredPurchases, config]
  );
  const prodEfficiency = useMemo(
    () => filteredProduction.length > 0 ? computeProductionEfficiency(filteredProduction) : null,
    [filteredProduction]
  );
  const bomVariance = useMemo(
    () => (filteredPurchases.length > 0 && filteredProduction.length > 0) ? computeBomVariance(filteredPurchases, filteredProduction, bomData, materialMaster) : null,
    [filteredPurchases, filteredProduction, bomData, materialMaster]
  );
  const yieldTracking = useMemo(
    () => (filteredProduction.length > 0 && filteredPurchases.length > 0) ? computeYieldTracking(filteredProduction, filteredPurchases, config) : null,
    [filteredProduction, filteredPurchases, config]
  );

  const [prodFilter, setProdFilter] = useState('all');
  const [wasteFilter, setWasteFilter] = useState('all');
  const [effFilter, setEffFilter] = useState('all');
  const [prodPage, setProdPage] = useState(1);
  const [effPage, setEffPage] = useState(1);
  const PROD_PAGE_SIZE = 20;

  // BOM 오차 드릴다운 상태
  const [selectedMaterial, setSelectedMaterial] = useState<BomVarianceItem | null>(null);
  // BOM 오차 정렬: 기본=|차이금액| 내림차순, 토글=연결메뉴수 오름차순
  const [bomSortByMenu, setBomSortByMenu] = useState(false);

  // 선택된 자재의 메뉴별 상세 데이터 (BOM 기준)
  const materialDrilldown = useMemo(() => {
    if (!selectedMaterial || bomData.length === 0) return null;
    const code = selectedMaterial.productCode;

    // BOM에서 해당 자재를 사용하는 생산품목(메뉴) 목록
    const relatedBom = bomData.filter(b => b.materialCode?.trim() === code);
    if (relatedBom.length === 0) return null;

    // 총 생산량 → BOM 제품수로 균등 분배
    const totalProdQty = filteredProduction.reduce((s, p) => s + p.prodQtyTotal, 0);
    const uniqueBomProducts = new Set(bomData.map(b => b.productCode?.trim()).filter(Boolean));
    const perProductProd = totalProdQty / (uniqueBomProducts.size || 1);

    // 전체 구매량 (해당 자재)
    const actualPurchaseQty = filteredPurchases
      .filter(p => p.productCode === code)
      .reduce((s, p) => s + p.quantity, 0);

    // 메뉴별 분석 (BOM consumptionQty 기준)
    const menuDetails = relatedBom.map(bom => {
      const menuCode = bom.productCode?.trim() || '';
      const menuName = bom.productName || menuCode;
      const recipeQty = bom.consumptionQty || 0;
      const batchSize = bom.productionQty || 1;

      // 기준 소모량 = consumptionQty × (제품별 균등생산량 / 배치크기)
      const standardConsumption = Math.round(recipeQty * (perProductProd / batchSize));

      return {
        menuCode,
        menuName: menuCode ? `[${menuCode}] ${menuName}` : menuName,
        recipeQty,
        batchSize,
        standardConsumption,
      };
    });

    // 전체 기준 소모량 합계
    const totalStandard = menuDetails.reduce((s, m) => s + m.standardConsumption, 0);

    // 구매량 비례 배분
    const menuWithAllocation = menuDetails.map(m => {
      const ratio = totalStandard > 0 ? m.standardConsumption / totalStandard : 0;
      const allocatedActual = Math.round(actualPurchaseQty * ratio);
      const diff = allocatedActual - m.standardConsumption;
      return { ...m, allocatedActual, diff };
    });

    return {
      items: menuWithAllocation,
      totalStandard,
      totalActual: actualPurchaseQty,
      unit: selectedMaterial.unit,
    };
  }, [selectedMaterial, bomData, filteredProduction, filteredPurchases]);

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

  const bomAnomaly = insights?.bomConsumptionAnomaly || null;

  const tabs = [
    { key: 'production', label: '생산 현황', icon: 'precision_manufacturing' },
    { key: 'waste', label: '폐기 분석', icon: 'delete_outline' },
    { key: 'efficiency', label: '생산성 분석', icon: 'speed' },
    { key: 'bomAnomaly', label: 'BOM 이상 감지', icon: 'warning' },
    { key: 'bomVariance', label: 'BOM 오차', icon: 'compare_arrows' },
    { key: 'yield', label: '수율 추적', icon: 'science' },
  ];

  return (
    <SubTabLayout title="생산/BOM 관리" tabs={tabs} onTabChange={onTabChange}>
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
            <InsightSection id="prod-status">
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
                    <FormulaTooltip {...FORMULAS.weeklyProduction} />
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
            </InsightSection>
          );
        }

        // ========== 폐기 분석 ==========
        if (activeTab === 'waste') {
          const daily = wasteAnalysis?.daily || [];
          const avgRate = wasteAnalysis?.avgWasteRate || 0;
          const highDays = wasteAnalysis?.highWasteDays || [];
          const totalCost = wasteAnalysis?.totalEstimatedCost || 0;

          // 반제품 폐기 통계
          const validSemiDays = daily.filter(d => d.productionQty > 0);
          const avgSemiRate = validSemiDays.length > 0
            ? Math.round((validSemiDays.reduce((s, d) => s + d.wasteSemiPct, 0) / validSemiDays.length) * 10) / 10
            : 0;
          const totalWasteEa = daily.reduce((s, d) => s + d.wasteFinishedEa, 0);
          const totalWasteKg = daily.reduce((s, d) => s + d.wasteSemiKg, 0);

          // 주간 폐기율 집계 (반제품 포함)
          const weeklyWaste = (() => {
            if (daily.length === 0) return [];
            const weeks: { weekLabel: string; avgWasteRate: number; avgWasteSemiPct: number; totalProduction: number; totalWaste: number; totalWasteKg: number; days: number }[] = [];
            let curr = { weekLabel: '', totalProd: 0, totalWaste: 0, totalWasteKg: 0, totalRate: 0, totalSemiRate: 0, days: 0 };
            daily.forEach((d, i) => {
              const date = new Date(d.date);
              if (i === 0 || date.getDay() === 1) {
                if (curr.days > 0) weeks.push({
                  weekLabel: curr.weekLabel,
                  avgWasteRate: Math.round((curr.totalRate / curr.days) * 10) / 10,
                  avgWasteSemiPct: Math.round((curr.totalSemiRate / curr.days) * 10) / 10,
                  totalProduction: curr.totalProd,
                  totalWaste: curr.totalWaste,
                  totalWasteKg: curr.totalWasteKg,
                  days: curr.days,
                });
                curr = { weekLabel: formatDate(d.date), totalProd: 0, totalWaste: 0, totalWasteKg: 0, totalRate: 0, totalSemiRate: 0, days: 0 };
              }
              curr.totalProd += d.productionQty;
              curr.totalWaste += d.wasteFinishedEa;
              curr.totalWasteKg += d.wasteSemiKg;
              curr.totalRate += d.wasteFinishedPct;
              curr.totalSemiRate += d.wasteSemiPct;
              curr.days++;
            });
            if (curr.days > 0) weeks.push({
              weekLabel: curr.weekLabel,
              avgWasteRate: Math.round((curr.totalRate / curr.days) * 10) / 10,
              avgWasteSemiPct: Math.round((curr.totalSemiRate / curr.days) * 10) / 10,
              totalProduction: curr.totalProd,
              totalWaste: curr.totalWaste,
              totalWasteKg: curr.totalWasteKg,
              days: curr.days,
            });
            return weeks;
          })();

          // 일별 폐기 상세 (폐기 데이터 있는 행만)
          const dailyWasteDetail = [...daily]
            .filter(d => d.wasteFinishedEa > 0 || d.wasteSemiKg > 0)
            .sort((a, b) => b.date.localeCompare(a.date));

          // 카테고리별 생산량 집계
          const categoryProduction = (() => {
            const cats = [
              { key: 'normal', label: '일반', eaField: 'prodQtyNormal' as const, kgField: 'prodKgNormal' as const, color: CATEGORY_COLORS.normal },
              { key: 'preprocess', label: '전처리', eaField: 'prodQtyPreprocess' as const, kgField: 'prodKgPreprocess' as const, color: CATEGORY_COLORS.preprocess },
              { key: 'frozen', label: '냉동', eaField: 'prodQtyFrozen' as const, kgField: 'prodKgFrozen' as const, color: CATEGORY_COLORS.frozen },
              { key: 'sauce', label: '소스', eaField: 'prodQtySauce' as const, kgField: 'prodKgSauce' as const, color: CATEGORY_COLORS.sauce },
              { key: 'bibimbap', label: '비빔밥', eaField: 'prodQtyBibimbap' as const, kgField: undefined as unknown as keyof ProductionData, color: CATEGORY_COLORS.bibimbap },
            ];
            return cats.map(c => ({
              category: c.label,
              totalEa: filteredProduction.reduce((s, p) => s + ((p[c.eaField] as number) || 0), 0),
              totalKg: c.kgField ? filteredProduction.reduce((s, p) => s + ((p[c.kgField] as number) || 0), 0) : 0,
              color: c.color,
            })).filter(c => c.totalEa > 0 || c.totalKg > 0);
          })();

          return (
            <InsightSection id="prod-waste">
            <div className="space-y-6">
              {/* KPI — 5개 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">평균 폐기율(완제품)</p>
                  <p className={`text-2xl font-bold mt-1 ${avgRate > config.wasteThresholdPct ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercent(avgRate)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">목표: {config.wasteThresholdPct}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">평균 폐기율(반제품)</p>
                  <p className={`text-2xl font-bold mt-1 ${avgSemiRate > config.wasteThresholdPct ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatPercent(avgSemiRate)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 폐기 수량(EA)</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{totalWasteEa.toLocaleString('ko-KR')}EA</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 폐기 중량(kg)</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{totalWasteKg.toLocaleString('ko-KR')}kg</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">추정 폐기비용</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalCost)}</p>
                </div>
              </div>

              {/* 주간 생산량 & 폐기율 추이 (완제품 + 반제품) */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 생산량 & 폐기율 추이 <FormulaTooltip {...FORMULAS.wasteRate} /></h3>
                {weeklyWaste.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyWaste} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number, name: string) => name.includes('폐기율') ? `${v}%` : v.toLocaleString()} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="totalProduction" name="생산량" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="avgWasteRate" name="완제품 폐기율" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="avgWasteSemiPct" name="반제품 폐기율" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
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

              {/* 카테고리별 생산량 비교 */}
              {categoryProduction.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">카테고리별 생산량</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryProduction} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v.toLocaleString()} />
                        <YAxis type="category" dataKey="category" width={60} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(), name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="totalEa" name="생산량(EA)" radius={[0, 4, 4, 0]}>
                          {categoryProduction.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
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

              {/* 일별 폐기 상세 테이블 */}
              {dailyWasteDetail.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-blue-500">table_chart</span>
                    일별 폐기 상세
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">날짜</th>
                          <th className="text-left py-2 px-3 text-gray-500">요일</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산(EA)</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산(kg)</th>
                          <th className="text-right py-2 px-3 text-gray-500">완제품 폐기(EA)</th>
                          <th className="text-right py-2 px-3 text-gray-500">완제품 폐기율</th>
                          <th className="text-right py-2 px-3 text-gray-500">반제품 폐기(kg)</th>
                          <th className="text-right py-2 px-3 text-gray-500">반제품 폐기율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyWasteDetail.slice(0, 30).map(d => {
                          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(d.date).getDay()];
                          const isHighFinished = d.wasteFinishedPct > config.wasteThresholdPct;
                          const isHighSemi = d.wasteSemiPct > config.wasteThresholdPct;
                          return (
                            <tr key={d.date} className={`border-b border-gray-100 dark:border-gray-800 ${
                              isHighFinished || isHighSemi ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                            }`}>
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{d.date}</td>
                              <td className="py-2 px-3 text-gray-500 text-xs">{dayOfWeek}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{d.productionQty.toLocaleString('ko-KR')}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{d.productionKg.toLocaleString('ko-KR')}</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{d.wasteFinishedEa > 0 ? d.wasteFinishedEa.toLocaleString('ko-KR') : '-'}</td>
                              <td className={`py-2 px-3 text-right font-medium ${isHighFinished ? 'text-red-600' : 'text-gray-500'}`}>
                                {d.wasteFinishedPct > 0 ? formatPercent(d.wasteFinishedPct) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{d.wasteSemiKg > 0 ? d.wasteSemiKg.toLocaleString('ko-KR') : '-'}</td>
                              <td className={`py-2 px-3 text-right font-medium ${isHighSemi ? 'text-orange-600' : 'text-gray-500'}`}>
                                {d.wasteSemiPct > 0 ? formatPercent(d.wasteSemiPct) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {dailyWasteDetail.length > 30 && (
                      <p className="text-xs text-gray-400 text-center mt-2">최근 30일만 표시 (전체 {dailyWasteDetail.length}일)</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            </InsightSection>
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
          <InsightSection id="prod-efficiency">
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
                <FormulaTooltip {...FORMULAS.productivity} />
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
          </InsightSection>
        );
        }

        // ========== BOM 이상 감지 ==========
        if (activeTab === 'bomAnomaly') {
          const ANOMALY_COLORS = { overuse: '#EF4444', underuse: '#3B82F6', price_deviation: '#F59E0B' };
          const ANOMALY_LABELS: Record<string, string> = { overuse: '초과사용', underuse: '미달사용', price_deviation: '단가이상' };
          const SEVERITY_COLORS: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' };
          const SEVERITY_LABELS: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' };

          if (!bomAnomaly || bomAnomaly.items.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                <span className="material-icons-outlined text-5xl mb-3">check_circle</span>
                <p className="text-lg font-medium">BOM 기준 자재 소진량이 정상 범위입니다</p>
                <p className="text-sm mt-1">BOM 데이터와 구매 데이터가 연결되면 이상 항목이 여기에 표시됩니다</p>
              </div>
            );
          }

          const { summary } = bomAnomaly;
          const typeData = [
            { name: '초과사용', value: summary.overuseCount, color: ANOMALY_COLORS.overuse },
            { name: '미달사용', value: summary.underuseCount, color: ANOMALY_COLORS.underuse },
            { name: '단가이상', value: summary.priceAnomalyCount, color: ANOMALY_COLORS.price_deviation },
          ].filter(d => d.value > 0);

          const severityData = [
            { name: '높음', value: bomAnomaly.items.filter(i => i.severity === 'high').length, color: SEVERITY_COLORS.high },
            { name: '중간', value: bomAnomaly.items.filter(i => i.severity === 'medium').length, color: SEVERITY_COLORS.medium },
            { name: '낮음', value: bomAnomaly.items.filter(i => i.severity === 'low').length, color: SEVERITY_COLORS.low },
          ].filter(d => d.value > 0);

          const renderTopCard = (title: string, items: BomConsumptionAnomalyItem[], color: string) => (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold mb-3" style={{ color }}>{title}</h4>
              {items.length === 0 ? (
                <p className="text-xs text-gray-400">해당 없음</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.materialCode} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-500 dark:text-gray-400">{idx + 1}</span>
                        <span className="truncate dark:text-gray-200">{item.materialName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-bold ${item.deviationPct > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {item.anomalyType === 'price_deviation'
                            ? `${item.priceDeviationPct > 0 ? '+' : ''}${item.priceDeviationPct}%`
                            : `${item.deviationPct > 0 ? '+' : ''}${item.deviationPct}%`}
                        </span>
                        <span className="text-gray-400">{formatCurrency(Math.abs(item.costImpact))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );

          return (
            <div className="space-y-6">
              {/* KPI */}
              <div className="flex items-center gap-1 mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">BOM 소모량 이상 감지</h3>
                <FormulaTooltip {...FORMULAS.bomAnomaly} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '이상 항목', value: summary.totalAnomalies, unit: '건', icon: 'warning', color: 'text-red-500' },
                  { label: '초과사용', value: summary.overuseCount, unit: '건', icon: 'trending_up', color: 'text-red-400' },
                  { label: '미달사용', value: summary.underuseCount, unit: '건', icon: 'trending_down', color: 'text-blue-400' },
                  { label: '비용 영향', value: formatCurrency(Math.abs(summary.totalCostImpact)), unit: '', icon: 'payments', color: 'text-amber-500' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`material-icons-outlined text-lg ${kpi.color}`}>{kpi.icon}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
                    </div>
                    <p className="text-xl font-bold dark:text-white">{kpi.value}{kpi.unit}</p>
                  </div>
                ))}
              </div>

              {/* 차트 2열 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 이상 유형별 Pie */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold mb-3 dark:text-white">이상 유형별 분포</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {typeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v}건`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 심각도별 Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold mb-3 dark:text-white">심각도별 분포</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={severityData} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={40} />
                      <Tooltip formatter={(v: number) => [`${v}건`, '']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {severityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 카드 3열 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderTopCard('Top 5 초과사용', bomAnomaly.topOveruse, ANOMALY_COLORS.overuse)}
                {renderTopCard('Top 5 미달사용', bomAnomaly.topUnderuse, ANOMALY_COLORS.underuse)}
                {renderTopCard('Top 5 단가이상', bomAnomaly.topPriceDeviation, ANOMALY_COLORS.price_deviation)}
              </div>

              {/* 전체 테이블 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold dark:text-white">전체 이상 항목 ({bomAnomaly.items.length}건)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">자재명</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">사용 제품</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">기대 소모</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">실제 소모</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">차이(%)</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">유형</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">심각도</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">비용 영향</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {bomAnomaly.items.map((item) => (
                        <tr key={item.materialCode} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => onItemClick({ id: item.materialCode, skuCode: item.materialCode, skuName: item.materialName, skuSub: '', process: item.anomalyType, stdQty: item.expectedConsumption, stdUnit: '', actualQty: item.actualConsumption, diffPercent: item.deviationPct, anomalyScore: item.severity === 'high' ? 80 : item.severity === 'medium' ? 50 : 20, costImpact: item.costImpact, reasoning: `${item.anomalyType} — 편차 ${item.deviationPct.toFixed(1)}%`, kind: 'bom' })}>
                          <td className="px-3 py-2 dark:text-gray-200">
                            <div className="font-medium">{item.materialName}</div>
                            <div className="text-gray-400 text-[10px]">{item.materialCode}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">{item.productNames.slice(0, 3).join(', ')}{item.productNames.length > 3 ? ` 외 ${item.productNames.length - 3}` : ''}</td>
                          <td className="px-3 py-2 text-right dark:text-gray-300">{formatQty(item.expectedConsumption)}</td>
                          <td className="px-3 py-2 text-right dark:text-gray-300">{formatQty(item.actualConsumption)}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: item.deviationPct > 0 ? '#EF4444' : '#3B82F6' }}>
                            {item.anomalyType === 'price_deviation'
                              ? `${item.priceDeviationPct > 0 ? '+' : ''}${item.priceDeviationPct}%`
                              : `${item.deviationPct > 0 ? '+' : ''}${item.deviationPct}%`}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: ANOMALY_COLORS[item.anomalyType] }}>
                              {ANOMALY_LABELS[item.anomalyType]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: SEVERITY_COLORS[item.severity] }}>
                              {SEVERITY_LABELS[item.severity]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium dark:text-gray-200">{formatCurrency(Math.abs(item.costImpact))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        }

        // ========== BOM 오차 분석 ==========
        if (activeTab === 'bomVariance') {
          return (
            <InsightSection id="prod-bom">
            <div className="space-y-6">
              <div className="flex items-center gap-1 mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">BOM 투입 오차 분석</h3>
                <FormulaTooltip {...FORMULAS.bomVariance} />
              </div>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">투입량 차이</p>
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
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">상위/하위 5 품목 (차이 금액) <span className="text-xs font-normal text-gray-400">클릭 → 드릴다운</span></h3>
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
                              _item: item,
                            }));
                          })()}
                          layout="vertical"
                          margin={{ left: 10, right: 20 }}
                          onClick={(data: any) => {
                            if (data?.activePayload?.[0]?.payload?._item) {
                              const clicked = data.activePayload[0].payload._item as BomVarianceItem;
                              setSelectedMaterial(selectedMaterial?.productCode === clicked.productCode ? null : clicked);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="차이금액" radius={[0, 4, 4, 0]} className="cursor-pointer">
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
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-500">
                    BOM 레시피 기준 대비 실제 투입 비교 | 양수=불리(초과사용), 음수=유리(절감)
                  </p>
                  {bomVariance && bomVariance.items.some(i => i.linkedMenuCount > 0) && (
                    <button
                      onClick={() => setBomSortByMenu(!bomSortByMenu)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                        bomSortByMenu
                          ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700'
                          : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                      }`}
                    >
                      <span className="material-icons-outlined text-xs">sort</span>
                      {bomSortByMenu ? '연결 메뉴수순' : '차이금액순'}
                    </button>
                  )}
                </div>

                {bomVariance && bomVariance.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">자재명</th>
                          <th className="text-left py-2 px-3 text-gray-500">연결 메뉴</th>
                          <th className="text-right py-2 px-3 text-gray-500">기준단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">실제단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">기준 투입량</th>
                          <th className="text-right py-2 px-3 text-gray-500">실제 투입량</th>
                          <th className="text-right py-2 px-3 text-gray-500">단가 차이</th>
                          <th className="text-right py-2 px-3 text-gray-500">투입량 차이</th>
                          <th className="text-right py-2 px-3 text-gray-500">총 차이</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...bomVariance.items]
                          .sort(bomSortByMenu
                            ? (a, b) => a.linkedMenuCount - b.linkedMenuCount || Math.abs(b.totalVariance) - Math.abs(a.totalVariance)
                            : (a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance)
                          )
                          .slice(0, 20).map(item => (
                          <React.Fragment key={item.productCode}>
                            <tr
                              className={`border-b border-gray-100 dark:border-gray-800 ${
                                item.totalVariance > 0 ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                              } ${bomData.length > 0 ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10' : ''}`}
                              onClick={() => bomData.length > 0 && setSelectedMaterial(selectedMaterial?.productCode === item.productCode ? null : item)}
                            >
                              <td className="py-2 px-3 text-gray-800 dark:text-gray-200">
                                <div className="flex items-center gap-1">
                                  {bomData.length > 0 && (
                                    <span className={`material-icons-outlined text-xs transition-transform ${selectedMaterial?.productCode === item.productCode ? 'rotate-90' : ''}`}>
                                      chevron_right
                                    </span>
                                  )}
                                  {item.productName}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {item.linkedMenus.length > 0 ? item.linkedMenus.slice(0, 3).map(m => (
                                    <span key={m.code} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 whitespace-nowrap">
                                      {m.code ? `${m.code}` : m.name.slice(0, 6)}
                                    </span>
                                  )) : <span className="text-[10px] text-gray-400">-</span>}
                                  {item.linkedMenus.length > 3 && (
                                    <span className="text-[10px] text-gray-400">+{item.linkedMenus.length - 3}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.standardPrice)}</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.actualPrice)}</td>
                              <td className="py-2 px-3 text-right text-gray-500">{formatQty(item.standardQty, item.unit)}</td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatQty(item.actualQty, item.unit)}</td>
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
                            {/* 드릴다운 패널 */}
                            {selectedMaterial?.productCode === item.productCode && (
                              <tr>
                                <td colSpan={9} className="p-0">
                                  <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-blue-500 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        <span className="material-icons-outlined text-blue-500 text-base align-middle mr-1">account_tree</span>
                                        {item.productName} — 메뉴별 소모 상세
                                      </h4>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedMaterial(null); }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                      >
                                        <span className="material-icons-outlined text-sm">close</span>
                                      </button>
                                    </div>
                                    {materialDrilldown && materialDrilldown.items.length > 0 ? (
                                      <>
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-gray-300 dark:border-gray-600">
                                              <th className="text-left py-1.5 px-2 text-gray-500">메뉴명</th>
                                              <th className="text-right py-1.5 px-2 text-gray-500">배치크기</th>
                                              <th className="text-right py-1.5 px-2 text-gray-500">레시피 기준({item.unit})</th>
                                              <th className="text-right py-1.5 px-2 text-gray-500">기준 소모합({item.unit})</th>
                                              <th className="text-right py-1.5 px-2 text-gray-500">구매 비례({item.unit})</th>
                                              <th className="text-right py-1.5 px-2 text-gray-500">차이({item.unit})</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {materialDrilldown.items.map(m => (
                                              <tr key={m.menuCode} className="border-b border-gray-200 dark:border-gray-700">
                                                <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{m.menuName}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-500">{m.batchSize.toLocaleString('ko-KR')}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-500">{m.recipeQty.toLocaleString('ko-KR')}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-500">{m.standardConsumption.toLocaleString('ko-KR')}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">{m.allocatedActual.toLocaleString('ko-KR')}</td>
                                                <td className={`py-1.5 px-2 text-right font-medium ${m.diff > 0 ? 'text-red-600' : m.diff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                  {m.diff > 0 ? '+' : ''}{m.diff.toLocaleString('ko-KR')}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot>
                                            <tr className="border-t-2 border-gray-400 dark:border-gray-500 font-bold">
                                              <td className="py-1.5 px-2 text-gray-700 dark:text-gray-200" colSpan={3}>합계</td>
                                              <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-200">{materialDrilldown.totalStandard.toLocaleString('ko-KR')}</td>
                                              <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-200">{materialDrilldown.totalActual.toLocaleString('ko-KR')}</td>
                                              <td className={`py-1.5 px-2 text-right ${(materialDrilldown.totalActual - materialDrilldown.totalStandard) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {(materialDrilldown.totalActual - materialDrilldown.totalStandard) > 0 ? '+' : ''}
                                                {(materialDrilldown.totalActual - materialDrilldown.totalStandard).toLocaleString('ko-KR')}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </>
                                    ) : (
                                      <p className="text-xs text-gray-400 py-2">BOM 데이터가 없어 상세 분석을 표시할 수 없습니다.</p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">구매/생산 데이터가 충분하지 않습니다.</p>}
              </div>
            </div>
            </InsightSection>
          );
        }

        // ========== 수율 추적 ==========
        if (activeTab === 'yield') {
          return (
            <InsightSection id="prod-yield">
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
                    <FormulaTooltip {...FORMULAS.yieldRate} />
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
                    <FormulaTooltip {...FORMULAS.wasteRate} />
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={yieldTracking.weekly.map(w => ({
                        ...w,
                        폐기율: w.totalQty > 0 ? Math.round((w.totalWaste / w.totalQty) * 1000) / 10 : 0,
                      }))} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => formatQty(v)} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v, name) => name === '폐기율' ? `${v}%` : formatQty(Number(v))} />
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
                    <FormulaTooltip {...FORMULAS.adjustedCost} />
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
            </InsightSection>
          );
        }

        return null;
      }}
    </SubTabLayout>
  );
};
