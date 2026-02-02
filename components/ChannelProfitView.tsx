import React from 'react';
import { KPICardProps, ChannelProfitData } from '../types';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface Props {
    data: ChannelProfitData[];
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, isPositive, icon }) => (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            <p className={`text-xs font-medium mt-1 flex items-center ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <span className="material-icons-outlined text-sm mr-0.5">{isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
                {change} 전일 대비
            </p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-full">
            <span className="material-icons-outlined text-primary dark:text-green-400 text-xl">{icon}</span>
        </div>
    </div>
);

export const ChannelProfitView: React.FC<Props> = ({ data }) => {
  return (
    <div className="space-y-6">
        {/* KPI Cards (Static Mock for now, but could be calculated from data) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard title="기간 총 매출" value="₩118M" change="12.5%" isPositive={true} icon="payments" />
            <KPICard title="기간 영업이익" value="₩38M" change="8.4%" isPositive={true} icon="trending_up" />
            <KPICard title="평균 마진율" value="32.1%" change="1.2%" isPositive={false} icon="pie_chart" />
        </div>

        {/* Chart Section */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">채널 통합 일별 손익 추이</h3>
                <div className="flex gap-2">
                     <select className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-gray-600 dark:text-gray-300 py-1 px-2">
                        <option>전체 채널</option>
                        <option>쿠팡</option>
                        <option>자사몰</option>
                        <option>B2B</option>
                    </select>
                </div>
            </div>

            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid stroke="#f5f5f5" vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" scale="band" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }} 
                            itemStyle={{ color: '#F9FAFB' }}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        <Bar yAxisId="left" dataKey="revenue" name="매출" barSize={20} fill="#2F5E3E" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="profit" name="영업이익" barSize={20} fill="#86EFAC" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="marginRate" name="마진율" stroke="#F59E0B" strokeWidth={3} dot={{r:4}} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Detailed Table Placeholder */}
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-bold text-gray-900 dark:text-white">날짜별 상세 손익 데이터</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">날짜</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">매출</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">원가</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">영업이익</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">마진율</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{row.date}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-300">₩{row.revenue.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-300">₩{(row.revenue - row.profit).toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-primary dark:text-green-400">₩{row.profit.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">{row.marginRate}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};