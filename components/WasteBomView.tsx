import React, { useState } from 'react';
import { InsightBanner } from './InsightBanner';
import { WasteTrendChart } from './WasteTrendChart';
import { TopWasteItems } from './TopWasteItems';
import { BomDiffTable } from './BomDiffTable';
import { BomHistoryLog } from './BomHistoryLog';
import { LATEST_INSIGHT, TOP_WASTE_ITEMS, MOCK_WASTE_REASONS, MOCK_BOM_HISTORY } from '../constants';
import { BomDiffItem, WasteTrendData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
    onItemClick: (item: BomDiffItem) => void;
    wasteTrendData: WasteTrendData[];
    bomItems: BomDiffItem[];
}

// Empty state component for views without data
const NoDataState = ({ title, description, apiName }: { title: string; description: string; apiName: string }) => (
    <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
        <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">precision_manufacturing</span>
        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md px-4">{description}</p>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-bold">참고:</span> ECOUNT API 구독에서 {apiName} 조회 API가 포함되어 있지 않습니다.
                해당 데이터를 보려면 ECOUNT에서 관련 API를 구독하거나 수동으로 데이터를 입력해야 합니다.
            </p>
        </div>
    </div>
);

export const WasteBomView: React.FC<Props> = ({ onItemClick, wasteTrendData, bomItems }) => {
  const [activeTab, setActiveTab] = useState<'waste' | 'bom' | 'history'>('waste');

  // Check if we have any meaningful data
  const hasData = (wasteTrendData && wasteTrendData.length > 0) || (bomItems && bomItems.length > 0);

  if (!hasData) {
    return (
      <NoDataState
        title="생산/BOM 데이터 없음"
        description="ECOUNT ERP에서 생산 이력 및 BOM 데이터를 가져올 수 없습니다."
        apiName="생산/BOM"
      />
    );
  }

  return (
    <>
      <InsightBanner insight={LATEST_INSIGHT} />
      
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('waste')}
            className={`${activeTab === 'waste' ? 'border-primary text-primary dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
          >
            <span className="material-icons-outlined mr-2 text-lg">trending_up</span>
            폐기 분석 (Overview)
          </button>
          <button 
            onClick={() => setActiveTab('bom')}
            className={`${activeTab === 'bom' ? 'border-primary text-primary dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
          >
            <span className="material-icons-outlined mr-2 text-lg">difference</span>
            BOM 차이 상세
          </button>
          <button 
             onClick={() => setActiveTab('history')}
             className={`${activeTab === 'history' ? 'border-primary text-primary dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
          >
            <span className="material-icons-outlined mr-2 text-lg">history</span>
            이력 로그 (History)
          </button>
        </nav>
      </div>

      {activeTab !== 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 w-full">
                {/* Pass filtered data to chart */}
                <WasteTrendChart data={wasteTrendData} />
            </div>
            
            {/* Feature 1: Waste Reason Analysis */}
            <div className="w-full bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 h-full transition-colors">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">폐기 발생 원인 (Why)</h3>
                <div className="h-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={MOCK_WASTE_REASONS}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {MOCK_WASTE_REASONS.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: 'none', fontSize: '12px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-sm font-bold text-gray-400">원인별</span>
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                    * 기계/설비 고장 비중이 45%로 가장 높습니다.
                </div>
            </div>
        </div>
      )}

      {activeTab !== 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1 w-full">
                <TopWasteItems items={TOP_WASTE_ITEMS} />
            </div>
            <div className="lg:col-span-2 w-full">
                <BomDiffTable items={bomItems} onItemClick={onItemClick} />
            </div>
        </div>
      )}

      {/* Feature 2: History Log View */}
      {activeTab === 'history' && (
          <div className="animate-fade-in">
              <BomHistoryLog history={MOCK_BOM_HISTORY} />
          </div>
      )}
    </>
  );
};