/**
 * 통합 데이터 Context
 *
 * 설정된 데이터 소스에서 가져온 데이터를 전역으로 제공하고,
 * 대시보드 컴포넌트에서 쉽게 사용할 수 있게 합니다.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  IntegratedData,
  fetchAllIntegratedData,
  loadDataSourcesConfig,
  calculateMenuCost,
  findLowStockItems,
  aggregateSalesByChannel,
  aggregateSalesByMenu,
  getDailySalesTrend,
  getMaterialPriceTrend,
  BomItem,
  InventoryItem,
  SalesRecord,
  PurchaseRecord,
} from '../../services/dataIntegrationService';

// ============================================
// 파생 데이터 타입
// ============================================

export interface DerivedAnalytics {
  // 메뉴별 원가
  menuCosts: Map<string, { totalCost: number; ingredients: { name: string; cost: number }[] }>;
  // 재고 부족 품목
  lowStockItems: InventoryItem[];
  // 채널별 매출
  salesByChannel: Map<string, number>;
  // 메뉴별 판매량
  salesByMenu: Map<string, { qty: number; amount: number }>;
  // 일별 매출 트렌드
  dailySalesTrend: { date: string; amount: number; qty: number }[];
  // KPI 요약
  kpiSummary: {
    totalSales: number;
    totalMenus: number;
    totalIngredients: number;
    lowStockCount: number;
    avgMargin: number;
  };
}

// ============================================
// Context 타입
// ============================================

interface IntegratedDataContextType {
  // 원시 데이터
  data: IntegratedData | null;
  // 파생 분석 데이터
  analytics: DerivedAnalytics | null;
  // 로딩 상태
  isLoading: boolean;
  // 에러
  error: string | null;
  // 마지막 업데이트 시간
  lastUpdated: string | null;
  // 연결된 소스 수
  connectedSources: number;
  // 데이터 새로고침
  refreshData: () => Promise<void>;
  // 특정 소스만 새로고침
  refreshSource: (sourceKey: string) => Promise<void>;
  // 데이터 소스 설정 여부
  hasConfiguration: boolean;
}

const defaultContextValue: IntegratedDataContextType = {
  data: null,
  analytics: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  connectedSources: 0,
  refreshData: async () => {},
  refreshSource: async () => {},
  hasConfiguration: false,
};

const IntegratedDataContext = createContext<IntegratedDataContextType>(defaultContextValue);

// ============================================
// Provider 컴포넌트
// ============================================

interface IntegratedDataProviderProps {
  children: ReactNode;
  autoRefreshInterval?: number; // ms, 0이면 자동 갱신 안함
}

export function IntegratedDataProvider({
  children,
  autoRefreshInterval = 0,
}: IntegratedDataProviderProps) {
  const [data, setData] = useState<IntegratedData | null>(null);
  const [analytics, setAnalytics] = useState<DerivedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [connectedSources, setConnectedSources] = useState(0);
  const [hasConfiguration, setHasConfiguration] = useState(false);

  // 파생 데이터 계산
  const calculateAnalytics = useCallback((rawData: IntegratedData): DerivedAnalytics => {
    // 메뉴별 원가 계산
    const menuCosts = new Map<
      string,
      { totalCost: number; ingredients: { name: string; cost: number }[] }
    >();
    const uniqueMenus = new Set(rawData.bomCombined.map(b => b.menuName));

    uniqueMenus.forEach(menuName => {
      const cost = calculateMenuCost(menuName, rawData.bomCombined, rawData.purchaseHistory);
      menuCosts.set(menuName, {
        totalCost: cost.totalCost,
        ingredients: cost.ingredients.map(i => ({ name: i.name, cost: i.cost })),
      });
    });

    // 재고 부족 품목
    const lowStockItems = findLowStockItems(rawData.inventory);

    // 채널별 매출
    const salesByChannel = aggregateSalesByChannel(rawData.sales);

    // 메뉴별 판매량
    const salesByMenu = aggregateSalesByMenu(rawData.sales);

    // 일별 매출 트렌드
    const dailySalesTrend = getDailySalesTrend(rawData.sales);

    // KPI 요약 계산
    const totalSales = rawData.sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalMenus = uniqueMenus.size;
    const totalIngredients = new Set(rawData.bomCombined.map(b => b.ingredientName)).size;
    const lowStockCount = lowStockItems.length;

    // 평균 마진율 계산 (판매가 - 원가) / 판매가
    let totalMargin = 0;
    let marginCount = 0;
    salesByMenu.forEach((salesData, menuName) => {
      const costData = menuCosts.get(menuName);
      if (costData && salesData.qty > 0 && salesData.amount > 0) {
        const unitPrice = salesData.amount / salesData.qty;
        const margin = ((unitPrice - costData.totalCost) / unitPrice) * 100;
        if (!isNaN(margin) && isFinite(margin)) {
          totalMargin += margin;
          marginCount++;
        }
      }
    });
    const avgMargin = marginCount > 0 ? totalMargin / marginCount : 0;

    return {
      menuCosts,
      lowStockItems,
      salesByChannel,
      salesByMenu,
      dailySalesTrend,
      kpiSummary: {
        totalSales,
        totalMenus,
        totalIngredients,
        lowStockCount,
        avgMargin,
      },
    };
  }, []);

  // 데이터 새로고침
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = loadDataSourcesConfig();
      setHasConfiguration(!!config);

      if (!config) {
        setData(null);
        setAnalytics(null);
        setConnectedSources(0);
        return;
      }

      // 연결된 소스 수 계산
      const connected = Object.values(config).filter(
        (c: any) => c.status === 'connected' || c.type !== 'none'
      ).length;
      setConnectedSources(connected);

      // 데이터 가져오기
      const integratedData = await fetchAllIntegratedData();
      setData(integratedData);
      setLastUpdated(integratedData.lastUpdated);

      // 파생 데이터 계산
      const analyticsData = calculateAnalytics(integratedData);
      setAnalytics(analyticsData);

      console.log('[IntegratedDataContext] 데이터 로드 완료:', {
        sources: connected,
        mealPlan: integratedData.mealPlan.length,
        sales: integratedData.sales.length,
        bom: integratedData.bomCombined.length,
        inventory: integratedData.inventory.length,
      });
    } catch (err: any) {
      console.error('[IntegratedDataContext] 데이터 로드 실패:', err);
      setError(err.message || '데이터를 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [calculateAnalytics]);

  // 특정 소스만 새로고침 (향후 구현)
  const refreshSource = useCallback(
    async (sourceKey: string) => {
      // 전체 새로고침으로 대체
      await refreshData();
    },
    [refreshData]
  );

  // 초기 로드
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 자동 새로고침 설정
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(refreshData, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, refreshData]);

  // localStorage 변경 감지 (설정 변경 시 자동 새로고침)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ZCMS_DATASOURCE_CONFIG') {
        console.log('[IntegratedDataContext] 데이터 소스 설정 변경 감지');
        refreshData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshData]);

  return (
    <IntegratedDataContext.Provider
      value={{
        data,
        analytics,
        isLoading,
        error,
        lastUpdated,
        connectedSources,
        refreshData,
        refreshSource,
        hasConfiguration,
      }}
    >
      {children}
    </IntegratedDataContext.Provider>
  );
}

// ============================================
// Custom Hook
// ============================================

export function useIntegratedData() {
  const context = useContext(IntegratedDataContext);
  if (!context) {
    throw new Error('useIntegratedData must be used within IntegratedDataProvider');
  }
  return context;
}

// 특정 데이터만 사용하는 헬퍼 훅들
export function useMealPlan() {
  const { data } = useIntegratedData();
  return data?.mealPlan || [];
}

export function useSales() {
  const { data } = useIntegratedData();
  return data?.sales || [];
}

export function useBom(brand?: 'SAN' | 'ZIP') {
  const { data } = useIntegratedData();
  if (!data) return [];
  if (brand === 'SAN') return data.bomSan;
  if (brand === 'ZIP') return data.bomZip;
  return data.bomCombined;
}

export function useInventory() {
  const { data } = useIntegratedData();
  return data?.inventory || [];
}

export function usePurchaseHistory() {
  const { data } = useIntegratedData();
  return data?.purchaseHistory || [];
}

export function usePurchaseOrders() {
  const { data } = useIntegratedData();
  return data?.purchaseOrders || [];
}

export function useKpiSummary() {
  const { analytics } = useIntegratedData();
  return analytics?.kpiSummary || null;
}

export function useLowStockItems() {
  const { analytics } = useIntegratedData();
  return analytics?.lowStockItems || [];
}

export function useSalesTrend() {
  const { analytics } = useIntegratedData();
  return analytics?.dailySalesTrend || [];
}
