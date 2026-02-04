import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, RadialBarChart, RadialBar, Legend,
    ComposedChart, Bar, ReferenceLine
} from 'recharts';
import { DailyPerformanceMetric, PerformanceStatus, StaffingSuggestion } from '../types';

interface Props {
    data?: DailyPerformanceMetric[];
    staffingSuggestions?: StaffingSuggestion[];
    targets?: {
        laborRatio: number;
        materialRatio: number;
    };
}

const DailyPerformanceView: React.FC<Props> = ({
    data = [],
    staffingSuggestions = [],
    targets = { laborRatio: 25, materialRatio: 45 }
}) => {
    const [viewMode, setViewMode] = useState<'today' | 'trend'>('today');

    // 오늘 데이터
    const todayData = useMemo(() => {
        if (data.length === 0) return null;
        return data[data.length - 1];
    }, [data]);

    // KPI 계산
    const kpis = useMemo(() => {
        if (data.length === 0) {
            return {
                avgLaborRatio: targets.laborRatio,
                avgMaterialRatio: targets.materialRatio,
                avgEfficiency: 100,
                onTargetDays: 0,
                totalDays: 0,
                laborTrend: 'stable' as const,
                materialTrend: 'stable' as const
            };
        }

        const avgLaborRatio = data.reduce((sum, d) => sum + d.actualLaborRatio, 0) / data.length;
        const avgMaterialRatio = data.reduce((sum, d) => sum + d.actualMaterialRatio, 0) / data.length;
        const avgEfficiency = data.reduce((sum, d) => sum + d.efficiency, 0) / data.length;
        const onTargetDays = data.filter(d => d.overallStatus === 'on-target').length;

        // 추세 계산 (최근 3일 vs 이전 3일)
        const recent = data.slice(-3);
        const previous = data.slice(-6, -3);

        const recentAvgLabor = recent.reduce((s, d) => s + d.actualLaborRatio, 0) / (recent.length || 1);
        const prevAvgLabor = previous.reduce((s, d) => s + d.actualLaborRatio, 0) / (previous.length || 1);
        const laborTrend = recentAvgLabor > prevAvgLabor + 2 ? 'up' : recentAvgLabor < prevAvgLabor - 2 ? 'down' : 'stable';

        const recentAvgMaterial = recent.reduce((s, d) => s + d.actualMaterialRatio, 0) / (recent.length || 1);
        const prevAvgMaterial = previous.reduce((s, d) => s + d.actualMaterialRatio, 0) / (previous.length || 1);
        const materialTrend = recentAvgMaterial > prevAvgMaterial + 2 ? 'up' : recentAvgMaterial < prevAvgMaterial - 2 ? 'down' : 'stable';

        return {
            avgLaborRatio,
            avgMaterialRatio,
            avgEfficiency,
            onTargetDays,
            totalDays: data.length,
            laborTrend,
            materialTrend
        };
    }, [data, targets]);

    // 게이지 색상
    const getGaugeColor = (actual: number, target: number): string => {
        const ratio = actual / target;
        if (ratio > 1.1) return '#EF4444'; // 초과 (나쁨)
        if (ratio > 1.05) return '#F59E0B'; // 주의
        if (ratio < 0.9) return '#10B981'; // 절감 (좋음)
        return '#3B82F6'; // 정상
    };

    // 상태 색상
    const getStatusColor = (status: PerformanceStatus): string => {
        switch (status) {
            case 'above-target': return '#EF4444';
            case 'below-target': return '#10B981';
            default: return '#3B82F6';
        }
    };

    const getStatusBadgeClass = (status: PerformanceStatus): string => {
        switch (status) {
            case 'above-target': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'below-target': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
    };

    const getStatusText = (status: PerformanceStatus): string => {
        switch (status) {
            case 'above-target': return '초과';
            case 'below-target': return '절감';
            default: return '목표달성';
        }
    };

    // 게이지 데이터
    const laborGaugeData = [{
        name: '노무비율',
        value: todayData?.actualLaborRatio || 0,
        target: targets.laborRatio,
        fill: getGaugeColor(todayData?.actualLaborRatio || 0, targets.laborRatio)
    }];

    const materialGaugeData = [{
        name: '원재료비율',
        value: todayData?.actualMaterialRatio || 0,
        target: targets.materialRatio,
        fill: getGaugeColor(todayData?.actualMaterialRatio || 0, targets.materialRatio)
    }];

    // 추세 차트 데이터
    const trendChartData = data.map(d => ({
        date: d.date.slice(5), // MM-DD
        day: d.dayOfWeek,
        laborRatio: d.actualLaborRatio,
        materialRatio: d.actualMaterialRatio,
        laborTarget: d.targetLaborRatio,
        materialTarget: d.targetMaterialRatio,
        efficiency: d.efficiency,
        original: d
    }));

    // 일별 효율 바 차트 데이터
    const efficiencyBarData = data.slice(-7).map(d => ({
        date: d.date.slice(5),
        day: d.dayOfWeek,
        efficiency: d.efficiency,
        status: d.overallStatus
    }));

    return (
        <div className="p-6 space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        목표 대비 일일 달성률
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        노무비율 및 원재료비율 실시간 KPI 모니터링
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('today')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                viewMode === 'today'
                                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            오늘
                        </button>
                        <button
                            onClick={() => setViewMode('trend')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                viewMode === 'trend'
                                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            추세
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">평균 노무비율</span>
                        <span className={`material-icons-outlined ${kpis.laborTrend === 'up' ? 'text-red-500' : kpis.laborTrend === 'down' ? 'text-green-500' : 'text-gray-400'}`}>
                            {kpis.laborTrend === 'up' ? 'trending_up' : kpis.laborTrend === 'down' ? 'trending_down' : 'trending_flat'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.avgLaborRatio.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">목표: {targets.laborRatio}%</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">평균 원재료비율</span>
                        <span className={`material-icons-outlined ${kpis.materialTrend === 'up' ? 'text-red-500' : kpis.materialTrend === 'down' ? 'text-green-500' : 'text-gray-400'}`}>
                            {kpis.materialTrend === 'up' ? 'trending_up' : kpis.materialTrend === 'down' ? 'trending_down' : 'trending_flat'}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.avgMaterialRatio.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">목표: {targets.materialRatio}%</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">평균 효율</span>
                        <span className="material-icons-outlined text-blue-500">speed</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.avgEfficiency.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">생산 효율성</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">목표 달성일</span>
                        <span className="material-icons-outlined text-green-500">check_circle</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.onTargetDays}/{kpis.totalDays}일
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        달성률 {kpis.totalDays > 0 ? ((kpis.onTargetDays / kpis.totalDays) * 100).toFixed(0) : 0}%
                    </p>
                </div>
            </div>

            {viewMode === 'today' ? (
                <>
                    {/* 게이지 차트 영역 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 노무비율 게이지 */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 text-center">
                                오늘의 노무비율
                            </h3>
                            <div className="h-64 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart
                                        innerRadius="60%"
                                        outerRadius="100%"
                                        data={laborGaugeData}
                                        startAngle={180}
                                        endAngle={0}
                                    >
                                        <RadialBar
                                            dataKey="value"
                                            cornerRadius={10}
                                            background={{ fill: '#E5E7EB' }}
                                        />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                                    <p className="text-4xl font-bold" style={{ color: laborGaugeData[0].fill }}>
                                        {todayData?.actualLaborRatio.toFixed(1) || 0}%
                                    </p>
                                    <p className="text-sm text-gray-500">목표: {targets.laborRatio}%</p>
                                    {todayData && (
                                        <span className={`mt-2 px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(todayData.laborStatus)}`}>
                                            {getStatusText(todayData.laborStatus)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                노무비: ₩{(todayData?.laborCost || 0).toLocaleString()}
                            </div>
                        </div>

                        {/* 원재료비율 게이지 */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 text-center">
                                오늘의 원재료비율
                            </h3>
                            <div className="h-64 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart
                                        innerRadius="60%"
                                        outerRadius="100%"
                                        data={materialGaugeData}
                                        startAngle={180}
                                        endAngle={0}
                                    >
                                        <RadialBar
                                            dataKey="value"
                                            cornerRadius={10}
                                            background={{ fill: '#E5E7EB' }}
                                        />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                                    <p className="text-4xl font-bold" style={{ color: materialGaugeData[0].fill }}>
                                        {todayData?.actualMaterialRatio.toFixed(1) || 0}%
                                    </p>
                                    <p className="text-sm text-gray-500">목표: {targets.materialRatio}%</p>
                                    {todayData && (
                                        <span className={`mt-2 px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(todayData.materialStatus)}`}>
                                            {getStatusText(todayData.materialStatus)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                원재료비: ₩{(todayData?.materialCost || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* 오늘 상세 정보 */}
                    {todayData && (
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                                오늘의 생산 현황 ({todayData.date} {todayData.dayOfWeek}요일)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="text-sm text-gray-500">생산량</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {todayData.productionQty.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-400">목표: {todayData.productionTarget.toLocaleString()}</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="text-sm text-gray-500">생산 달성률</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {todayData.productionAchievement}%
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="text-sm text-gray-500">노무비 차이</p>
                                    <p className={`text-xl font-bold ${todayData.laborVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {todayData.laborVariance > 0 ? '+' : ''}{todayData.laborVariance.toFixed(1)}%
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="text-sm text-gray-500">원재료비 차이</p>
                                    <p className={`text-xl font-bold ${todayData.materialVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {todayData.materialVariance > 0 ? '+' : ''}{todayData.materialVariance.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* 추세 차트 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 비율 추세 */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                                노무비율 / 원재료비율 추세
                            </h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                                            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        <ReferenceLine y={targets.laborRatio} stroke="#94A3B8" strokeDasharray="3 3" />
                                        <ReferenceLine y={targets.materialRatio} stroke="#94A3B8" strokeDasharray="3 3" />
                                        <Line
                                            type="monotone"
                                            dataKey="laborRatio"
                                            name="노무비율"
                                            stroke="#3B82F6"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="materialRatio"
                                            name="원재료비율"
                                            stroke="#10B981"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 일별 효율 */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                                일별 생산 효율
                            </h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={efficiencyBarData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 120]} />
                                        <Tooltip
                                            formatter={(value: number) => [`${value}%`, '효율']}
                                            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff' }}
                                        />
                                        <ReferenceLine y={100} stroke="#9CA3AF" strokeDasharray="5 5" label="목표" />
                                        <Bar dataKey="efficiency" name="효율" radius={[4, 4, 0, 0]}>
                                            {efficiencyBarData.map((entry, index) => (
                                                <cell key={index} fill={getStatusColor(entry.status)} />
                                            ))}
                                        </Bar>
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* 일별 상세 테이블 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            일별 성과 상세
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">날짜</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">생산량</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">노무비율</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">원재료비율</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">효율</th>
                                        <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {data.slice(-7).reverse().map((item) => (
                                        <tr key={item.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                                                {item.date} ({item.dayOfWeek})
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                {item.productionQty.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={item.actualLaborRatio > targets.laborRatio ? 'text-red-600' : 'text-green-600'}>
                                                    {item.actualLaborRatio.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={item.actualMaterialRatio > targets.materialRatio ? 'text-red-600' : 'text-green-600'}>
                                                    {item.actualMaterialRatio.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-900 dark:text-white">
                                                {item.efficiency}%
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(item.overallStatus)}`}>
                                                    {getStatusText(item.overallStatus)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* 인력 배치 제안 */}
            {staffingSuggestions.length > 0 && (
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <span className="material-icons-outlined text-blue-500">people</span>
                        익일 인력 배치 제안
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {staffingSuggestions.map((suggestion, idx) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border ${
                                    suggestion.priority === 'high'
                                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                        : suggestion.priority === 'medium'
                                            ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                                            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {suggestion.department}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        suggestion.priority === 'high'
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            : suggestion.priority === 'medium'
                                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }`}>
                                        {suggestion.priority === 'high' ? '긴급' : suggestion.priority === 'medium' ? '권장' : '참고'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    {suggestion.reason}
                                </p>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-500">현재:</span>
                                    <span className="font-medium">{suggestion.currentHeadcount}명</span>
                                    <span className="material-icons-outlined text-gray-400 text-sm">arrow_forward</span>
                                    <span className="text-gray-500">권장:</span>
                                    <span className={`font-medium ${
                                        suggestion.suggestedHeadcount > suggestion.currentHeadcount
                                            ? 'text-blue-600'
                                            : 'text-green-600'
                                    }`}>
                                        {suggestion.suggestedHeadcount}명
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyPerformanceView;
