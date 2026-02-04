import React, { useState, useEffect } from 'react';
import { KPICardProps, DashboardSummary } from '../types';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface DataAvailability {
    sales: boolean;
    purchases: boolean;
    inventory: boolean;
    production: boolean;
    bom: boolean;
}

// Google Sheets 데이터 소스 설정 타입
interface DataSourceConfig {
    type: 'googleSheets' | 'ecount' | 'none';
    googleSheets?: {
        spreadsheetUrl: string;
        sheetName: string;
    };
    status: 'connected' | 'disconnected' | 'error' | 'testing';
    lastTested?: string;
    errorMessage?: string;
}

interface DataSourcesConfig {
    mealPlan: DataSourceConfig;
    salesHistory: DataSourceConfig;
    bomSan: DataSourceConfig;
    bomZip: DataSourceConfig;
    inventory: DataSourceConfig;
    purchaseOrders: DataSourceConfig;
    purchaseHistory: DataSourceConfig;
}

const DATASOURCE_CONFIG_KEY = 'ZCMS_DATASOURCE_CONFIG';
const API_BASE = 'http://localhost:3001';

const DATA_SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
    mealPlan: { label: '식단표', icon: 'restaurant_menu' },
    salesHistory: { label: '판매실적', icon: 'point_of_sale' },
    bomSan: { label: 'BOM (SAN)', icon: 'receipt_long' },
    bomZip: { label: 'BOM (ZIP)', icon: 'receipt_long' },
    inventory: { label: '재고현황', icon: 'inventory_2' },
    purchaseOrders: { label: '발주현황', icon: 'local_shipping' },
    purchaseHistory: { label: '구매현황', icon: 'shopping_cart' },
};

interface DashboardHomeViewProps {
    onSync: () => void;
    isSyncing: boolean;
    lastSyncTime: string;
    summaryData: DashboardSummary;
    profitTrend: any[];
    wasteTrend: any[];
    syncMessage?: string;
    dataAvailability?: DataAvailability;
    inventoryCount?: number;
    onNavigateToSettings?: () => void;
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
    wasteTrend,
    syncMessage,
    dataAvailability,
    inventoryCount = 0,
    onNavigateToSettings
}) => {
    const [sheetsConfig, setSheetsConfig] = useState<DataSourcesConfig | null>(null);
    const [testingSource, setTestingSource] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; count?: number; error?: string }>>({});

    // Load Google Sheets config from localStorage
    useEffect(() => {
        const loadConfig = () => {
            const saved = localStorage.getItem(DATASOURCE_CONFIG_KEY);
            if (saved) {
                try {
                    setSheetsConfig(JSON.parse(saved));
                } catch {
                    setSheetsConfig(null);
                }
            }
        };
        loadConfig();

        // Listen for storage changes
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === DATASOURCE_CONFIG_KEY) {
                loadConfig();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Test a single Google Sheets connection
    const testSheetConnection = async (sourceKey: string, config: DataSourceConfig) => {
        if (config.type !== 'googleSheets' || !config.googleSheets?.spreadsheetUrl) {
            return;
        }

        setTestingSource(sourceKey);
        try {
            const response = await fetch(`${API_BASE}/api/sheets/fetch-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    spreadsheetUrl: config.googleSheets.spreadsheetUrl,
                    sheetName: config.googleSheets.sheetName
                })
            });
            const result = await response.json();

            setTestResults(prev => ({
                ...prev,
                [sourceKey]: {
                    success: result.success,
                    count: result.data?.length || 0,
                    error: result.error
                }
            }));
        } catch (error: any) {
            setTestResults(prev => ({
                ...prev,
                [sourceKey]: { success: false, error: error.message }
            }));
        } finally {
            setTestingSource(null);
        }
    };

    // Test all configured sheets
    const testAllSheets = async () => {
        if (!sheetsConfig) return;

        const sources = Object.entries(sheetsConfig) as [string, DataSourceConfig][];
        for (const [key, config] of sources) {
            if (config.type === 'googleSheets' && config.googleSheets?.spreadsheetUrl) {
                await testSheetConnection(key, config);
            }
        }
    };

    // Count configured and connected sources
    const getSourceCounts = () => {
        if (!sheetsConfig) return { configured: 0, connected: 0 };

        let configured = 0;
        let connected = 0;

        (Object.entries(sheetsConfig) as [string, DataSourceConfig][]).forEach(([key, config]) => {
            if (config.type === 'googleSheets' && config.googleSheets?.spreadsheetUrl) {
                configured++;
                if (testResults[key]?.success) {
                    connected++;
                }
            }
        });

        return { configured, connected };
    };

    const sourceCounts = getSourceCounts();
    const hasAnySheetConfig = sourceCounts.configured > 0;

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

             {/* Data Availability Notice */}
             {syncMessage && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="material-icons-outlined text-blue-500">info</span>
                        <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{syncMessage}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                ECOUNT API 구독에서 조회 API가 지원되지 않는 데이터는 표시되지 않습니다.
                            </p>
                        </div>
                    </div>
                </div>
             )}

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
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">ECOUNT API 연동 상태</h3>
                     <div className="space-y-3">
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">inventory_2</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">재고 현황</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${dataAvailability?.inventory ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dataAvailability?.inventory ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                 {dataAvailability?.inventory ? `${inventoryCount}개 품목` : 'API 미지원'}
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">point_of_sale</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">판매 이력</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${dataAvailability?.sales ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dataAvailability?.sales ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                 {dataAvailability?.sales ? '연동됨' : '조회 API 미지원'}
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">shopping_cart</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">구매 이력</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${dataAvailability?.purchases ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dataAvailability?.purchases ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                 {dataAvailability?.purchases ? '연동됨' : '조회 API 미지원'}
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">precision_manufacturing</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">생산 이력</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${dataAvailability?.production ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dataAvailability?.production ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                 {dataAvailability?.production ? '연동됨' : '조회 API 미지원'}
                             </span>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <span className="material-icons-outlined text-gray-400">account_tree</span>
                                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">BOM 데이터</span>
                             </div>
                             <span className={`flex items-center text-xs font-medium px-2 py-1 rounded ${dataAvailability?.bom ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dataAvailability?.bom ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                 {dataAvailability?.bom ? '연동됨' : '조회 API 미지원'}
                             </span>
                         </div>
                         <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                             <p className="text-xs text-gray-500">데이터 마지막 동기화: {lastSyncTime}</p>
                         </div>
                     </div>
                 </div>
             </div>

            {/* Google Sheets 데이터 소스 연결 상태 */}
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-icons-outlined text-green-600">table_chart</span>
                        Google Sheets 데이터 소스
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            sourceCounts.configured === 0
                                ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                : sourceCounts.connected === sourceCounts.configured
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                            {sourceCounts.configured === 0 ? '미설정' : `${sourceCounts.connected}/${sourceCounts.configured} 연결됨`}
                        </span>
                        <button
                            onClick={testAllSheets}
                            disabled={testingSource !== null || !hasAnySheetConfig}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded transition-colors disabled:opacity-50"
                        >
                            <span className={`material-icons-outlined text-sm ${testingSource ? 'animate-spin' : ''}`}>
                                {testingSource ? 'sync' : 'refresh'}
                            </span>
                            연결 테스트
                        </button>
                    </div>
                </div>

                {!hasAnySheetConfig ? (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-start gap-3">
                            <span className="material-icons-outlined text-yellow-500">warning</span>
                            <div>
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    데이터 소스가 설정되지 않았습니다
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                                    설정에서 Google Sheets URL을 등록하면 식단표, BOM, 재고 등의 데이터를 연동할 수 있습니다.
                                </p>
                                {onNavigateToSettings && (
                                    <button
                                        onClick={onNavigateToSettings}
                                        className="mt-2 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:underline flex items-center gap-1"
                                    >
                                        <span className="material-icons-outlined text-sm">settings</span>
                                        설정으로 이동
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(Object.entries(sheetsConfig || {}) as [string, DataSourceConfig][]).map(([key, config]) => {
                            const sourceInfo = DATA_SOURCE_LABELS[key];
                            if (!sourceInfo) return null;

                            const isConfigured = config.type === 'googleSheets' && config.googleSheets?.spreadsheetUrl;
                            const testResult = testResults[key];
                            const isTesting = testingSource === key;

                            let statusColor = 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
                            let statusIcon = 'cloud_off';
                            let statusText = '미설정';
                            let iconColor = 'text-gray-400';

                            if (isConfigured) {
                                if (isTesting) {
                                    statusColor = 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
                                    statusIcon = 'sync';
                                    statusText = '테스트 중...';
                                    iconColor = 'text-blue-500 animate-spin';
                                } else if (testResult) {
                                    if (testResult.success) {
                                        statusColor = 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
                                        statusIcon = 'check_circle';
                                        statusText = `${testResult.count}건`;
                                        iconColor = 'text-green-500';
                                    } else {
                                        statusColor = 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
                                        statusIcon = 'error';
                                        statusText = '연결 실패';
                                        iconColor = 'text-red-500';
                                    }
                                } else {
                                    statusColor = 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
                                    statusIcon = 'help_outline';
                                    statusText = '테스트 필요';
                                    iconColor = 'text-yellow-500';
                                }
                            }

                            return (
                                <div
                                    key={key}
                                    className={`p-3 rounded-lg border ${statusColor} cursor-pointer hover:shadow-sm transition-shadow`}
                                    onClick={() => isConfigured && testSheetConnection(key, config)}
                                    title={testResult?.error || (isConfigured ? '클릭하여 연결 테스트' : '설정에서 연결 필요')}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`material-icons-outlined text-sm ${iconColor}`}>
                                            {statusIcon}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {sourceInfo.label}
                                        </span>
                                    </div>
                                    <p className={`text-sm font-semibold ${
                                        testResult?.success ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {statusText}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 서비스 계정 정보 */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="material-icons-outlined text-sm">account_circle</span>
                            서비스 계정: z-cms-bot@z-cms-486204.iam.gserviceaccount.com
                        </span>
                        <span className="text-gray-400">시트에 편집자 권한 필요</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
