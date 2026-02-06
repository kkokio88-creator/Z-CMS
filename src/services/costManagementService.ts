/**
 * Cost Management Service
 * Integrates ECOUNT data, Google Sheets data, and AI agent insights
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Purchase Order Data
export interface PurchaseOrderData {
  orderId: string;
  orderDate: string;
  supplierName: string;
  supplierCode: string;
  totalAmount: number;
  itemCount: number;
  status: string;
  isUrgent: boolean;
  items: {
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
}

// Inventory by Location
export interface InventoryByLocation {
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  category: string;
}

// Attendance Record - 부서별 일일 노무비 집계 (Google Sheet DB_노무비 시트 기반)
export interface AttendanceRecord {
  week: string; // 주차
  date: string; // 날짜
  department: string; // 부서명
  headcount: number; // 근무인원(명)
  // 근무시간
  weekdayRegularHours: number; // 평일 소정근무
  weekdayOvertimeHours: number; // 평일 연장근무
  weekdayNightHours: number; // 평일 야간근무
  weekdayTotalHours: number; // 평일 합계
  holidayRegularHours: number; // 휴일 소정근무
  holidayOvertimeHours: number; // 휴일 연장근무
  holidayNightHours: number; // 휴일 야간근무
  holidayTotalHours: number; // 휴일 합계
  // 노무비 (Google Sheet에서 이미 계산된 값)
  weekdayRegularPay: number; // 평일 소정비용
  weekdayOvertimePay: number; // 평일 연장비용
  weekdayNightPay: number; // 평일 야간비용
  holidayRegularPay: number; // 휴일 소정비용
  holidayOvertimePay: number; // 휴일 연장비용
  holidayNightPay: number; // 휴일 야간비용
  totalPay: number; // 노무비 합계 (Sheet에서 계산된 값 그대로 사용)
}

// 급여 마스터 테이블 - 직급별 시간당 임금
export interface WageRate {
  grade: string;
  hourlyWage: number;
  overtimeMultiplier: number; // 초과근무 배수 (1.5배)
  nightMultiplier: number; // 야간근무 배수 (2배)
  holidayMultiplier: number; // 휴일근무 배수 (2배)
}

// 기본 급여 마스터 데이터
export const DEFAULT_WAGE_RATES: WageRate[] = [
  { grade: '사원', hourlyWage: 12000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
  { grade: '대리', hourlyWage: 15000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
  { grade: '과장', hourlyWage: 18000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
  { grade: '차장', hourlyWage: 22000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
  { grade: '부장', hourlyWage: 28000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
  { grade: '생산직', hourlyWage: 13000, overtimeMultiplier: 1.5, nightMultiplier: 2.0, holidayMultiplier: 2.0 },
];

// Cost Analysis Summary
export interface CostAnalysisSummary {
  totalPurchaseAmount: number;
  totalInventoryValue: number;
  totalLaborCost: number;
  totalOvertimeHours: number;
  avgOvertimePerEmployee: number;
  urgentOrderRatio: number;
  topSuppliers: { name: string; amount: number }[];
  costByWarehouse: { warehouse: string; value: number }[];
  laborByDepartment: { department: string; hours: number; cost: number }[];
}

// AI Agent Insight
export interface AgentInsight {
  id: string;
  agentId: string;
  domain: string;
  title: string;
  description: string;
  highlight?: string;
  level: 'info' | 'warning' | 'critical';
  confidence: number;
  suggestedActions?: string[];
  timestamp: string;
}

// Fetch Purchase Orders - Google Sheet 우선, ECOUNT 폴백
export const fetchPurchaseOrders = async (
  dateFrom?: string,
  dateTo?: string
): Promise<PurchaseOrderData[]> => {
  try {
    // 먼저 Google Sheet에서 구매 데이터 가져오기 시도
    const gsResponse = await fetch(`${BACKEND_URL}/googlesheet/purchases`);
    const gsResult = await gsResponse.json();

    if (gsResult.success && gsResult.data && gsResult.data.length > 0) {
      // Google Sheet 데이터를 PurchaseOrderData 형식으로 변환
      const groupedByDate = new Map<string, any[]>();
      gsResult.data.forEach((item: any) => {
        const date = item.date || 'unknown';
        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, []);
        }
        groupedByDate.get(date)!.push(item);
      });

      return Array.from(groupedByDate.entries()).map(([date, items], idx) => ({
        orderId: `GS-PO-${date}-${idx}`,
        orderDate: date,
        supplierName: items[0]?.productName?.split(' ')[0] || '공급업체',
        supplierCode: items[0]?.productCode || '',
        totalAmount: items.reduce((sum: number, i: any) => sum + (i.total || 0), 0),
        itemCount: items.length,
        status: 'completed',
        isUrgent: false,
        items: items.map((i: any) => ({
          productCode: i.productCode || '',
          productName: i.productName || '',
          quantity: i.quantity || 0,
          unitPrice: i.unitPrice || 0,
          amount: i.total || 0,
        })),
      }));
    }

    // Google Sheet 실패 시 ECOUNT API 시도
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const from = dateFrom || threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const to = dateTo || today.toISOString().slice(0, 10).replace(/-/g, '');

    const response = await fetch(
      `${BACKEND_URL}/ecount/purchase-orders?dateFrom=${from}&dateTo=${to}`
    );
    const result = await response.json();

    if (!result.success) {
      console.warn('Failed to fetch purchase orders:', result.error);
      return [];
    }

    return result.data.map((po: any) => ({
      orderId: po.ORDER_NO || po.SLIP_NO || `PO-${Math.random().toString(36).substr(2, 9)}`,
      orderDate: po.ORDER_DATE || po.IO_DATE || '',
      supplierName: po.CUST_DES || po.VENDOR_DES || '미지정',
      supplierCode: po.CUST_CD || po.VENDOR_CD || '',
      totalAmount: parseFloat(po.SUPPLY_AMT || po.AMT || 0),
      itemCount: parseInt(po.QTY || 1),
      status: po.STATUS || 'pending',
      isUrgent: (po.REMARK || '').includes('긴급') || (po.REMARK || '').includes('urgent'),
      items: [],
    }));
  } catch (error) {
    console.error('Purchase orders fetch error:', error);
    return [];
  }
};

// Fetch Inventory by Location - Supabase 우선, ECOUNT 폴백
export const fetchInventoryByLocation = async (
  baseDate?: string
): Promise<InventoryByLocation[]> => {
  // 1. Supabase 캐시에서 먼저 시도
  try {
    const sbResponse = await fetch(`${BACKEND_URL}/data/inventory`);
    const sbResult = await sbResponse.json();

    if (sbResult.success && sbResult.data && sbResult.data.length > 0) {
      const mapped = sbResult.data.map((inv: any) => ({
        warehouseCode: inv.warehouse_code || '001',
        warehouseName: inv.warehouse_code || '메인창고',
        productCode: inv.product_code || '',
        productName: inv.product_name || inv.product_code || '품목',
        quantity: Number(inv.balance_qty || 0),
        unitPrice: 1000, // Supabase에는 단가 없음 - 기본값
        totalValue: Number(inv.balance_qty || 0) * 1000,
        category: '일반',
      }));
      console.log('[costManagementService] Supabase 재고:', mapped.length, '건');
      return mapped;
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  // 2. ECOUNT inventory-by-location API
  try {
    const url = baseDate
      ? `${BACKEND_URL}/ecount/inventory-by-location?baseDate=${baseDate}`
      : `${BACKEND_URL}/ecount/inventory-by-location`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      return result.data.map((inv: any) => ({
        warehouseCode: inv.WH_CD || '001',
        warehouseName: inv.WH_DES || inv.WH_CD || '메인창고',
        productCode: inv.PROD_CD || '',
        productName: inv.PROD_DES || inv.PROD_CD || '품목',
        quantity: parseFloat(inv.BAL_QTY || inv.QTY || inv.BALANCE_QTY || 0),
        unitPrice: parseFloat(inv.UNIT_PRICE || 1000),
        totalValue:
          parseFloat(inv.AMT || 0) || parseFloat(inv.BAL_QTY || inv.QTY || 0) * parseFloat(inv.UNIT_PRICE || 1000),
        category: inv.CLASS_CD || inv.CATEGORY || '일반',
      }));
    }

    // 3. 일반 inventory API
    const invResponse = await fetch(`${BACKEND_URL}/ecount/inventory`);
    const invResult = await invResponse.json();

    if (invResult.success && invResult.data && invResult.data.length > 0) {
      return invResult.data.map((inv: any) => ({
        warehouseCode: inv.WH_CD || '001',
        warehouseName: inv.WH_DES || '메인창고',
        productCode: inv.PROD_CD || '',
        productName: inv.PROD_DES || inv.PROD_CD || '품목',
        quantity: parseFloat(inv.BAL_QTY || inv.QTY || 0),
        unitPrice: parseFloat(inv.UNIT_PRICE || 1000),
        totalValue: parseFloat(inv.BAL_QTY || inv.QTY || 0) * parseFloat(inv.UNIT_PRICE || 1000),
        category: inv.CLASS_CD || '일반',
      }));
    }
  } catch (error) {
    console.error('[costManagementService] 재고 API 오류:', error);
  }

  return [];
};

// Fetch Attendance Records - Google Sheet DB_노무비 시트에서 실제 데이터 사용
export const fetchAttendanceRecords = async (
  dateFrom?: string,
  dateTo?: string
): Promise<AttendanceRecord[]> => {
  try {
    // Google Sheet 노무비 데이터 가져오기 (실제 데이터만 사용, 추정 금지)
    console.log('[costManagementService] 노무비 API 호출:', `${BACKEND_URL}/googlesheet/labor`);
    const gsResponse = await fetch(`${BACKEND_URL}/googlesheet/labor`);
    const gsResult = await gsResponse.json();

    console.log('[costManagementService] 노무비 API 응답:', {
      success: gsResult.success,
      dataLength: gsResult.data?.length || 0,
      count: gsResult.count,
      error: gsResult.error,
    });

    if (gsResult.success && gsResult.data && gsResult.data.length > 0) {
      // Google Sheet LaborData를 AttendanceRecord 형식으로 변환 (1:1 매핑)
      let records: AttendanceRecord[] = gsResult.data.map((labor: any) => ({
        week: labor.week || '',
        date: labor.date || '',
        department: labor.department || '',
        headcount: labor.headcount || 0,
        // 근무시간
        weekdayRegularHours: labor.weekdayRegularHours || 0,
        weekdayOvertimeHours: labor.weekdayOvertimeHours || 0,
        weekdayNightHours: labor.weekdayNightHours || 0,
        weekdayTotalHours: labor.weekdayTotalHours || 0,
        holidayRegularHours: labor.holidayRegularHours || 0,
        holidayOvertimeHours: labor.holidayOvertimeHours || 0,
        holidayNightHours: labor.holidayNightHours || 0,
        holidayTotalHours: labor.holidayTotalHours || 0,
        // 노무비 (Google Sheet에서 이미 계산된 값 그대로 사용)
        weekdayRegularPay: labor.weekdayRegularPay || 0,
        weekdayOvertimePay: labor.weekdayOvertimePay || 0,
        weekdayNightPay: labor.weekdayNightPay || 0,
        holidayRegularPay: labor.holidayRegularPay || 0,
        holidayOvertimePay: labor.holidayOvertimePay || 0,
        holidayNightPay: labor.holidayNightPay || 0,
        totalPay: labor.totalPay || 0,
      }));

      console.log('[costManagementService] 노무비 데이터 변환 완료:', records.length, '건');
      if (records.length > 0) {
        console.log('[costManagementService] 노무비 샘플:', {
          date: records[0].date,
          department: records[0].department,
          totalPay: records[0].totalPay,
        });
      }

      // 날짜 범위 필터링
      if (dateFrom || dateTo) {
        const fromDate = dateFrom ? dateFrom.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '0000-00-00';
        const toDate = dateTo ? dateTo.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '9999-99-99';
        records = records.filter((r: AttendanceRecord) => r.date >= fromDate && r.date <= toDate);
      }

      return records;
    }

    // Google Sheet 데이터가 없으면 빈 배열 반환 (추정 데이터 생성하지 않음)
    console.warn('[costManagementService] 노무비 데이터 없음 - Google Sheet DB_노무비');
    return [];
  } catch (error) {
    console.error('[costManagementService] 노무비 API 오류:', error);
    return [];
  }
};

// Fetch Customers/Vendors
export const fetchCustomers = async (): Promise<{ code: string; name: string; type: string }[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/ecount/customers`);
    const result = await response.json();

    if (!result.success) {
      console.warn('Failed to fetch customers:', result.error);
      return [];
    }

    return result.data.map((cust: any) => ({
      code: cust.CUST_CD || cust.VENDOR_CD || '',
      name: cust.CUST_DES || cust.VENDOR_DES || '',
      type: cust.CUST_TYPE || 'general',
    }));
  } catch (error) {
    console.error('Customers fetch error:', error);
    return [];
  }
};

// 노무비 계산 헬퍼 함수 - Google Sheet에서 이미 계산된 값을 반환
export const calculateLaborCostForRecord = (
  att: AttendanceRecord
): {
  baseCost: number;
  overtimeCost: number;
  nightCost: number;
  holidayCost: number;
  totalCost: number;
  totalHours: number;
  overtimeHours: number;
} => {
  // Google Sheet에서 이미 계산된 노무비 값 사용 (이중 계산 방지)
  const baseCost = att.weekdayRegularPay + att.holidayRegularPay;
  const overtimeCost = att.weekdayOvertimePay + att.holidayOvertimePay;
  const nightCost = att.weekdayNightPay + att.holidayNightPay;
  const holidayCost = att.holidayRegularPay + att.holidayOvertimePay + att.holidayNightPay;

  // 총 근무시간 및 초과근무시간 계산
  const totalHours = att.weekdayTotalHours + att.holidayTotalHours;
  const overtimeHours = att.weekdayOvertimeHours + att.holidayOvertimeHours;

  return {
    baseCost,
    overtimeCost,
    nightCost,
    holidayCost,
    totalCost: att.totalPay, // Google Sheet의 계산된 합계 사용
    totalHours,
    overtimeHours,
  };
};

// Calculate Cost Analysis Summary
export const calculateCostAnalysis = (
  purchaseOrders: PurchaseOrderData[],
  inventory: InventoryByLocation[],
  attendance: AttendanceRecord[]
): CostAnalysisSummary => {
  // Total purchase amount
  const totalPurchaseAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);

  // Total inventory value
  const totalInventoryValue = inventory.reduce((sum, inv) => sum + inv.totalValue, 0);

  // Labor calculations - Google Sheet에서 이미 계산된 값 사용
  let totalOvertimeHours = 0;
  let totalHeadcount = 0;
  attendance.forEach(att => {
    const laborInfo = calculateLaborCostForRecord(att);
    totalOvertimeHours += laborInfo.overtimeHours;
    totalHeadcount += att.headcount;
  });

  // 고유 부서-날짜 조합으로 평균 초과근무 계산
  const uniqueDeptDates = new Set(attendance.map(a => `${a.department}-${a.date}`)).size;
  const avgOvertimePerEmployee = uniqueDeptDates > 0 ? totalOvertimeHours / uniqueDeptDates : 0;

  // 총 노무비 - Google Sheet의 계산된 값 합산
  const totalLaborCost = attendance.reduce((sum, att) => sum + att.totalPay, 0);

  // Urgent order ratio
  const urgentOrders = purchaseOrders.filter(po => po.isUrgent).length;
  const urgentOrderRatio =
    purchaseOrders.length > 0 ? (urgentOrders / purchaseOrders.length) * 100 : 0;

  // Top suppliers
  const supplierMap = new Map<string, number>();
  purchaseOrders.forEach(po => {
    const current = supplierMap.get(po.supplierName) || 0;
    supplierMap.set(po.supplierName, current + po.totalAmount);
  });
  const topSuppliers = Array.from(supplierMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  // Cost by warehouse
  const warehouseMap = new Map<string, number>();
  inventory.forEach(inv => {
    const current = warehouseMap.get(inv.warehouseName) || 0;
    warehouseMap.set(inv.warehouseName, current + inv.totalValue);
  });
  const costByWarehouse = Array.from(warehouseMap.entries()).map(([warehouse, value]) => ({
    warehouse,
    value,
  }));

  // Labor by department - Google Sheet 데이터 기반 집계
  const deptMap = new Map<string, { hours: number; cost: number; overtimeHours: number; overtimeCost: number }>();
  attendance.forEach(att => {
    const current = deptMap.get(att.department) || { hours: 0, cost: 0, overtimeHours: 0, overtimeCost: 0 };
    const laborInfo = calculateLaborCostForRecord(att);
    deptMap.set(att.department, {
      hours: current.hours + laborInfo.totalHours,
      cost: current.cost + att.totalPay,
      overtimeHours: current.overtimeHours + laborInfo.overtimeHours,
      overtimeCost: current.overtimeCost + laborInfo.overtimeCost,
    });
  });
  const laborByDepartment = Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    hours: data.hours,
    cost: data.cost,
  }));

  return {
    totalPurchaseAmount,
    totalInventoryValue,
    totalLaborCost,
    totalOvertimeHours,
    avgOvertimePerEmployee,
    urgentOrderRatio,
    topSuppliers,
    costByWarehouse,
    laborByDepartment,
  };
};

// Fetch AI Agent Insights
export const fetchAgentInsights = async (): Promise<AgentInsight[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/agents/insights`);
    const result = await response.json();

    if (!result.success) {
      return [];
    }

    return result.data
      .filter(
        (insight: AgentInsight) =>
          insight.domain === 'profitability' || insight.domain === 'inventory'
      )
      .slice(0, 10);
  } catch (error) {
    console.error('Agent insights fetch error:', error);
    return [];
  }
};

// Request Cost Analysis from Agent
export const requestCostAnalysis = async (costData: {
  salesAmount: number;
  rawMaterialCost: number;
  subMaterialCost: number;
  laborCost: number;
  expenseAmount: number;
  targetRatios?: Record<string, number>;
}): Promise<{ success: boolean; taskId?: string; message?: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/agents/cost-management/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'analyze_cost_structure',
        payload: { costData, targetRatios: costData.targetRatios || {} },
      }),
    });

    const result = await response.json();
    return {
      success: result.success,
      taskId: result.taskId,
      message: result.message,
    };
  } catch (error) {
    console.error('Cost analysis request error:', error);
    return { success: false, message: '분석 요청 실패' };
  }
};

// Helper: Calculate work hours from clock in/out times
function calculateWorkHours(clockIn: string, clockOut: string): number {
  try {
    const [inHour, inMin] = clockIn.split(':').map(Number);
    const [outHour, outMin] = clockOut.split(':').map(Number);

    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;

    // Handle overnight shifts
    const diff =
      outMinutes >= inMinutes ? outMinutes - inMinutes : 24 * 60 - inMinutes + outMinutes;

    // Subtract 1 hour lunch break
    return Math.max(0, (diff - 60) / 60);
  } catch {
    return 8; // Default to 8 hours
  }
}

// Format currency
export const formatCurrency = (amount: number): string => {
  if (Math.abs(amount) >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  } else if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(0)}만`;
  }
  return amount.toLocaleString();
};
