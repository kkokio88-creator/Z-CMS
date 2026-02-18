/**
 * Sync Context — 동기화 상태 전역 관리
 * DataContext에서 분리: 자주 변하는 sync 상태를 별도 context로 격리하여
 * 데이터 소비자의 불필요한 리렌더링 방지
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { DataAvailability } from '../services/ecountService';
import type { SyncStatusInfo } from '../services/supabaseClient';

export interface SyncContextType {
  isSyncing: boolean;
  lastSyncTime: string;
  syncMessage: string;
  dataAvailability: DataAvailability;
  dataSource: 'backend' | 'direct' | false;
  syncStatus: SyncStatusInfo | null;
  handleSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

interface SyncProviderProps {
  children: ReactNode;
  value: SyncContextType;
}

export function SyncProvider({ children, value }: SyncProviderProps) {
  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

/** 동기화 상태에 접근하는 훅 */
export function useSync(): SyncContextType {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return ctx;
}
