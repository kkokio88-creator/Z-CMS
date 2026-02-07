import {
  ChannelProfitData,
  InventorySafetyItem,
  BomDiffItem,
  ProfitRankItem,
  WasteTrendData,
  StocktakeAnomalyItem,
  OrderSuggestion,
} from '../types.ts';

/**
 * ECOUNT ERP API Integration Service
 *
 * Routes through backend server to avoid CORS issues
 * NO MOCK DATA - Only real ECOUNT data
 */

// Backend API URL
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

// Default Configuration
const DEFAULT_CONFIG = {
  COM_CODE: '89445',
  USER_ID: 'JANG_HOYEON',
  API_KEY: '1e679c653fd184e999f5a74df7a6bf0699',
  ZONE: 'CD',
};

export interface EcountConfig {
  COM_CODE: string;
  USER_ID: string;
  API_KEY: string;
  ZONE: string;
}

// Load Config from LocalStorage or use Default
let CURRENT_CONFIG: EcountConfig = {
  ...DEFAULT_CONFIG,
  ...JSON.parse(localStorage.getItem('ECOUNT_CONFIG') || '{}'),
};

// Helper: Update Configuration
export const updateEcountConfig = (newConfig: EcountConfig) => {
  CURRENT_CONFIG = { ...newConfig };
  localStorage.setItem('ECOUNT_CONFIG', JSON.stringify(CURRENT_CONFIG));

  // Also update backend config
  fetch(`${BACKEND_URL}/ecount/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CURRENT_CONFIG),
  }).catch(err => console.warn('Failed to update backend config:', err));
};

export const getEcountConfig = (): EcountConfig => {
  return { ...CURRENT_CONFIG };
};

/**
 * Test API Connection via Backend
 */
export const testApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // First update backend with current config
    await fetch(`${BACKEND_URL}/ecount/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CURRENT_CONFIG),
    });

    // Then test connection
    const response = await fetch(`${BACKEND_URL}/ecount/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: `성공: ${CURRENT_CONFIG.ZONE} Zone 서버에 정상적으로 연결되었습니다.`,
      };
    } else {
      return {
        success: false,
        message: `실패: ${result.message || '연결에 실패했습니다.'}`,
      };
    }
  } catch (e: any) {
    // Check if backend is running
    if (e.name === 'TypeError' || e.message === 'Failed to fetch') {
      return {
        success: false,
        message: '백엔드 서버에 연결할 수 없습니다. server 폴더에서 npm run dev를 실행하세요.',
      };
    }
    return { success: false, message: `오류: ${e.message}` };
  }
};

export interface DataAvailability {
  sales: boolean;
  purchases: boolean;
  inventory: boolean;
  production: boolean;
  bom: boolean;
}

export interface SyncResult {
  profitTrend: ChannelProfitData[];
  topProfit: ProfitRankItem[];
  bottomProfit: ProfitRankItem[];
  inventory: InventorySafetyItem[];
  anomalies: StocktakeAnomalyItem[];
  suggestions: OrderSuggestion[];
  bomItems: BomDiffItem[];
  wasteTrend: WasteTrendData[];
  lastSynced: string;
  dataAvailable: boolean;
  dataAvailability: DataAvailability;
  message?: string;
}

/**
 * Sync all data via Backend - NO MOCK DATA
 */
export const syncAllEcountData = async (): Promise<SyncResult> => {
  const emptyAvailability: DataAvailability = {
    sales: false,
    purchases: false,
    inventory: false,
    production: false,
    bom: false,
  };

  const emptyResult: SyncResult = {
    profitTrend: [],
    topProfit: [],
    bottomProfit: [],
    inventory: [],
    anomalies: [],
    suggestions: [],
    bomItems: [],
    wasteTrend: [],
    lastSynced: new Date().toLocaleTimeString(),
    dataAvailable: false,
    dataAvailability: emptyAvailability,
    message: '',
  };

  try {
    // Update backend config first
    await fetch(`${BACKEND_URL}/ecount/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CURRENT_CONFIG),
    });

    // Call backend sync endpoint
    const response = await fetch(`${BACKEND_URL}/ecount/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!result.success) {
      return {
        ...emptyResult,
        message: result.error || 'ECOUNT 동기화 실패',
      };
    }

    const data = result.data;

    // Track data availability per data type
    const dataAvailability: DataAvailability = {
      sales: data.salesCount > 0,
      purchases: data.purchasesCount > 0,
      inventory: data.inventoryCount > 0,
      production: data.productionCount > 0,
      bom: data.bomCount > 0,
    };

    const hasAnyData = Object.values(dataAvailability).some(v => v);

    if (!hasAnyData) {
      return {
        ...emptyResult,
        dataAvailable: false,
        message:
          'ECOUNT에서 데이터를 찾을 수 없습니다. API 권한 또는 데이터 존재 여부를 확인하세요.',
      };
    }

    // Build status message based on available data
    const availableTypes = [];
    const unavailableTypes = [];
    if (dataAvailability.inventory) availableTypes.push('재고');
    else unavailableTypes.push('재고');
    if (dataAvailability.sales) availableTypes.push('판매');
    else unavailableTypes.push('판매');
    if (dataAvailability.purchases) availableTypes.push('구매');
    else unavailableTypes.push('구매');
    if (dataAvailability.production) availableTypes.push('생산');
    else unavailableTypes.push('생산');
    if (dataAvailability.bom) availableTypes.push('BOM');
    else unavailableTypes.push('BOM');

    const statusMessage =
      unavailableTypes.length > 0
        ? `${availableTypes.join(', ')} 데이터 연동됨 (${unavailableTypes.join(', ')} API 미지원)`
        : '전체 데이터 연동 완료';

    // Transform backend data to frontend format
    return {
      profitTrend: result.transformedData?.profitTrend || [],
      topProfit: result.transformedData?.topProfit || [],
      bottomProfit: result.transformedData?.bottomProfit || [],
      inventory: result.transformedData?.inventory || [],
      anomalies: result.transformedData?.anomalies || [],
      suggestions: result.transformedData?.suggestions || [],
      bomItems: result.transformedData?.bomItems || [],
      wasteTrend: result.transformedData?.wasteTrend || [],
      lastSynced: data.syncedAt || new Date().toLocaleTimeString(),
      dataAvailable: hasAnyData,
      dataAvailability,
      message: statusMessage,
    };
  } catch (e: any) {
    console.error('ECOUNT sync failed:', e);
    return {
      ...emptyResult,
      message:
        e.message === 'Failed to fetch'
          ? '백엔드 서버에 연결할 수 없습니다.'
          : `동기화 오류: ${e.message}`,
    };
  }
};

// Legacy login function (now routed through backend)
export const loginEcount = async (): Promise<{ success: boolean; message?: string }> => {
  const result = await testApiConnection();
  return result;
};
