/**
 * Google Sheet Service - Frontend
 * Supabase 직접 조회 우선, 백엔드 API 폴백
 */

import {
  isSupabaseDirectAvailable,
  directFetchDailySales,
  directFetchSalesDetail,
  directFetchProduction,
  directFetchPurchases,
  directFetchUtilities,
  directFetchLabor,
  directFetchBom,
  directFetchMaterialMaster,
} from './supabaseClient';
import { loadBusinessConfig } from '../config/businessConfig';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

// Supabase 스네이크_케이스 → 프론트엔드 camelCase 변환 헬퍼
function mapDailySalesFromDb(row: any): DailySalesData {
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

function mapSalesDetailFromDb(row: any): SalesDetailData {
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

function mapProductionFromDb(row: any): ProductionData {
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

function mapPurchaseFromDb(row: any): PurchaseData {
  return {
    date: row.date ?? '',
    productName: row.product_name ?? '',
    productCode: row.product_code ?? '',
    quantity: row.quantity ?? 0,
    unitPrice: row.unit_price ?? 0,
    supplyAmount: row.supply_amount ?? 0,
    vat: row.vat ?? 0,
    total: row.total ?? 0,
    inboundPrice: row.inbound_price ?? 0,
    inboundTotal: row.inbound_total ?? 0,
  };
}

function mapUtilityFromDb(row: any): UtilityData {
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

/** 백엔드 서버 가용 여부 확인 (동기화 트리거용) */
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/data/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

// 데이터 타입 정의
export interface DailySalesData {
  date: string;
  jasaPrice: number;
  coupangPrice: number;
  kurlyPrice: number;
  totalRevenue: number;
  frozenSoup: number;
  etc: number;
  bibimbap: number;
  jasaHalf: number;
  coupangHalf: number;
  kurlyHalf: number;
  frozenHalf: number;
  etcHalf: number;
  productionQty: number;
  productionRevenue: number;
}

export interface SalesDetailData {
  productCode: string;
  productName: string;
  date: string;
  customer: string;
  productDesc: string;
  spec: string;
  quantity: number;
  supplyAmount: number;
  vat: number;
  total: number;
}

export interface ProductionData {
  date: string;
  prodQtyNormal: number;
  prodQtyPreprocess: number;
  prodQtyFrozen: number;
  prodQtySauce: number;
  prodQtyBibimbap: number;
  prodQtyTotal: number;
  prodKgNormal: number;
  prodKgPreprocess: number;
  prodKgFrozen: number;
  prodKgSauce: number;
  prodKgTotal: number;
  wasteFinishedEa: number;
  wasteFinishedPct: number;
  wasteSemiKg: number;
  wasteSemiPct: number;
}

export interface PurchaseData {
  date: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  inboundPrice: number;
  inboundTotal: number;
}

export interface UtilityData {
  date: string;
  elecPrev: number;
  elecCurr: number;
  elecUsage: number;
  elecCost: number;
  waterPrev: number;
  waterCurr: number;
  waterUsage: number;
  waterCost: number;
  gasPrev: number;
  gasCurr: number;
  gasUsage: number;
  gasCost: number;
}

// BOM 데이터 타입 (3. SAN_BOM, 4. ZIP_BOM 시트 S~AD열)
export interface BomData {
  productCode: string; // 생산품목코드
  productName: string; // 생산품목명
  bomVersion: string; // 생산품BOM버전
  isExistingBom: boolean; // 기존BOM여부
  productionQty: number; // 생산수량
  materialCode: string; // 소모품목코드
  materialName: string; // 소모품목명
  materialBomVersion: string; // 소모품BOM버전
  consumptionQty: number; // 소모수량
  location: string; // 위치
  remark: string; // 적요
  additionalQty: number; // 소모추가수량
  source: 'SAN' | 'ZIP'; // 출처 (SAN_BOM 또는 ZIP_BOM)
}

export interface BomSummary {
  sanBomCount: number;
  zipBomCount: number;
  productCount: number;
}

// 노무비 일별 데이터 타입
export interface LaborDailyData {
  date: string;
  department: string;
  week: string;
  headcount: number;
  weekdayRegularHours: number;
  weekdayOvertimeHours: number;
  weekdayNightHours: number;
  weekdayTotalHours: number;
  holidayRegularHours: number;
  holidayOvertimeHours: number;
  holidayNightHours: number;
  holidayTotalHours: number;
  weekdayRegularPay: number;
  weekdayOvertimePay: number;
  weekdayNightPay: number;
  holidayRegularPay: number;
  holidayOvertimePay: number;
  holidayNightPay: number;
  totalPay: number;
}

// BOM 아이템 데이터 타입 (Supabase 경유)
export interface BomItemData {
  source: string;
  productCode: string;
  productName: string;
  bomVersion: string;
  isExistingBom: boolean;
  productionQty: number;
  materialCode: string;
  materialName: string;
  materialBomVersion: string;
  consumptionQty: number;
  location: string;
  remark: string;
  additionalQty: number;
}

// 자재 마스터 아이템 타입
export interface MaterialMasterItem {
  no: number;
  category: string;
  issueType: string;
  materialCode: string;
  materialName: string;
  preprocessYield: number;
  spec: string;
  unit: string;
  unitPrice: number;
  safetyStock: number;
  excessStock: number;
  leadTimeDays: number;
  recentOutputQty: number;
  dailyAvg: number;
  note: string;
  inUse: boolean;
}

export interface GoogleSheetSyncResult {
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  production: ProductionData[];
  purchases: PurchaseData[];
  utilities: UtilityData[];
  labor: LaborDailyData[];
  bom: BomItemData[];
  materialMaster: MaterialMasterItem[];
  profitTrend: ChannelProfitItem[];
  topProfit: ProfitRankItem[];
  bottomProfit: ProfitRankItem[];
  wasteTrend: WasteTrendItem[];
  purchaseSummary: PurchaseSummaryItem[];
  utilityCosts: UtilityCostItem[];
  syncedAt: string;
  counts: {
    dailySales: number;
    salesDetail: number;
    production: number;
    purchases: number;
    utilities: number;
    labor: number;
    bom: number;
    materialMaster: number;
  };
}

export interface ChannelProfitItem {
  date: string;
  revenue: number;
  profit: number;
  marginRate: number;
  channels: {
    jasa: number;
    coupang: number;
    kurly: number;
  };
}

export interface ProfitRankItem {
  id: string;
  rank: number;
  skuName: string;
  channel: string;
  profit: number;
  margin: number;
}

export interface WasteTrendItem {
  day: string;
  avg: number;
  actual: number;
  productionQty: number;
  wasteQty: number;
}

export interface PurchaseSummaryItem {
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalAmount: number;
  avgUnitPrice: number;
}

export interface UtilityCostItem {
  date: string;
  electricity: number;
  water: number;
  gas: number;
  total: number;
}

/**
 * 구글 시트 전체 동기화
 * 3-Tier 폴백: 백엔드API → Supabase 직접 → 백엔드/Google Sheets
 * 개별 fetch 함수들이 이미 3-Tier 폴백을 내장하므로 항상 호출
 */
export const syncGoogleSheetData = async (): Promise<GoogleSheetSyncResult> => {
  const backendOk = await isBackendAvailable();

  // 백엔드 가동 중이면 백그라운드로 동기화 트리거
  if (backendOk) {
    fetch(`${BACKEND_URL}/sync/google-sheets`, { method: 'POST' }).catch(() => {});
  }

  // 개별 fetch 함수 호출 (각각 3-Tier 폴백 내장: 백엔드→Supabase직접→Google Sheets)
  try {
    const [dailySales, salesDetail, production, purchases, utilities, labor, bom, materialMaster] = await Promise.all([
      fetchDailySales(),
      fetchSalesDetail(),
      fetchProduction(),
      fetchPurchases(),
      fetchUtilities(),
      fetchLabor(),
      fetchBomData(),
      fetchMaterialMaster(),
    ]);

    // 데이터가 하나라도 있으면 성공
    if (dailySales.length > 0 || salesDetail.length > 0 || production.length > 0) {
      const profitTrend = buildProfitTrend(dailySales);
      const { topProfit, bottomProfit } = buildProfitRanking(salesDetail);
      const wasteTrend = buildWasteTrend(production);
      const purchaseSummary = buildPurchaseSummary(purchases);
      const utilityCosts = buildUtilityCosts(utilities);

      return {
        dailySales,
        salesDetail,
        production,
        purchases,
        utilities,
        labor,
        bom,
        materialMaster,
        profitTrend,
        topProfit,
        bottomProfit,
        wasteTrend,
        purchaseSummary,
        utilityCosts,
        syncedAt: new Date().toISOString(),
        counts: {
          dailySales: dailySales.length,
          salesDetail: salesDetail.length,
          production: production.length,
          purchases: purchases.length,
          utilities: utilities.length,
          labor: labor.length,
          bom: bom.length,
          materialMaster: materialMaster.length,
        },
      };
    }
  } catch (err) {
    console.warn('3-Tier 데이터 조회 실패:', err);
  }

  // 최종 폴백: 기존 Google Sheets API (백엔드 필수)
  return syncGoogleSheetDataLegacy();
};

/** 기존 Google Sheets 동기화 (폴백) */
const syncGoogleSheetDataLegacy = async (): Promise<GoogleSheetSyncResult> => {
  try {
    const response = await fetch(`${BACKEND_URL}/googlesheet/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '구글 시트 동기화 실패');
    }

    return {
      dailySales: result.transformedData?.rawData?.dailySales || [],
      salesDetail: result.transformedData?.rawData?.salesDetail || [],
      production: result.transformedData?.rawData?.production || [],
      purchases: result.transformedData?.rawData?.purchases || [],
      utilities: result.transformedData?.rawData?.utilities || [],
      labor: [],
      bom: [],
      materialMaster: [],
      profitTrend: result.transformedData?.profitTrend || [],
      topProfit: result.transformedData?.topProfit || [],
      bottomProfit: result.transformedData?.bottomProfit || [],
      wasteTrend: result.transformedData?.wasteTrend || [],
      purchaseSummary: result.transformedData?.purchaseSummary || [],
      utilityCosts: result.transformedData?.utilityCosts || [],
      syncedAt: result.data?.syncedAt || new Date().toISOString(),
      counts: {
        dailySales: result.data?.dailySalesCount || 0,
        salesDetail: result.data?.salesDetailCount || 0,
        production: result.data?.productionCount || 0,
        purchases: result.data?.purchasesCount || 0,
        utilities: result.data?.utilitiesCount || 0,
        labor: result.data?.laborCount || 0,
        bom: result.data?.bomCount || 0,
        materialMaster: result.data?.materialMasterCount || 0,
      },
    };
  } catch (error: any) {
    console.error('Google Sheet sync failed:', error);
    throw error;
  }
};

// ==============================
// 데이터 변환 헬퍼 (Supabase 데이터 → 대시보드 형식)
// ==============================

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return dateStr;
}

function buildProfitTrend(dailySales: DailySalesData[]): ChannelProfitItem[] {
  const config = loadBusinessConfig();
  const marginRate = config.defaultMarginRate;
  return dailySales.map(d => ({
    date: formatDateForDisplay(d.date),
    revenue: d.totalRevenue,
    profit: Math.round(d.totalRevenue * marginRate),
    marginRate: Math.round(marginRate * 100),
    channels: {
      jasa: d.jasaPrice,
      coupang: d.coupangPrice,
      kurly: d.kurlyPrice,
    },
  }));
}

function buildProfitRanking(salesDetail: SalesDetailData[]): {
  topProfit: ProfitRankItem[];
  bottomProfit: ProfitRankItem[];
} {
  const productProfits = new Map<
    string,
    { name: string; channel: string; revenue: number; quantity: number }
  >();
  salesDetail.forEach(sale => {
    const existing = productProfits.get(sale.productCode) || {
      name: sale.productName,
      channel: sale.customer,
      revenue: 0,
      quantity: 0,
    };
    existing.revenue += sale.total;
    existing.quantity += sale.quantity;
    productProfits.set(sale.productCode, existing);
  });

  const config = loadBusinessConfig();
  const marginRate = config.defaultMarginRate;
  const sorted = Array.from(productProfits.entries())
    .map(([code, d]) => ({
      id: code,
      skuName: d.name,
      channel: d.channel,
      revenue: d.revenue,
      profit: Math.round(d.revenue * marginRate),
      margin: Math.round(marginRate * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProfit = sorted.slice(0, 10).map((item, idx) => ({
    id: `top-${idx}`,
    rank: idx + 1,
    skuName: item.skuName,
    channel: item.channel,
    profit: item.profit,
    margin: item.margin,
  }));

  const bottomProfit = sorted
    .slice(-10)
    .reverse()
    .map((item, idx) => ({
      id: `bot-${idx}`,
      rank: idx + 1,
      skuName: item.skuName,
      channel: item.channel,
      profit: item.profit,
      margin: item.margin,
    }));

  return { topProfit, bottomProfit };
}

function buildWasteTrend(production: ProductionData[]): WasteTrendItem[] {
  return production.map(p => ({
    day: formatDateForDisplay(p.date),
    avg: 2.5,
    actual: p.wasteFinishedPct || 0,
    productionQty: p.prodQtyTotal,
    wasteQty: p.wasteFinishedEa,
  }));
}

function buildPurchaseSummary(purchases: PurchaseData[]): PurchaseSummaryItem[] {
  const byProduct = new Map<
    string,
    { name: string; totalQty: number; totalAmount: number }
  >();
  purchases.forEach(p => {
    const existing = byProduct.get(p.productCode) || {
      name: p.productName,
      totalQty: 0,
      totalAmount: 0,
    };
    existing.totalQty += p.quantity;
    existing.totalAmount += p.total;
    byProduct.set(p.productCode, existing);
  });

  return Array.from(byProduct.entries()).map(([code, d]) => ({
    productCode: code,
    productName: d.name,
    totalQuantity: d.totalQty,
    totalAmount: d.totalAmount,
    avgUnitPrice: d.totalQty > 0 ? Math.round(d.totalAmount / d.totalQty) : 0,
  }));
}

function buildUtilityCosts(utilities: UtilityData[]): UtilityCostItem[] {
  return utilities.map(u => ({
    date: formatDateForDisplay(u.date),
    electricity: u.elecCost,
    water: u.waterCost,
    gas: u.gasCost,
    total: u.elecCost + u.waterCost + u.gasCost,
  }));
}

/**
 * 일별 채널 매출 데이터 가져오기
 * Primary: Supabase 직접 → Fallback: 백엔드 API
 */
export const fetchDailySales = async (): Promise<DailySalesData[]> => {
  // Primary: Supabase 직접 조회
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchDailySales();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }

  // Fallback: 백엔드 API
  try {
    const response = await fetch(`${BACKEND_URL}/data/daily-sales`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapDailySalesFromDb);
  } catch { /* 백엔드 실패 */ }

  return [];
};

/**
 * 판매 상세 데이터 가져오기
 */
export const fetchSalesDetail = async (): Promise<SalesDetailData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchSalesDetail();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/sales-detail`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapSalesDetailFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * 생산/폐기 데이터 가져오기
 */
export const fetchProduction = async (): Promise<ProductionData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchProduction();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/production`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapProductionFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * 구매/원자재 데이터 가져오기
 */
export const fetchPurchases = async (): Promise<PurchaseData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchPurchases();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/purchases`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapPurchaseFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * 유틸리티 데이터 가져오기
 */
export const fetchUtilities = async (): Promise<UtilityData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchUtilities();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/utilities`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapUtilityFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

// DB→camelCase 변환 맵퍼 (labor, bom, materialMaster)

function mapLaborFromDb(row: any): LaborDailyData {
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

function mapBomFromDb(row: any): BomItemData {
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

function mapMaterialMasterFromDb(row: any): MaterialMasterItem {
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

/**
 * 노무비 데이터 가져오기 (3-Tier)
 */
export const fetchLabor = async (): Promise<LaborDailyData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchLabor();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/labor`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapLaborFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * BOM 데이터 가져오기 (3-Tier: Supabase → 백엔드 API)
 */
export const fetchBomData = async (): Promise<BomItemData[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchBom();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/bom`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapBomFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * 자재 마스터 데이터 가져오기 (3-Tier)
 */
export const fetchMaterialMaster = async (): Promise<MaterialMasterItem[]> => {
  if (isSupabaseDirectAvailable()) {
    try {
      const data = await directFetchMaterialMaster();
      if (data.length > 0) return data;
    } catch { /* Supabase 직접 실패 */ }
  }
  try {
    const response = await fetch(`${BACKEND_URL}/data/material-master`, { signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (result.success && result.data?.length > 0) return result.data.map(mapMaterialMasterFromDb);
  } catch { /* 백엔드 실패 */ }
  return [];
};

/**
 * BOM 데이터 가져오기 (3. SAN_BOM, 4. ZIP_BOM 시트)
 */
export const fetchBom = async (): Promise<{
  data: BomData[];
  summary: BomSummary;
}> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/bom`);
  const result = await response.json();
  return result.success
    ? { data: result.data, summary: result.summary }
    : { data: [], summary: { sanBomCount: 0, zipBomCount: 0, productCount: 0 } };
};

/**
 * 생산품목별 BOM 그룹화
 */
export const fetchBomByProduct = async (): Promise<Map<string, BomData[]>> => {
  const { data } = await fetchBom();
  const byProduct = new Map<string, BomData[]>();

  data.forEach(item => {
    const key = item.productCode;
    if (!byProduct.has(key)) {
      byProduct.set(key, []);
    }
    byProduct.get(key)!.push(item);
  });

  return byProduct;
};
