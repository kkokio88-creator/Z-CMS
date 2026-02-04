import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'labor' | 'insights'>('overview');
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

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);

    // Fetch all data in parallel
    const [poData, invData, attData, insightData] = await Promise.all([
      fetchPurchaseOrders(),
      fetchInventoryByLocation(),
      fetchAttendanceRecords(),
      fetchAgentInsights(),
    ]);

    setPurchaseOrders(poData);
    setInventory(invData);
    setAttendance(attData);
    setInsights(insightData);

    // Update data status
    setDataStatus({
      purchaseOrders: poData.length > 0,
      inventory: invData.length > 0,
      attendance: attData.length > 0,
    });

    // Calculate summary
    if (poData.length > 0 || invData.length > 0 || attData.length > 0) {
      const summary = calculateCostAnalysis(poData, invData, attData);
      setCostSummary(summary);
    }

    setIsLoading(false);
  };

  // Generate mock data if no ECOUNT data available
  const getMockSummary = (): CostAnalysisSummary => ({
    totalPurchaseAmount: 125000000,
    totalInventoryValue: 85000000,
    totalLaborCost: 42000000,
    totalOvertimeHours: 320,
    avgOvertimePerEmployee: 12.8,
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
    laborByDepartment: [
      { department: '생산1팀', hours: 1200, cost: 18000000 },
      { department: '생산2팀', hours: 980, cost: 14700000 },
      { department: '품질관리', hours: 420, cost: 6300000 },
      { department: '물류', hours: 200, cost: 3000000 },
    ],
  });

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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">종합 원가관리 대시보드</h2>
          <p className="text-sm text-gray-500">ECOUNT ERP + Google Sheets + AI 에이전트 통합 분석</p>
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
              className={`${activeTab === tab.id
                ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">상위 공급처 현황</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displaySummary.topSuppliers} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal />
                    <XAxis type="number" tickFormatter={(v) => `₩${formatCurrency(v)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                    <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                    <Bar dataKey="amount" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Warehouse Distribution */}
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">창고별 재고 자산</h3>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">부서별 노무비 현황</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={displaySummary.laborByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `₩${formatCurrency(v)}`} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: '시간', angle: 90, position: 'insideRight' }} />
                  <Tooltip formatter={(value: number, name: string) =>
                    name === 'cost' ? `₩${formatCurrency(value)}` : `${value}시간`
                  } />
                  <Legend />
                  <Bar yAxisId="left" dataKey="cost" name="노무비" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="hours" name="근무시간" stroke="#F97316" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
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
                  {(purchaseOrders.length > 0 ? purchaseOrders.slice(0, 10) : getMockPurchaseOrders()).map((po, idx) => (
                    <tr key={po.orderId || idx} className={po.isUrgent ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-4 py-3 font-mono text-sm">{po.orderId}</td>
                      <td className="px-4 py-3">{formatDate(po.orderDate)}</td>
                      <td className="px-4 py-3">{po.supplierName}</td>
                      <td className="px-4 py-3 text-right font-medium">₩{formatCurrency(po.totalAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        {po.isUrgent ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">긴급</span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">일반</span>
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

      {/* Labor Analysis Tab */}
      {activeTab === 'labor' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              title="총 근무시간"
              value={`${displaySummary.laborByDepartment.reduce((s, d) => s + d.hours, 0).toLocaleString()}시간`}
              icon="schedule"
              color="bg-blue-500"
            />
            <KPICard
              title="총 초과근무"
              value={`${displaySummary.totalOvertimeHours.toFixed(0)}시간`}
              icon="more_time"
              color={displaySummary.avgOvertimePerEmployee > 15 ? 'bg-red-500' : 'bg-teal-500'}
            />
            <KPICard
              title="인당 초과근무"
              value={`${displaySummary.avgOvertimePerEmployee.toFixed(1)}시간`}
              icon="person"
              color={displaySummary.avgOvertimePerEmployee > 15 ? 'bg-red-500' : 'bg-green-500'}
              subtext={displaySummary.avgOvertimePerEmployee > 15 ? '인력 충원 검토' : '양호'}
            />
            <KPICard
              title="인당 노무비"
              value={`₩${formatCurrency(displaySummary.totalLaborCost / Math.max(attendance.length || 25, 1))}`}
              icon="payments"
              color="bg-purple-500"
            />
          </div>

          {/* Attendance Summary */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">부서별 근태 현황</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">부서</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">총 근무시간</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">노무비</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">시간당 비용</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">비중</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {displaySummary.laborByDepartment.map((dept, idx) => {
                    const totalCost = displaySummary.laborByDepartment.reduce((s, d) => s + d.cost, 0);
                    const ratio = (dept.cost / totalCost) * 100;
                    return (
                      <tr key={dept.department}>
                        <td className="px-4 py-3 font-medium">{dept.department}</td>
                        <td className="px-4 py-3 text-right">{dept.hours.toLocaleString()}시간</td>
                        <td className="px-4 py-3 text-right font-medium">₩{formatCurrency(dept.cost)}</td>
                        <td className="px-4 py-3 text-right">₩{formatCurrency(dept.cost / dept.hours)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${ratio}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                            </div>
                            <span className="text-xs font-medium">{ratio.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI 원가관리 인사이트</h3>
            <span className="text-sm text-gray-500">원가관리 전문가 에이전트 분석 결과</span>
          </div>

          {insights.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
              <span className="material-icons-outlined text-4xl text-gray-400 mb-2">lightbulb</span>
              <p className="text-gray-500">아직 생성된 인사이트가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">ECOUNT 데이터를 동기화하면 AI가 원가 절감 기회를 분석합니다.</p>
            </div>
          ) : (
            insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))
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
                  description: '원재료비가 목표 대비 15% 초과하고 있습니다. 대체 공급처 검토 또는 대량 구매 협상을 권장합니다.',
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
                  description: '생산1팀의 초과근무 시간이 평균 대비 25% 높습니다. 인력 배치 조정 또는 추가 채용을 고려하세요.',
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
                  description: '최근 3개월 간 긴급발주 비율이 증가 추세입니다. 안전재고 수준 재검토가 필요합니다.',
                  highlight: '긴급발주 15.5%',
                  level: 'warning',
                  confidence: 0.82,
                  suggestedActions: ['안전재고 수준 상향', '정기 발주 시스템 도입', '리드타임 단축 협의'],
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
  <span className={`px-2 py-1 text-xs rounded-full ${
    connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
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
                  <span key={idx} className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200">
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
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getMockPurchaseOrders(): PurchaseOrderData[] {
  return [
    { orderId: 'PO-2026-0142', orderDate: '20260128', supplierName: 'ABC 원자재', supplierCode: 'S001', totalAmount: 12500000, itemCount: 5, status: 'pending', isUrgent: false, items: [] },
    { orderId: 'PO-2026-0141', orderDate: '20260127', supplierName: 'XYZ 부품', supplierCode: 'S002', totalAmount: 8200000, itemCount: 3, status: 'pending', isUrgent: true, items: [] },
    { orderId: 'PO-2026-0140', orderDate: '20260126', supplierName: '대한화학', supplierCode: 'S003', totalAmount: 15800000, itemCount: 8, status: 'complete', isUrgent: false, items: [] },
    { orderId: 'PO-2026-0139', orderDate: '20260125', supplierName: '삼성포장', supplierCode: 'S004', totalAmount: 3200000, itemCount: 2, status: 'complete', isUrgent: false, items: [] },
    { orderId: 'PO-2026-0138', orderDate: '20260124', supplierName: 'ABC 원자재', supplierCode: 'S001', totalAmount: 9500000, itemCount: 4, status: 'complete', isUrgent: true, items: [] },
  ];
}

export default CostManagementDashboard;
