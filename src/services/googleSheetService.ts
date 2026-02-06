/**
 * Google Sheet Service - Frontend
 * Supabase 캐시 우선 조회, 실패 시 기존 Google Sheets API 폴백
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

/** Supabase 데이터 가용 여부를 빠르게 확인 */
async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/data/health`);
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

export interface GoogleSheetSyncResult {
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  production: ProductionData[];
  purchases: PurchaseData[];
  utilities: UtilityData[];
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
 * 1) Supabase에 동기화 트리거 (백그라운드)
 * 2) Supabase에서 데이터 조회
 * 3) 실패 시 기존 Google Sheets API 폴백
 */
export const syncGoogleSheetData = async (): Promise<GoogleSheetSyncResult> => {
  // Supabase 사용 가능 시: 동기화 트리거 + Supabase에서 조회
  const supabaseOk = await isSupabaseAvailable();

  if (supabaseOk) {
    try {
      // 백그라운드로 동기화 트리거 (결과를 기다리지 않음)
      fetch(`${BACKEND_URL}/sync/google-sheets`, { method: 'POST' }).catch(() => {});

      // Supabase에서 데이터 조회
      const [dailySales, salesDetail, production, purchases, utilities] = await Promise.all([
        fetchDailySales(),
        fetchSalesDetail(),
        fetchProduction(),
        fetchPurchases(),
        fetchUtilities(),
      ]);

      // 변환 로직 (기존과 동일한 형식)
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
          labor: 0,
          bom: 0,
        },
      };
    } catch (err) {
      console.warn('Supabase 조회 실패, Google Sheets 폴백:', err);
    }
  }

  // 폴백: 기존 Google Sheets API
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
  return dailySales.map(d => ({
    date: formatDateForDisplay(d.date),
    revenue: d.totalRevenue,
    profit: Math.round(d.totalRevenue * 0.3),
    marginRate: 30,
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

  const sorted = Array.from(productProfits.entries())
    .map(([code, d]) => ({
      id: code,
      skuName: d.name,
      channel: d.channel,
      revenue: d.revenue,
      profit: Math.round(d.revenue * 0.3),
      margin: 30,
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
 * Supabase 우선, 실패 시 Google Sheets 폴백
 */
export const fetchDailySales = async (): Promise<DailySalesData[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/data/daily-sales`);
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      return result.data.map(mapDailySalesFromDb);
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  const response = await fetch(`${BACKEND_URL}/googlesheet/daily-sales`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 판매 상세 데이터 가져오기
 */
export const fetchSalesDetail = async (): Promise<SalesDetailData[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/data/sales-detail`);
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      return result.data.map(mapSalesDetailFromDb);
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  const response = await fetch(`${BACKEND_URL}/googlesheet/sales-detail`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 생산/폐기 데이터 가져오기
 */
export const fetchProduction = async (): Promise<ProductionData[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/data/production`);
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      return result.data.map(mapProductionFromDb);
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  const response = await fetch(`${BACKEND_URL}/googlesheet/production`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 구매/원자재 데이터 가져오기
 */
export const fetchPurchases = async (): Promise<PurchaseData[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/data/purchases`);
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      return result.data.map(mapPurchaseFromDb);
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  const response = await fetch(`${BACKEND_URL}/googlesheet/purchases`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 유틸리티 데이터 가져오기
 */
export const fetchUtilities = async (): Promise<UtilityData[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/data/utilities`);
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      return result.data.map(mapUtilityFromDb);
    }
  } catch { /* Supabase 실패 - 폴백 */ }

  const response = await fetch(`${BACKEND_URL}/googlesheet/utilities`);
  const result = await response.json();
  return result.success ? result.data : [];
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
