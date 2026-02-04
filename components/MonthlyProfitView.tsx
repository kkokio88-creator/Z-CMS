import React from 'react';
import { ProfitRankItem } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface Props {
    topItems: ProfitRankItem[];
    bottomItems: ProfitRankItem[];
    onItemClick?: (item: ProfitRankItem) => void;
}

// Empty state component for views without data
const NoDataState = ({ title, description }: { title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
        <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">leaderboard</span>
        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md px-4">{description}</p>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-bold">참고:</span> ECOUNT API 구독에서 판매 조회 API가 포함되어 있지 않습니다.
                수익성 분석을 보려면 ECOUNT에서 판매 조회 API를 구독하거나 수동으로 데이터를 입력해야 합니다.
            </p>
        </div>
    </div>
);

export const MonthlyProfitView: React.FC<Props> = ({ topItems, bottomItems, onItemClick }) => {
  // Show empty state if no data
  if ((!topItems || topItems.length === 0) && (!bottomItems || bottomItems.length === 0)) {
    return (
      <NoDataState
        title="수익성 데이터 없음"
        description="ECOUNT ERP에서 판매 이력 데이터를 가져올 수 없어 수익성 분석이 불가합니다."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">월간 수익성 랭킹 (2023년 11월)</h3>
        <div className="text-sm text-gray-500">
          <span className="inline-block w-3 h-3 bg-blue-500 rounded-sm mr-1"></span>이익
          <span className="inline-block w-3 h-3 bg-red-500 rounded-sm ml-3 mr-1"></span>손실
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top 10 Profit */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
                 <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="material-icons-outlined text-green-600 mr-2">thumb_up</span>
                    Top 5 효자 상품 (고수익)
                 </h4>
            </div>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={topItems}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        onClick={(data: any) => {
                            if (data && data.activePayload && onItemClick) {
                                onItemClick(data.activePayload[0].payload);
                            }
                        }}
                        className="cursor-pointer"
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="skuName" width={100} tick={{fontSize: 11}} />
                        <Tooltip 
                            formatter={(value: number) => `₩${value.toLocaleString()}`}
                            contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: 'none' }}
                        />
                        <Bar dataKey="profit" name="영업이익" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20}>
                            {topItems.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="#3B82F6" />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">마진율</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {topItems.map((item) => (
                            <tr key={item.id} onClick={() => onItemClick && onItemClick(item)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-3 py-2 text-xs font-bold text-gray-900 dark:text-white">{item.rank}위</td>
                                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{item.channel}</td>
                                <td className="px-3 py-2 text-xs text-right text-green-600 font-bold">{item.margin}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Bottom 10 Profit (Loss) */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
                 <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="material-icons-outlined text-red-600 mr-2">thumb_down</span>
                    Bottom 5 저수익/적자 상품
                 </h4>
            </div>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={bottomItems}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        onClick={(data: any) => {
                            if (data && data.activePayload && onItemClick) {
                                onItemClick(data.activePayload[0].payload);
                            }
                        }}
                        className="cursor-pointer"
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="skuName" width={100} tick={{fontSize: 11}} />
                        <Tooltip 
                             formatter={(value: number) => `₩${value.toLocaleString()}`}
                             contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: 'none' }}
                        />
                         <ReferenceLine x={0} stroke="#9CA3AF" />
                        <Bar dataKey="profit" name="영업손익" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
             <div className="mt-4">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">마진율</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {bottomItems.map((item) => (
                            <tr key={item.id} onClick={() => onItemClick && onItemClick(item)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-3 py-2 text-xs font-bold text-gray-900 dark:text-white">{item.rank}위</td>
                                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{item.channel}</td>
                                <td className="px-3 py-2 text-xs text-right text-red-600 font-bold">{item.margin}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

       {/* Action Card */}
       <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full">
                    <span className="material-icons-outlined text-orange-600 dark:text-orange-300">warning</span>
                </div>
                <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-200">저수익 품목 개선 필요</p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">Bottom 5 품목의 평균 마진율이 -1.5%입니다. 프로모션 중단 또는 단가 인상을 검토하세요.</p>
                </div>
            </div>
            <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                상세 분석 리포트
            </button>
       </div>
    </div>
  );
};