/**
 * 데이터 소스 연결 상태 표시 컴포넌트
 *
 * 헤더 또는 대시보드에서 현재 연결된 데이터 소스 상태를 표시합니다.
 */

import React, { useState } from 'react';
import { useIntegratedData } from '../src/contexts/IntegratedDataContext';

interface DataSourceStatusProps {
    compact?: boolean;
    showRefreshButton?: boolean;
}

export const DataSourceStatus: React.FC<DataSourceStatusProps> = ({
    compact = false,
    showRefreshButton = true
}) => {
    const {
        data,
        isLoading,
        error,
        lastUpdated,
        connectedSources,
        refreshData,
        hasConfiguration
    } = useIntegratedData();

    const [isExpanded, setIsExpanded] = useState(false);

    // 컴팩트 모드
    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                        connectedSources > 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                    onClick={() => setIsExpanded(!isExpanded)}
                    title="클릭하여 상세 보기"
                >
                    <span className={`material-icons-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
                        {isLoading ? 'sync' : connectedSources > 0 ? 'cloud_done' : 'cloud_off'}
                    </span>
                    <span>{connectedSources}개 연결</span>
                </div>

                {showRefreshButton && (
                    <button
                        onClick={refreshData}
                        disabled={isLoading}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        title="데이터 새로고침"
                    >
                        <span className={`material-icons-outlined text-sm text-gray-500 ${isLoading ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                    </button>
                )}
            </div>
        );
    }

    // 전체 상태 표시
    return (
        <div className="bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center">
                    <span className="material-icons-outlined mr-2 text-blue-500">storage</span>
                    데이터 소스 상태
                </h4>
                {showRefreshButton && (
                    <button
                        onClick={refreshData}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded transition-colors disabled:opacity-50"
                    >
                        <span className={`material-icons-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                        {isLoading ? '로딩 중...' : '새로고침'}
                    </button>
                )}
            </div>

            {!hasConfiguration && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                    <span className="material-icons-outlined text-sm mr-1 align-middle">warning</span>
                    데이터 소스가 설정되지 않았습니다. 설정에서 데이터 소스를 연결해주세요.
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400 mb-3">
                    <span className="material-icons-outlined text-sm mr-1 align-middle">error</span>
                    {error}
                </div>
            )}

            {/* 데이터 요약 */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <DataCountCard
                        label="식단표"
                        count={data.mealPlan.length}
                        icon="restaurant_menu"
                        status={data.sourceStatus.mealPlan}
                    />
                    <DataCountCard
                        label="판매실적"
                        count={data.sales.length}
                        icon="point_of_sale"
                        status={data.sourceStatus.salesHistory}
                    />
                    <DataCountCard
                        label="BOM (SAN)"
                        count={data.bomSan.length}
                        icon="receipt_long"
                        status={data.sourceStatus.bomSan}
                    />
                    <DataCountCard
                        label="BOM (ZIP)"
                        count={data.bomZip.length}
                        icon="receipt_long"
                        status={data.sourceStatus.bomZip}
                    />
                    <DataCountCard
                        label="재고현황"
                        count={data.inventory.length}
                        icon="inventory_2"
                        status={data.sourceStatus.inventory}
                    />
                    <DataCountCard
                        label="구매현황"
                        count={data.purchaseHistory.length}
                        icon="shopping_cart"
                        status={data.sourceStatus.purchaseHistory}
                    />
                    <DataCountCard
                        label="발주현황"
                        count={data.purchaseOrders.length}
                        icon="local_shipping"
                        status={data.sourceStatus.purchaseOrders}
                    />
                </div>
            )}

            {lastUpdated && (
                <p className="text-xs text-gray-400 text-right">
                    마지막 업데이트: {new Date(lastUpdated).toLocaleString('ko-KR')}
                </p>
            )}
        </div>
    );
};

// 데이터 카운트 카드
const DataCountCard: React.FC<{
    label: string;
    count: number;
    icon: string;
    status?: { loaded: boolean; rowCount: number; error?: string };
}> = ({ label, count, icon, status }) => {
    const isLoaded = status?.loaded ?? count > 0;
    const hasError = !!status?.error;

    return (
        <div
            className={`p-2 rounded-lg border ${
                hasError
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : isLoaded
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
            }`}
            title={status?.error || `${count}건 로드됨`}
        >
            <div className="flex items-center gap-2">
                <span
                    className={`material-icons-outlined text-sm ${
                        hasError
                            ? 'text-red-500'
                            : isLoaded
                            ? 'text-green-500'
                            : 'text-gray-400'
                    }`}
                >
                    {hasError ? 'error' : isLoaded ? 'check_circle' : icon}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                    <p className={`text-sm font-semibold ${
                        hasError
                            ? 'text-red-600 dark:text-red-400'
                            : isLoaded
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400'
                    }`}>
                        {hasError ? '오류' : `${count}건`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DataSourceStatus;
