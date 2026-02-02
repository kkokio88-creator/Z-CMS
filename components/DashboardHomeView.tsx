import React from 'react';
import { KPICardProps, DashboardSummary } from '../types';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface DashboardHomeViewProps {
    onSync: () => void;
    isSyncing: boolean;
    lastSyncTime: string;
    summaryData: DashboardSummary;
    profitTrend: any[];
    wasteTrend: any[];
}

const KPICard: React.FC<KPICardProps & { chartData?: any[], chartType?: 'line' | 'area', color?: string }> = ({ 
    title, value, change, isPositive, icon, chartData, chartType = 'line', color = '#3B82F6' 
}) => (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start z-10">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            </div>
            <div className={`p-2 rounded-full ${isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <span className={`material-icons-outlined text-xl ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{icon}</span>
            </div>
        </div>
        
        <div className="flex items-center mt-2 z-10">
            <span className={`text-xs font-bold mr-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {change}
            </span>
            <span className="text-xs text-gray-400">지난달 대비</span>
        </div>

        {/* Mini Chart Background */}
        {chartData && chartData.length > 0 ? (
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 group-hover:opacity-30 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'area' ? (
                        <AreaChart data={chartData}>
                             <Area type="monotone" dataKey="value" stroke={color} fill={color} />
                        </AreaChart>
                    ) : (
                        <LineChart data={chartData}>
                            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        ) : (
             <div className="absolute bottom-2 right-2 opacity-10">
                 <span className="text-4xl text-gray-300 material-icons-outlined">show_chart</span>
             </div>
        )}
    </div>
);

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
    onSync,
    isSyncing,
    lastSyncTime,
    summaryData,
    profitTrend,
    wasteTrend
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
             {/* Welcome Section */}
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">통합 관제 대시보드</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">오늘의 공장 운영 현황과 주요 KPI를 한눈에 확인하세요.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onSync}
                        disabled={isSyncing}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                        <span className={`w-2 h-2 rounded-full bg-green-500 mr-2 ${isSyncing ? 'animate-spin' : 'animate-pulse'}`}></span>
                        {isSyncing ? "ERP 동기화 중..." : "ECOUNT 연동됨"}
                    </button>
                    <span className="text-xs text-gray-400">마지막 업데이트: {lastSyncTime}</span>
                </div>
             </div>

             {/* KPI Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                    title="총 매출 (3개월)" 
                    value={`₩${(summaryData.totalRevenue / 1000000).toFixed(0)}M`} 
                    change={`+${summaryData.revenueChange}%`} 
                    isPositive={true} 
                    icon="payments"
                    chartData={profitTrend}
                    chartType="area"
                    color="#10B981"
                />
                <KPICard 
                    title="평균 영업 이익률" 
                    value={`${summaryData.avgMargin}%`} 
                    change={`+${summaryData.marginChange}%p`} 
                    isPositive={true} 
                    icon="trending_up"
                    chartData={profitTrend}
                    color="#3B82F6"
                />
                <KPICard 
                    title="평균 폐기율" 
                    value={`${summaryData.wasteRate}%`} 
                    change={`${summaryData.wasteRateChange}%p`} 
                    isPositive={true} 
                    icon="delete_outline"
                    chartData={wasteTrend}
                    color="#F59E0B"
                />
                <KPICard 
                    title="재고 위험/이상 징후" 
                    value={`${summaryData.riskItems + summaryData.anomalyCount}건`} 
                    change="주의 필요" 
                    isPositive={false} 
                    icon="warning_amber"
                    color="#EF4444"
                />
             </div>

             {/* Recent Alerts & Shortcuts */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Quick Actions / Shortcuts */}
                 <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">바로가기 (Quick Actions)</h3>
                     <div className="grid grid-cols-2 gap-4">
                         <button className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-primary/30 group">
                             <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <span className="material-icons-outlined">inventory</span>
                             </div>
                             <div className="ml-4 text-left">
                                 <p className="font-bold text-gray-900 dark:text-white">재고 발주</p>
                                 <p className="text-xs text-gray-500">부족 재고 처리</p>
                             </div>
                         </button>
                         <button className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-primary/30 group">
                             <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                <span className="material-icons-outlined">psychology</span>
                             </div>
                             <div className="ml-4 text-left">
                                 <p className="font-bold text-gray-900 dark:text-white">AI 모델 학습</p>
                                 <p className="text-xs text-gray-500">BOM 기준 업데이트</p>
                             </div>
                         </button>
                         <button className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-primary/30 group">
                             <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                                <span className="material-icons-outlined">assessment</span>
                             </div>
                             <div className="ml-4 text-left">
                                 <p className="font-bold text-gray-900 dark:text-white">월간 리포트</p>
                                 <p className="text-xs text-gray-500">PDF 다운로드</p>
                             </div>
                         </button>
                         <button className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-primary/30 group">
                             <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                                <span className="material-icons-outlined">settings</span>
                             </div>
                             <div className="ml-4 text-left">
                                 <p className="font-bold text-gray-900 dark:text-white">기준 설정</p>
                                 <p className="text-xs text-gray-500">임계값 관리</p>
                             </div>
                         </button>
                     </div>
                 </div>

                 {/* System Health / Status */}
                 <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">시스템 연결 상태</h3>
                     <div className="space-y-4">
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">dns</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ERP (이카운트)</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${isSyncing ? 'text-blue-600 bg-blue-50' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isSyncing ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                                 {isSyncing ? '동기화 진행 중...' : '연동 정상 (ID: 89445)'}
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">precision_manufacturing</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MES (생산설비)</span>
                             </div>
                             <span className="flex items-center text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                 실시간 수집 중
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">shopping_bag</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">판매채널 (이카운트 전표)</span>
                             </div>
                             <span className="flex items-center text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                 ERP 통합 연동
                             </span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                             <p className="text-xs text-gray-500">데이터 마지막 동기화: {lastSyncTime}</p>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};