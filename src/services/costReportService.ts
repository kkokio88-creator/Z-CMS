/**
 * Cost Report Service
 * Handles communication with backend for cost data from Google Sheets
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface MonthlyCostSummary {
  month: string;
  // 실제 값
  salesAmount: number; // 생산매출
  rawMaterialCost: number; // 원재료액
  subMaterialCost: number; // 부재료액
  laborCost: number; // 노무비액
  expenseAmount: number; // 경비액
  totalCost: number; // 총 원가
  wasteCost: number; // 폐기 (참고용)

  // 비율 (생산매출 / 각 항목)
  profitRatio: number; // 생산매출/총원가 비율
  rawMaterialRatio: number; // 생산매출/원재료액
  subMaterialRatio: number; // 생산매출/부재료액
  laborRatio: number; // 생산매출/노무비액
  expenseRatio: number; // 생산매출/경비액

  // 목표 비율
  targetSales?: number | null;
  targetRawMaterial?: number | null;
  targetSubMaterial?: number | null;
  targetLabor?: number | null;
  targetExpense?: number | null;
  targetRatio?: number | null;

  // 달성률 (각 항목별)
  achievementRate?: number | null;
  rawMaterialAchievement?: number | null;
  subMaterialAchievement?: number | null;
  laborAchievement?: number | null;
  expenseAchievement?: number | null;

  // 초과/절감 금액
  rawMaterialVariance?: number | null; // + 절감, - 초과
  subMaterialVariance?: number | null;
  laborVariance?: number | null;
  expenseVariance?: number | null;
}

// 일별 누적 데이터
export interface DailyCumulativeData {
  date: string; // YYYY-MM-DD
  dayOfMonth: number; // 1~31일
  cumSales: number; // 누적 매출
  cumRawMaterial: number; // 누적 원재료
  cumSubMaterial: number; // 누적 부재료
  cumLabor: number; // 누적 노무비
  cumExpense: number; // 누적 경비
  cumTotal: number; // 누적 총원가

  // 누적 비율
  cumRawMaterialRatio: number;
  cumSubMaterialRatio: number;
  cumLaborRatio: number;
  cumExpenseRatio: number;
  cumTotalRatio: number;
}

export interface CostTarget {
  month: string;
  targetSales: number; // 목표 생산매출
  targetRawMaterial: number; // 목표 원재료액
  targetSubMaterial: number; // 목표 부재료액
  targetLabor: number; // 목표 노무비액
  targetExpense: number; // 목표 경비액

  // 계산된 목표 비율
  targetRawMaterialRatio?: number;
  targetSubMaterialRatio?: number;
  targetLaborRatio?: number;
  targetExpenseRatio?: number;
  targetTotalRatio?: number;
}

export interface CostReportData {
  summary: MonthlyCostSummary[];
  targets: CostTarget[];
  dailyCumulative?: DailyCumulativeData[]; // 당월 일별 누적
}

// Test Google Sheets connection
export const testSheetsConnection = async (): Promise<{
  success: boolean;
  message: string;
  sheetNames?: string[];
}> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/test`);
    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message:
        error.message === 'Failed to fetch'
          ? '백엔드 서버에 연결할 수 없습니다.'
          : `오류: ${error.message}`,
    };
  }
};

// Get monthly cost summary with targets
export const getCostSummary = async (): Promise<CostReportData> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/summary`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch cost summary');
    }

    return {
      summary: result.data || [],
      targets: result.targets || [],
    };
  } catch (error: any) {
    console.error('Cost summary fetch error:', error);
    return {
      summary: [],
      targets: [],
    };
  }
};

// Get targets
export const getTargets = async (): Promise<CostTarget[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/targets`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Targets fetch error:', error);
    return [];
  }
};

// Save all targets
export const saveTargets = async (targets: CostTarget[]): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets }),
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Targets save error:', error);
    return false;
  }
};

// Update single target (expanded - all 5 categories)
export const updateTarget = async (
  month: string,
  target: Partial<CostTarget>
): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/targets/${month}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Target update error:', error);
    return false;
  }
};

// Get daily cumulative data for current month
export const getDailyCumulative = async (month?: string): Promise<DailyCumulativeData[]> => {
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const response = await fetch(`${BACKEND_URL}/cost-report/daily/${targetMonth}`);
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Daily cumulative fetch error:', error);
    return [];
  }
};

// Calculate variance (savings/overspend) based on target ratio
export const calculateVariance = (
  actualSales: number,
  actualCost: number,
  targetRatio: number
): number => {
  // 목표 비용 = 실제 매출 / 목표 비율
  const targetCost = targetRatio > 0 ? actualSales / targetRatio : 0;
  // 절감(+) / 초과(-)
  return targetCost - actualCost;
};

// Configure Google Sheets (API key or credentials)
export const configureSheets = async (apiKey?: string, credentials?: any): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/cost-report/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, credentials }),
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Sheets config error:', error);
    return false;
  }
};

// Format currency for display
export const formatCurrency = (amount: number): string => {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만`;
  }
  return amount.toLocaleString();
};

// Format month for display (YYYY-MM -> YYYY년 M월)
export const formatMonth = (month: string): string => {
  const [year, m] = month.split('-');
  return `${year}년 ${parseInt(m)}월`;
};
