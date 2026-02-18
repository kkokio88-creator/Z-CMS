/**
 * Data Context — 데이터 상태 전역 관리
 * 동기화 상태는 SyncContext로 분리되었습니다.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { DashboardInsights } from '../services/insightService';
import type {
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
  UtilityData,
  LaborDailyData,
  BomItemData,
  MaterialMasterItem,
} from '../services/googleSheetService';
import type {
  InventorySafetyItem,
  StocktakeAnomalyItem,
} from '../types';

export interface DataContextType {
  // Google Sheet 데이터
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  production: ProductionData[];
  purchases: PurchaseData[];
  utilities: UtilityData[];
  labor: LaborDailyData[];
  bom: BomItemData[];
  materialMaster: MaterialMasterItem[];

  // 재고 데이터
  inventoryData: InventorySafetyItem[];
  stocktakeAnomalies: StocktakeAnomalyItem[];

  // 인사이트
  insights: DashboardInsights | null;
}

const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: ReactNode;
  value: DataContextType;
}

export function DataProvider({ children, value }: DataProviderProps) {
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

/** 데이터에 접근하는 훅 */
export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within DataProvider');
  }
  return ctx;
}
