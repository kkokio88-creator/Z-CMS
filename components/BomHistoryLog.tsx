import React from 'react';
import { BomHistoryItem } from '../types';

interface Props {
  history: BomHistoryItem[];
}

export const BomHistoryLog: React.FC<Props> = ({ history }) => {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-icons-outlined text-gray-400">history</span>
          BOM 및 기준 정보 변경 이력
        </h3>
        <button className="text-sm text-primary dark:text-green-400 font-medium hover:underline">
          전체 로그 다운로드
        </button>
      </div>

      <div className="relative">
        {/* Vertical Line for Timeline effect (Simplified table for now) */}
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                일시
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                대상 품목
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                유형
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                내용
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                변경 전/후
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                작업자
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
            {history.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {item.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {item.skuName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      item.actionType === 'Update'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                        : item.actionType === 'Fix'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {item.actionType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {item.description}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {item.oldValue && item.newValue ? (
                    <div className="flex items-center gap-2">
                      <span className="line-through text-red-400 text-xs">{item.oldValue}</span>
                      <span className="material-icons-outlined text-xs text-gray-400">
                        arrow_forward
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {item.newValue}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {item.actor === 'AI Agent' ? (
                      <span className="material-icons-outlined text-purple-500 text-sm">
                        auto_awesome
                      </span>
                    ) : (
                      <span className="material-icons-outlined text-gray-400 text-sm">person</span>
                    )}
                    <span
                      className={
                        item.actor === 'AI Agent'
                          ? 'text-purple-600 dark:text-purple-400 font-medium'
                          : 'text-gray-600 dark:text-gray-300'
                      }
                    >
                      {item.actor}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
