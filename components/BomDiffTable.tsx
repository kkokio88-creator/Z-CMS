import React from 'react';
import { BomDiffItem } from '../types';

interface Props {
  items: BomDiffItem[];
  onItemClick?: (item: BomDiffItem) => void;
}

export const BomDiffTable: React.FC<Props> = ({ items, onItemClick }) => {
  const getDiffBadgeColor = (percent: number) => {
    if (percent >= 10) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (percent >= 5) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-red-500 text-red-600 dark:text-red-400';
    if (score >= 60) return 'bg-orange-400 text-orange-600 dark:text-orange-400';
    return 'bg-green-500 text-green-600 dark:text-green-400';
  };

  const handleAction = (e: React.MouseEvent, type: 'update' | 'resolve') => {
      e.stopPropagation();
      // Logic would go here to update the item status
      alert(type === 'update' ? "표준 BOM 업데이트가 승인되었습니다. AI가 학습합니다." : "일시적인 이슈로 처리되었습니다.");
  };

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">상세 BOM 차이 리스트</h3>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
            모든 위험 필터
          </button>
          <button className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
            CSV 내보내기
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU / 원자재</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">공정 단계</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">표준 / 실제</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">차이</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">이상 점수</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">원가 영향</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI 피드백 액션</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <tr 
                key={item.id} 
                onClick={() => onItemClick && onItemClick(item)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 font-mono mr-3">
                      {item.skuCode}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.skuName}</div>
                      <div className="text-xs text-gray-500">{item.skuSub}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.process}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                   <div className="flex flex-col">
                        <span className="text-xs text-gray-400">Std: {item.stdQty}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{item.actualQty} {item.stdUnit}</span>
                   </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDiffBadgeColor(item.diffPercent)}`}>
                    +{item.diffPercent}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full max-w-[80px] mx-auto">
                    <div 
                        className={`absolute h-2 rounded-full ${getScoreColor(item.anomalyScore).split(' ')[0]}`} 
                        style={{ width: `${item.anomalyScore}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs mt-1 block font-bold ${getScoreColor(item.anomalyScore).split(' ')[1]}`}>
                    {item.anomalyScore}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-semibold">
                  ${item.costImpact.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  {item.status === 'resolved' ? (
                       <span className="text-gray-400 text-xs flex items-center justify-center gap-1">
                           <span className="material-icons-outlined text-sm">check_circle</span> 처리완료
                       </span>
                  ) : (
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => handleAction(e, 'update')}
                            title="표준 BOM 업데이트 (학습)"
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100"
                        >
                            <span className="material-icons-outlined text-sm">update</span>
                        </button>
                        <button 
                            onClick={(e) => handleAction(e, 'resolve')}
                            title="일시적 이슈로 처리"
                            className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200"
                        >
                            <span className="material-icons-outlined text-sm">done</span>
                        </button>
                      </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};