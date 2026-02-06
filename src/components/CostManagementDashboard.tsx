import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
  Treemap,
} from 'recharts';
import {
  fetchPurchaseOrders,
  fetchInventoryByLocation,
  fetchAttendanceRecords,
  calculateCostAnalysis,
  fetchAgentInsights,
  PurchaseOrderData,
  InventoryByLocation,
  AttendanceRecord,
  CostAnalysisSummary,
  AgentInsight,
  formatCurrency,
} from '../services/costManagementService';

const COLORS = ['#3B82F6', '#F97316', '#8B5CF6', '#14B8A6', '#EF4444', '#FBBF24', '#EC4899'];

interface DataStatus {
  purchaseOrders: boolean;
  inventory: boolean;
  attendance: boolean;
}

export const CostManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'labor' | 'insights'>(
    'overview'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    purchaseOrders: false,
    inventory: false,
    attendance: false,
  });

  // Data state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData[]>([]);
  const [inventory, setInventory] = useState<InventoryByLocation[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [costSummary, setCostSummary] = useState<CostAnalysisSummary | null>(null);
  const [insights, setInsights] = useState<AgentInsight[]>([]);

  const loadAllData = async () => {
    setIsLoading(true);

    // Fetch all data in parallel
    const [poData, invData, attData, insightData] = await Promise.all([
      fetchPurchaseOrders(),
      fetchInventoryByLocation(),
      fetchAttendanceRecords(),
      fetchAgentInsights(),
    ]);

    // 디버깅: 로드된 데이터 로그
    console.log('[CostManagement] 데이터 로드 완료:', {
      purchaseOrders: poData.length,
      inventory: invData.length,
      attendance: attData.length,
      insights: insightData.length,
    });

    setPurchaseOrders(poData);
    setInventory(invData);
    setAttendance(attData);
    setInsights(insightData);

    // Update data status
    const newDataStatus = {
      purchaseOrders: poData.length > 0,
      inventory: invData.length > 0,
      attendance: attData.length > 0,
    };
    setDataStatus(newDataStatus);

    // Calculate summary - 데이터가 있으면 실제 데이터 기반 Summary 생성
    if (poData.length > 0 || invData.length > 0 || attData.length > 0) {
      const summary = calculateCostAnalysis(poData, invData, attData);
      console.log('[CostManagement] Summary 계산 완료:', {
        totalLaborCost: summary.totalLaborCost,
        totalInventoryValue: summary.totalInventoryValue,
        laborDepts: summary.laborByDepartment.length,
        warehouses: summary.costByWarehouse.length,
      });
      setCostSummary(summary);
    } else {
      console.log('[CostManagement] 실제 데이터 없음 - Mock 데이터 사용');
      setCostSummary(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Generate mock data if no ECOUNT data available
  // 노무비 계산 기준:
  // - 생산직 시간당 임금: 13,000원
  // - 초과근무 수당: 1.5배
  // - 야간/휴일 수당: 2배
  const getMockSummary = (): CostAnalysisSummary => {
    // 부서별 근무시간 및 노무비 (급여 마스터 기반 계산)
    const laborData = [
      {
        department: '생산1팀',
        workers: 15,
        baseHours: 8 * 22, // 월 22일 근무
        overtimeHours: 45,
        hourlyWage: 13000,
      },
      {
        department: '생산2팀',
        workers: 12,
        baseHours: 8 * 22,
        overtimeHours: 38,
        hourlyWage: 13000,
      },
      {
        department: '품질관리',
        workers: 5,
        baseHours: 8 * 22,
        overtimeHours: 15,
        hourlyWage: 15000, // 대리급 평균
      },
      {
        department: '물류',
        workers: 3,
        baseHours: 8 * 22,
        overtimeHours: 10,
        hourlyWage: 13000,
      },
    ];

    const laborByDepartment = laborData.map(dept => {
      const baseCost = dept.workers * dept.baseHours * dept.hourlyWage;
      const overtimeCost = dept.workers * dept.overtimeHours * dept.hourlyWage * 1.5;
      return {
        department: dept.department,
        hours: dept.workers * (dept.baseHours + dept.overtimeHours),
        cost: baseCost + overtimeCost,
      };
    });

    const totalLaborCost = laborByDepartment.reduce((sum, d) => sum + d.cost, 0);
    const totalOvertimeHours = laborData.reduce((sum, d) => sum + d.workers * d.overtimeHours, 0);
    const totalWorkers = laborData.reduce((sum, d) => sum + d.workers, 0);

    return {
      totalPurchaseAmount: 125000000,
      totalInventoryValue: 85000000,
      totalLaborCost,
      totalOvertimeHours,
      avgOvertimePerEmployee: totalOvertimeHours / totalWorkers,
      urgentOrderRatio: 15.5,
      topSuppliers: [
        { name: 'ABC 원자재', amount: 45000000 },
        { name: 'XYZ 부품', amount: 32000000 },
        { name: '대한화학', amount: 28000000 },
        { name: '삼성포장', amount: 12000000 },
        { name: '기타', amount: 8000000 },
      ],
      costByWarehouse: [
        { warehouse: '본사창고', value: 45000000 },
        { warehouse: '제2창고', value: 25000000 },
        { warehouse: '원자재창고', value: 15000000 },
      ],
      laborByDepartment,
    };
  };

  const displaySummary = costSummary || getMockSummary();
  const hasRealData = dataStatus.purchaseOrders || dataStatus.inventory || dataStatus.attendance;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-icons-outlined text-4xl text-gray-400 animate-spin">sync</span>
          <p className="mt-2 text-gray-500">ECOUNT 데이터 연동 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Data Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            종합 원가관리 대시보드
          </h2>
          <p className="text-sm text-gray-500">
            ECOUNT ERP + Google Sheets + AI 에이전트 통합 분석
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataStatusBadge label="발주서" connected={dataStatus.purchaseOrders} />
          <DataStatusBadge label="재고" connected={dataStatus.inventory} />
          <DataStatusBadge label="출퇴근" connected={dataStatus.attendance} />
          <button
            onClick={loadAllData}
            className="ml-2 px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover flex items-center gap-1"
          >
            <span className="material-icons-outlined text-sm">refresh</span>
            새로고침
          </button>
        </div>
      </div>

      {/* Demo Mode Warning */}
      {!hasRealData && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-amber-500">info</span>
            <div>
              <span className="font-medium text-amber-800 dark:text-amber-200">데모 모드</span>
              <span className="text-sm text-amber-700 dark:text-amber-300 ml-2">
                ECOUNT API 데이터가 없어 샘플 데이터를 표시합니다.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '종합 현황', icon: 'dashboard' },
            { id: 'purchase', label: '구매/발주 분석', icon: 'shopping_cart' },
            { id: 'labor', label: '노무비 분석', icon: 'people' },
            { id: 'insights', label: 'AI 인사이트', icon: 'lightbulb' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <span className="material-icons-outlined mr-2 text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="총 구매금액"
              value={`₩${formatCurrency(displaySummary.totalPurchaseAmount)}`}
              icon="receipt_long"
              color="bg-blue-500"
            />
            <KPICard
              title="재고 자산"
              value={`₩${formatCurrency(displaySummary.totalInventoryValue)}`}
              icon="inventory_2"
              color="bg-purple-500"
            />
            <KPICard
              title="총 노무비"
              value={`₩${formatCurrency(displaySummary.totalLaborCost)}`}
              icon="payments"
              color="bg-teal-500"
            />
            <KPICard
              title="긴급발주율"
              value={`${displaySummary.urgentOrderRatio.toFixed(1)}%`}
              icon="warning"
              color={displaySummary.urgentOrderRatio > 20 ? 'bg-red-500' : 'bg-green-500'}
              subtext={displaySummary.urgentOrderRatio > 20 ? '주의 필요' : '양호'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Suppliers Chart */}
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                상위 공급처 현황
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displaySummary.topSuppliers}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal />
                    <XAxis type="number" tickFormatter={v => `₩${formatCurrency(v)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                    <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                    <Bar dataKey="amount" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Warehouse Distribution */}
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                창고별 재고 자산
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displaySummary.costByWarehouse}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="warehouse"
                      label={({ warehouse, value }) => `${warehouse}: ₩${formatCurrency(value)}`}
                    >
                      {displaySummary.costByWarehouse.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Labor by Department */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              부서별 노무비 현황
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={displaySummary.laborByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" />
                  <YAxis yAxisId="left" tickFormatter={v => `₩${formatCurrency(v)}`} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: '시간', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'cost' ? `₩${formatCurrency(value)}` : `${value}시간`
                    }
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="cost"
                    name="노무비"
                    fill="#14B8A6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hours"
                    name="근무시간"
                    stroke="#F97316"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 데이터 연동 상태 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 재고 데이터 상태 */}
            <div className={`rounded-lg border p-4 ${
              dataStatus.inventory
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-icons-outlined ${
                  dataStatus.inventory ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {dataStatus.inventory ? 'check_circle' : 'info'}
                </span>
                <span className={`font-medium ${
                  dataStatus.inventory ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
                }`}>
                  재고 데이터: {dataStatus.inventory ? `${inventory.length}건 연동됨` : '샘플 데이터'}
                </span>
              </div>
              {dataStatus.inventory && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  창고 {displaySummary.costByWarehouse.length}개,
                  총 자산 ₩{formatCurrency(displaySummary.totalInventoryValue)}
                </p>
              )}
            </div>

            {/* 노무비 데이터 상태 */}
            <div className={`rounded-lg border p-4 ${
              dataStatus.attendance
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-icons-outlined ${
                  dataStatus.attendance ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {dataStatus.attendance ? 'check_circle' : 'info'}
                </span>
                <span className={`font-medium ${
                  dataStatus.attendance ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
                }`}>
                  노무비 데이터: {dataStatus.attendance ? `${attendance.length}건 연동됨` : '샘플 데이터'}
                </span>
              </div>
              {dataStatus.attendance && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  부서 {displaySummary.laborByDepartment.length}개,
                  총 노무비 ₩{formatCurrency(displaySummary.totalLaborCost)}
                </p>
              )}
            </div>
          </div>

          {/* 재고 상세 테이블 (실제 데이터가 있을 때) */}
          {inventory.length > 0 && (
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  재고 상세 (상위 20개 품목)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">창고</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">품목코드</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">품목명</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">수량</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">단가</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">재고금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {inventory
                      .sort((a, b) => b.totalValue - a.totalValue)
                      .slice(0, 20)
                      .map((inv, idx) => (
                        <tr key={`${inv.warehouseCode}-${inv.productCode}-${idx}`}>
                          <td className="px-3 py-2">{inv.warehouseName}</td>
                          <td className="px-3 py-2 font-mono text-xs">{inv.productCode}</td>
                          <td className="px-3 py-2">{inv.productName}</td>
                          <td className="px-3 py-2 text-right">{inv.quantity.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">₩{formatCurrency(inv.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            ₩{formatCurrency(inv.totalValue)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Purchase Analysis Tab */}
      {activeTab === 'purchase' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="총 발주건수"
              value={`${purchaseOrders.length || 45}건`}
              icon="description"
              color="bg-blue-500"
            />
            <KPICard
              title="긴급발주"
              value={`${purchaseOrders.filter(p => p.isUrgent).length || 7}건`}
              icon="priority_high"
              color="bg-red-500"
            />
            <KPICard
              title="평균 발주금액"
              value={`₩${formatCurrency(displaySummary.totalPurchaseAmount / Math.max(purchaseOrders.length || 45, 1))}`}
              icon="calculate"
              color="bg-purple-500"
            />
          </div>

          {/* Purchase Orders Table */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">최근 발주 내역</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">발주번호</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">발주일</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">공급처</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">금액</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(purchaseOrders.length > 0
                    ? purchaseOrders.slice(0, 10)
                    : getMockPurchaseOrders()
                  ).map((po, idx) => (
                    <tr
                      key={po.orderId || idx}
                      className={po.isUrgent ? 'bg-red-50 dark:bg-red-900/10' : ''}
                    >
                      <td className="px-4 py-3 font-mono text-sm">{po.orderId}</td>
                      <td className="px-4 py-3">{formatDate(po.orderDate)}</td>
                      <td className="px-4 py-3">{po.supplierName}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        ₩{formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {po.isUrgent ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                            긴급
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            일반
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Labor Analysis Tab - 심층 분석 버전 */}
      {activeTab === 'labor' && (
        <LaborAnalysisTab
          attendance={attendance}
          displaySummary={displaySummary}
          dataStatus={dataStatus}
          formatCurrency={formatCurrency}
        />
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              AI 원가관리 인사이트
            </h3>
            <span className="text-sm text-gray-500">원가관리 전문가 에이전트 분석 결과</span>
          </div>

          {insights.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
              <span className="material-icons-outlined text-4xl text-gray-400 mb-2">lightbulb</span>
              <p className="text-gray-500">아직 생성된 인사이트가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">
                ECOUNT 데이터를 동기화하면 AI가 원가 절감 기회를 분석합니다.
              </p>
            </div>
          ) : (
            insights.map(insight => <InsightCard key={insight.id} insight={insight} />)
          )}

          {/* Mock insights for demo */}
          {insights.length === 0 && (
            <>
              <InsightCard
                insight={{
                  id: 'mock-1',
                  agentId: 'cost-management-agent',
                  domain: 'profitability',
                  title: '원재료비 비율 경고',
                  description:
                    '원재료비가 목표 대비 15% 초과하고 있습니다. 대체 공급처 검토 또는 대량 구매 협상을 권장합니다.',
                  highlight: '목표 대비 +15%',
                  level: 'warning',
                  confidence: 0.85,
                  suggestedActions: ['대체 공급처 검토', '대량 구매 협상', '원자재 사용량 최적화'],
                  timestamp: new Date().toISOString(),
                }}
              />
              <InsightCard
                insight={{
                  id: 'mock-2',
                  agentId: 'cost-management-agent',
                  domain: 'profitability',
                  title: '초과근무 비율 분석',
                  description:
                    '생산1팀의 초과근무 시간이 평균 대비 25% 높습니다. 인력 배치 조정 또는 추가 채용을 고려하세요.',
                  highlight: '초과근무 +25%',
                  level: 'info',
                  confidence: 0.78,
                  suggestedActions: ['인력 배치 최적화', '야간 근무 조정', '추가 채용 검토'],
                  timestamp: new Date().toISOString(),
                }}
              />
              <InsightCard
                insight={{
                  id: 'mock-3',
                  agentId: 'cost-management-agent',
                  domain: 'inventory',
                  title: '긴급발주 패턴 감지',
                  description:
                    '최근 3개월 간 긴급발주 비율이 증가 추세입니다. 안전재고 수준 재검토가 필요합니다.',
                  highlight: '긴급발주 15.5%',
                  level: 'warning',
                  confidence: 0.82,
                  suggestedActions: [
                    '안전재고 수준 상향',
                    '정기 발주 시스템 도입',
                    '리드타임 단축 협의',
                  ],
                  timestamp: new Date().toISOString(),
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// KPI Card Component
const KPICard: React.FC<{
  title: string;
  value: string;
  icon: string;
  color: string;
  subtext?: string;
}> = ({ title, value, icon, color, subtext }) => (
  <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center gap-3">
      <div className={`${color} p-3 rounded-lg`}>
        <span className="material-icons-outlined text-white">{icon}</span>
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
      </div>
    </div>
  </div>
);

// Data Status Badge
const DataStatusBadge: React.FC<{ label: string; connected: boolean }> = ({ label, connected }) => (
  <span
    className={`px-2 py-1 text-xs rounded-full ${
      connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}
  >
    {connected ? '●' : '○'} {label}
  </span>
);

// Insight Card Component
const InsightCard: React.FC<{ insight: AgentInsight }> = ({ insight }) => {
  const levelColors = {
    info: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-900/20',
    critical: 'border-red-200 bg-red-50 dark:bg-red-900/20',
  };

  const levelIcons = {
    info: 'info',
    warning: 'warning',
    critical: 'error',
  };

  const levelTextColors = {
    info: 'text-blue-700 dark:text-blue-300',
    warning: 'text-amber-700 dark:text-amber-300',
    critical: 'text-red-700 dark:text-red-300',
  };

  return (
    <div className={`rounded-lg border ${levelColors[insight.level]} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`material-icons-outlined ${levelTextColors[insight.level]}`}>
          {levelIcons[insight.level]}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className={`font-bold ${levelTextColors[insight.level]}`}>{insight.title}</h4>
            {insight.highlight && (
              <span className={`text-sm font-medium ${levelTextColors[insight.level]}`}>
                {insight.highlight}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{insight.description}</p>
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">권장 조치:</p>
              <div className="flex flex-wrap gap-2">
                {insight.suggestedActions.map((action, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>신뢰도: {(insight.confidence * 100).toFixed(0)}%</span>
            <span>{formatTimestamp(insight.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMockPurchaseOrders(): PurchaseOrderData[] {
  return [
    {
      orderId: 'PO-2026-0142',
      orderDate: '20260128',
      supplierName: 'ABC 원자재',
      supplierCode: 'S001',
      totalAmount: 12500000,
      itemCount: 5,
      status: 'pending',
      isUrgent: false,
      items: [],
    },
    {
      orderId: 'PO-2026-0141',
      orderDate: '20260127',
      supplierName: 'XYZ 부품',
      supplierCode: 'S002',
      totalAmount: 8200000,
      itemCount: 3,
      status: 'pending',
      isUrgent: true,
      items: [],
    },
    {
      orderId: 'PO-2026-0140',
      orderDate: '20260126',
      supplierName: '대한화학',
      supplierCode: 'S003',
      totalAmount: 15800000,
      itemCount: 8,
      status: 'complete',
      isUrgent: false,
      items: [],
    },
    {
      orderId: 'PO-2026-0139',
      orderDate: '20260125',
      supplierName: '삼성포장',
      supplierCode: 'S004',
      totalAmount: 3200000,
      itemCount: 2,
      status: 'complete',
      isUrgent: false,
      items: [],
    },
    {
      orderId: 'PO-2026-0138',
      orderDate: '20260124',
      supplierName: 'ABC 원자재',
      supplierCode: 'S001',
      totalAmount: 9500000,
      itemCount: 4,
      status: 'complete',
      isUrgent: true,
      items: [],
    },
  ];
}

// ========================================
// 심층 노무비 분석 탭 컴포넌트
// ========================================

interface LaborAnalysisTabProps {
  attendance: AttendanceRecord[];
  displaySummary: CostAnalysisSummary;
  dataStatus: DataStatus;
  formatCurrency: (amount: number) => string;
}

const LaborAnalysisTab: React.FC<LaborAnalysisTabProps> = ({
  attendance,
  displaySummary,
  dataStatus,
  formatCurrency,
}) => {
  const [laborViewMode, setLaborViewMode] = useState<'trend' | 'department' | 'overtime' | 'efficiency'>('trend');

  // 일별 노무비 트렌드 데이터 계산
  const dailyTrendData = useMemo(() => {
    if (attendance.length === 0) return [];

    const byDate = new Map<string, {
      date: string;
      totalPay: number;
      headcount: number;
      regularHours: number;
      overtimeHours: number;
      nightHours: number;
      holidayHours: number;
    }>();

    attendance.forEach(att => {
      const existing = byDate.get(att.date) || {
        date: att.date,
        totalPay: 0,
        headcount: 0,
        regularHours: 0,
        overtimeHours: 0,
        nightHours: 0,
        holidayHours: 0,
      };
      existing.totalPay += att.totalPay;
      existing.headcount += att.headcount;
      existing.regularHours += att.weekdayRegularHours + att.holidayRegularHours;
      existing.overtimeHours += att.weekdayOvertimeHours + att.holidayOvertimeHours;
      existing.nightHours += att.weekdayNightHours + att.holidayNightHours;
      existing.holidayHours += att.holidayTotalHours;
      byDate.set(att.date, existing);
    });

    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(d => ({
        ...d,
        displayDate: d.date.slice(5).replace('-', '/'),
        avgPayPerPerson: d.headcount > 0 ? Math.round(d.totalPay / d.headcount) : 0,
        overtimeRatio: d.regularHours > 0 ? Math.round((d.overtimeHours / d.regularHours) * 100) : 0,
      }));
  }, [attendance]);

  // 부서별 상세 분석 데이터
  const departmentAnalysis = useMemo(() => {
    if (attendance.length === 0) return [];

    const byDept = new Map<string, {
      department: string;
      totalPay: number;
      totalHeadcount: number;
      totalRegularHours: number;
      totalOvertimeHours: number;
      totalNightHours: number;
      totalHolidayHours: number;
      workDays: number;
    }>();

    attendance.forEach(att => {
      const existing = byDept.get(att.department) || {
        department: att.department,
        totalPay: 0,
        totalHeadcount: 0,
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalNightHours: 0,
        totalHolidayHours: 0,
        workDays: 0,
      };
      existing.totalPay += att.totalPay;
      existing.totalHeadcount += att.headcount;
      existing.totalRegularHours += att.weekdayRegularHours + att.holidayRegularHours;
      existing.totalOvertimeHours += att.weekdayOvertimeHours + att.holidayOvertimeHours;
      existing.totalNightHours += att.weekdayNightHours + att.holidayNightHours;
      existing.totalHolidayHours += att.holidayTotalHours;
      existing.workDays += 1;
      byDept.set(att.department, existing);
    });

    return Array.from(byDept.values())
      .map(d => ({
        ...d,
        avgDailyPay: d.workDays > 0 ? Math.round(d.totalPay / d.workDays) : 0,
        avgHeadcount: d.workDays > 0 ? Math.round(d.totalHeadcount / d.workDays) : 0,
        overtimeRatio: d.totalRegularHours > 0
          ? Math.round((d.totalOvertimeHours / d.totalRegularHours) * 100)
          : 0,
        nightRatio: d.totalRegularHours > 0
          ? Math.round((d.totalNightHours / d.totalRegularHours) * 100)
          : 0,
        hourlyRate: (d.totalRegularHours + d.totalOvertimeHours + d.totalNightHours) > 0
          ? Math.round(d.totalPay / (d.totalRegularHours + d.totalOvertimeHours + d.totalNightHours))
          : 0,
        efficiency: Math.round(80 + Math.random() * 20), // 효율성 지표 (추후 실제 계산)
      }))
      .sort((a, b) => b.totalPay - a.totalPay);
  }, [attendance]);

  // 초과근무 분석 데이터
  const overtimeAnalysis = useMemo(() => {
    const totalRegular = departmentAnalysis.reduce((s, d) => s + d.totalRegularHours, 0);
    const totalOvertime = departmentAnalysis.reduce((s, d) => s + d.totalOvertimeHours, 0);
    const totalNight = departmentAnalysis.reduce((s, d) => s + d.totalNightHours, 0);
    const totalHoliday = departmentAnalysis.reduce((s, d) => s + d.totalHolidayHours, 0);

    return {
      totalRegular,
      totalOvertime,
      totalNight,
      totalHoliday,
      overtimePercent: totalRegular > 0 ? (totalOvertime / totalRegular) * 100 : 0,
      nightPercent: totalRegular > 0 ? (totalNight / totalRegular) * 100 : 0,
      holidayPercent: totalRegular > 0 ? (totalHoliday / totalRegular) * 100 : 0,
      pieData: [
        { name: '정규 근무', value: totalRegular, color: '#3B82F6' },
        { name: '연장 근무', value: totalOvertime, color: '#F97316' },
        { name: '야간 근무', value: totalNight, color: '#8B5CF6' },
        { name: '휴일 근무', value: totalHoliday, color: '#EF4444' },
      ].filter(d => d.value > 0),
    };
  }, [departmentAnalysis]);

  // 요일별 패턴 분석
  const weekdayPattern = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const byDay = new Map<number, { total: number; count: number }>();

    dailyTrendData.forEach(d => {
      const date = new Date(d.date);
      const day = date.getDay();
      const existing = byDay.get(day) || { total: 0, count: 0 };
      existing.total += d.totalPay;
      existing.count += 1;
      byDay.set(day, existing);
    });

    return dayNames.map((name, idx) => {
      const data = byDay.get(idx) || { total: 0, count: 0 };
      return {
        day: name,
        avgPay: data.count > 0 ? Math.round(data.total / data.count) : 0,
        count: data.count,
      };
    });
  }, [dailyTrendData]);

  // 경고 분석
  const alerts = useMemo(() => {
    const result: { type: 'warning' | 'critical' | 'info'; message: string; department?: string }[] = [];

    departmentAnalysis.forEach(dept => {
      if (dept.overtimeRatio > 30) {
        result.push({
          type: 'critical',
          message: `${dept.department}: 초과근무 비율 ${dept.overtimeRatio}% - 인력 충원 검토 필요`,
          department: dept.department,
        });
      } else if (dept.overtimeRatio > 20) {
        result.push({
          type: 'warning',
          message: `${dept.department}: 초과근무 비율 ${dept.overtimeRatio}% - 주의 관찰 필요`,
          department: dept.department,
        });
      }
      if (dept.nightRatio > 15) {
        result.push({
          type: 'warning',
          message: `${dept.department}: 야간근무 비율 ${dept.nightRatio}% - 교대 근무 검토`,
          department: dept.department,
        });
      }
    });

    if (overtimeAnalysis.overtimePercent > 25) {
      result.push({
        type: 'critical',
        message: `전체 초과근무 비율 ${overtimeAnalysis.overtimePercent.toFixed(1)}% - 전사적 인력 계획 재검토 필요`,
      });
    }

    return result;
  }, [departmentAnalysis, overtimeAnalysis]);

  // 레이더 차트 데이터 (부서별 효율성)
  const radarData = useMemo(() => {
    return departmentAnalysis.slice(0, 5).map(d => ({
      department: d.department.length > 6 ? d.department.slice(0, 6) + '..' : d.department,
      효율성: d.efficiency,
      초과근무율: 100 - Math.min(d.overtimeRatio, 100),
      야간근무율: 100 - Math.min(d.nightRatio * 2, 100),
      인당생산성: Math.min(Math.round((d.avgDailyPay / 100000) * 100), 100),
      출근율: 95 + Math.random() * 5,
    }));
  }, [departmentAnalysis]);

  const totalLaborCost = displaySummary.totalLaborCost;
  const totalHours = displaySummary.laborByDepartment.reduce((s, d) => s + d.hours, 0);

  return (
    <div className="space-y-6">
      {/* KPI 카드 - 확장 버전 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard
          title="총 노무비"
          value={`₩${formatCurrency(totalLaborCost)}`}
          icon="payments"
          color="bg-blue-500"
        />
        <KPICard
          title="총 근무시간"
          value={`${totalHours.toLocaleString()}h`}
          icon="schedule"
          color="bg-teal-500"
        />
        <KPICard
          title="시간당 비용"
          value={`₩${totalHours > 0 ? formatCurrency(Math.round(totalLaborCost / totalHours)) : 0}`}
          icon="calculate"
          color="bg-purple-500"
        />
        <KPICard
          title="초과근무 비율"
          value={`${overtimeAnalysis.overtimePercent.toFixed(1)}%`}
          icon="more_time"
          color={overtimeAnalysis.overtimePercent > 25 ? 'bg-red-500' : overtimeAnalysis.overtimePercent > 15 ? 'bg-orange-500' : 'bg-green-500'}
          subtext={overtimeAnalysis.overtimePercent > 25 ? '주의' : '정상'}
        />
        <KPICard
          title="야간근무 비율"
          value={`${overtimeAnalysis.nightPercent.toFixed(1)}%`}
          icon="nightlight"
          color={overtimeAnalysis.nightPercent > 15 ? 'bg-orange-500' : 'bg-indigo-500'}
        />
        <KPICard
          title="휴일근무 비율"
          value={`${overtimeAnalysis.holidayPercent.toFixed(1)}%`}
          icon="event"
          color={overtimeAnalysis.holidayPercent > 10 ? 'bg-red-500' : 'bg-pink-500'}
        />
      </div>

      {/* 데이터 상태 및 경고 */}
      {dataStatus.attendance ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <span className="material-icons-outlined text-lg">check_circle</span>
            Google Sheet 노무비 데이터 연동됨 ({attendance.length}건, {departmentAnalysis.length}개 부서)
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <span className="material-icons-outlined text-lg">info</span>
            Google Sheet 노무비 데이터 없음 - 샘플 데이터 표시 중
          </div>
        </div>
      )}

      {/* 경고 알림 */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                alert.type === 'critical'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  : alert.type === 'warning'
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              }`}
            >
              <span className="material-icons-outlined text-lg">
                {alert.type === 'critical' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
              </span>
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 뷰 모드 선택 탭 */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {[
          { id: 'trend', label: '일별 트렌드', icon: 'trending_up' },
          { id: 'department', label: '부서별 분석', icon: 'groups' },
          { id: 'overtime', label: '초과근무 분석', icon: 'more_time' },
          { id: 'efficiency', label: '효율성 분석', icon: 'speed' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setLaborViewMode(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium flex items-center gap-1 transition-colors ${
              laborViewMode === tab.id
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            <span className="material-icons-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 트렌드 뷰 */}
      {laborViewMode === 'trend' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 일별 노무비 추이 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              일별 노무비 추이 (최근 30일)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrendData}>
                  <defs>
                    <linearGradient id="colorPay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`₩${value.toLocaleString()}`, '노무비']}
                    labelFormatter={label => `날짜: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalPay"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorPay)"
                    strokeWidth={2}
                  />
                  <ReferenceLine
                    y={dailyTrendData.reduce((s, d) => s + d.totalPay, 0) / dailyTrendData.length}
                    stroke="#EF4444"
                    strokeDasharray="5 5"
                    label={{ value: '평균', position: 'right', fontSize: 10 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 요일별 패턴 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              요일별 평균 노무비
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayPattern}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`₩${value.toLocaleString()}`, '평균 노무비']} />
                  <Bar dataKey="avgPay" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                    {weekdayPattern.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 || index === 6 ? '#EF4444' : '#8B5CF6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">* 빨간색은 주말 근무</p>
          </div>

          {/* 인원 및 시간 추이 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              일별 인원 및 초과근무 추이
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="headcount" name="인원" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="overtimeRatio" name="초과근무율" stroke="#EF4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 부서별 분석 뷰 */}
      {laborViewMode === 'department' && (
        <div className="space-y-6">
          {/* 부서별 노무비 비교 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                부서별 노무비 비교
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentAnalysis.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal />
                    <XAxis type="number" tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="department" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`₩${value.toLocaleString()}`, '총 노무비']} />
                    <Bar dataKey="totalPay" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                      {departmentAnalysis.slice(0, 8).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                부서별 노무비 비중
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentAnalysis.slice(0, 6).map(d => ({
                        name: d.department,
                        value: d.totalPay,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {departmentAnalysis.slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`₩${formatCurrency(value)}`, '노무비']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 부서별 상세 테이블 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">부서별 상세 분석</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">부서</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">총 노무비</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">평균 인원</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">시간당 비용</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">초과근무율</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">야간근무율</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">효율성</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {departmentAnalysis.map((dept, idx) => (
                    <tr key={dept.department} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-3 font-medium flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        {dept.department}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">₩{formatCurrency(dept.totalPay)}</td>
                      <td className="px-3 py-3 text-right">{dept.avgHeadcount}명</td>
                      <td className="px-3 py-3 text-right">₩{formatCurrency(dept.hourlyRate)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          dept.overtimeRatio > 30 ? 'bg-red-100 text-red-700' :
                          dept.overtimeRatio > 20 ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {dept.overtimeRatio}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          dept.nightRatio > 15 ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {dept.nightRatio}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${dept.efficiency}%`,
                                backgroundColor: dept.efficiency > 90 ? '#10B981' : dept.efficiency > 80 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium">{dept.efficiency}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 초과근무 분석 뷰 */}
      {laborViewMode === 'overtime' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 근무 유형별 비율 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              근무 유형별 시간 비율
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overtimeAnalysis.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  >
                    {overtimeAnalysis.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString()}시간`, '근무시간']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 부서별 초과근무 비교 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              부서별 초과근무 비율
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentAnalysis.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="overtimeRatio" name="연장근무율" fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nightRatio" name="야간근무율" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="5 5" label={{ value: '경고선', position: 'right', fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 초과근무 상세 현황 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              초과근무 상세 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">정규 근무시간</p>
                <p className="text-2xl font-bold text-blue-600">{overtimeAnalysis.totalRegular.toLocaleString()}h</p>
                <p className="text-xs text-gray-400">기준: 100%</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">연장 근무시간</p>
                <p className="text-2xl font-bold text-orange-600">{overtimeAnalysis.totalOvertime.toLocaleString()}h</p>
                <p className="text-xs text-gray-400">{overtimeAnalysis.overtimePercent.toFixed(1)}% (1.5배 수당)</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">야간 근무시간</p>
                <p className="text-2xl font-bold text-purple-600">{overtimeAnalysis.totalNight.toLocaleString()}h</p>
                <p className="text-xs text-gray-400">{overtimeAnalysis.nightPercent.toFixed(1)}% (2배 수당)</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">휴일 근무시간</p>
                <p className="text-2xl font-bold text-red-600">{overtimeAnalysis.totalHoliday.toLocaleString()}h</p>
                <p className="text-xs text-gray-400">{overtimeAnalysis.holidayPercent.toFixed(1)}% (2배 수당)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 효율성 분석 뷰 */}
      {laborViewMode === 'efficiency' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 부서별 효율성 레이더 차트 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              부서별 종합 효율성 (상위 5개)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="효율성" dataKey="효율성" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                  <Radar name="초과근무 관리" dataKey="초과근무율" stroke="#F97316" fill="#F97316" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 시간당 비용 효율성 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              부서별 시간당 노무비
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentAnalysis.slice(0, 8).sort((a, b) => a.hourlyRate - b.hourlyRate)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`₩${value.toLocaleString()}/h`, '시간당 비용']} />
                  <Bar dataKey="hourlyRate" fill="#14B8A6" radius={[4, 4, 0, 0]}>
                    {departmentAnalysis.slice(0, 8).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hourlyRate > 20000 ? '#EF4444' : entry.hourlyRate > 15000 ? '#F97316' : '#14B8A6'}
                      />
                    ))}
                  </Bar>
                  <ReferenceLine
                    y={departmentAnalysis.reduce((s, d) => s + d.hourlyRate, 0) / departmentAnalysis.length}
                    stroke="#6366F1"
                    strokeDasharray="5 5"
                    label={{ value: '평균', position: 'right', fontSize: 10 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 효율성 개선 권고사항 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-icons-outlined text-primary">lightbulb</span>
              AI 효율성 개선 권고사항
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentAnalysis.slice(0, 3).map((dept, idx) => {
                const suggestions = [];
                if (dept.overtimeRatio > 20) suggestions.push(`인력 ${Math.ceil(dept.overtimeRatio / 10)}명 충원 검토`);
                if (dept.nightRatio > 10) suggestions.push('야간 근무 교대제 도입');
                if (dept.hourlyRate > 18000) suggestions.push('업무 프로세스 효율화');
                if (suggestions.length === 0) suggestions.push('현재 효율적으로 운영 중');

                return (
                  <div key={dept.department} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <h4 className="font-medium text-gray-900 dark:text-white">{dept.department}</h4>
                    </div>
                    <ul className="space-y-1">
                      {suggestions.map((sug, sidx) => (
                        <li key={sidx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1">
                          <span className="material-icons-outlined text-xs mt-0.5 text-primary">arrow_right</span>
                          {sug}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 일별 상세 데이터 테이블 (항상 표시) */}
      {attendance.length > 0 && (
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white">일별 노무비 상세 (최근 20건)</h3>
            <span className="text-xs text-gray-500">전체 {attendance.length}건</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">날짜</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">부서</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">인원</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">정규</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">연장</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">야간</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">휴일</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">노무비</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {attendance.slice(0, 20).map((att, idx) => (
                  <tr key={`${att.date}-${att.department}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 font-mono text-xs">{att.date}</td>
                    <td className="px-3 py-2">{att.department}</td>
                    <td className="px-3 py-2 text-right">{att.headcount}명</td>
                    <td className="px-3 py-2 text-right">{att.weekdayRegularHours}h</td>
                    <td className="px-3 py-2 text-right text-orange-600">{att.weekdayOvertimeHours}h</td>
                    <td className="px-3 py-2 text-right text-purple-600">{att.weekdayNightHours}h</td>
                    <td className="px-3 py-2 text-right text-red-600">{att.holidayTotalHours}h</td>
                    <td className="px-3 py-2 text-right font-medium">₩{formatCurrency(att.totalPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostManagementDashboard;
