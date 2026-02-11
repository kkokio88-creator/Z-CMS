/**
 * Supabase Direct Client - 프론트엔드에서 직접 Supabase 조회
 * 백엔드 서버가 다운되었을 때 Tier 2 폴백으로 사용
 * anon key는 Row Level Security로 보호되는 공개 키
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
  UtilityData,
  LaborDailyData,
  BomItemData,
  MaterialMasterItem,
} from './googleSheetService';

let supabaseClient: SupabaseClient | null = null;

/** Supabase 직접 연결이 가능한지 확인 */
export function isSupabaseDirectAvailable(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!(url && key);
}

/** 싱글톤 Supabase 클라이언트 반환 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// === 페이지네이션 헬퍼 (Supabase 기본 1000행 제한 극복) ===

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  table: string,
  orderCol: string = 'date',
  ascending: boolean = true,
): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(orderCol, { ascending })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break; // 마지막 페이지
    from += PAGE_SIZE;
  }

  return all;
}

// === 테이블별 직접 조회 함수 ===

function mapDailySalesFromDb(row: Record<string, any>): DailySalesData {
  return {
    date: row.date,
    jasaPrice: row.jasa_price ?? 0,
    coupangPrice: row.coupang_price ?? 0,
    kurlyPrice: row.kurly_price ?? 0,
    totalRevenue: row.total_revenue ?? 0,
    frozenSoup: row.frozen_soup ?? 0,
    etc: row.etc ?? 0,
    bibimbap: row.bibimbap ?? 0,
    jasaHalf: row.jasa_half ?? 0,
    coupangHalf: row.coupang_half ?? 0,
    kurlyHalf: row.kurly_half ?? 0,
    frozenHalf: row.frozen_half ?? 0,
    etcHalf: row.etc_half ?? 0,
    productionQty: row.production_qty ?? 0,
    productionRevenue: row.production_revenue ?? 0,
  };
}

function mapSalesDetailFromDb(row: Record<string, any>): SalesDetailData {
  return {
    productCode: row.product_code ?? '',
    productName: row.product_name ?? '',
    date: row.date ?? '',
    customer: row.customer ?? '',
    productDesc: row.product_desc ?? '',
    spec: row.spec ?? '',
    quantity: row.quantity ?? 0,
    supplyAmount: row.supply_amount ?? 0,
    vat: row.vat ?? 0,
    total: row.total ?? 0,
  };
}

function mapProductionFromDb(row: Record<string, any>): ProductionData {
  return {
    date: row.date,
    prodQtyNormal: row.prod_qty_normal ?? 0,
    prodQtyPreprocess: row.prod_qty_preprocess ?? 0,
    prodQtyFrozen: row.prod_qty_frozen ?? 0,
    prodQtySauce: row.prod_qty_sauce ?? 0,
    prodQtyBibimbap: row.prod_qty_bibimbap ?? 0,
    prodQtyTotal: row.prod_qty_total ?? 0,
    prodKgNormal: row.prod_kg_normal ?? 0,
    prodKgPreprocess: row.prod_kg_preprocess ?? 0,
    prodKgFrozen: row.prod_kg_frozen ?? 0,
    prodKgSauce: row.prod_kg_sauce ?? 0,
    prodKgTotal: row.prod_kg_total ?? 0,
    wasteFinishedEa: row.waste_finished_ea ?? 0,
    wasteFinishedPct: row.waste_finished_pct ?? 0,
    wasteSemiKg: row.waste_semi_kg ?? 0,
    wasteSemiPct: row.waste_semi_pct ?? 0,
  };
}

function mapPurchaseFromDb(row: Record<string, any>): PurchaseData {
  return {
    date: row.date ?? '',
    productName: row.product_name ?? '',
    productCode: row.product_code ?? '',
    quantity: row.quantity ?? 0,
    unitPrice: row.unit_price ?? 0,
    supplyAmount: row.supply_amount ?? 0,
    vat: row.vat ?? 0,
    total: row.total ?? 0,
    supplierName: row.supplier_name ?? '',
  };
}

function mapUtilityFromDb(row: Record<string, any>): UtilityData {
  return {
    date: row.date,
    elecPrev: row.elec_prev ?? 0,
    elecCurr: row.elec_curr ?? 0,
    elecUsage: row.elec_usage ?? 0,
    elecCost: row.elec_cost ?? 0,
    waterPrev: row.water_prev ?? 0,
    waterCurr: row.water_curr ?? 0,
    waterUsage: row.water_usage ?? 0,
    waterCost: row.water_cost ?? 0,
    gasPrev: row.gas_prev ?? 0,
    gasCurr: row.gas_curr ?? 0,
    gasUsage: row.gas_usage ?? 0,
    gasCost: row.gas_cost ?? 0,
  };
}

export async function directFetchDailySales(): Promise<DailySalesData[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('daily_sales').select('*').order('date', { ascending: true });
  if (error || !data) return [];
  return data.map(mapDailySalesFromDb);
}

export async function directFetchSalesDetail(): Promise<SalesDetailData[]> {
  const rows = await fetchAllRows<Record<string, any>>('sales_detail', 'date', true);
  return rows.map(mapSalesDetailFromDb);
}

export async function directFetchProduction(): Promise<ProductionData[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('production_daily').select('*').order('date', { ascending: true });
  if (error || !data) return [];
  return data.map(mapProductionFromDb);
}

export async function directFetchPurchases(): Promise<PurchaseData[]> {
  const rows = await fetchAllRows<Record<string, any>>('purchases', 'date', true);
  return rows.map(mapPurchaseFromDb);
}

export async function directFetchInventory(): Promise<Record<string, any>[]> {
  return fetchAllRows<Record<string, any>>('inventory', 'product_code', true);
}

export async function directFetchInventorySnapshots(): Promise<import('./googleSheetService').InventorySnapshotData[]> {
  const rows = await fetchAllRows<Record<string, any>>('inventory', 'product_code', true);
  return rows.map((row: any) => ({
    productCode: row.product_code ?? '',
    productName: row.product_name ?? '',
    balanceQty: Number(row.balance_qty) || 0,
    warehouseCode: row.warehouse_code ?? 'DEFAULT',
    snapshotDate: row.snapshot_date ?? '',
  }));
}

export async function directFetchUtilities(): Promise<UtilityData[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('utilities').select('*').order('date', { ascending: true });
  if (error || !data) return [];
  return data.map(mapUtilityFromDb);
}

function mapLaborFromDb(row: Record<string, any>): LaborDailyData {
  return {
    date: row.date ?? '',
    department: row.department ?? '',
    week: row.week ?? '',
    headcount: row.headcount ?? 0,
    weekdayRegularHours: row.weekday_regular_hours ?? 0,
    weekdayOvertimeHours: row.weekday_overtime_hours ?? 0,
    weekdayNightHours: row.weekday_night_hours ?? 0,
    weekdayTotalHours: row.weekday_total_hours ?? 0,
    holidayRegularHours: row.holiday_regular_hours ?? 0,
    holidayOvertimeHours: row.holiday_overtime_hours ?? 0,
    holidayNightHours: row.holiday_night_hours ?? 0,
    holidayTotalHours: row.holiday_total_hours ?? 0,
    weekdayRegularPay: row.weekday_regular_pay ?? 0,
    weekdayOvertimePay: row.weekday_overtime_pay ?? 0,
    weekdayNightPay: row.weekday_night_pay ?? 0,
    holidayRegularPay: row.holiday_regular_pay ?? 0,
    holidayOvertimePay: row.holiday_overtime_pay ?? 0,
    holidayNightPay: row.holiday_night_pay ?? 0,
    totalPay: row.total_pay ?? 0,
  };
}

function mapBomFromDb(row: Record<string, any>): BomItemData {
  return {
    source: row.source ?? '',
    productCode: row.product_code ?? '',
    productName: row.product_name ?? '',
    bomVersion: row.bom_version ?? '',
    isExistingBom: row.is_existing_bom ?? false,
    productionQty: row.production_qty ?? 0,
    materialCode: row.material_code ?? '',
    materialName: row.material_name ?? '',
    materialBomVersion: row.material_bom_version ?? '',
    consumptionQty: row.consumption_qty ?? 0,
    location: row.location ?? '',
    remark: row.remark ?? '',
    additionalQty: row.additional_qty ?? 0,
  };
}

function mapMaterialMasterFromDb(row: Record<string, any>): MaterialMasterItem {
  return {
    no: row.no ?? 0,
    category: row.category ?? '',
    issueType: row.issue_type ?? '',
    materialCode: row.material_code ?? '',
    materialName: row.material_name ?? '',
    preprocessYield: row.preprocess_yield ?? 0,
    spec: row.spec ?? '',
    unit: row.unit ?? '',
    unitPrice: row.unit_price ?? 0,
    safetyStock: row.safety_stock ?? 0,
    excessStock: row.excess_stock ?? 0,
    leadTimeDays: row.lead_time_days ?? 0,
    recentOutputQty: row.recent_output_qty ?? 0,
    dailyAvg: row.daily_avg ?? 0,
    note: row.note ?? '',
    inUse: row.in_use ?? true,
  };
}

export async function directFetchLabor(): Promise<LaborDailyData[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('labor_daily').select('*').order('date', { ascending: true });
  if (error || !data) return [];
  return data.map(mapLaborFromDb);
}

export async function directFetchBom(): Promise<BomItemData[]> {
  const rows = await fetchAllRows<Record<string, any>>('bom', 'product_code', true);
  return rows.map(mapBomFromDb);
}

export async function directFetchMaterialMaster(): Promise<MaterialMasterItem[]> {
  const rows = await fetchAllRows<Record<string, any>>('material_master', 'no', true);
  return rows.map(mapMaterialMasterFromDb);
}

export interface SyncStatusInfo {
  lastSyncTime: string | null;
  tableCounts: Record<string, number>;
  source: 'direct' | 'backend';
}

/** 백엔드 API에서 동기화 상태 가져오기 */
export async function fetchSyncStatusFromBackend(): Promise<SyncStatusInfo | null> {
  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
  try {
    const res = await fetch(`${BACKEND_URL}/sync/status`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (!json.success) return null;

    // recentLogs에서 마지막 성공 동기화 시간 추출
    const lastLog = json.recentLogs?.find((l: any) => l.status === 'success');
    const lastSyncTime = lastLog?.completed_at ?? null;

    // 각 테이블 레코드 수는 백엔드에서 직접 제공하지 않으므로 data 엔드포인트 사용
    const tables = ['daily-sales', 'sales-detail', 'production', 'purchases', 'inventory', 'utilities'];
    const tableKeys = ['daily_sales', 'sales_detail', 'production_daily', 'purchases', 'inventory', 'utilities'];
    const counts = await Promise.all(
      tables.map(async (endpoint, idx) => {
        try {
          const r = await fetch(`${BACKEND_URL}/data/${endpoint}`, { signal: AbortSignal.timeout(3000) });
          const d = await r.json();
          return [tableKeys[idx], d.count ?? d.data?.length ?? 0] as [string, number];
        } catch {
          return [tableKeys[idx], 0] as [string, number];
        }
      })
    );

    return { lastSyncTime, tableCounts: Object.fromEntries(counts), source: 'backend' };
  } catch {
    return null;
  }
}

export async function directFetchSyncStatus(): Promise<SyncStatusInfo | null> {
  // Tier 1: 백엔드 API 우선
  const backendStatus = await fetchSyncStatusFromBackend();
  if (backendStatus) return backendStatus;

  // Tier 2: Supabase 직접
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: syncLog } = await client
      .from('sync_log')
      .select('completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1);

    const lastSyncTime = syncLog?.[0]?.completed_at ?? null;

    const tables = ['daily_sales', 'sales_detail', 'production_daily', 'purchases', 'inventory', 'utilities'];
    const counts = await Promise.all(
      tables.map(async (table) => {
        const { count } = await client.from(table).select('*', { count: 'exact', head: true });
        return [table, count ?? 0] as [string, number];
      })
    );

    return { lastSyncTime, tableCounts: Object.fromEntries(counts), source: 'direct' };
  } catch {
    return null;
  }
}

/** 데이터 소스 확인: 'backend' | 'direct' | false */
export async function checkDataSource(): Promise<'backend' | 'direct' | false> {
  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

  // Tier 1: 백엔드 health check
  try {
    const res = await fetch(`${BACKEND_URL}/data/health`, { signal: AbortSignal.timeout(3000) });
    const json = await res.json();
    if (json.success) return 'backend';
  } catch { /* 백엔드 미응답 */ }

  // Tier 2: Supabase 직접
  if (isSupabaseDirectAvailable()) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.from('sync_log').select('completed_at').limit(1);
        if (!error) return 'direct';
      } catch { /* Supabase 직접 연결 실패 */ }
    }
  }

  return false;
}
