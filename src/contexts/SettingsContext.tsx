/**
 * Settings Context — 비즈니스 설정 전역 제공
 * businessConfig의 값을 React Context로 래핑하여
 * 어디서든 useSettings()로 접근 가능하게 합니다.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  BusinessConfig,
  DEFAULT_BUSINESS_CONFIG,
  loadBusinessConfig,
  saveBusinessConfig,
} from '../config/businessConfig';

interface SettingsContextType {
  config: BusinessConfig;
  updateConfig: (partial: Partial<BusinessConfig>) => void;
  resetConfig: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BusinessConfig>(() => loadBusinessConfig());

  const updateConfig = useCallback((partial: Partial<BusinessConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      saveBusinessConfig(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    const defaults = { ...DEFAULT_BUSINESS_CONFIG };
    setConfig(defaults);
    saveBusinessConfig(defaults);
  }, []);

  return (
    <SettingsContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </SettingsContext.Provider>
  );
}

/** 비즈니스 설정에 접근하는 훅 */
export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

/** 설정값만 읽는 간편 훅 */
export function useBusinessConfig(): BusinessConfig {
  return useSettings().config;
}
