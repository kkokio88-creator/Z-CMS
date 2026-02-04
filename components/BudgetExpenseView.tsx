import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { BudgetItem, ExpenseSummary, BudgetStatus, BudgetAlert } from '../types';

interface Props {
    budgets?: BudgetItem[];
    summary?: ExpenseSummary | null;
    alerts?: BudgetAlert[];
    onItemClick?: (item: BudgetItem) => void;
}

const BudgetExpenseView: React.FC<Props> = ({
    budgets = [],
    summary = null,
    alerts = [],
    onItemClick
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'fixed' | 'variable'>('all');

    // 필터링된 예산 항목
    const filteredBudgets = useMemo(() => {
        if (categoryFilter === 'all') return budgets;
        return budgets.filter(b => b.category === categoryFilter);
    }, [budgets, categoryFilter]);

    // 고정비/변동비 파이 차트 데이터
    const pieChartData = useMemo(() => {
        if (!summary) return [];
        return [
            { name: '고정비', value: summary.fixedCostUsed, color: '#3B82F6' },
            { name: '변동비', value: summary.variableCostUsed, color: '#10B981' },
            { name: '잔액', value: summary.totalRemaining, color: '#E5E7EB' }
        ];
    }, [summary]);

    // 업체별 예산 소진 바 차트 데이터
    const barChartData = useMemo(() => {
        return filteredBudgets.slice(0, 8).map(b => ({
            name: b.accountName.length > 8 ? b.accountName.slice(0, 8) + '...' : b.accountName,
            fullName: b.accountName,
            used: b.usedAmount,
            remaining: b.remainingAmount,
            budget: b.budgetAmount,
            burnRate: b.burnRate,
            status: b.status,
            original: b
        }));
    }, [filteredBudgets]);

    // 색상 헬퍼
    const getStatusColor = (status: BudgetStatus): string => {
        switch (status) {
            case 'critical': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#10B981';
        }
    };

    const getStatusBadgeClass = (status: BudgetStatus): string => {
        switch (status) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'warning': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        }
    };

    const getStatusText = (status: BudgetStatus): string => {
        switch (status) {
            case 'critical': return '초과위험';
            case 'warning': return '주의';
            default: return '정상';
        }
    };

    const formatCurrency = (value: number): string => {
        if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
        if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
        return value.toLocaleString();
    };

    // 건전성 점수 색상
    const getHealthColor = (score: number): string => {
        if (score >= 80) return '#10B981';
        if (score >= 60) return '#F59E0B';
        return '#EF4444';
    };

    return (
        <div className="p-6 space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        경비 및 예산 관리
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {summary?.period || '이번 달'} 예산 대비 사용액 현황 및 Burn Rate 분석
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as any)}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                    >
                        <option value="all">전체</option>
                        <option value="fixed">고정비</option>
                        <option value="variable">변동비</option>
                    </select>
                </div>
            </div>

            {/* 경고 알림 배너 */}
            {summary?.overrunRisk && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <span className="material-icons-outlined text-red-500 text-2xl">warning</span>
                        <div className="flex-1">
                            <p className="font-semibold text-red-800 dark:text-red-200">
                                예산 초과 위험 감지
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300">
                                현재 소진율로 예측 시 월말까지 ₩{formatCurrency(summary.projectedMonthEnd - summary.totalBudget)} 초과 예상됩니다.
                            </p>
                        </div>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                            예산 재배정
                        </button>
                    </div>
                </div>
            )}

            {/* 개별 경고 알림 */}
            {alerts.filter(a => !a.acknowledged).slice(0, 3).map(alert => (
                <div
                    key={alert.id}
                    className={`border rounded-lg p-3 ${
                        alert.severity === 'critical'
                            ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                            : 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`material-icons-outlined text-sm ${
                            alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                        }`}>
                            {alert.alertType === 'exceeded' ? 'error' : 'warning'}
                        </span>
                        <span className={`text-sm ${
                            alert.severity === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
                        }`}>
                            {alert.message}
                        </span>
                    </div>
                </div>
            ))}

            {/* KPI 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">총 예산</span>
                        <span className="material-icons-outlined text-blue-500">account_balance_wallet</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        ₩{formatCurrency(summary?.totalBudget || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{summary?.period}</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">사용액</span>
                        <span className="material-icons-outlined text-orange-500">payments</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        ₩{formatCurrency(summary?.totalUsed || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        소진율 {summary?.overallBurnRate.toFixed(1) || 0}%
                    </p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">잔액</span>
                        <span className="material-icons-outlined text-green-500">savings</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        ₩{formatCurrency(summary?.totalRemaining || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        잔여 {(100 - (summary?.overallBurnRate || 0)).toFixed(1)}%
                    </p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">월말 예상</span>
                        <span className="material-icons-outlined text-purple-500">trending_up</span>
                    </div>
                    <p className={`text-2xl font-bold mt-2 ${
                        (summary?.projectedMonthEnd || 0) > (summary?.totalBudget || 0)
                            ? 'text-red-600'
                            : 'text-gray-900 dark:text-white'
                    }`}>
                        ₩{formatCurrency(summary?.projectedMonthEnd || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">예상 총액</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">건전성 점수</span>
                        <span className="material-icons-outlined" style={{ color: getHealthColor(summary?.healthScore || 0) }}>
                            health_and_safety
                        </span>
                    </div>
                    <p className="text-2xl font-bold mt-2" style={{ color: getHealthColor(summary?.healthScore || 0) }}>
                        {summary?.healthScore || 0}점
                    </p>
                    <p className="text-xs text-gray-500 mt-1">100점 만점</p>
                </div>
            </div>

            {/* 탭 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'overview'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    개요
                </button>
                <button
                    onClick={() => setActiveTab('detail')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'detail'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    항목별 상세
                </button>
            </div>

            {activeTab === 'overview' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 고정비/변동비 파이 차트 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            비용 구성 (고정비 vs 변동비)
                        </h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-xs text-blue-600 dark:text-blue-400">고정비</p>
                                <p className="font-semibold text-blue-800 dark:text-blue-200">
                                    ₩{formatCurrency(summary?.fixedCostUsed || 0)}
                                </p>
                            </div>
                            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-xs text-green-600 dark:text-green-400">변동비</p>
                                <p className="font-semibold text-green-800 dark:text-green-200">
                                    ₩{formatCurrency(summary?.variableCostUsed || 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 항목별 예산 소진 바 차트 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            항목별 예산 소진 현황
                        </h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" tickFormatter={(v) => `₩${formatCurrency(v)}`} />
                                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-gray-900 text-white text-xs rounded p-2">
                                                        <p className="font-semibold">{data.fullName}</p>
                                                        <p>예산: ₩{formatCurrency(data.budget)}</p>
                                                        <p>사용: ₩{formatCurrency(data.used)}</p>
                                                        <p>소진율: {data.burnRate.toFixed(1)}%</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar
                                        dataKey="used"
                                        stackId="a"
                                        name="사용액"
                                        radius={[0, 0, 0, 0]}
                                        onClick={(data) => onItemClick?.(data.original)}
                                        cursor="pointer"
                                    >
                                        {barChartData.map((entry, index) => (
                                            <Cell key={index} fill={getStatusColor(entry.status)} />
                                        ))}
                                    </Bar>
                                    <Bar
                                        dataKey="remaining"
                                        stackId="a"
                                        name="잔액"
                                        fill="#E5E7EB"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                /* 항목별 상세 테이블 */
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300">계정과목</th>
                                    <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">구분</th>
                                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">예산</th>
                                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">사용액</th>
                                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">잔액</th>
                                    <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">소진율</th>
                                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">월말 예상</th>
                                    <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredBudgets.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                                            item.status === 'critical' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                                        }`}
                                        onClick={() => onItemClick?.(item)}
                                    >
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {item.accountName}
                                                </p>
                                                {item.vendorName && (
                                                    <p className="text-xs text-gray-500">{item.vendorName}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                item.category === 'fixed'
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            }`}>
                                                {item.category === 'fixed' ? '고정' : '변동'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                                            ₩{formatCurrency(item.budgetAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                            ₩{formatCurrency(item.usedAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                                            ₩{formatCurrency(item.remainingAmount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${Math.min(100, item.burnRate)}%`,
                                                            backgroundColor: getStatusColor(item.status)
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600 dark:text-gray-400 w-12">
                                                    {item.burnRate.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={item.projectedOverrun > 0 ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                                                ₩{formatCurrency(item.projectedTotal)}
                                            </span>
                                            {item.projectedOverrun > 0 && (
                                                <p className="text-xs text-red-500">
                                                    +₩{formatCurrency(item.projectedOverrun)}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(item.status)}`}>
                                                {getStatusText(item.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 권장 조치 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons-outlined text-blue-500">swap_horiz</span>
                        <span className="font-semibold text-blue-800 dark:text-blue-200">예산 재배정</span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                        여유 있는 항목에서 초과 예상 항목으로 예산을 재배정할 수 있습니다.
                    </p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons-outlined text-orange-500">content_cut</span>
                        <span className="font-semibold text-orange-800 dark:text-orange-200">불필요 지출 통제</span>
                    </div>
                    <p className="text-sm text-orange-600 dark:text-orange-300">
                        소진율이 높은 항목의 추가 지출을 제한해보세요.
                    </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons-outlined text-green-500">schedule</span>
                        <span className="font-semibold text-green-800 dark:text-green-200">결산 전 점검</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-300">
                        월말 결산 전 잔액 현황을 점검하고 이월 계획을 세워보세요.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BudgetExpenseView;
