/**
 * Google Sheet Service - Frontend
 * 백엔드 API를 통해 구글 시트 데이터를 가져옴
 */

const BACKEND_URL = 'http://localhost:3001/api';

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
 */
export const syncGoogleSheetData = async (): Promise<GoogleSheetSyncResult> => {
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
      },
    };
  } catch (error: any) {
    console.error('Google Sheet sync failed:', error);
    throw error;
  }
};

/**
 * 일별 채널 매출 데이터 가져오기
 */
export const fetchDailySales = async (): Promise<DailySalesData[]> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/daily-sales`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 판매 상세 데이터 가져오기
 */
export const fetchSalesDetail = async (): Promise<SalesDetailData[]> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/sales-detail`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 생산/폐기 데이터 가져오기
 */
export const fetchProduction = async (): Promise<ProductionData[]> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/production`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 구매/원자재 데이터 가져오기
 */
export const fetchPurchases = async (): Promise<PurchaseData[]> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/purchases`);
  const result = await response.json();
  return result.success ? result.data : [];
};

/**
 * 유틸리티 데이터 가져오기
 */
export const fetchUtilities = async (): Promise<UtilityData[]> => {
  const response = await fetch(`${BACKEND_URL}/googlesheet/utilities`);
  const result = await response.json();
  return result.success ? result.data : [];
};
