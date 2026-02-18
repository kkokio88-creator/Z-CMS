import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardInsights } from '../../services/insightService';
import type { ModalItem } from '../../types';

interface ModalManagerProps {
  selectedItem: ModalItem | null;
  insights: DashboardInsights | null;
  onPurchaseRequest: () => void;
}

export const ModalManager: React.FC<ModalManagerProps> = ({ selectedItem, insights, onPurchaseRequest }) => {
  if (!selectedItem) return null;

  // 월간 랭킹 모달
  if (selectedItem.kind === 'profit') {
    const COST_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const costData = insights?.costBreakdown?.composition?.map((c, i) => ({
      name: c.name,
      value: c.value,
      color: COST_COLORS[i % COST_COLORS.length],
    })) || [];
    const channelData = insights?.channelRevenue?.channels?.map(ch => ({
      name: ch.name,
      value: ch.share,
      marginRate: ch.marginRate3,
    })) || [];

    return (
      <div className="space-y-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
          <h4 className="font-bold text-blue-800 dark:text-blue-200">
            수익성 분석 리포트: {selectedItem.skuName}
          </h4>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            마진율: {selectedItem.margin}%
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
            <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              원가 구조
            </h5>
            {costData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {costData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                원가 데이터 수집 중...
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
            <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              채널별 판매 비중
            </h5>
            {channelData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={channelData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
                    <Bar dataKey="value" name="판매비중(%)" fill="#8884d8" radius={[0, 4, 4, 0]}>
                      {channelData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.marginRate < 20 ? '#EF4444' : '#3B82F6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                채널 데이터 수집 중...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 재고 모달
  if (selectedItem.kind === 'inventory') {
    const isShortage = selectedItem.status === 'Shortage';
    const isOverstock = selectedItem.status === 'Overstock';
    const stockRatio = selectedItem.safetyStock > 0
      ? Math.round((selectedItem.currentStock / selectedItem.safetyStock) * 100)
      : 0;
    return (
      <div className="space-y-4">
        <div
          className={`p-3 rounded-md mb-4 border ${isShortage ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isOverstock ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800' : 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800'}`}
        >
          <h4
            className={`font-bold ${isShortage ? 'text-red-800 dark:text-red-200' : isOverstock ? 'text-yellow-800 dark:text-yellow-200' : 'text-green-800 dark:text-green-200'}`}
          >
            재고 상태:{' '}
            {isShortage ? '부족 (발주 필요)' : isOverstock ? '과잉' : '정상'}
          </h4>
          <p
            className={`text-xs mt-1 ${isShortage ? 'text-red-600 dark:text-red-300' : isOverstock ? 'text-yellow-600 dark:text-yellow-300' : 'text-green-600 dark:text-green-300'}`}
          >
            {isShortage
              ? '안전재고 미달 상태입니다. 즉시 발주가 권장됩니다.'
              : isOverstock
                ? '재고가 안전재고의 3배 이상입니다. 구매량 조정을 검토하세요.'
                : '현재 재고 수준은 안정적입니다.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="text-xs text-gray-500">현재 재고</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.currentStock.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="text-xs text-gray-500">안전재고</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.safetyStock.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="text-xs text-gray-500">재고 충족률</p>
            <p className={`font-bold text-lg ${stockRatio < 100 ? 'text-red-600' : 'text-green-600'}`}>{stockRatio}%</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="text-xs text-gray-500">회전율</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.turnoverRate}회</p>
          </div>
        </div>

        {isShortage && (
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onPurchaseRequest}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
            >
              <span className="material-icons-outlined text-sm">shopping_cart</span>
              긴급 발주 요청
            </button>
          </div>
        )}
      </div>
    );
  }

  // 실사 이상 모달
  if (selectedItem.kind === 'stocktake') {
    const variance = selectedItem.systemQty - selectedItem.countedQty;
    const variancePct = selectedItem.systemQty > 0
      ? ((variance / selectedItem.systemQty) * 100).toFixed(1)
      : '0';
    const isLoss = variance > 0;
    return (
      <div className="space-y-4">
        <div className={`p-3 rounded-md mb-4 border ${selectedItem.anomalyScore > 70 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800'}`}>
          <h4 className={`font-bold ${selectedItem.anomalyScore > 70 ? 'text-red-800 dark:text-red-200' : 'text-indigo-800 dark:text-indigo-200'}`}>
            실사 분석: {selectedItem.materialName}
          </h4>
          <p className={`text-xs mt-1 ${selectedItem.anomalyScore > 70 ? 'text-red-600 dark:text-red-300' : 'text-indigo-600 dark:text-indigo-300'}`}>
            {selectedItem.reason}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
            <p className="text-xs text-gray-500">전산 재고</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.systemQty.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
            <p className="text-xs text-gray-500">실사 재고</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.countedQty.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
            <p className="text-xs text-gray-500">AI 예측</p>
            <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">{selectedItem.aiExpectedQty.toLocaleString()}</p>
          </div>
        </div>

        <div className={`p-3 rounded-md border ${isLoss ? 'bg-red-50 border-red-200 dark:bg-red-900/10' : 'bg-green-50 border-green-200 dark:bg-green-900/10'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">차이 수량</span>
            <span className={`font-bold text-lg ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
              {isLoss ? '-' : '+'}{Math.abs(variance).toLocaleString()} ({variancePct}%)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isLoss ? '전산 재고 > 실물 재고 — 분실/Loss 가능성' : '실물 재고 > 전산 재고 — 입고 미전표 가능성'}
          </p>
        </div>

        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <span className="text-xs text-gray-500">이상 점수:</span>
          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${selectedItem.anomalyScore > 70 ? 'bg-red-500' : selectedItem.anomalyScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${selectedItem.anomalyScore}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{selectedItem.anomalyScore}점</span>
        </div>
      </div>
    );
  }

  // Default: BOM Diff
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-xs text-gray-500">표준 소요량</p>
          <p className="font-bold text-gray-900 dark:text-white">
            {selectedItem.stdQty} {selectedItem.stdUnit}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-xs text-gray-500">실제 소요량</p>
          <p className="font-bold text-red-600 dark:text-red-400">
            {selectedItem.actualQty} {selectedItem.stdUnit}
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-md border border-indigo-100 dark:border-indigo-800">
        <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center">
          <span className="material-icons-outlined text-sm mr-1">psychology</span>
          AI Reasoning (원인 분석)
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {selectedItem.reasoning || '특이 사항이 발견되지 않았습니다.'}
        </p>
      </div>

      {selectedItem.costImpact && (
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">원가 영향</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            이 차이로 인해 이번 배치에서 총{' '}
            <span className="font-bold text-red-600">
              ${Math.abs(selectedItem.costImpact).toLocaleString()}
            </span>
            의 추가 비용이 발생했습니다.
          </p>
        </div>
      )}
    </div>
  );
};
