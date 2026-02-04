import React from 'react';
import { TopWasteItem } from '../types';

interface Props {
  items: TopWasteItem[];
}

export const TopWasteItems: React.FC<Props> = ({ items }) => {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 h-full transition-colors">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          비용 영향별 주요 폐기 항목
        </h3>
        <button className="text-gray-400 hover:text-primary">
          <span className="material-icons-outlined text-sm">more_horiz</span>
        </button>
      </div>

      <div className="space-y-4 pt-2">
        {items.map(item => (
          <div key={item.id} className="group cursor-pointer">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
              <span
                className={`font-bold ${item.isAnomaly ? 'text-orange-500 dark:text-orange-400' : item.id === '1' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                ${item.amount.toLocaleString()}
              </span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`${item.colorClass} h-2.5 rounded-full ${!item.isAnomaly && item.id !== '1' ? 'opacity-60' : ''}`}
                style={{ width: `${item.percentageOfTotal}%` }}
              ></div>
            </div>

            <div className="text-xs text-gray-500 mt-1 flex justify-between">
              <span>분산: +{item.variancePercent}%</span>
              {item.percentageOfTotal && (
                <span>
                  {item.isAnomaly
                    ? '이상 탐지됨'
                    : item.id === '1'
                      ? `전체 폐기 비용의 ${item.percentageOfTotal}%`
                      : '허용 범위 내'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
