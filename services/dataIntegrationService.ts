/**
 * 데이터 통합 서비스
 *
 * 설정된 데이터 소스(Google Sheets, ECOUNT API)에서 데이터를 가져와
 * 대시보드 컴포넌트에서 사용할 수 있도록 통합/가공합니다.
 */

const API_BASE = 'http://localhost:3001';
const DATASOURCE_CONFIG_KEY = 'ZCMS_DATASOURCE_CONFIG';

// ============================================
// 타입 정의
// ============================================

export interface DataSourceConfig {
  type: 'googleSheets' | 'ecount' | 'none';
  googleSheets?: {
    spreadsheetUrl: string;
    sheetName: string;
  };
  ecount?: {
    enabled: boolean;
  };
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastTested?: string;
  errorMessage?: string;
}

export interface DataSourcesConfig {
  mealPlan: DataSourceConfig;
  salesHistory: DataSourceConfig;
  bomSan: DataSourceConfig;
  bomZip: DataSourceConfig;
  inventory: DataSourceConfig;
  purchaseOrders: DataSourceConfig;
  purchaseHistory: DataSourceConfig;
}

// 통합 데이터 타입
export interface MealPlanItem {
  date: string;
  dayOfWeek: string;
  mealType: string; // 조식, 중식, 석식
  menuName: string;
  plannedQty: number;
  channel?: string;
}

export interface SalesRecord {
  date: string;
  menuName: string;
  channel: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface BomItem {
  menuCode: string;
  menuName: string;
  ingredientCode: string;
  ingredientName: string;
  requiredQty: number;
  unit: string;
  brand: 'SAN' | 'ZIP';
}

export interface InventoryItem {
  itemCode: string;
  itemName: string;
  currentQty: number;
  unit: string;
  safetyStock: number;
  lastUpdated: string;
}

export interface PurchaseRecord {
  date: string;
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  orderNo: string;
  orderDate: string;
  supplierName: string;
  itemName: string;
  quantity: number;
  expectedDate: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'received';
}

// 통합된 전체 데이터
export interface IntegratedData {
  mealPlan: MealPlanItem[];
  sales: SalesRecord[];
  bomSan: BomItem[];
  bomZip: BomItem[];
  bomCombined: BomItem[]; // SAN + ZIP 합친 것
  inventory: InventoryItem[];
  purchaseHistory: PurchaseRecord[];
  purchaseOrders: PurchaseOrder[];
  lastUpdated: string;
  sourceStatus: {
    [key: string]: { loaded: boolean; rowCount: number; error?: string };
  };
}

// ============================================
// 유틸리티 함수
// ============================================

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]+$/.test(url)) return url;
  return null;
}

// ============================================
// 데이터 가져오기 함수
// ============================================

export async function fetchSheetData(
  spreadsheetUrl: string,
  sheetName: string
): Promise<{ success: boolean; data: Record<string, any>[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/sheets/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetUrl, sheetName }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

// 설정 로드
export function loadDataSourcesConfig(): DataSourcesConfig | null {
  const saved = localStorage.getItem(DATASOURCE_CONFIG_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

// ============================================
// 데이터 변환 함수 (시트 → 통합 타입)
// ============================================

function transformMealPlan(raw: Record<string, any>[]): MealPlanItem[] {
  return raw
    .map(row => ({
      date: String(row['날짜'] || row['일자'] || row['date'] || ''),
      dayOfWeek: String(row['요일'] || ''),
      mealType: String(row['식사구분'] || row['구분'] || row['mealType'] || ''),
      menuName: String(row['메뉴명'] || row['메뉴'] || row['menu'] || ''),
      plannedQty: Number(row['예상수량'] || row['수량'] || row['qty'] || 0),
      channel: String(row['채널'] || row['판매처'] || ''),
    }))
    .filter(item => item.date && item.menuName);
}

function transformSales(raw: Record<string, any>[]): SalesRecord[] {
  return raw
    .map(row => ({
      date: String(row['날짜'] || row['일자'] || row['date'] || ''),
      menuName: String(row['메뉴명'] || row['메뉴'] || row['품목'] || row['품명'] || ''),
      channel: String(row['채널'] || row['판매처'] || row['거래처'] || ''),
      quantity: Number(row['수량'] || row['판매수량'] || 0),
      unitPrice: Number(row['단가'] || row['판매단가'] || 0),
      totalAmount: Number(row['금액'] || row['매출액'] || row['합계'] || 0),
    }))
    .filter(item => item.date && item.menuName);
}

function transformBom(raw: Record<string, any>[], brand: 'SAN' | 'ZIP'): BomItem[] {
  return raw
    .map(row => ({
      menuCode: String(row['메뉴코드'] || row['품목코드'] || row['완제품코드'] || ''),
      menuName: String(row['메뉴명'] || row['품목명'] || row['완제품명'] || row['메뉴'] || ''),
      ingredientCode: String(row['원재료코드'] || row['자재코드'] || row['재료코드'] || ''),
      ingredientName: String(
        row['원재료명'] || row['자재명'] || row['재료명'] || row['원재료'] || ''
      ),
      requiredQty: Number(row['소요량'] || row['필요량'] || row['사용량'] || row['수량'] || 0),
      unit: String(row['단위'] || 'g'),
      brand,
    }))
    .filter(item => item.menuName && item.ingredientName);
}

function transformInventory(raw: Record<string, any>[]): InventoryItem[] {
  return raw
    .map(row => ({
      itemCode: String(row['품목코드'] || row['자재코드'] || row['코드'] || ''),
      itemName: String(row['품목명'] || row['자재명'] || row['품명'] || ''),
      currentQty: Number(row['현재고'] || row['재고량'] || row['수량'] || 0),
      unit: String(row['단위'] || ''),
      safetyStock: Number(row['안전재고'] || row['최소재고'] || 0),
      lastUpdated: String(row['갱신일'] || row['기준일'] || new Date().toISOString().split('T')[0]),
    }))
    .filter(item => item.itemName);
}

function transformPurchaseHistory(raw: Record<string, any>[]): PurchaseRecord[] {
  return raw
    .map(row => ({
      date: String(row['날짜'] || row['일자'] || row['구매일'] || ''),
      supplierCode: String(row['거래처코드'] || row['공급업체코드'] || ''),
      supplierName: String(row['거래처'] || row['거래처명'] || row['공급업체'] || ''),
      itemCode: String(row['품목코드'] || row['자재코드'] || ''),
      itemName: String(row['품목명'] || row['자재명'] || row['품명'] || ''),
      quantity: Number(row['수량'] || row['구매수량'] || 0),
      unitPrice: Number(row['단가'] || row['매입단가'] || 0),
      totalAmount: Number(row['금액'] || row['매입액'] || row['합계'] || 0),
    }))
    .filter(item => item.date && item.itemName);
}

function transformPurchaseOrders(raw: Record<string, any>[]): PurchaseOrder[] {
  return raw
    .map(row => {
      const statusMap: Record<string, PurchaseOrder['status']> = {
        대기: 'pending',
        확정: 'confirmed',
        배송중: 'shipped',
        입고완료: 'received',
        pending: 'pending',
        confirmed: 'confirmed',
        shipped: 'shipped',
        received: 'received',
      };

      return {
        orderNo: String(row['발주번호'] || row['주문번호'] || ''),
        orderDate: String(row['발주일'] || row['주문일'] || ''),
        supplierName: String(row['거래처'] || row['공급업체'] || ''),
        itemName: String(row['품목명'] || row['품명'] || ''),
        quantity: Number(row['수량'] || row['발주수량'] || 0),
        expectedDate: String(row['입고예정일'] || row['예정일'] || ''),
        status: statusMap[String(row['상태'] || row['status'] || 'pending')] || 'pending',
      };
    })
    .filter(item => item.itemName);
}

// ============================================
// 메인 통합 함수
// ============================================

export async function fetchAllIntegratedData(): Promise<IntegratedData> {
  const config = loadDataSourcesConfig();

  const result: IntegratedData = {
    mealPlan: [],
    sales: [],
    bomSan: [],
    bomZip: [],
    bomCombined: [],
    inventory: [],
    purchaseHistory: [],
    purchaseOrders: [],
    lastUpdated: new Date().toISOString(),
    sourceStatus: {},
  };

  if (!config) {
    console.warn('[DataIntegration] 데이터 소스 설정이 없습니다.');
    return result;
  }

  // 각 데이터 소스에서 데이터 가져오기
  const fetchTasks: Promise<void>[] = [];

  // 식단표
  if (config.mealPlan.type === 'googleSheets' && config.mealPlan.googleSheets?.spreadsheetUrl) {
    fetchTasks.push(
      fetchSheetData(
        config.mealPlan.googleSheets.spreadsheetUrl,
        config.mealPlan.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.mealPlan = transformMealPlan(res.data);
          result.sourceStatus.mealPlan = { loaded: true, rowCount: result.mealPlan.length };
        } else {
          result.sourceStatus.mealPlan = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // 판매실적
  if (
    config.salesHistory.type === 'googleSheets' &&
    config.salesHistory.googleSheets?.spreadsheetUrl
  ) {
    fetchTasks.push(
      fetchSheetData(
        config.salesHistory.googleSheets.spreadsheetUrl,
        config.salesHistory.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.sales = transformSales(res.data);
          result.sourceStatus.salesHistory = { loaded: true, rowCount: result.sales.length };
        } else {
          result.sourceStatus.salesHistory = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // BOM (SAN)
  if (config.bomSan.type === 'googleSheets' && config.bomSan.googleSheets?.spreadsheetUrl) {
    fetchTasks.push(
      fetchSheetData(
        config.bomSan.googleSheets.spreadsheetUrl,
        config.bomSan.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.bomSan = transformBom(res.data, 'SAN');
          result.sourceStatus.bomSan = { loaded: true, rowCount: result.bomSan.length };
        } else {
          result.sourceStatus.bomSan = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // BOM (ZIP)
  if (config.bomZip.type === 'googleSheets' && config.bomZip.googleSheets?.spreadsheetUrl) {
    fetchTasks.push(
      fetchSheetData(
        config.bomZip.googleSheets.spreadsheetUrl,
        config.bomZip.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.bomZip = transformBom(res.data, 'ZIP');
          result.sourceStatus.bomZip = { loaded: true, rowCount: result.bomZip.length };
        } else {
          result.sourceStatus.bomZip = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // 재고현황
  if (config.inventory.type === 'googleSheets' && config.inventory.googleSheets?.spreadsheetUrl) {
    fetchTasks.push(
      fetchSheetData(
        config.inventory.googleSheets.spreadsheetUrl,
        config.inventory.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.inventory = transformInventory(res.data);
          result.sourceStatus.inventory = { loaded: true, rowCount: result.inventory.length };
        } else {
          result.sourceStatus.inventory = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // 구매현황
  if (
    config.purchaseHistory.type === 'googleSheets' &&
    config.purchaseHistory.googleSheets?.spreadsheetUrl
  ) {
    fetchTasks.push(
      fetchSheetData(
        config.purchaseHistory.googleSheets.spreadsheetUrl,
        config.purchaseHistory.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.purchaseHistory = transformPurchaseHistory(res.data);
          result.sourceStatus.purchaseHistory = {
            loaded: true,
            rowCount: result.purchaseHistory.length,
          };
        } else {
          result.sourceStatus.purchaseHistory = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // 발주현황
  if (
    config.purchaseOrders.type === 'googleSheets' &&
    config.purchaseOrders.googleSheets?.spreadsheetUrl
  ) {
    fetchTasks.push(
      fetchSheetData(
        config.purchaseOrders.googleSheets.spreadsheetUrl,
        config.purchaseOrders.googleSheets.sheetName
      ).then(res => {
        if (res.success) {
          result.purchaseOrders = transformPurchaseOrders(res.data);
          result.sourceStatus.purchaseOrders = {
            loaded: true,
            rowCount: result.purchaseOrders.length,
          };
        } else {
          result.sourceStatus.purchaseOrders = { loaded: false, rowCount: 0, error: res.error };
        }
      })
    );
  }

  // 모든 데이터 가져오기 완료 대기
  await Promise.all(fetchTasks);

  // BOM 통합
  result.bomCombined = [...result.bomSan, ...result.bomZip];

  console.log('[DataIntegration] 데이터 통합 완료:', {
    mealPlan: result.mealPlan.length,
    sales: result.sales.length,
    bomSan: result.bomSan.length,
    bomZip: result.bomZip.length,
    inventory: result.inventory.length,
    purchaseHistory: result.purchaseHistory.length,
    purchaseOrders: result.purchaseOrders.length,
  });

  return result;
}

// ============================================
// 분석용 파생 데이터 함수
// ============================================

// 메뉴별 원가 계산
export function calculateMenuCost(
  menuName: string,
  bom: BomItem[],
  purchaseHistory: PurchaseRecord[]
): {
  totalCost: number;
  ingredients: { name: string; qty: number; unitCost: number; cost: number }[];
} {
  const menuBom = bom.filter(b => b.menuName === menuName);
  const ingredients: { name: string; qty: number; unitCost: number; cost: number }[] = [];

  // 최근 매입단가 맵 생성
  const latestPriceMap = new Map<string, number>();
  purchaseHistory
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(p => {
      if (!latestPriceMap.has(p.itemName)) {
        latestPriceMap.set(p.itemName, p.unitPrice);
      }
    });

  let totalCost = 0;
  menuBom.forEach(item => {
    const unitCost = latestPriceMap.get(item.ingredientName) || 0;
    const cost = unitCost * item.requiredQty;
    ingredients.push({
      name: item.ingredientName,
      qty: item.requiredQty,
      unitCost,
      cost,
    });
    totalCost += cost;
  });

  return { totalCost, ingredients };
}

// 재고 부족 품목 찾기
export function findLowStockItems(inventory: InventoryItem[]): InventoryItem[] {
  return inventory.filter(item => item.currentQty < item.safetyStock);
}

// 채널별 매출 집계
export function aggregateSalesByChannel(sales: SalesRecord[]): Map<string, number> {
  const result = new Map<string, number>();
  sales.forEach(s => {
    const current = result.get(s.channel) || 0;
    result.set(s.channel, current + s.totalAmount);
  });
  return result;
}

// 메뉴별 판매량 집계
export function aggregateSalesByMenu(
  sales: SalesRecord[]
): Map<string, { qty: number; amount: number }> {
  const result = new Map<string, { qty: number; amount: number }>();
  sales.forEach(s => {
    const current = result.get(s.menuName) || { qty: 0, amount: 0 };
    result.set(s.menuName, {
      qty: current.qty + s.quantity,
      amount: current.amount + s.totalAmount,
    });
  });
  return result;
}

// 일별 판매 트렌드
export function getDailySalesTrend(
  sales: SalesRecord[]
): { date: string; amount: number; qty: number }[] {
  const dailyMap = new Map<string, { amount: number; qty: number }>();

  sales.forEach(s => {
    const current = dailyMap.get(s.date) || { amount: 0, qty: 0 };
    dailyMap.set(s.date, {
      amount: current.amount + s.totalAmount,
      qty: current.qty + s.quantity,
    });
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 원자재 단가 추이
export function getMaterialPriceTrend(
  itemName: string,
  purchaseHistory: PurchaseRecord[]
): { date: string; unitPrice: number }[] {
  return purchaseHistory
    .filter(p => p.itemName === itemName)
    .map(p => ({ date: p.date, unitPrice: p.unitPrice }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
