import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { WasteTrendData, BomDiffItem, BomYieldAnalysisItem, InventoryDiscrepancyItem } from '../types';

interface Props {
  wasteTrendData: WasteTrendData[];
  bomItems: BomDiffItem[];
  yieldData: BomYieldAnalysisItem[];
  discrepancyData: InventoryDiscrepancyItem[];
  onItemClick: (item: any) => void;
}

const getYieldColor = (level: string): string => {
  if (level === 'critical') return '#EF4444';
  if (level === 'warning') return '#F59E0B';
  return '#10B981';
};

export const ProductionBomView: React.FC<Props> = ({
  wasteTrendData,
  bomItems,
  yieldData,
  discrepancyData,
  onItemClick,
}) => {
  // KPI 계산
  const avgWaste = wasteTrendData.length > 0
    ? (wasteTrendData.reduce((s, d) => s + d.actual, 0) / wasteTrendData.length).toFixed(1)
    : '0';
  const criticalBomItems = bomItems.filter(b => b.anomalyScore >= 80).length;
  const yieldAlerts = yieldData.filter(y => y.anomalyLevel === 'critical' || y.anomalyLevel === 'warning').length;
  const discrepancyAlerts = discrepancyData.filter(d => Math.abs(d.discrepancyRate) > 10).length;

  // Yield 차트 데이터
  const yieldChartData = yieldData.slice(0, 10).map(y => ({
    name: y.productName.length > 8 ? y.productName.slice(0, 8) + '…' : y.productName,
    표준수율: y.stdYield,
    실제수율: y.actualYield,
    level: y.anomalyLevel,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">생산/BOM 관리</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">평균 폐기율</p>
          <p className={`text-2xl font-bold mt-1 ${Number(avgWaste) > 2.5 ? 'text-red-600' : 'text-green-600'}`}>
            {avgWaste}%
          </p>
          <p className="text-xs text-gray-400 mt-1">목표: 2.5%</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">BOM 이상 항목</p>
          <p className={`text-2xl font-bold mt-1 ${criticalBomItems > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {criticalBomItems}건
          </p>
          <p className="text-xs text-gray-400 mt-1">전체 {bomItems.length}건 중</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Yield 경고</p>
          <p className={`text-2xl font-bold mt-1 ${yieldAlerts > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {yieldAlerts}건
          </p>
          <p className="text-xs text-gray-400 mt-1">주의/심각 수준</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">재고 괴리</p>
          <p className={`text-2xl font-bold mt-1 ${discrepancyAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {discrepancyAlerts}건
          </p>
          <p className="text-xs text-gray-400 mt-1">괴리율 10% 초과</p>
        </div>
      </div>

      {/* 폐기 트렌드 + Yield 비교 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 폐기율 트렌드 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">폐기율 트렌드</h3>
          {wasteTrendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={wasteTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="avg" name="목표" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="actual" name="실제" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">폐기율 데이터 없음</p>
          )}
        </div>

        {/* BOM Yield 비교 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">BOM Yield 비교</h3>
          {yieldChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yieldChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="표준수율" fill="#94A3B8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="실제수율" radius={[0, 4, 4, 0]}>
                    {yieldChartData.map((entry, i) => <Cell key={i} fill={getYieldColor(entry.level)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">Yield 데이터 없음</p>
          )}
        </div>
      </div>

      {/* BOM 차이 주요 항목 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-orange-500">difference</span>
          BOM 차이 주요 항목
        </h3>
        {bomItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">품목</th>
                  <th className="text-right py-2 px-3 text-gray-500">표준</th>
                  <th className="text-right py-2 px-3 text-gray-500">실제</th>
                  <th className="text-right py-2 px-3 text-gray-500">차이(%)</th>
                  <th className="text-right py-2 px-3 text-gray-500">원가 영향</th>
                  <th className="text-center py-2 px-3 text-gray-500">위험도</th>
                </tr>
              </thead>
              <tbody>
                {bomItems.slice(0, 15).map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.skuName}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.stdQty} {item.stdUnit}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.actualQty} {item.stdUnit}</td>
                    <td className={`py-2 px-3 text-right font-medium ${Math.abs(item.diffPercent) > 3 ? 'text-red-600' : 'text-green-600'}`}>
                      {item.diffPercent > 0 ? '+' : ''}{item.diffPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">₩{item.costImpact.toLocaleString()}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.anomalyScore >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : item.anomalyScore >= 50 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.anomalyScore >= 80 ? '심각' : item.anomalyScore >= 50 ? '주의' : '정상'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-6">BOM 차이 데이터 없음</p>
        )}
      </div>

      {/* 재고 괴리 항목 */}
      {discrepancyData.length > 0 && (
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-blue-500">compare_arrows</span>
            재고 괴리 항목
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">자재</th>
                  <th className="text-left py-2 px-3 text-gray-500">창고</th>
                  <th className="text-right py-2 px-3 text-gray-500">전표 수량</th>
                  <th className="text-right py-2 px-3 text-gray-500">실사 수량</th>
                  <th className="text-right py-2 px-3 text-gray-500">괴리율</th>
                  <th className="text-center py-2 px-3 text-gray-500">조치 상태</th>
                </tr>
              </thead>
              <tbody>
                {discrepancyData.slice(0, 10).map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.materialName}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{item.warehouse}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.transactionQty.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.physicalQty.toLocaleString()}</td>
                    <td className={`py-2 px-3 text-right font-medium ${Math.abs(item.discrepancyRate) > 10 ? 'text-red-600' : Math.abs(item.discrepancyRate) > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                      {item.discrepancyRate > 0 ? '+' : ''}{item.discrepancyRate.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.actionStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : item.actionStatus === 'investigating' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.actionStatus === 'pending' ? '대기' : item.actionStatus === 'investigating' ? '조사중' : '완료'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
