/**
 * Cost Management Service
 * Integrates ECOUNT data, Google Sheets data, and AI agent insights
 */

const BACKEND_URL = 'http://localhost:3001/api';

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

// Attendance Record
export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  workHours: number;
  overtimeHours: number;
  shift: string;
  department: string;
}

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

// Fetch Purchase Orders
export const fetchPurchaseOrders = async (dateFrom?: string, dateTo?: string): Promise<PurchaseOrderData[]> => {
  try {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const from = dateFrom || threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const to = dateTo || today.toISOString().slice(0, 10).replace(/-/g, '');

    const response = await fetch(`${BACKEND_URL}/ecount/purchase-orders?dateFrom=${from}&dateTo=${to}`);
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

// Fetch Inventory by Location
export const fetchInventoryByLocation = async (baseDate?: string): Promise<InventoryByLocation[]> => {
  try {
    const url = baseDate
      ? `${BACKEND_URL}/ecount/inventory-by-location?baseDate=${baseDate}`
      : `${BACKEND_URL}/ecount/inventory-by-location`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      console.warn('Failed to fetch inventory by location:', result.error);
      return [];
    }

    return result.data.map((inv: any) => ({
      warehouseCode: inv.WH_CD || '001',
      warehouseName: inv.WH_DES || inv.WH_CD || '메인창고',
      productCode: inv.PROD_CD || '',
      productName: inv.PROD_DES || inv.PROD_CD || '품목',
      quantity: parseFloat(inv.QTY || inv.BALANCE_QTY || 0),
      unitPrice: parseFloat(inv.UNIT_PRICE || 0),
      totalValue: parseFloat(inv.AMT || 0) || parseFloat(inv.QTY || 0) * parseFloat(inv.UNIT_PRICE || 0),
      category: inv.CLASS_CD || inv.CATEGORY || '일반',
    }));
  } catch (error) {
    console.error('Inventory by location fetch error:', error);
    return [];
  }
};

// Fetch Attendance Records
export const fetchAttendanceRecords = async (dateFrom?: string, dateTo?: string): Promise<AttendanceRecord[]> => {
  try {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const from = dateFrom || oneMonthAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const to = dateTo || today.toISOString().slice(0, 10).replace(/-/g, '');

    const response = await fetch(`${BACKEND_URL}/ecount/attendance?dateFrom=${from}&dateTo=${to}`);
    const result = await response.json();

    if (!result.success) {
      console.warn('Failed to fetch attendance records:', result.error);
      return [];
    }

    return result.data.map((att: any) => {
      const clockIn = att.CLOCK_IN || att.START_TIME || '09:00';
      const clockOut = att.CLOCK_OUT || att.END_TIME || '18:00';
      const workHours = calculateWorkHours(clockIn, clockOut);

      return {
        employeeId: att.EMP_CD || att.EMPLOYEE_ID || '',
        employeeName: att.EMP_DES || att.EMPLOYEE_NAME || '직원',
        date: att.ATT_DATE || att.WORK_DATE || '',
        clockIn,
        clockOut,
        workHours,
        overtimeHours: Math.max(0, workHours - 8),
        shift: att.SHIFT || att.WORK_TYPE || '일근',
        department: att.DEPT_DES || att.DEPARTMENT || '생산부',
      };
    });
  } catch (error) {
    console.error('Attendance records fetch error:', error);
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

// Calculate Cost Analysis Summary
export const calculateCostAnalysis = (
  purchaseOrders: PurchaseOrderData[],
  inventory: InventoryByLocation[],
  attendance: AttendanceRecord[],
  hourlyWage: number = 15000
): CostAnalysisSummary => {
  // Total purchase amount
  const totalPurchaseAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);

  // Total inventory value
  const totalInventoryValue = inventory.reduce((sum, inv) => sum + inv.totalValue, 0);

  // Labor calculations
  const totalOvertimeHours = attendance.reduce((sum, att) => sum + att.overtimeHours, 0);
  const uniqueEmployees = new Set(attendance.map(a => a.employeeId)).size;
  const avgOvertimePerEmployee = uniqueEmployees > 0 ? totalOvertimeHours / uniqueEmployees : 0;
  const totalLaborCost = attendance.reduce((sum, att) => sum + (att.workHours * hourlyWage), 0);

  // Urgent order ratio
  const urgentOrders = purchaseOrders.filter(po => po.isUrgent).length;
  const urgentOrderRatio = purchaseOrders.length > 0 ? (urgentOrders / purchaseOrders.length) * 100 : 0;

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
  const costByWarehouse = Array.from(warehouseMap.entries())
    .map(([warehouse, value]) => ({ warehouse, value }));

  // Labor by department
  const deptMap = new Map<string, { hours: number; cost: number }>();
  attendance.forEach(att => {
    const current = deptMap.get(att.department) || { hours: 0, cost: 0 };
    deptMap.set(att.department, {
      hours: current.hours + att.workHours,
      cost: current.cost + (att.workHours * hourlyWage),
    });
  });
  const laborByDepartment = Array.from(deptMap.entries())
    .map(([department, data]) => ({ department, ...data }));

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
      .filter((insight: AgentInsight) =>
        insight.domain === 'profitability' || insight.domain === 'inventory')
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
    const diff = outMinutes >= inMinutes
      ? outMinutes - inMinutes
      : (24 * 60 - inMinutes) + outMinutes;

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
