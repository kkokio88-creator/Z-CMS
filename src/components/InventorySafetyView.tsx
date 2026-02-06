import React, { useState, useMemo } from 'react';
import { MOCK_TURNOVER_TREND } from '../constants';
import { InventorySafetyItem } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';

interface Props {
  data: InventorySafetyItem[];
  onItemClick?: (item: InventorySafetyItem) => void;
}

export const InventorySafetyView: React.FC<Props> = ({ data, onItemClick }) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique filter options from the dynamic data
  const warehouses = useMemo(
    () => ['All', ...Array.from(new Set(data.map(i => i.warehouse)))],
    [data]
  );
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(data.map(i => i.category)))],
    [data]
  );

  // Filter Data Logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchWH = selectedWarehouse === 'All' || item.warehouse === selectedWarehouse;
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchWH && matchCat;
    });
  }, [data, selectedWarehouse, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-surface-dark p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">창고:</label>
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white py-1 px-3 focus:ring-primary focus:border-primary"
          >
            {warehouses.map(wh => (
              <option key={wh} value={wh}>
                {wh === 'All' ? '전체 창고' : wh}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">카테고리:</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white py-1 px-3 focus:ring-primary focus:border-primary"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'All' ? '전체 카테고리' : cat}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-gray-500">총 {filteredData.length}개 항목 조회됨</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safety Stock vs Current Stock Chart */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            안전재고 vs 현재재고 현황
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
                onClick={(data: any) => {
                  if (data && data.activePayload && onItemClick) {
                    onItemClick(data.activePayload[0].payload);
                  }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="skuName" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="safetyStock" name="안전재고" fill="#9CA3AF" />
                <Bar dataKey="currentStock" name="현재재고" fill="#2F5E3E">
                  {filteredData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.currentStock < entry.safetyStock
                          ? '#EF4444'
                          : entry.currentStock > entry.safetyStock * 2
                            ? '#F59E0B'
                            : '#2F5E3E'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center flex justify-center gap-4">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> 부족 (위험)
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-800 mr-1"></span> 정상
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></span> 과잉 (비효율)
            </span>
          </div>
        </div>

        {/* Feature 3: Turnover Rate Trend Chart */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              재고 회전율 추이 (Turnover Trend)
            </h3>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              +0.3 전월 대비
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={MOCK_TURNOVER_TREND}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={8.0} label="목표 (8.0)" stroke="red" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="회전율"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            * 최근 3개월간 회전율이 지속적으로 상승하고 있어 긍정적입니다.
          </p>
        </div>
      </div>

      {/* Risk Items Table */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
          <h3 className="font-bold text-red-700 dark:text-red-300 flex items-center">
            <span className="material-icons-outlined mr-2">warning</span>
            재고 리스크 알림 (과부족 품목)
          </h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                SKU명
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                창고/카테고리
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                현재재고
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                안전재고
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                괴리율
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
            {filteredData.filter(i => i.status !== 'Normal').length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  리스크 항목이 없습니다.
                </td>
              </tr>
            ) : (
              filteredData
                .filter(i => i.status !== 'Normal')
                .map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => onItemClick && onItemClick(item)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {item.skuName}
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-gray-500">
                      {item.warehouse} / {item.category}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'Shortage'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}
                      >
                        {item.status === 'Shortage' ? '부족 위험' : '과잉 재고'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white font-bold">
                      {item.currentStock}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                      {item.safetyStock}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                      {Math.round(
                        ((item.currentStock - item.safetyStock) / item.safetyStock) * 100
                      )}
                      %
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
