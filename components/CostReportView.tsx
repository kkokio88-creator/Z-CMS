import React, { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import {
  getCostSummary,
  updateTarget,
  testSheetsConnection,
  MonthlyCostSummary,
  CostTarget,
  DailyCumulativeData,
  formatCurrency,
  formatMonth,
} from '../services/costReportService';

// 계정 타입 정의
type AccountType = 'rawMaterial' | 'subMaterial' | 'labor' | 'expense';

const ACCOUNT_LABELS: Record<AccountType, string> = {
  rawMaterial: '원재료액',
  subMaterial: '부재료액',
  labor: '노무비액',
  expense: '경비액',
};

const ACCOUNT_COLORS: Record<AccountType, string> = {
  rawMaterial: '#F97316',
  subMaterial: '#8B5CF6',
  labor: '#14B8A6',
  expense: '#EF4444',
};

// Mock data for development/demo
const createMockData = (): MonthlyCostSummary[] => [
  {
    month: '2025-10',
    salesAmount: 52000000, rawMaterialCost: 18000000, subMaterialCost: 5000000,
    laborCost: 8500000, expenseAmount: 6500000, totalCost: 38000000, wasteCost: 2200000,
    profitRatio: 1.37, rawMaterialRatio: 2.89, subMaterialRatio: 10.4, laborRatio: 6.12, expenseRatio: 8.0,
    targetSales: 55000000, targetRawMaterial: 17000000, targetSubMaterial: 4500000,
    targetLabor: 8000000, targetExpense: 6000000, targetRatio: 1.55,
    achievementRate: 88, rawMaterialAchievement: 94, subMaterialAchievement: 90,
    laborAchievement: 94, expenseAchievement: 92,
    rawMaterialVariance: -1000000, subMaterialVariance: -500000, laborVariance: -500000, expenseVariance: -500000,
  },
  {
    month: '2025-11',
    salesAmount: 58000000, rawMaterialCost: 19500000, subMaterialCost: 5200000,
    laborCost: 9000000, expenseAmount: 6800000, totalCost: 40500000, wasteCost: 1800000,
    profitRatio: 1.43, rawMaterialRatio: 2.97, subMaterialRatio: 11.15, laborRatio: 6.44, expenseRatio: 8.53,
    targetSales: 58000000, targetRawMaterial: 19000000, targetSubMaterial: 5000000,
    targetLabor: 8800000, targetExpense: 6500000, targetRatio: 1.47,
    achievementRate: 97, rawMaterialAchievement: 97, subMaterialAchievement: 96,
    laborAchievement: 98, expenseAchievement: 96,
    rawMaterialVariance: -500000, subMaterialVariance: -200000, laborVariance: -200000, expenseVariance: -300000,
  },
  {
    month: '2025-12',
    salesAmount: 63000000, rawMaterialCost: 20000000, subMaterialCost: 5500000,
    laborCost: 9500000, expenseAmount: 7000000, totalCost: 42000000, wasteCost: 2500000,
    profitRatio: 1.50, rawMaterialRatio: 3.15, subMaterialRatio: 11.45, laborRatio: 6.63, expenseRatio: 9.0,
    targetSales: 60000000, targetRawMaterial: 20000000, targetSubMaterial: 5500000,
    targetLabor: 9500000, targetExpense: 7000000, targetRatio: 1.43,
    achievementRate: 105, rawMaterialAchievement: 100, subMaterialAchievement: 100,
    laborAchievement: 100, expenseAchievement: 100,
    rawMaterialVariance: 0, subMaterialVariance: 0, laborVariance: 0, expenseVariance: 0,
  },
  {
    month: '2026-01',
    salesAmount: 48000000, rawMaterialCost: 17000000, subMaterialCost: 4800000,
    laborCost: 8200000, expenseAmount: 6200000, totalCost: 36200000, wasteCost: 1900000,
    profitRatio: 1.33, rawMaterialRatio: 2.82, subMaterialRatio: 10.0, laborRatio: 5.85, expenseRatio: 7.74,
    targetSales: 50000000, targetRawMaterial: 16000000, targetSubMaterial: 4500000,
    targetLabor: 8000000, targetExpense: 6000000, targetRatio: 1.45,
    achievementRate: 92, rawMaterialAchievement: 94, subMaterialAchievement: 94,
    laborAchievement: 98, expenseAchievement: 97,
    rawMaterialVariance: -1000000, subMaterialVariance: -300000, laborVariance: -200000, expenseVariance: -200000,
  },
];

// Mock daily data
const MOCK_DAILY_DATA: DailyCumulativeData[] = Array.from({ length: 15 }, (_, i) => ({
  date: `2026-01-${String(i + 1).padStart(2, '0')}`,
  dayOfMonth: i + 1,
  cumSales: 3200000 * (i + 1),
  cumRawMaterial: 1130000 * (i + 1),
  cumSubMaterial: 320000 * (i + 1),
  cumLabor: 550000 * (i + 1),
  cumExpense: 410000 * (i + 1),
  cumTotal: 2410000 * (i + 1),
  cumRawMaterialRatio: 2.8 + (Math.random() * 0.4 - 0.2),
  cumSubMaterialRatio: 10.0 + (Math.random() * 1 - 0.5),
  cumLaborRatio: 5.8 + (Math.random() * 0.6 - 0.3),
  cumExpenseRatio: 7.8 + (Math.random() * 0.4 - 0.2),
  cumTotalRatio: 1.33 + (Math.random() * 0.1 - 0.05),
}));

interface Props {
  onItemClick?: (item: MonthlyCostSummary) => void;
}

export const CostReportView: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'targets' | 'daily'>('overview');
  const [summaryData, setSummaryData] = useState<MonthlyCostSummary[]>([]);
  const [dailyData] = useState<DailyCumulativeData[]>(MOCK_DAILY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  // 로컬 목표 상태 (저장 문제 해결)
  const [localTargets, setLocalTargets] = useState<Record<string, Partial<CostTarget>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    const connResult = await testSheetsConnection();
    setConnectionStatus(connResult.success ? 'connected' : 'disconnected');

    if (!connResult.success) {
      console.log('Using mock data - Google Sheets not connected');
      const mockData = createMockData();
      setSummaryData(mockData);
      // 초기 목표값 설정
      const initialTargets: Record<string, Partial<CostTarget>> = {};
      mockData.forEach(d => {
        initialTargets[d.month] = {
          targetSales: d.targetSales || 0,
          targetRawMaterial: d.targetRawMaterial || 0,
          targetSubMaterial: d.targetSubMaterial || 0,
          targetLabor: d.targetLabor || 0,
          targetExpense: d.targetExpense || 0,
        };
      });
      setLocalTargets(initialTargets);
      setError(connResult.message);
      setIsLoading(false);
      return;
    }

    const { summary } = await getCostSummary();
    const data = summary.length > 0 ? summary : createMockData();
    setSummaryData(data);
    setIsLoading(false);
  };

  // 목표 저장 (로컬 상태 업데이트)
  const handleTargetSave = useCallback((month: string, target: Partial<CostTarget>) => {
    setLocalTargets(prev => ({
      ...prev,
      [month]: { ...prev[month], ...target }
    }));

    // summaryData도 업데이트
    setSummaryData(prev => prev.map(d => {
      if (d.month === month) {
        const newTarget = { ...localTargets[month], ...target };
        // 달성률 및 초과/절감 재계산
        const rawMaterialAchievement = newTarget.targetRawMaterial && newTarget.targetRawMaterial > 0
          ? Math.round((newTarget.targetRawMaterial / d.rawMaterialCost) * 100) : null;
        const subMaterialAchievement = newTarget.targetSubMaterial && newTarget.targetSubMaterial > 0
          ? Math.round((newTarget.targetSubMaterial / d.subMaterialCost) * 100) : null;
        const laborAchievement = newTarget.targetLabor && newTarget.targetLabor > 0
          ? Math.round((newTarget.targetLabor / d.laborCost) * 100) : null;
        const expenseAchievement = newTarget.targetExpense && newTarget.targetExpense > 0
          ? Math.round((newTarget.targetExpense / d.expenseAmount) * 100) : null;

        return {
          ...d,
          targetSales: newTarget.targetSales,
          targetRawMaterial: newTarget.targetRawMaterial,
          targetSubMaterial: newTarget.targetSubMaterial,
          targetLabor: newTarget.targetLabor,
          targetExpense: newTarget.targetExpense,
          rawMaterialAchievement,
          subMaterialAchievement,
          laborAchievement,
          expenseAchievement,
          rawMaterialVariance: (newTarget.targetRawMaterial || 0) - d.rawMaterialCost,
          subMaterialVariance: (newTarget.targetSubMaterial || 0) - d.subMaterialCost,
          laborVariance: (newTarget.targetLabor || 0) - d.laborCost,
          expenseVariance: (newTarget.targetExpense || 0) - d.expenseAmount,
        };
      }
      return d;
    }));

    // 연결된 경우 서버에도 저장 시도
    if (connectionStatus === 'connected') {
      updateTarget(month, target);
    }
  }, [connectionStatus, localTargets]);

  const showConnectionWarning = connectionStatus === 'disconnected';
  const months = summaryData.map(d => d.month);

  // 계정별 누적 초과금액 계산
  const cumulativeVarianceByAccount = (['rawMaterial', 'subMaterial', 'labor', 'expense'] as AccountType[]).map(account => {
    let cumVariance = 0;
    const data = summaryData.map(d => {
      const variance = account === 'rawMaterial' ? d.rawMaterialVariance :
        account === 'subMaterial' ? d.subMaterialVariance :
        account === 'labor' ? d.laborVariance : d.expenseVariance;
      cumVariance += (variance || 0);
      return { month: d.month, cumVariance };
    });
    return { account, label: ACCOUNT_LABELS[account], color: ACCOUNT_COLORS[account], data };
  });

  // 비율 추이 데이터 변환
  const ratioTrendData = summaryData.map(d => ({
    month: formatMonth(d.month).replace('년 ', '/'),
    원재료: d.rawMaterialRatio,
    부재료: d.subMaterialRatio,
    노무비: d.laborRatio,
    경비: d.expenseRatio,
  }));

  // 누적 초과금액 차트 데이터
  const varianceChartData = summaryData.map((d, idx) => {
    const result: any = { month: formatMonth(d.month).replace('년 ', '/') };
    cumulativeVarianceByAccount.forEach(acc => {
      result[acc.label] = acc.data[idx].cumVariance;
    });
    return result;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-icons-outlined text-4xl text-gray-400 animate-spin">sync</span>
          <p className="mt-2 text-gray-500">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Warning */}
      {showConnectionWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="material-icons-outlined text-amber-500">warning</span>
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 dark:text-amber-200">Google Sheets 연결 안됨 - 데모 모드</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{error}</p>
              <details className="mt-2 text-xs text-amber-600">
                <summary className="cursor-pointer font-medium">연결 방법 보기</summary>
                <ol className="mt-2 list-decimal ml-4 space-y-1">
                  <li>Google Cloud Console에서 서비스 계정의 JSON 키 다운로드</li>
                  <li>파일을 <code className="bg-amber-100 px-1 rounded">server/credentials/</code> 폴더에 저장</li>
                  <li><code className="bg-amber-100 px-1 rounded">server/.env</code> 파일 수정:
                    <pre className="mt-1 bg-amber-100 p-2 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/your-key.json</pre>
                  </li>
                  <li>서버 재시작</li>
                </ol>
              </details>
            </div>
            <button onClick={fetchData} className="px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200">
              재연결
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">원가 분석 리포트</h2>
          <p className="text-sm text-gray-500">생산매출 대비 항목별 비율 분석</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
        }`}>
          {connectionStatus === 'connected' ? '● 연동됨' : '○ 데모'}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '대시보드', icon: 'analytics' },
            { id: 'targets', label: '목표 설정', icon: 'flag' },
            { id: 'daily', label: '일 누적 현황', icon: 'calendar_today' },
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
          {/* 실적표 - 계정 세로, 기간 가로 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">월별 실적 vs 목표</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 border-r border-gray-200">계정</th>
                    {months.map(m => (
                      <th key={m} className="px-4 py-3 text-center font-medium text-gray-500 min-w-[120px]">
                        {formatMonth(m).replace('년 ', '/')}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium text-gray-500 bg-blue-50">누적 초과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* 생산매출 */}
                  <tr className="bg-blue-50/50">
                    <td className="px-4 py-3 font-bold text-blue-700 border-r border-gray-200">생산매출</td>
                    {summaryData.map(d => (
                      <td key={d.month} className="px-4 py-3 text-center">
                        <div className="font-bold text-blue-600">₩{formatCurrency(d.salesAmount)}</div>
                        {d.targetSales && <div className="text-xs text-gray-400">목표: ₩{formatCurrency(d.targetSales)}</div>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center bg-blue-50">-</td>
                  </tr>
                  {/* 원재료액 */}
                  <tr>
                    <td className="px-4 py-3 font-medium text-orange-600 border-r border-gray-200">원재료액</td>
                    {summaryData.map(d => (
                      <td key={d.month} className="px-4 py-3 text-center">
                        <div>₩{formatCurrency(d.rawMaterialCost)}</div>
                        {d.targetRawMaterial && <div className="text-xs text-gray-400">목표: ₩{formatCurrency(d.targetRawMaterial)}</div>}
                        {d.rawMaterialVariance !== null && (
                          <div className={`text-xs font-bold ${(d.rawMaterialVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(d.rawMaterialVariance || 0) >= 0 ? '▼' : '▲'} ₩{formatCurrency(Math.abs(d.rawMaterialVariance || 0))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center bg-blue-50">
                      <span className={`font-bold ${cumulativeVarianceByAccount[0].data.slice(-1)[0].cumVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₩{formatCurrency(Math.abs(cumulativeVarianceByAccount[0].data.slice(-1)[0].cumVariance))}
                      </span>
                    </td>
                  </tr>
                  {/* 부재료액 */}
                  <tr>
                    <td className="px-4 py-3 font-medium text-purple-600 border-r border-gray-200">부재료액</td>
                    {summaryData.map(d => (
                      <td key={d.month} className="px-4 py-3 text-center">
                        <div>₩{formatCurrency(d.subMaterialCost)}</div>
                        {d.targetSubMaterial && <div className="text-xs text-gray-400">목표: ₩{formatCurrency(d.targetSubMaterial)}</div>}
                        {d.subMaterialVariance !== null && (
                          <div className={`text-xs font-bold ${(d.subMaterialVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(d.subMaterialVariance || 0) >= 0 ? '▼' : '▲'} ₩{formatCurrency(Math.abs(d.subMaterialVariance || 0))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center bg-blue-50">
                      <span className={`font-bold ${cumulativeVarianceByAccount[1].data.slice(-1)[0].cumVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₩{formatCurrency(Math.abs(cumulativeVarianceByAccount[1].data.slice(-1)[0].cumVariance))}
                      </span>
                    </td>
                  </tr>
                  {/* 노무비액 */}
                  <tr>
                    <td className="px-4 py-3 font-medium text-teal-600 border-r border-gray-200">노무비액</td>
                    {summaryData.map(d => (
                      <td key={d.month} className="px-4 py-3 text-center">
                        <div>₩{formatCurrency(d.laborCost)}</div>
                        {d.targetLabor && <div className="text-xs text-gray-400">목표: ₩{formatCurrency(d.targetLabor)}</div>}
                        {d.laborVariance !== null && (
                          <div className={`text-xs font-bold ${(d.laborVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(d.laborVariance || 0) >= 0 ? '▼' : '▲'} ₩{formatCurrency(Math.abs(d.laborVariance || 0))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center bg-blue-50">
                      <span className={`font-bold ${cumulativeVarianceByAccount[2].data.slice(-1)[0].cumVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₩{formatCurrency(Math.abs(cumulativeVarianceByAccount[2].data.slice(-1)[0].cumVariance))}
                      </span>
                    </td>
                  </tr>
                  {/* 경비액 */}
                  <tr>
                    <td className="px-4 py-3 font-medium text-red-600 border-r border-gray-200">경비액</td>
                    {summaryData.map(d => (
                      <td key={d.month} className="px-4 py-3 text-center">
                        <div>₩{formatCurrency(d.expenseAmount)}</div>
                        {d.targetExpense && <div className="text-xs text-gray-400">목표: ₩{formatCurrency(d.targetExpense)}</div>}
                        {d.expenseVariance !== null && (
                          <div className={`text-xs font-bold ${(d.expenseVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(d.expenseVariance || 0) >= 0 ? '▼' : '▲'} ₩{formatCurrency(Math.abs(d.expenseVariance || 0))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center bg-blue-50">
                      <span className={`font-bold ${cumulativeVarianceByAccount[3].data.slice(-1)[0].cumVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₩{formatCurrency(Math.abs(cumulativeVarianceByAccount[3].data.slice(-1)[0].cumVariance))}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 비율 추이 - 선 그래프 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 비율 추이 (생산매출/각 계정)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ratioTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: '비율', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Line type="monotone" dataKey="원재료" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="부재료" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="노무비" stroke="#14B8A6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="경비" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">* 비율이 높을수록 좋음 (매출 대비 비용이 적음)</p>
          </div>

          {/* 누적 초과/절감 그래프 */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">계정별 누적 초과/절감 금액</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={varianceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v >= 0 ? '' : '-'}₩${formatCurrency(Math.abs(v))}`} />
                  <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
                  <Bar dataKey="원재료액" fill="#F97316" />
                  <Bar dataKey="부재료액" fill="#8B5CF6" />
                  <Bar dataKey="노무비액" fill="#14B8A6" />
                  <Bar dataKey="경비액" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">* 양수: 절감 (목표 이내) | 음수: 초과 (목표 초과)</p>
          </div>
        </>
      )}

      {/* Targets Tab */}
      {activeTab === 'targets' && (
        <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">월별 목표 설정</h3>
              <p className="text-xs text-gray-500">각 계정별 월 목표 금액을 입력하세요</p>
            </div>
            <button
              onClick={() => setIsEditingTargets(!isEditingTargets)}
              className={`px-4 py-2 text-sm rounded font-medium ${isEditingTargets
                ? 'bg-gray-200 text-gray-700' : 'bg-primary text-white hover:bg-primary-hover'}`}
            >
              {isEditingTargets ? '완료' : '수정'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 border-r border-gray-200">계정</th>
                  {months.map(m => (
                    <th key={m} className="px-4 py-3 text-center font-medium text-gray-500 min-w-[140px]">
                      {formatMonth(m).replace('년 ', '/')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* 생산매출 목표 */}
                <TargetRow
                  label="생산매출"
                  color="text-blue-600"
                  months={months}
                  summaryData={summaryData}
                  localTargets={localTargets}
                  targetKey="targetSales"
                  actualKey="salesAmount"
                  isEditing={isEditingTargets}
                  onSave={handleTargetSave}
                />
                {/* 원재료액 목표 */}
                <TargetRow
                  label="원재료액"
                  color="text-orange-600"
                  months={months}
                  summaryData={summaryData}
                  localTargets={localTargets}
                  targetKey="targetRawMaterial"
                  actualKey="rawMaterialCost"
                  isEditing={isEditingTargets}
                  onSave={handleTargetSave}
                />
                {/* 부재료액 목표 */}
                <TargetRow
                  label="부재료액"
                  color="text-purple-600"
                  months={months}
                  summaryData={summaryData}
                  localTargets={localTargets}
                  targetKey="targetSubMaterial"
                  actualKey="subMaterialCost"
                  isEditing={isEditingTargets}
                  onSave={handleTargetSave}
                />
                {/* 노무비액 목표 */}
                <TargetRow
                  label="노무비액"
                  color="text-teal-600"
                  months={months}
                  summaryData={summaryData}
                  localTargets={localTargets}
                  targetKey="targetLabor"
                  actualKey="laborCost"
                  isEditing={isEditingTargets}
                  onSave={handleTargetSave}
                />
                {/* 경비액 목표 */}
                <TargetRow
                  label="경비액"
                  color="text-red-600"
                  months={months}
                  summaryData={summaryData}
                  localTargets={localTargets}
                  targetKey="targetExpense"
                  actualKey="expenseAmount"
                  isEditing={isEditingTargets}
                  onSave={handleTargetSave}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <>
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {formatMonth(summaryData[summaryData.length - 1]?.month || '2026-01')} 일별 누적 금액
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dayOfMonth" tick={{ fontSize: 11 }} label={{ value: '일', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₩${formatCurrency(v)}`} />
                  <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="cumSales" name="누적매출" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="cumRawMaterial" name="누적원재료" stroke="#F97316" fill="#F97316" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="cumLabor" name="누적노무비" stroke="#14B8A6" fill="#14B8A6" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="cumExpense" name="누적경비" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">일별 누적 비율 추이</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dayOfMonth" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Line type="monotone" dataKey="cumRawMaterialRatio" name="원재료비율" stroke="#F97316" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="cumLaborRatio" name="노무비비율" stroke="#14B8A6" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="cumExpenseRatio" name="경비비율" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// 목표 입력 행 컴포넌트
const TargetRow = ({
  label, color, months, summaryData, localTargets, targetKey, actualKey, isEditing, onSave,
}: {
  label: string;
  color: string;
  months: string[];
  summaryData: MonthlyCostSummary[];
  localTargets: Record<string, Partial<CostTarget>>;
  targetKey: keyof CostTarget;
  actualKey: keyof MonthlyCostSummary;
  isEditing: boolean;
  onSave: (month: string, target: Partial<CostTarget>) => void;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    months.forEach(m => {
      const target = localTargets[m];
      initial[m] = target?.[targetKey]?.toString() || '';
    });
    setValues(initial);
  }, [months, localTargets, targetKey]);

  const handleChange = (month: string, value: string) => {
    setValues(prev => ({ ...prev, [month]: value }));
  };

  const handleBlur = (month: string) => {
    const numValue = parseFloat(values[month]) || 0;
    onSave(month, { [targetKey]: numValue });
  };

  return (
    <tr>
      <td className={`px-4 py-3 font-medium ${color} border-r border-gray-200`}>{label}</td>
      {months.map(m => {
        const data = summaryData.find(d => d.month === m);
        const actual = data?.[actualKey] as number || 0;

        return (
          <td key={m} className="px-4 py-3 text-center">
            <div className="text-xs text-gray-400 mb-1">실적: ₩{formatCurrency(actual)}</div>
            {isEditing ? (
              <input
                type="number"
                value={values[m] || ''}
                onChange={(e) => handleChange(m, e.target.value)}
                onBlur={() => handleBlur(m)}
                placeholder="목표 입력"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
              />
            ) : (
              <div className="font-medium">
                ₩{formatCurrency(parseFloat(values[m]) || 0)}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
};
