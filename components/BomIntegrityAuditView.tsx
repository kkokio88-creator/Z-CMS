import React, { useState, useMemo } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, Legend, ReferenceLine
} from 'recharts';
import {
    BomYieldAnalysisItem,
    InventoryDiscrepancyItem,
    AnomalyLevel
} from '../types';

interface Props {
    yieldData?: BomYieldAnalysisItem[];
    discrepancyData?: InventoryDiscrepancyItem[];
    onItemClick?: (item: BomYieldAnalysisItem | InventoryDiscrepancyItem) => void;
}

const BomIntegrityAuditView: React.FC<Props> = ({
    yieldData = [],
    discrepancyData = [],
    onItemClick
}) => {
    const [activeTab, setActiveTab] = useState<'yield' | 'discrepancy'>('yield');
    const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all');

    // KPI 계산
    const kpis = useMemo(() => {
        const criticalYield = yieldData.filter(y => y.anomalyLevel === 'critical').length;
        const warningYield = yieldData.filter(y => y.anomalyLevel === 'warning').length;
        const avgYieldGap = yieldData.length > 0
            ? yieldData.reduce((sum, y) => sum + Math.abs(y.yieldGap), 0) / yieldData.length
            : 0;

        const criticalDisc = discrepancyData.filter(d => Math.abs(d.discrepancyRate) > 10).length;
        const pendingActions = discrepancyData.filter(d => d.actionStatus === 'pending').length;
        const avgDiscrepancy = discrepancyData.length > 0
            ? discrepancyData.reduce((sum, d) => sum + Math.abs(d.discrepancyRate), 0) / discrepancyData.length
            : 0;

        const maxYieldItem = yieldData.reduce((max, y) =>
            Math.abs(y.yieldGap) > Math.abs(max?.yieldGap || 0) ? y : max, yieldData[0]);

        return {
            criticalYield,
            warningYield,
            avgYieldGap,
            criticalDisc,
            pendingActions,
            avgDiscrepancy,
            maxYieldItem
        };
    }, [yieldData, discrepancyData]);

    // 필터링된 데이터
    const filteredYield = useMemo(() => {
        if (filter === 'all') return yieldData;
        return yieldData.filter(y => y.anomalyLevel === filter);
    }, [yieldData, filter]);

    const filteredDiscrepancy = useMemo(() => {
        if (filter === 'all') return discrepancyData;
        if (filter === 'critical') return discrepancyData.filter(d => Math.abs(d.discrepancyRate) > 10);
        if (filter === 'warning') return discrepancyData.filter(d => Math.abs(d.discrepancyRate) > 5 && Math.abs(d.discrepancyRate) <= 10);
        return discrepancyData;
    }, [discrepancyData, filter]);

    // 색상 헬퍼
    const getAnomalyColor = (level: AnomalyLevel): string => {
        switch (level) {
            case 'critical': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#10B981';
        }
    };

    const getAnomalyBadgeClass = (level: AnomalyLevel): string => {
        switch (level) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'warning': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        }
    };

    const getDiscrepancyColor = (rate: number): string => {
        const absRate = Math.abs(rate);
        if (absRate > 15) return '#EF4444';
        if (absRate > 10) return '#F59E0B';
        if (absRate > 5) return '#FBBF24';
        return '#10B981';
    };

    // Scatter 데이터 변환
    const scatterData = discrepancyData.map(d => ({
        x: d.transactionQty,
        y: d.physicalQty,
        z: Math.abs(d.discrepancyRate),
        name: d.materialName,
        rate: d.discrepancyRate,
        original: d
    }));

    // Bar 차트 데이터 (Yield)
    const yieldChartData = filteredYield.slice(0, 10).map(y => ({
        name: y.productName.length > 10 ? y.productName.slice(0, 10) + '...' : y.productName,
        stdYield: y.stdYield,
        actualYield: y.actualYield,
        gap: y.yieldGap,
        level: y.anomalyLevel,
        original: y
    }));

    return (
        <div className="p-6 space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        재고 및 BOM 정합성 검토
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        실사 재고와 전표 데이터 간 괴리율, BOM 대비 실제 Yield 분석
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                    >
                        <option value="all">전체</option>
                        <option value="warning">주의</option>
                        <option value="critical">심각</option>
                    </select>
                </div>
            </div>

            {/* KPI 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">심각 이상 항목</span>
                        <span className="material-icons-outlined text-red-500">error</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.criticalYield + kpis.criticalDisc}건
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Yield {kpis.criticalYield} + 괴리 {kpis.criticalDisc}</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">평균 Yield 차이</span>
                        <span className="material-icons-outlined text-orange-500">trending_down</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.avgYieldGap.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">목표 대비 실제 수율 차이</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">평균 괴리율</span>
                        <span className="material-icons-outlined text-blue-500">compare_arrows</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.avgDiscrepancy.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">전표 vs 실사 차이</p>
                </div>

                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">조치 대기</span>
                        <span className="material-icons-outlined text-yellow-500">pending_actions</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {kpis.pendingActions}건
                    </p>
                    <p className="text-xs text-gray-500 mt-1">조사/수정 필요</p>
                </div>
            </div>

            {/* 탭 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('yield')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'yield'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    BOM Yield 분석
                </button>
                <button
                    onClick={() => setActiveTab('discrepancy')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'discrepancy'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    재고 괴리 분석
                </button>
            </div>

            {/* 차트 영역 */}
            {activeTab === 'yield' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Yield 비교 차트 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            제품별 Yield 비교 (표준 vs 실제)
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={yieldChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(value: number) => `${value.toFixed(1)}%`}
                                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <ReferenceLine x={100} stroke="#9CA3AF" strokeDasharray="3 3" />
                                    <Bar dataKey="stdYield" name="표준 수율" fill="#94A3B8" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="actualYield" name="실제 수율" radius={[0, 4, 4, 0]}>
                                        {yieldChartData.map((entry, index) => (
                                            <Cell key={index} fill={getAnomalyColor(entry.level)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Yield 상세 테이블 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            Yield 이상 항목 상세
                        </h3>
                        <div className="overflow-x-auto max-h-80">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">제품</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">표준</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">실제</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">차이</th>
                                        <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">상태</th>
                                        <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">조치</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredYield.slice(0, 10).map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                            onClick={() => onItemClick?.(item)}
                                        >
                                            <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                                                {item.productName}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                {item.stdYield.toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                {item.actualYield.toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={item.yieldGap < 0 ? 'text-red-600' : 'text-green-600'}>
                                                    {item.yieldGap > 0 ? '+' : ''}{item.yieldGap.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs ${getAnomalyBadgeClass(item.anomalyLevel)}`}>
                                                    {item.anomalyLevel === 'critical' ? '심각' : item.anomalyLevel === 'warning' ? '주의' : '정상'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                    상세
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 괴리 Scatter 차트 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            전표 수량 vs 실사 수량 (괴리 시각화)
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        name="전표 수량"
                                        tick={{ fontSize: 11 }}
                                        label={{ value: '전표 수량', position: 'bottom', fontSize: 12 }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="실사 수량"
                                        tick={{ fontSize: 11 }}
                                        label={{ value: '실사 수량', angle: -90, position: 'left', fontSize: 12 }}
                                    />
                                    <ZAxis type="number" dataKey="z" range={[50, 400]} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-gray-900 text-white text-xs rounded p-2">
                                                        <p className="font-semibold">{data.name}</p>
                                                        <p>전표: {data.x.toLocaleString()}</p>
                                                        <p>실사: {data.y.toLocaleString()}</p>
                                                        <p>괴리율: {data.rate.toFixed(1)}%</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <ReferenceLine
                                        segment={[{ x: 0, y: 0 }, { x: Math.max(...scatterData.map(d => d.x)), y: Math.max(...scatterData.map(d => d.x)) }]}
                                        stroke="#9CA3AF"
                                        strokeDasharray="5 5"
                                        label="일치선"
                                    />
                                    <Scatter
                                        data={scatterData}
                                        onClick={(data) => onItemClick?.(data.original)}
                                    >
                                        {scatterData.map((entry, index) => (
                                            <Cell
                                                key={index}
                                                fill={getDiscrepancyColor(entry.rate)}
                                                cursor="pointer"
                                            />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            점선 위: 실사 &gt; 전표 (과잉) | 점선 아래: 실사 &lt; 전표 (부족)
                        </p>
                    </div>

                    {/* 괴리 상세 테이블 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                            재고 괴리 항목 상세
                        </h3>
                        <div className="overflow-x-auto max-h-80">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">자재</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">전표</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">실사</th>
                                        <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">괴리율</th>
                                        <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">상태</th>
                                        <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">조치</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredDiscrepancy.slice(0, 10).map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                            onClick={() => onItemClick?.(item)}
                                        >
                                            <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                                                {item.materialName}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                {item.transactionQty.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                                {item.physicalQty.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span
                                                    className="px-2 py-1 rounded text-xs text-white"
                                                    style={{ backgroundColor: getDiscrepancyColor(item.discrepancyRate) }}
                                                >
                                                    {item.discrepancyRate > 0 ? '+' : ''}{item.discrepancyRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                    item.actionStatus === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                        : item.actionStatus === 'investigating'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                }`}>
                                                    {item.actionStatus === 'pending' ? '대기' : item.actionStatus === 'investigating' ? '조사중' : '완료'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center space-x-1">
                                                <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                    수정
                                                </button>
                                                <button className="text-orange-600 hover:text-orange-800 text-xs">
                                                    조사
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 최대 이상 항목 경고 배너 */}
            {kpis.maxYieldItem && kpis.maxYieldItem.anomalyLevel === 'critical' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <span className="material-icons-outlined text-red-500">warning</span>
                        <div>
                            <p className="font-semibold text-red-800 dark:text-red-200">
                                최대 Yield 이상 항목 감지
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300">
                                {kpis.maxYieldItem.productName}: 표준 대비 {Math.abs(kpis.maxYieldItem.yieldGap).toFixed(1)}% 차이 발생.
                                즉각적인 로스 원인 파악이 필요합니다.
                            </p>
                        </div>
                        <button
                            onClick={() => onItemClick?.(kpis.maxYieldItem!)}
                            className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                        >
                            상세 분석
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BomIntegrityAuditView;
