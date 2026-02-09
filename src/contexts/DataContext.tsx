/**
 * Data Context — 데이터 상태 전역 관리
 * App.tsx의 데이터 상태를 Context로 제공하여
 * 하위 컴포넌트에서 props 없이 접근 가능하게 합니다.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { DashboardInsights } from '../services/insightService';
import type {
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
  UtilityData,
} from '../services/googleSheetService';
import type {
  InventorySafetyItem,
  StocktakeAnomalyItem,
} from '../types';
import type { DataAvailability } from '../services/ecountService';
import type { SyncStatusInfo } from '../services/supabaseClient';

export interface DataContextType {
  // Google Sheet 데이터
  dailySales: DailySalesData[];
  salesDetail: SalesDetailData[];
  production: ProductionData[];
  purchases: PurchaseData[];
  utilities: UtilityData[];

  // 재고 데이터
  inventoryData: InventorySafetyItem[];
  stocktakeAnomalies: StocktakeAnomalyItem[];

  // 인사이트
  insights: DashboardInsights | null;

  // 동기화 상태
  isSyncing: boolean;
  lastSyncTime: string;
  syncMessage: string;
  dataAvailability: DataAvailability;
  dataSource: 'backend' | 'direct' | false;
  syncStatus: SyncStatusInfo | null;

  // 액션
  handleSync: () => Promise<void>;
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
