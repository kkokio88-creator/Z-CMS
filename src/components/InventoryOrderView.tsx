import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { InventorySafetyItem, StocktakeAnomalyItem, OrderSuggestion } from '../types';

interface Props {
  inventoryData: InventorySafetyItem[];
  stocktakeAnomalies: StocktakeAnomalyItem[];
  orderSuggestions: OrderSuggestion[];
  onItemClick: (item: any) => void;
}

export const InventoryOrderView: React.FC<Props> = ({
  inventoryData,
  stocktakeAnomalies,
  orderSuggestions,
  onItemClick,
}) => {
  // KPI 계산
  const shortageCount = inventoryData.filter(i => i.status === 'Shortage').length;
  const overstockCount = inventoryData.filter(i => i.status === 'Overstock').length;
  const anomalyCount = stocktakeAnomalies.filter(a => a.anomalyScore > 80).length;
  const pendingOrders = orderSuggestions.filter(o => o.status === 'Ready').length;
  const totalOrderAmount = orderSuggestions.reduce((s, o) => s + o.orderQty * o.unitPrice, 0);

  // 재고 과부족 차트 데이터
  const inventoryChartData = inventoryData
    .filter(i => i.status !== 'Normal')
    .slice(0, 10)
    .map(i => ({
      name: i.skuName.length > 10 ? i.skuName.slice(0, 10) + '…' : i.skuName,
      현재재고: i.currentStock,
      안전재고: i.safetyStock,
      status: i.status,
    }));

  // 발주 추천 차트 데이터
  const orderChartData = orderSuggestions.slice(0, 8).map(o => ({
    name: o.skuName.length > 8 ? o.skuName.slice(0, 8) + '…' : o.skuName,
    발주수량: o.orderQty,
    예상금액: o.orderQty * o.unitPrice,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">재고/발주 관리</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">재고 부족</p>
          <p className={`text-2xl font-bold mt-1 ${shortageCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {shortageCount}건
          </p>
          <p className="text-xs text-gray-400 mt-1">전체 {inventoryData.length}건 중</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">과잉 재고</p>
          <p className={`text-2xl font-bold mt-1 ${overstockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {overstockCount}건
          </p>
          <p className="text-xs text-gray-400 mt-1">비효율 재고</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">실사 이상 징후</p>
          <p className={`text-2xl font-bold mt-1 ${anomalyCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {anomalyCount}건
          </p>
          <p className="text-xs text-gray-400 mt-1">이상 점수 80+</p>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">발주 대기</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{pendingOrders}건</p>
          <p className="text-xs text-gray-400 mt-1">₩{(totalOrderAmount / 1_000_000).toFixed(1)}M 예상</p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 재고 과부족 현황 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">재고 과부족 현황</h3>
          {inventoryChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="안전재고" fill="#9CA3AF" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="현재재고" radius={[0, 4, 4, 0]}>
                    {inventoryChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.status === 'Shortage' ? '#EF4444' : '#F59E0B'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">리스크 재고 없음 (모두 정상)</p>
          )}
        </div>

        {/* 발주 추천 현황 */}
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">발주 추천 현황</h3>
          {orderChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderChartData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="예상금액" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-10">발주 추천 없음</p>
          )}
        </div>
      </div>

      {/* 재고 리스크 항목 테이블 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-red-500">warning</span>
          재고 리스크 항목
        </h3>
        {inventoryData.filter(i => i.status !== 'Normal').length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">품목</th>
                  <th className="text-left py-2 px-3 text-gray-500">창고/카테고리</th>
                  <th className="text-center py-2 px-3 text-gray-500">상태</th>
                  <th className="text-right py-2 px-3 text-gray-500">현재재고</th>
                  <th className="text-right py-2 px-3 text-gray-500">안전재고</th>
                  <th className="text-right py-2 px-3 text-gray-500">괴리율</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.filter(i => i.status !== 'Normal').slice(0, 15).map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onItemClick(item)}>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.skuName}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{item.warehouse} / {item.category}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'Shortage' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {item.status === 'Shortage' ? '부족' : '과잉'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{item.currentStock}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{item.safetyStock}</td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {item.safetyStock > 0 ? Math.round(((item.currentStock - item.safetyStock) / item.safetyStock) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-6">리스크 항목 없음</p>
        )}
      </div>

      {/* 실사 이상 징후 테이블 */}
      {stocktakeAnomalies.length > 0 && (
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-indigo-500">fact_check</span>
            실사 이상 징후
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">자재</th>
                  <th className="text-left py-2 px-3 text-gray-500">위치</th>
                  <th className="text-right py-2 px-3 text-gray-500">전산</th>
                  <th className="text-right py-2 px-3 text-gray-500">실사</th>
                  <th className="text-center py-2 px-3 text-gray-500">이상 점수</th>
                  <th className="text-left py-2 px-3 text-gray-500">분석</th>
                </tr>
              </thead>
              <tbody>
                {[...stocktakeAnomalies].sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 10).map((item, i) => (
                  <tr key={item.id || i} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${item.anomalyScore > 80 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`} onClick={() => onItemClick(item)}>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.materialName}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{item.location}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.systemQty}</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{item.countedQty}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.anomalyScore > 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.anomalyScore}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 발주 추천 상세 테이블 */}
      {orderSuggestions.length > 0 && (
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-blue-500">shopping_cart</span>
            발주 추천 상세
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500">품목</th>
                  <th className="text-left py-2 px-3 text-gray-500">공급처</th>
                  <th className="text-right py-2 px-3 text-gray-500">현재재고</th>
                  <th className="text-right py-2 px-3 text-gray-500">안전재고</th>
                  <th className="text-right py-2 px-3 text-gray-500">추천수량</th>
                  <th className="text-right py-2 px-3 text-gray-500">예상금액</th>
                  <th className="text-center py-2 px-3 text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody>
                {orderSuggestions.slice(0, 15).map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.skuName}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{item.supplierName}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.currentStock}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{item.safetyStock}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-600">{item.orderQty} {item.unit}</td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">₩{(item.orderQty * item.unitPrice).toLocaleString()}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'Ready' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.status === 'Ready' ? '대기' : '발송됨'}
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
