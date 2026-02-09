import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
} from 'recharts';
import { SubTabLayout } from './SubTabLayout';
import { formatCurrency, formatAxisKRW, formatPercent } from '../utils/format';
import type { PurchaseData, UtilityData, ProductionData } from '../services/googleSheetService';
import type { DashboardInsights, CostRecommendation } from '../services/insightService';
import { useBusinessConfig } from '../contexts/SettingsContext';
import { getLaborMonthlySummaries, LaborMonthlySummary } from './LaborRecordAdmin';
import { groupByWeek, weekKeyToLabel, getSortedWeekEntries } from '../utils/weeklyAggregation';

interface Props {
  purchases: PurchaseData[];
  utilities: UtilityData[];
  production: ProductionData[];
  insights: DashboardInsights | null;
  onItemClick: (item: any) => void;
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const COST_COLORS = { rawMaterial: '#3B82F6', subMaterial: '#10B981', labor: '#F59E0B', overhead: '#EF4444' };

const SUB_MATERIAL_KEYWORDS = ['포장', '박스', '비닐', '라벨', '테이프', '봉투', '스티커', '밴드', '용기', '캡', '뚜껑'];
function isSubMaterial(name: string) { return SUB_MATERIAL_KEYWORDS.some(kw => name.includes(kw)); }

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
  const config = useBusinessConfig();
  const costBreakdown = insights?.costBreakdown;
  const materialPrices = insights?.materialPrices;
  const utilityCosts = insights?.utilityCosts;
  const recommendations = insights?.recommendations || [];
  const limitPrice = insights?.limitPrice || null;

  const [rawFilter, setRawFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [overheadFilter, setOverheadFilter] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // 생산매출 계산 (원가율의 분모)
  const productionRevenue = useMemo(() => {
    const channelRev = insights?.channelRevenue;
    if (channelRev) return channelRev.totalRevenue;
    return production.reduce((s, p) => s + (p.prodQtyTotal || 0), 0) * 5000;
  }, [insights?.channelRevenue, production]);

  // 노무비 반별 데이터
  const laborSummaries = useMemo<LaborMonthlySummary[]>(() => {
    return getLaborMonthlySummaries(config.avgHourlyWage, config.overtimeMultiplier);
  }, [config.avgHourlyWage, config.overtimeMultiplier]);

  // =============================================
  // 주간 집계 데이터 (B1/B3: 모든 그래프 주간 단위)
  // =============================================
  const weeklyData = useMemo(() => {
    // purchases를 원재료/부재료로 분류
    const rawPurchases = purchases.filter(p => !isSubMaterial(p.productName));
    const subPurchases = purchases.filter(p => isSubMaterial(p.productName));

    // 주간별 그룹핑
    const rawWeeks = groupByWeek(rawPurchases, 'date');
    const subWeeks = groupByWeek(subPurchases, 'date');
    const utilWeeks = groupByWeek(utilities, 'date');
    const prodWeeks = groupByWeek(production, 'date');

    // 모든 주간 키 수집
    const allWeekKeys = new Set<string>();
    [rawWeeks, subWeeks, utilWeeks, prodWeeks].forEach(m => m.forEach((_, k) => allWeekKeys.add(k)));
    const sortedKeys = Array.from(allWeekKeys).sort();

    const weeklyEntries = sortedKeys.map(wk => {
      const rawItems = rawWeeks.get(wk) || [];
      const subItems = subWeeks.get(wk) || [];
      const utilItems = utilWeeks.get(wk) || [];
      const prodItems = prodWeeks.get(wk) || [];

      const rawTotal = rawItems.reduce((s, p) => s + p.total, 0);
      const subTotal = subItems.reduce((s, p) => s + p.total, 0);
      const elec = utilItems.reduce((s, u) => s + u.elecCost, 0);
      const water = utilItems.reduce((s, u) => s + u.waterCost, 0);
      const gas = utilItems.reduce((s, u) => s + u.gasCost, 0);
      const utilTotal = elec + water + gas;
      const prodQty = prodItems.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
      const prodQuantity = prodItems.reduce((s, p) => s + (p.quantity || 0), 0);

      // 노무비 추정 (주간)
      const labor = Math.round((rawTotal + subTotal + utilTotal) * config.laborCostRatio);
      // 경비
      const hasFixed = config.monthlyFixedOverhead > 0 || config.variableOverheadPerUnit > 0;
      const weekFixedOverhead = hasFixed ? Math.round(config.monthlyFixedOverhead / 4.33) : 0;
      const weekVarOverhead = hasFixed ? Math.round(prodQuantity * config.variableOverheadPerUnit) : 0;
      const otherOverhead = hasFixed
        ? weekFixedOverhead + weekVarOverhead
        : Math.round((rawTotal + subTotal) * config.overheadRatio);
      const overhead = utilTotal + otherOverhead;
      const total = rawTotal + subTotal + labor + overhead;

      return {
        weekKey: wk,
        weekLabel: weekKeyToLabel(wk),
        rawMaterial: rawTotal,
        subMaterial: subTotal,
        labor,
        overhead,
        total,
        electricity: elec,
        water,
        gas,
        utilityTotal: utilTotal,
        prodQty,
        prodQuantity,
        perUnit: prodQty > 0 ? Math.round(utilTotal / prodQty) : 0,
        perUnitElec: prodQty > 0 ? Math.round(elec / prodQty) : 0,
        perUnitWater: prodQty > 0 ? Math.round(water / prodQty) : 0,
        perUnitGas: prodQty > 0 ? Math.round(gas / prodQty) : 0,
      };
    });

    return weeklyEntries;
  }, [purchases, utilities, production, config]);

  // 주간 원재료비/부재료비 차트 데이터
  const weeklyRaw = useMemo(() => weeklyData.map(w => ({
    week: w.weekLabel, 원재료비: w.rawMaterial,
  })), [weeklyData]);

  const weeklySub = useMemo(() => weeklyData.map(w => ({
    week: w.weekLabel, 부재료비: w.subMaterial,
  })), [weeklyData]);

  // 주간 원가율 차트 데이터
  const weeklyCostRate = useMemo(() => {
    const totalWeeks = weeklyData.length || 1;
    const weeklyRev = productionRevenue / totalWeeks;
    return weeklyData.map(w => ({
      week: w.weekLabel,
      원재료율: weeklyRev > 0 ? Math.round((w.rawMaterial / weeklyRev) * 1000) / 10 : 0,
      부재료율: weeklyRev > 0 ? Math.round((w.subMaterial / weeklyRev) * 1000) / 10 : 0,
      노무비율: weeklyRev > 0 ? Math.round((w.labor / weeklyRev) * 1000) / 10 : 0,
      경비율: weeklyRev > 0 ? Math.round((w.overhead / weeklyRev) * 1000) / 10 : 0,
      총원가율: weeklyRev > 0 ? Math.round((w.total / weeklyRev) * 1000) / 10 : 0,
      rawMaterial: w.rawMaterial,
      subMaterial: w.subMaterial,
      labor: w.labor,
      overhead: w.overhead,
      total: w.total,
    }));
  }, [weeklyData, productionRevenue]);

  // Pre-compute filtered data
  const allRawItems = materialPrices?.items || [];
  const filteredRawItems = (() => {
    switch (rawFilter) {
      case 'priceUp': return allRawItems.filter(m => m.changeRate >= config.priceIncreaseThreshold);
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

  // 노무비 주간 데이터 (최상위에서 계산 — hooks 규칙 준수)
  const weeklyLabor = useMemo(() => {
    const laborDetail = costBreakdown?.laborDetail;
    const hasLaborRecords = laborSummaries.length > 0;
    const totalLaborCost = hasLaborRecords
      ? laborSummaries.reduce((s, ls) => s + ls.totalCost, 0)
      : (laborDetail?.estimated || 0);
    const avgHc = laborSummaries.length > 0
      ? Math.round(laborSummaries.reduce((s, ls) => s + ls.totalHeadcount, 0) / laborSummaries.length)
      : 0;

    const prodWeeks = groupByWeek(production, 'date');
    const sorted = getSortedWeekEntries(prodWeeks);
    const totalWeeks = sorted.length || 1;
    const weeklyLaborCost = totalLaborCost / totalWeeks;
    const weeklyRev = productionRevenue / totalWeeks;

    return sorted.map(([wk, items]) => {
      const prodQty = items.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
      return {
        week: weekKeyToLabel(wk),
        노무비: Math.round(weeklyLaborCost),
        생산량: prodQty,
        인당생산성: avgHc > 0 ? Math.round(prodQty / avgHc) : 0,
        노무비율: weeklyRev > 0 ? Math.round((weeklyLaborCost / weeklyRev) * 1000) / 10 : 0,
      };
    });
  }, [production, costBreakdown, laborSummaries, productionRevenue]);

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
          const composition = costBreakdown?.composition || [];
          const totalCost = composition.reduce((s, c) => s + c.value, 0);

          const totalCostRate = productionRevenue > 0 ? Math.round((totalCost / productionRevenue) * 1000) / 10 : 0;
          const rawCostRate = productionRevenue > 0
            ? Math.round(((composition.find(c => c.name === '원재료')?.value || 0) / productionRevenue) * 1000) / 10 : 0;
          const subCostRate = productionRevenue > 0
            ? Math.round(((composition.find(c => c.name === '부재료')?.value || 0) / productionRevenue) * 1000) / 10 : 0;
          const laborCostRate = productionRevenue > 0
            ? Math.round(((composition.find(c => c.name === '노무비')?.value || 0) / productionRevenue) * 1000) / 10 : 0;
          const overheadCostRate = productionRevenue > 0
            ? Math.round(((composition.find(c => c.name === '경비')?.value || 0) / productionRevenue) * 1000) / 10 : 0;

          let prevWeekChange = 0;
          if (weeklyData.length >= 2) {
            const last = weeklyData[weeklyData.length - 1].total;
            const prev = weeklyData[weeklyData.length - 2].total;
            prevWeekChange = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;
          }

          return (
            <div className="space-y-6">
              {/* 원가율 KPI */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">생산매출</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(productionRevenue)}</p>
                  <p className="text-xs text-gray-400 mt-1">분모 기준</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원가율</p>
                  <p className={`text-2xl font-bold mt-1 ${totalCostRate > 80 ? 'text-red-600' : totalCostRate > 60 ? 'text-orange-600' : 'text-blue-600'}`}>
                    {totalCostRate}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(totalCost)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">원재료율</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COST_COLORS.rawMaterial }}>{rawCostRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(composition.find(c => c.name === '원재료')?.value || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">부재료율</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COST_COLORS.subMaterial }}>{subCostRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(composition.find(c => c.name === '부재료')?.value || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">노무비율</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COST_COLORS.labor }}>{laborCostRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(composition.find(c => c.name === '노무비')?.value || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">경비율</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COST_COLORS.overhead }}>{overheadCostRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(composition.find(c => c.name === '경비')?.value || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 주간 원가율 추이 */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 원가율 추이</h3>
                  {weeklyCostRate.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyCostRate}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: number) => `${v}%`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="원재료율" stackId="1" stroke={COST_COLORS.rawMaterial} fill={COST_COLORS.rawMaterial} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="부재료율" stackId="1" stroke={COST_COLORS.subMaterial} fill={COST_COLORS.subMaterial} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="노무비율" stackId="1" stroke={COST_COLORS.labor} fill={COST_COLORS.labor} fillOpacity={0.7} />
                          <Area type="monotone" dataKey="경비율" stackId="1" stroke={COST_COLORS.overhead} fill={COST_COLORS.overhead} fillOpacity={0.7} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">원가 데이터 없음</p>}
                </div>
                {/* 원가 구성비 Pie */}
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">원가 구성비 (원가율 기준)</h3>
                  {composition.length > 0 && totalCost > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={composition} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value"
                            label={({ name }) => {
                              const rate = productionRevenue > 0
                                ? Math.round(((composition.find(c => c.name === name)?.value || 0) / productionRevenue) * 1000) / 10
                                : 0;
                              return `${name} ${rate}%`;
                            }}>
                            {composition.map((_, i) => <Cell key={i} fill={Object.values(COST_COLORS)[i] || PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${formatCurrency(v)} (${productionRevenue > 0 ? (v / productionRevenue * 100).toFixed(1) : 0}%)`, '원가']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">구성비 데이터 없음</p>}
                </div>
              </div>

              {/* 주간 원가율 테이블 */}
              {weeklyCostRate.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 원가율 상세</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">주간</th>
                          <th className="text-right py-2 px-3" style={{ color: COST_COLORS.rawMaterial }}>원재료율</th>
                          <th className="text-right py-2 px-3" style={{ color: COST_COLORS.subMaterial }}>부재료율</th>
                          <th className="text-right py-2 px-3" style={{ color: COST_COLORS.labor }}>노무비율</th>
                          <th className="text-right py-2 px-3" style={{ color: COST_COLORS.overhead }}>경비율</th>
                          <th className="text-right py-2 px-3 text-gray-500">총원가율</th>
                          <th className="text-right py-2 px-3 text-gray-500">총원가액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyCostRate.map(m => (
                          <tr key={m.week} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.week}</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: COST_COLORS.rawMaterial }}>{m.원재료율}%</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: COST_COLORS.subMaterial }}>{m.부재료율}%</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: COST_COLORS.labor }}>{m.노무비율}%</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: COST_COLORS.overhead }}>{m.경비율}%</td>
                            <td className={`py-2 px-3 text-right font-bold ${m.총원가율 > 80 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{m.총원가율}%</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span className="material-icons-outlined text-base">info</span>
                  원가율 = 원가액 / 생산매출 × 100 | 전주 대비 원가액 변동: {prevWeekChange > 0 ? '+' : ''}{prevWeekChange}%
                </p>
              </div>

              {recommendations.length > 0 && (
                <InsightCards items={recommendations.slice(0, 3)} />
              )}
            </div>
          );
        }

        // ========== 원재료 ==========
        if (activeTab === 'raw') {
          const rawDetail = costBreakdown?.rawMaterialDetail;
          const priceUpCount = allRawItems.filter(m => m.changeRate >= config.priceIncreaseThreshold).length;
          const selectedItem = selectedMaterial ? allRawItems.find(m => m.productCode === selectedMaterial) : null;

          const filteredBarData = filteredRawItems.slice(0, 15).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
            변동률: item.changeRate,
          }));

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원재료비</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(rawDetail?.total || 0)}</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">단가 {config.priceIncreaseThreshold}%↑ 품목</p>
                  <p className={`text-2xl font-bold mt-1 ${priceUpCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{priceUpCount}건</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">필터 결과</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredRawItems.length}개</p>
                </div>
              </div>

              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'priceUp', label: `단가상승(${config.priceIncreaseThreshold}%↑)` },
                  { key: 'priceDown', label: '단가하락' },
                  { key: 'top10', label: '상위10(금액순)' },
                ]}
                active={rawFilter}
                onChange={setRawFilter}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 원재료비 추이</h3>
                  {weeklyRaw.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyRaw}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="원재료비" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
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
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="금액" radius={[0, 4, 4, 0]}>
                            {filteredBarData.map((entry, i) => (
                              <Cell key={i} fill={entry.변동률 >= config.priceIncreaseThreshold ? '#EF4444' : entry.변동률 < 0 ? '#10B981' : '#3B82F6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">해당 조건의 품목 없음</p>}
                </div>
              </div>

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
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="price" name="단가" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">이력 없음</p>}
                </div>
              )}

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

              {limitPrice && limitPrice.items.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-outlined text-red-500">price_change</span>
                    한계단가 분석
                    {limitPrice.exceedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {limitPrice.exceedCount}건 초과
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    한계단가 = 평균단가 + 1 표준편차 | 초과 품목은 가격 이상 징후
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">품목</th>
                          <th className="text-right py-2 px-3 text-gray-500">평균단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">한계단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">현재단가</th>
                          <th className="text-right py-2 px-3 text-gray-500">초과율</th>
                          <th className="text-center py-2 px-3 text-gray-500">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {limitPrice.items.slice(0, 15).map(item => (
                          <tr key={item.productCode} className={`border-b border-gray-100 dark:border-gray-800 ${
                            item.isExceeding ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                          }`}>
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.productName}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.avgUnitPrice)}</td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.limitPrice)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${item.isExceeding ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                              {formatCurrency(item.currentPrice)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${
                              item.exceedRate > 0 ? 'text-red-600' : item.exceedRate < -5 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {item.exceedRate > 0 ? '+' : ''}{item.exceedRate.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                item.isExceeding
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {item.isExceeding ? '초과' : '정상'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <InsightCards items={materialRecs} />
            </div>
          );
        }

        // ========== 부재료 ==========
        if (activeTab === 'sub') {
          const subDetail = costBreakdown?.subMaterialDetail;

          const filteredSubBarData = filteredSubItems.slice(0, 10).map(item => ({
            name: item.productName.length > 10 ? item.productName.slice(0, 10) + '...' : item.productName,
            금액: item.totalSpent,
          }));

          return (
            <div className="space-y-6">
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

              <FilterBar
                filters={[
                  { key: 'all', label: '전체' },
                  { key: 'top5', label: '상위5(금액순)' },
                ]}
                active={subFilter}
                onChange={setSubFilter}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 부재료비 추이</h3>
                  {weeklySub.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklySub}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="부재료비" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
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
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="금액" fill="#10B981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">부재료 품목 없음</p>}
                </div>
              </div>

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

        // ========== 노무비 (반별 분석) — 주간 단위 ==========
        if (activeTab === 'labor') {
          const laborDetail = costBreakdown?.laborDetail;
          const hasLaborRecords = laborSummaries.length > 0;

          const totalLaborCost = hasLaborRecords
            ? laborSummaries.reduce((s, ls) => s + ls.totalCost, 0)
            : (laborDetail?.estimated || 0);

          const totalRegularHours = laborSummaries.reduce((s, ls) => s + ls.totalRegularHours, 0);
          const totalOvertimeHours = laborSummaries.reduce((s, ls) => s + ls.totalOvertimeHours, 0);
          const totalHeadcount = laborSummaries.length > 0 ? laborSummaries[laborSummaries.length - 1].totalHeadcount : 0;
          const totalHours = totalRegularHours + totalOvertimeHours;
          const overtimeRate = totalHours > 0 ? Math.round((totalOvertimeHours / totalHours) * 1000) / 10 : 0;

          const totalProdQty = production.reduce((s, p) => s + (p.prodQtyTotal || 0), 0);
          const avgHeadcount = laborSummaries.length > 0
            ? Math.round(laborSummaries.reduce((s, ls) => s + ls.totalHeadcount, 0) / laborSummaries.length)
            : 0;
          const prodPerPerson = avgHeadcount > 0 ? Math.round(totalProdQty / avgHeadcount) : 0;
          const laborCostPerUnit = totalProdQty > 0 ? Math.round(totalLaborCost / totalProdQty) : 0;
          const laborRate = productionRevenue > 0 ? Math.round((totalLaborCost / productionRevenue) * 1000) / 10 : 0;

          // 반별 비교
          const latestShifts = hasLaborRecords
            ? laborSummaries[laborSummaries.length - 1].shifts
            : [];

          const SHIFT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 노무비{hasLaborRecords ? '' : ' (추정)'}</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(totalLaborCost)}</p>
                  <p className="text-xs text-gray-400 mt-1">노무비율 {laborRate}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 근로시간</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{totalHours.toLocaleString()}h</p>
                  <p className="text-xs text-gray-400 mt-1">정규 {totalRegularHours.toLocaleString()}h</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">초과근무 시간</p>
                  <p className={`text-2xl font-bold mt-1 ${overtimeRate > 15 ? 'text-red-600' : 'text-orange-600'}`}>
                    {totalOvertimeHours.toLocaleString()}h
                  </p>
                  <p className="text-xs text-gray-400 mt-1">비율 {overtimeRate}%</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">인원</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalHeadcount}명</p>
                  <p className="text-xs text-gray-400 mt-1">{latestShifts.length}개 반</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">인당 생산성</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{prodPerPerson.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">개/인(기간합)</p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">단위당 노무비</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">₩{laborCostPerUnit.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">원/개</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 노무비 & 노무비율</h3>
                  {weeklyLabor.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={weeklyLabor}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: number, name: string) => name === '노무비율' ? `${v}%` : formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar yAxisId="left" dataKey="노무비" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="노무비율" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-gray-400 text-center py-10">데이터 없음</p>}
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    반별 노무비 비교
                    {hasLaborRecords && <span className="text-sm text-gray-400 font-normal ml-2">({laborSummaries[laborSummaries.length - 1].month})</span>}
                  </h3>
                  {latestShifts.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={latestShifts.map(s => ({
                          name: s.name,
                          노무비: s.cost,
                          인원: s.headcount,
                        }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="노무비" radius={[0, 4, 4, 0]}>
                            {latestShifts.map((_, i) => (
                              <Cell key={i} fill={SHIFT_COLORS[i % SHIFT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10">
                      <span className="material-icons-outlined text-4xl text-gray-300 mb-2">groups</span>
                      <p className="text-gray-400 text-sm">반별 노무 기록이 없습니다</p>
                      <p className="text-xs text-gray-400 mt-1">설정 &gt; 노무비 관리에서 반별 근무 기록을 입력하세요</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 주간 인당 생산성 차트 */}
              {weeklyLabor.length > 0 && avgHeadcount > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 생산량 & 인당 생산성</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyLabor}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="생산량" fill="#3B82F6" name="생산량" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="인당생산성" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="인당 생산성" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 주간 노무비 상세 테이블 */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">주간 노무비 상세</h3>
                {weeklyLabor.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-500">주간</th>
                          <th className="text-right py-2 px-3 text-gray-500">생산량</th>
                          <th className="text-right py-2 px-3 text-gray-500">인당생산성</th>
                          <th className="text-right py-2 px-3 text-gray-500">노무비</th>
                          <th className="text-right py-2 px-3 text-gray-500">노무비율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyLabor.map(m => (
                          <tr key={m.week} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.week}</td>
                            <td className="py-2 px-3 text-right text-blue-600">{m.생산량.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-green-600 font-medium">
                              {m.인당생산성 > 0 ? m.인당생산성.toLocaleString() : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-yellow-600">{formatCurrency(m.노무비)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${m.노무비율 > 30 ? 'text-red-600' : 'text-gray-600'}`}>{m.노무비율}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-400 text-center py-6">데이터 없음</p>}
              </div>

              {!hasLaborRecords && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <span className="material-icons-outlined text-base">info</span>
                    노무비는 현재 추정값입니다. 설정 &gt; 노무비 관리에서 반별 근무 기록을 입력하면 정확한 분석이 가능합니다.
                  </p>
                </div>
              )}

              <InsightCards items={marginRecs} />
            </div>
          );
        }

        // ========== 경비 (B4: perUnit 버그 수정 + B5: 생산매출/생산량 대비) ==========
        const overheadDetail = costBreakdown?.overheadDetail;

        // 주간 에너지 데이터 (B4: 필터별 perUnit 재계산)
        const weeklyUtility = weeklyData.map(w => {
          let filteredTotal: number;
          let filteredPerUnit: number;
          switch (overheadFilter) {
            case 'electricity':
              filteredTotal = w.electricity;
              filteredPerUnit = w.perUnitElec;
              break;
            case 'water':
              filteredTotal = w.water;
              filteredPerUnit = w.perUnitWater;
              break;
            case 'gas':
              filteredTotal = w.gas;
              filteredPerUnit = w.perUnitGas;
              break;
            default:
              filteredTotal = w.utilityTotal;
              filteredPerUnit = w.perUnit;
          }
          return {
            week: w.weekLabel,
            전기: w.electricity,
            수도: w.water,
            가스: w.gas,
            합계: filteredTotal,
            perUnit: filteredPerUnit,
            생산량: w.prodQty,
          };
        });

        // B5: 총 생산량 / 매출 대비
        const totalEnergy = weeklyData.reduce((s, w) => s + w.utilityTotal, 0);
        const totalProdQtyAll = weeklyData.reduce((s, w) => s + w.prodQty, 0);
        const energyRevenueRatio = productionRevenue > 0 ? Math.round((totalEnergy / productionRevenue) * 10000) / 100 : 0;
        const energyPerUnitTotal = totalProdQtyAll > 0 ? Math.round(totalEnergy / totalProdQtyAll) : 0;

        // 필터별 KPI perUnit (B4 수정)
        const lastWeek = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null;
        const kpiPerUnit = lastWeek
          ? (overheadFilter === 'electricity' ? lastWeek.perUnitElec
            : overheadFilter === 'water' ? lastWeek.perUnitWater
            : overheadFilter === 'gas' ? lastWeek.perUnitGas
            : lastWeek.perUnit)
          : 0;

        return (
          <div className="space-y-6">
            {/* KPI — B5: 생산매출/생산량 대비 추가 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  단위당 {overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : overheadFilter === 'gas' ? '가스' : '에너지'}비용
                </p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {kpiPerUnit > 0 ? `₩${kpiPerUnit.toLocaleString()}` : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">최근 주간 기준</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">매출 대비 에너지</p>
                <p className={`text-2xl font-bold mt-1 ${energyRevenueRatio > 5 ? 'text-red-600' : 'text-blue-600'}`}>
                  {energyRevenueRatio}%
                </p>
                <p className="text-xs text-gray-400 mt-1">에너지/생산매출</p>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">평균 단위당 에너지</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">
                  {energyPerUnitTotal > 0 ? `₩${energyPerUnitTotal.toLocaleString()}` : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">전체 기간 평균</p>
              </div>
            </div>

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  {overheadFilter === 'all' ? '주간 공과금 추이' : `주간 ${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용 추이`}
                </h3>
                {weeklyUtility.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {overheadFilter === 'all' ? (
                        <AreaChart data={weeklyUtility}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="전기" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="수도" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="가스" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                        </AreaChart>
                      ) : (
                        <LineChart data={weeklyUtility}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatAxisKRW} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Line type="monotone" dataKey="합계"
                            stroke={overheadFilter === 'electricity' ? '#F59E0B' : overheadFilter === 'water' ? '#3B82F6' : '#EF4444'}
                            strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">공과금 데이터 없음</p>}
              </div>
              {/* B5: 단위당 에너지 비용 + 매출 대비 비율 (우축) */}
              <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  단위당 {overheadFilter !== 'all' ? (overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스') : '에너지'} 비용
                </h3>
                {weeklyUtility.filter(m => m.perUnit > 0).length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyUtility.filter(m => m.perUnit > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `₩${v.toLocaleString()}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number, name: string) => name === '생산량' ? v.toLocaleString() : `₩${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="perUnit" name="단위당 비용" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                        <Bar yAxisId="right" dataKey="생산량" fill="#E5E7EB" name="생산량" radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-gray-400 text-center py-10">생산량 데이터 필요</p>}
              </div>
            </div>

            {/* 주간 공과금 상세 테이블 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {overheadFilter === 'all' ? '주간 공과금 상세' : `주간 ${overheadFilter === 'electricity' ? '전기' : overheadFilter === 'water' ? '수도' : '가스'} 비용`}
              </h3>
              {weeklyUtility.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-500">주간</th>
                        {(overheadFilter === 'all' || overheadFilter === 'electricity') && <th className="text-right py-2 px-3 text-gray-500">전기</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'water') && <th className="text-right py-2 px-3 text-gray-500">수도</th>}
                        {(overheadFilter === 'all' || overheadFilter === 'gas') && <th className="text-right py-2 px-3 text-gray-500">가스</th>}
                        <th className="text-right py-2 px-3 text-gray-500">합계</th>
                        <th className="text-right py-2 px-3 text-gray-500">생산량</th>
                        <th className="text-right py-2 px-3 text-gray-500">단위당</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyUtility.map(m => (
                        <tr key={m.week} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{m.week}</td>
                          {(overheadFilter === 'all' || overheadFilter === 'electricity') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.전기)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'water') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.수도)}</td>}
                          {(overheadFilter === 'all' || overheadFilter === 'gas') && <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(m.가스)}</td>}
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(m.합계)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{m.생산량.toLocaleString()}</td>
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
