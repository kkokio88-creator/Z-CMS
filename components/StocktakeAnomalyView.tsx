import React, { useState, useEffect } from 'react';
import { StocktakeAnomalyItem } from '../types';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

interface Props {
    data: StocktakeAnomalyItem[];
    onItemClick?: (item: StocktakeAnomalyItem) => void;
}

export const StocktakeAnomalyView: React.FC<Props> = ({ data, onItemClick }) => {
  // Local state for UI interactions (Action Status), synced with props
  const [items, setItems] = useState<StocktakeAnomalyItem[]>(data);

  useEffect(() => {
      setItems(data);
  }, [data]);

  const handleAction = (e: React.MouseEvent, id: string, action: 'adjust' | 'recount') => {
      e.stopPropagation();
      setItems(prev => prev.map(item => {
          if (item.id === id) {
              return { 
                  ...item, 
                  actionStatus: action === 'adjust' ? 'adjusted' : 'recount_requested' 
              };
          }
          return item;
      }));
      
      const message = action === 'adjust' 
        ? "시스템 재고가 실사 수량에 맞춰 조정되었습니다." 
        : "담당자에게 긴급 재실사 요청이 전송되었습니다.";
      alert(message);
  };

  return (
    <div className="space-y-6">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 p-4 rounded-r-lg">
            <div className="flex">
                <div className="flex-shrink-0">
                    <span className="material-icons-outlined text-indigo-500">psychology</span>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        AI 분석 결과, 최근 재고 실사 데이터 중 <span className="font-bold">{items.filter(i => i.anomalyScore > 80).length}건의 비정상 패턴</span>이 감지되었습니다. 실물 재조사를 권장합니다.
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Anomaly Scatter Plot */}
            <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">전산 재고 vs 실사 재고 상관관계</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid />
                            <XAxis type="number" dataKey="systemQty" name="전산 재고" unit="ea" stroke="#9CA3AF" />
                            <YAxis type="number" dataKey="countedQty" name="실사 재고" unit="ea" stroke="#9CA3AF" />
                            <ZAxis type="number" dataKey="anomalyScore" range={[60, 400]} name="이상 점수" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <ReferenceLine x={0} y={0} stroke="red" label="일치선 (y=x)" strokeDasharray="3 3" segment={[{x:0, y:0}, {x:3000, y:3000}]}/>
                            <Scatter name="Inventory Items" data={items} fill="#8884d8">
                                {items.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.anomalyScore > 80 ? '#EF4444' : '#2F5E3E'} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">X축: 시스템 상 재고, Y축: 실제 세어본 재고. 대각선에서 멀어질수록 이상 징후가 높음.</p>
            </div>

            {/* Stats Card */}
             <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col justify-center items-center text-center">
                 <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                    <span className="material-icons-outlined text-4xl text-red-600 dark:text-red-400">error_outline</span>
                 </div>
                 <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                     {items.length > 0 ? Math.max(...items.map(i => i.anomalyScore)) : 0}/100
                 </h4>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">최고 이상 점수</p>
                 
                 <div className="w-full border-t border-gray-200 dark:border-gray-700 pt-4">
                     <div className="flex justify-between mb-2">
                         <span className="text-sm text-gray-600 dark:text-gray-300">검사 대상 품목</span>
                         <span className="text-sm font-bold text-gray-900 dark:text-white">{items.length * 15}건</span>
                     </div>
                     <div className="flex justify-between">
                         <span className="text-sm text-gray-600 dark:text-gray-300">의심 항목</span>
                         <span className="text-sm font-bold text-red-600 dark:text-red-400">{items.length}건</span>
                     </div>
                 </div>
             </div>
        </div>

        {/* Detailed Anomaly Table */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">이상 징후 상세 내역 및 조치</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">자재명 / 위치</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">전산 재고</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">실사 재고</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI 예상</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">이상 점수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">분석 의견</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">조치 (Action)</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                    {items.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-4 text-sm text-gray-500">이상 징후 데이터가 없습니다.</td></tr>
                    ) : (
                        items.sort((a,b) => b.anomalyScore - a.anomalyScore).map((item) => (
                        <tr 
                            key={item.id} 
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${item.anomalyScore > 80 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                            onClick={() => onItemClick && onItemClick(item)}
                        >
                            <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.materialName}</div>
                                <div className="text-xs text-gray-500">{item.location}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{item.systemQty}</td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-gray-900 dark:text-white">{item.countedQty}</td>
                             <td className="px-6 py-4 text-sm text-right text-indigo-600 dark:text-indigo-400 font-medium">{item.aiExpectedQty}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    item.anomalyScore > 80 
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                    {item.anomalyScore}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {item.reason}
                            </td>
                            <td className="px-6 py-4 text-center">
                                {item.actionStatus && item.actionStatus !== 'none' ? (
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                        item.actionStatus === 'adjusted' 
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    }`}>
                                        {item.actionStatus === 'adjusted' ? '조정 완료' : '재실사 요청됨'}
                                    </span>
                                ) : (
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={(e) => handleAction(e, item.id, 'adjust')}
                                            title="시스템 재고 조정"
                                            className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 border border-blue-200 dark:border-blue-800"
                                        >
                                            <span className="material-icons-outlined text-sm">save_as</span>
                                        </button>
                                        <button 
                                            onClick={(e) => handleAction(e, item.id, 'recount')}
                                            title="재실사 요청"
                                            className="p-1.5 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded hover:bg-yellow-100 border border-yellow-200 dark:border-yellow-800"
                                        >
                                            <span className="material-icons-outlined text-sm">find_replace</span>
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    )))}
                </tbody>
            </table>
        </div>
    </div>
  );
};