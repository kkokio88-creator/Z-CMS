import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  testApiConnection,
  getEcountConfig,
  updateEcountConfig,
  EcountConfig,
} from '../../services/ecountService';
import { useSettings } from '../../contexts/SettingsContext';
import { useUI } from '../../contexts/UIContext';
import { ChannelCostAdmin, LaborRecordAdmin } from '../domain';
import { deriveMultipliersFromTargets, type ProfitCenterGoal, type BusinessConfig } from '../../config/businessConfig';
import {
  loadDataSourceConfig,
  saveDataSourceConfig,
  resetDataSourceConfig,
  getSpreadsheetUrl,
  type DataSourceConfig as NormalizedDSConfig,
  type DataSourceSheet,
} from '../../config/dataSourceConfig';
import { generateDataSourceMd, saveMdToStorage } from '../../utils/generateDataSourceMd';

// ─── 구글시트 연결 테스트 상태 타입 ───
type SheetTestStatus = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string; rowCount?: number };

const SHEET_TEST_CACHE_KEY = 'Z_CMS_SHEET_TEST_CACHE';
const SHEET_TEST_TTL = 5 * 60 * 1000; // 5분

function loadCachedSheetTests(): Record<string, SheetTestStatus> {
  try {
    const raw = sessionStorage.getItem(SHEET_TEST_CACHE_KEY);
    if (!raw) return {};
    const { ts, results } = JSON.parse(raw);
    if (Date.now() - ts > SHEET_TEST_TTL) return {};
    return results;
  } catch { return {}; }
}

function saveCachedSheetTests(results: Record<string, SheetTestStatus>) {
  try {
    sessionStorage.setItem(SHEET_TEST_CACHE_KEY, JSON.stringify({ ts: Date.now(), results }));
  } catch { /* ignore */ }
}

// ─── 접이식 섹션 헬퍼 ───
const SECTION_IDS = {
  ecount: 'ecount',
  googleSheets: 'google-sheets',
  ai: 'ai',
  inventoryCost: 'inventory-cost',
  costConfig: 'cost-config',
  abcXyz: 'abc-xyz',
  anomaly: 'anomaly',
  labor: 'labor',
  orderParams: 'order-params',
  viewThresholds: 'view-thresholds',
  channelProfit: 'channel-profit',
  channelSettlement: 'channel-settlement',
  budget: 'budget',
  laborRecords: 'labor-records',
  channelCosts: 'channel-costs',
  profitCenter: 'profit-center',
  exportImport: 'export-import',
} as const;

const DEFAULT_OPEN_SECTIONS = new Set([SECTION_IDS.ecount, SECTION_IDS.googleSheets]);

// ─── 카테고리 블럭 정의 ───
interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  textColor: string;
  sections: string[];
  description: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'data-connection',
    label: '데이터 연결',
    icon: 'cloud_sync',
    color: 'bg-blue-600',
    textColor: 'text-blue-600 dark:text-blue-400',
    sections: [SECTION_IDS.ecount, SECTION_IDS.googleSheets],
    description: 'ERP API 및 구글시트 데이터 소스 연결',
  },
  {
    id: 'cost-management',
    label: '원가/비용 관리',
    icon: 'payments',
    color: 'bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    sections: [SECTION_IDS.costConfig, SECTION_IDS.labor, SECTION_IDS.laborRecords, SECTION_IDS.budget],
    description: '원가 기준, 노무비, 예산 설정',
  },
  {
    id: 'channel-management',
    label: '채널/매출 관리',
    icon: 'storefront',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    sections: [SECTION_IDS.channelProfit, SECTION_IDS.channelSettlement, SECTION_IDS.channelCosts],
    description: '채널별 수수료, 정산주기, 비용 설정',
  },
  {
    id: 'inventory-order',
    label: '재고/발주 관리',
    icon: 'inventory_2',
    color: 'bg-cyan-500',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    sections: [SECTION_IDS.inventoryCost, SECTION_IDS.abcXyz, SECTION_IDS.orderParams],
    description: '재고 기준, ABC-XYZ 분류, 발주 파라미터',
  },
  {
    id: 'analysis-detection',
    label: '분석/감지 설정',
    icon: 'analytics',
    color: 'bg-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    sections: [SECTION_IDS.ai, SECTION_IDS.anomaly, SECTION_IDS.viewThresholds],
    description: 'AI 탐지, 이상 감지, 뷰 임계값',
  },
  {
    id: 'system-goals',
    label: '경영 목표/시스템',
    icon: 'emoji_events',
    color: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    sections: [SECTION_IDS.profitCenter, SECTION_IDS.exportImport],
    description: '독립채산제 목표, 설정 백업',
  },
];

const DEFAULT_OPEN_CATEGORIES = new Set(['data-connection']);

const GOOGLE_SHEETS_SERVICE_ACCOUNT = 'z-cms-3077@gen-lang-client-0670850409.iam.gserviceaccount.com';

// ─── 접이식 섹션 컴포넌트 ───
const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  headerBg?: string;
  headerTextColor?: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ id, title, icon, isOpen, onToggle, headerBg, headerTextColor, subtitle, children }) => (
  <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
    <button
      onClick={onToggle}
      className={`w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer transition-colors hover:opacity-90 ${headerBg || 'bg-gray-50 dark:bg-gray-800'}`}
    >
      <div className="text-left">
        <h3 className={`font-bold flex items-center ${headerTextColor || 'text-gray-900 dark:text-white'}`}>
          <span className="material-icons-outlined mr-2">{icon}</span>
          {title}
        </h3>
        {subtitle && <p className={`text-xs mt-1 opacity-70 ${headerTextColor || ''}`}>{subtitle}</p>}
      </div>
      <span
        className={`material-icons-outlined transition-transform duration-200 ${headerTextColor || 'text-gray-500 dark:text-gray-400'}`}
        style={{ transform: isOpen ? 'rotate(180deg)' : '' }}
      >
        expand_more
      </span>
    </button>
    {isOpen && <div className="p-6">{children}</div>}
  </div>
);

// ─── 카테고리 블럭 컴포넌트 ───
const CategoryBlock: React.FC<{
  category: CategoryDef;
  isOpen: boolean;
  onToggle: () => void;
  warningCount: number;
  children: React.ReactNode;
}> = ({ category, isOpen, onToggle, warningCount, children }) => (
  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
    <button
      onClick={onToggle}
      className={`w-full px-5 py-4 flex items-center justify-between cursor-pointer transition-all ${
        isOpen
          ? `${category.color} text-white`
          : 'bg-white dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`material-icons-outlined text-2xl ${isOpen ? 'text-white' : category.textColor}`}>
          {category.icon}
        </span>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-base ${isOpen ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {category.label}
            </h3>
            {warningCount > 0 && !isOpen && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold animate-pulse">
                !
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isOpen ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
            {category.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {warningCount > 0 && isOpen && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium text-white">
            <span className="material-icons-outlined text-sm">warning</span>
            {warningCount}개 확인 필요
          </span>
        )}
        <span
          className={`material-icons-outlined transition-transform duration-200 ${isOpen ? 'text-white' : 'text-gray-400'}`}
          style={{ transform: isOpen ? 'rotate(180deg)' : '' }}
        >
          expand_more
        </span>
      </div>
    </button>
    {isOpen && (
      <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 space-y-3">
        {children}
      </div>
    )}
  </div>
);

export const SettingsView: React.FC = () => {
  const { config, updateConfig, resetConfig } = useSettings();
  const { setSettingsDirty } = useUI();
  const importFileRef = useRef<HTMLInputElement>(null);

  // ─── 카테고리 블럭 상태 ───
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(DEFAULT_OPEN_CATEGORIES));
  const toggleCategory = useCallback((id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── 접이식 섹션 상태 ───
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(DEFAULT_OPEN_SECTIONS));
  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── Draft 패턴: 즉시 저장 → 임시 상태로 변경 ───
  const [draft, setDraft] = useState<BusinessConfig>(() => ({ ...config }));
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config]);

  const updateDraft = useCallback((partial: Partial<BusinessConfig>) => {
    setDraft(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = useCallback(() => {
    updateConfig(draft);
  }, [draft, updateConfig]);

  const handleDiscard = useCallback(() => {
    setDraft({ ...config });
  }, [config]);

  // config 외부 변경 시 draft 동기화 (reset 등)
  useEffect(() => {
    if (!isDirty) setDraft({ ...config });
  }, [config]);

  // isDirty 변경 시 UIContext에 알림
  useEffect(() => {
    setSettingsDirty(isDirty);
    return () => setSettingsDirty(false);
  }, [isDirty, setSettingsDirty]);

  // ─── ECOUNT Config State ───
  const [ecountConfig, setEcountConfig] = useState<EcountConfig>({
    COM_CODE: '', USER_ID: '', API_KEY: '', ZONE: 'CD',
  });
  const [apiTestStatus, setApiTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // ─── 정규화 데이터 소스 관리 ───
  const [normalizedDSConfig, setNormalizedDSConfig] = useState<NormalizedDSConfig>(loadDataSourceConfig);
  const [dsEditingSheet, setDsEditingSheet] = useState<string | null>(null);
  const [dsMdPreview, setDsMdPreview] = useState(false);

  // ─── 구글시트 연결 테스트 ───
  const [sheetTestResults, setSheetTestResults] = useState<Record<string, SheetTestStatus>>(loadCachedSheetTests);
  const sheetTestRanRef = useRef(false);

  // 결과 변경 시 sessionStorage 캐싱
  useEffect(() => {
    const hasResults = Object.values(sheetTestResults).some(r => r.status === 'ok' || r.status === 'error');
    if (hasResults) saveCachedSheetTests(sheetTestResults);
  }, [sheetTestResults]);

  const testSheetConnection = useCallback(async (sheet: DataSourceSheet) => {
    setSheetTestResults(prev => ({ ...prev, [sheet.id]: { status: 'testing' } }));

    // Tier 1: 백엔드 API
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
      const response = await fetch(`${apiUrl}/api/sheets/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: sheet.spreadsheetId, sheetName: sheet.sheetName }),
        signal: AbortSignal.timeout(5000),
      });
      const result = await response.json();
      if (result.success) {
        setSheetTestResults(prev => ({ ...prev, [sheet.id]: { status: 'ok', rowCount: result.rowCount } }));
        return;
      }
    } catch { /* 백엔드 실패 → Supabase 폴백 */ }

    // Tier 2: Supabase 직접 카운트 (시트별 대응 테이블)
    try {
      const { getSupabaseClient } = await import('../../services/supabaseClient');
      const client = getSupabaseClient();
      if (client) {
        const tableMap: Record<string, string> = {
          daily_sales: 'daily_sales', sales_detail: 'sales_detail',
          purchases: 'purchases', production_daily: 'production_daily',
          utilities: 'utilities', inventory: 'inventory',
          labor_daily: 'labor_daily', bom_san: 'bom', bom_zip: 'bom',
        };
        const table = tableMap[sheet.id] || sheet.id;
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
        if (!error && count !== null) {
          setSheetTestResults(prev => ({ ...prev, [sheet.id]: { status: 'ok', rowCount: count, message: 'Supabase' } }));
          return;
        }
      }
    } catch { /* Supabase 실패 */ }

    setSheetTestResults(prev => ({ ...prev, [sheet.id]: { status: 'error', message: '서버/Supabase 연결 실패' } }));
  }, []);

  const testAllSheets = useCallback(async () => {
    const enabled = normalizedDSConfig.sheets.filter(s => s.enabled);
    for (const sheet of enabled) {
      await testSheetConnection(sheet);
    }
  }, [normalizedDSConfig.sheets, testSheetConnection]);

  // 구글시트 섹션 열릴 때 자동 1회 테스트 (캐시가 있으면 스킵)
  useEffect(() => {
    if (openSections.has(SECTION_IDS.googleSheets) && !sheetTestRanRef.current) {
      sheetTestRanRef.current = true;
      const cached = loadCachedSheetTests();
      const hasValidCache = Object.keys(cached).length > 0;
      if (!hasValidCache) testAllSheets();
    }
  }, [openSections, testAllSheets]);

  // ─── AI 탐지 로컬 상태 (draft 외) ───
  const [safetyDays, setSafetyDays] = useState(14);
  const [aiSensitivity, setAiSensitivity] = useState(80);
  const [marginAlert, setMarginAlert] = useState(10);

  // ─── 초기화 ───
  useEffect(() => {
    const current = getEcountConfig();
    setEcountConfig(current);
  }, []);

  const handleConfigChange = (field: keyof EcountConfig, value: string) => {
    setEcountConfig(prev => ({ ...prev, [field]: value }));
    setApiTestStatus(null);
  };

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setApiTestStatus(null);
    updateEcountConfig(ecountConfig);
    try {
      const result = await testApiConnection();
      setApiTestStatus(result);
    } catch {
      setApiTestStatus({ success: false, message: '알 수 없는 오류가 발생했습니다.' });
    } finally {
      setIsTesting(false);
    }
  };

  // ─── 시트 테스트 상태 배지 렌더 ───
  const renderSheetTestBadge = (sheetId: string) => {
    const result = sheetTestResults[sheetId];
    if (!result || result.status === 'idle') {
      return <span className="inline-flex items-center text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-300 mr-1"></span>미확인</span>;
    }
    if (result.status === 'testing') {
      return <span className="inline-flex items-center text-xs text-blue-500"><span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1"></span>테스트 중</span>;
    }
    if (result.status === 'ok') {
      return <span className="inline-flex items-center text-xs text-green-600"><span className="material-icons-outlined text-sm mr-0.5">check_circle</span>{result.rowCount}행</span>;
    }
    return (
      <span className="inline-flex items-center text-xs text-red-500 group relative">
        <span className="material-icons-outlined text-sm mr-0.5">error</span>오류
        {result.message && (
          <span className="hidden group-hover:block absolute bottom-full left-0 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 mb-1">
            {result.message}
          </span>
        )}
      </span>
    );
  };

  // ─── 카테고리별 경고 카운트 계산 ───
  const categoryWarnings = useMemo(() => {
    const warnings: Record<string, number> = {};
    let dataWarn = 0;
    if (!ecountConfig.COM_CODE || !ecountConfig.API_KEY) dataWarn++;
    const sheetErrors = Object.values(sheetTestResults).filter(r => r.status === 'error').length;
    if (sheetErrors > 0) dataWarn++;
    warnings['data-connection'] = dataWarn;
    let costWarn = 0;
    if (!draft.budgetRawMaterial) costWarn++;
    if (!draft.budgetLabor) costWarn++;
    if (!draft.budgetOverhead) costWarn++;
    warnings['cost-management'] = costWarn;
    let channelWarn = 0;
    if (!draft.defaultMarginRate) channelWarn++;
    warnings['channel-management'] = channelWarn;
    warnings['inventory-order'] = 0;
    warnings['analysis-detection'] = 0;
    let sysWarn = 0;
    if (!draft.profitCenterGoals || draft.profitCenterGoals.length === 0) sysWarn++;
    warnings['system-goals'] = sysWarn;
    return warnings;
  }, [ecountConfig, sheetTestResults, draft]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in pb-24">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          시스템 및 기준 정보 설정
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AI 분석 로직과 알림 기준을 직접 제어할 수 있습니다.
        </p>
      </div>


      {/* ── 카테고리 1: 데이터 연결 ── */}
      <CategoryBlock category={CATEGORIES[0]} isOpen={openCategories.has('data-connection')} onToggle={() => toggleCategory('data-connection')} warningCount={categoryWarnings['data-connection'] || 0}>
      {/* ═══════════ 1. ERP API 연결 설정 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.ecount}
        title="ERP API 연결 설정 (ECOUNT)"
        icon="api"
        isOpen={openSections.has(SECTION_IDS.ecount)}
        onToggle={() => toggleSection(SECTION_IDS.ecount)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">회사 코드 (Company Code)</label>
              <input type="text" value={ecountConfig.COM_CODE} onChange={e => handleConfigChange('COM_CODE', e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border" placeholder="예: 12345" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">사용자 ID (User ID)</label>
              <input type="text" value={ecountConfig.USER_ID} onChange={e => handleConfigChange('USER_ID', e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border" placeholder="예: MASTER" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API 인증키 (API Key)</label>
              <input type="password" value={ecountConfig.API_KEY} onChange={e => handleConfigChange('API_KEY', e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border" placeholder="ECOUNT API 인증키 입력" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Zone</label>
              <select value={ecountConfig.ZONE} onChange={e => handleConfigChange('ZONE', e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border">
                <option value="CD">CD (운영서버)</option>
                <option value="AA">AA</option>
                <option value="AB">AB</option>
                <option value="BA">BA</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">* 저장 시 자동으로 연결 테스트가 수행됩니다. <br />* 변경된 정보는 로컬 브라우저에만 저장됩니다.</p>
            <button onClick={handleSaveAndTest} disabled={isTesting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center">
              {isTesting ? (<><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>연결 확인 중...</>) : '저장 및 연결 테스트'}
            </button>
          </div>
          {apiTestStatus && (
            <div className={`mt-2 p-3 rounded-md text-sm ${apiTestStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-center">
                <span className="material-icons-outlined mr-2 text-sm">{apiTestStatus.success ? 'check_circle' : 'error'}</span>
                {apiTestStatus.message}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
      {/* ═══════════ 2. 구글시트 데이터 소스 관리 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.googleSheets}
        title="구글시트 데이터 소스 관리"
        icon="dataset"
        isOpen={openSections.has(SECTION_IDS.googleSheets)}
        onToggle={() => toggleSection(SECTION_IDS.googleSheets)}
        headerBg="bg-green-50 dark:bg-green-900/20"
        headerTextColor="text-green-900 dark:text-green-200"
        subtitle={`${normalizedDSConfig.sheets.length}개 시트 연동 | v${normalizedDSConfig.version} | 최종 업데이트: ${normalizedDSConfig.lastUpdated}`}
      >
        <div className="space-y-3">
          {/* 서비스 계정 안내 */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800">
            <div className="flex items-start">
              <span className="material-icons-outlined text-yellow-600 dark:text-yellow-400 mr-2 text-lg">warning</span>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">서비스 계정 권한</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">아래 서비스 계정에 스프레드시트 <strong>"편집자"</strong> 권한을 공유하세요:</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded text-xs font-mono text-yellow-900 dark:text-yellow-100">{normalizedDSConfig.serviceAccount}</code>
                  <button onClick={() => navigator.clipboard.writeText(normalizedDSConfig.serviceAccount)} className="p-1 hover:bg-yellow-200 dark:hover:bg-yellow-700 rounded transition-colors" title="복사">
                    <span className="material-icons-outlined text-sm text-yellow-700 dark:text-yellow-300">content_copy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 전체 연결 테스트 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={testAllSheets}
              className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium transition-colors flex items-center gap-1"
            >
              <span className="material-icons-outlined text-sm">wifi_tethering</span>
              전체 연결 테스트
            </button>
          </div>

          {/* 시트 목록 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2 pr-2 w-6"></th>
                  <th className="pb-2 pr-4">데이터</th>
                  <th className="pb-2 pr-4">시트명</th>
                  <th className="pb-2 pr-4 text-center">헤더행</th>
                  <th className="pb-2 pr-4 text-center">시작행</th>
                  <th className="pb-2 pr-4 text-center">컬럼수</th>
                  <th className="pb-2 pr-4 text-center">상태</th>
                  <th className="pb-2 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {normalizedDSConfig.sheets.map((sheet) => (
                  <React.Fragment key={sheet.id}>
                    <tr className={`border-b dark:border-gray-700 ${!sheet.enabled ? 'opacity-50' : ''}`}>
                      <td className="py-2.5 pr-2">
                        <input
                          type="checkbox"
                          checked={sheet.enabled}
                          onChange={() => {
                            const updated = { ...normalizedDSConfig };
                            const idx = updated.sheets.findIndex(s => s.id === sheet.id);
                            updated.sheets[idx] = { ...sheet, enabled: !sheet.enabled };
                            setNormalizedDSConfig(updated);
                            saveDataSourceConfig(updated);
                            const md = generateDataSourceMd(updated);
                            saveMdToStorage(md);
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{sheet.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 font-mono text-xs">{sheet.sheetName}</td>
                      <td className="py-2.5 pr-4 text-center text-gray-500">{sheet.headerRow}</td>
                      <td className="py-2.5 pr-4 text-center text-gray-500">{sheet.dataStartRow}</td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs">{sheet.columns.length}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">{renderSheetTestBadge(sheet.id)}</td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => testSheetConnection(sheet)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="연결 테스트">
                            <span className="material-icons-outlined text-sm text-blue-500 dark:text-blue-400">wifi_tethering</span>
                          </button>
                          <button onClick={() => setDsEditingSheet(dsEditingSheet === sheet.id ? null : sheet.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="편집">
                            <span className="material-icons-outlined text-sm text-gray-500 dark:text-gray-400">{dsEditingSheet === sheet.id ? 'expand_less' : 'edit'}</span>
                          </button>
                          <a href={getSpreadsheetUrl(sheet.spreadsheetId)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="시트 열기">
                            <span className="material-icons-outlined text-sm text-green-600 dark:text-green-400">open_in_new</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                    {/* 편집 확장 영역 */}
                    {dsEditingSheet === sheet.id && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50 dark:bg-gray-800/50 px-4 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">시트명</label>
                                <input type="text" value={sheet.sheetName} onChange={(e) => { const updated = { ...normalizedDSConfig }; const idx = updated.sheets.findIndex(s => s.id === sheet.id); updated.sheets[idx] = { ...sheet, sheetName: e.target.value }; setNormalizedDSConfig(updated); }} className="block w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1.5 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">헤더행</label>
                                <input type="number" min={1} value={sheet.headerRow} onChange={(e) => { const updated = { ...normalizedDSConfig }; const idx = updated.sheets.findIndex(s => s.id === sheet.id); updated.sheets[idx] = { ...sheet, headerRow: Number(e.target.value) }; setNormalizedDSConfig(updated); }} className="block w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1.5 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">데이터시작행</label>
                                <input type="number" min={1} value={sheet.dataStartRow} onChange={(e) => { const updated = { ...normalizedDSConfig }; const idx = updated.sheets.findIndex(s => s.id === sheet.id); updated.sheets[idx] = { ...sheet, dataStartRow: Number(e.target.value) }; setNormalizedDSConfig(updated); }} className="block w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1.5 border" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">스프레드시트 ID</label>
                                <input type="text" value={sheet.spreadsheetId} onChange={(e) => { const updated = { ...normalizedDSConfig }; const idx = updated.sheets.findIndex(s => s.id === sheet.id); updated.sheets[idx] = { ...sheet, spreadsheetId: e.target.value }; setNormalizedDSConfig(updated); }} className="block w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1.5 border font-mono text-xs" />
                              </div>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">컬럼 매핑 ({sheet.columns.length}개)</h5>
                              <div className="max-h-48 overflow-auto rounded border dark:border-gray-700">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">필드</th>
                                      <th className="px-2 py-1 text-center w-16">컬럼</th>
                                      <th className="px-2 py-1 text-left">라벨</th>
                                      <th className="px-2 py-1 text-center w-20">타입</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sheet.columns.map((col, ci) => (
                                      <tr key={ci} className="border-t dark:border-gray-700">
                                        <td className="px-2 py-1 font-mono text-blue-600 dark:text-blue-400">{col.key}</td>
                                        <td className="px-2 py-1 text-center">
                                          <input type="text" value={col.column} onChange={(e) => { const updated = { ...normalizedDSConfig }; const si = updated.sheets.findIndex(s => s.id === sheet.id); const cols = [...updated.sheets[si].columns]; cols[ci] = { ...cols[ci], column: e.target.value }; updated.sheets[si] = { ...updated.sheets[si], columns: cols }; setNormalizedDSConfig(updated); }} className="w-12 text-center rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-0.5 border" />
                                        </td>
                                        <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{col.label}</td>
                                        <td className="px-2 py-1 text-center">
                                          <span className={`px-1.5 py-0.5 rounded ${col.type === 'number' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : col.type === 'date' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{col.type}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {sheet.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{sheet.notes}</p>}
                            <div className="flex justify-end">
                              <button onClick={() => { saveDataSourceConfig(normalizedDSConfig); const md = generateDataSourceMd(normalizedDSConfig); saveMdToStorage(md); setDsEditingSheet(null); }} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-hover transition-colors">저장</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* 액션 버튼 */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => { saveDataSourceConfig(normalizedDSConfig); const md = generateDataSourceMd(normalizedDSConfig); saveMdToStorage(md); alert('설정이 저장되고 MD 문서가 업데이트되었습니다.'); }} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium transition-colors flex items-center gap-1">
                <span className="material-icons-outlined text-sm">save</span>전체 저장 + MD 업데이트
              </button>
              <button onClick={() => { const md = generateDataSourceMd(normalizedDSConfig); setDsMdPreview(!dsMdPreview); saveMdToStorage(md); }} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 rounded text-xs font-medium transition-colors flex items-center gap-1">
                <span className="material-icons-outlined text-sm">description</span>{dsMdPreview ? 'MD 미리보기 닫기' : 'MD 미리보기'}
              </button>
              <button onClick={() => { const md = generateDataSourceMd(normalizedDSConfig); const blob = new Blob([md], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `google-sheets-data-${new Date().toISOString().slice(0, 10)}.md`; a.click(); URL.revokeObjectURL(url); }} className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded text-xs font-medium transition-colors flex items-center gap-1">
                <span className="material-icons-outlined text-sm">download</span>MD 다운로드
              </button>
            </div>
            <button onClick={() => { if (window.confirm('데이터 소스 설정을 기본값으로 초기화하시겠습니까?')) { const defaultConfig = resetDataSourceConfig(); setNormalizedDSConfig(defaultConfig); const md = generateDataSourceMd(defaultConfig); saveMdToStorage(md); } }} className="text-red-500 hover:text-red-600 dark:text-red-400 text-xs flex items-center">
              <span className="material-icons-outlined text-sm mr-1">restart_alt</span>초기화
            </button>
          </div>

          {dsMdPreview && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 max-h-96 overflow-auto">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateDataSourceMd(normalizedDSConfig)}</pre>
            </div>
          )}
        </div>
      </CollapsibleSection>
      </CategoryBlock>

      {/* ── 카테고리 2: 원가/비용 관리 ── */}
      <CategoryBlock category={CATEGORIES[1]} isOpen={openCategories.has('cost-management')} onToggle={() => toggleCategory('cost-management')} warningCount={categoryWarnings['cost-management'] || 0}>
      {/* ═══════════ 5. 원가 관련 설정 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.costConfig}
        title="원가 관련 설정"
        icon="calculate"
        isOpen={openSections.has(SECTION_IDS.costConfig)}
        onToggle={() => toggleSection(SECTION_IDS.costConfig)}
        headerBg="bg-orange-50 dark:bg-orange-900/20"
        headerTextColor="text-orange-900 dark:text-orange-200"
        subtitle="이익률, 폐기 단가, 경비 비율 등 원가 계산에 사용되는 기준값입니다."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">기본 이익률</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={Math.round(draft.defaultMarginRate * 100)} onChange={e => updateDraft({ defaultMarginRate: Number(e.target.value) / 100 })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">실제 비용 데이터 없을 때 사용하는 추정 마진율</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">폐기 기본 단가</label>
            <div className="flex items-center gap-2">
              <input type="number" step="100" min="0" value={draft.wasteUnitCost} onChange={e => updateDraft({ wasteUnitCost: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">원/개</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">품목별 단가가 없을 때 사용하는 기본 폐기 비용</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">노무비 추정 비율</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={Math.round(draft.laborCostRatio * 100)} onChange={e => updateDraft({ laborCostRatio: Number(e.target.value) / 100 })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">총 원가 대비 노무비 추정 비율 (실데이터 없을 때)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">간접 경비 비율</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={Math.round(draft.overheadRatio * 100)} onChange={e => updateDraft({ overheadRatio: Number(e.target.value) / 100 })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">구매비 대비 기타 간접 경비 비율</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">월 고정경비</label>
            <div className="flex items-center gap-2">
              <input type="number" step="10000" min="0" value={draft.monthlyFixedOverhead} onChange={e => updateDraft({ monthlyFixedOverhead: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">재고 보유비 비율</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={Math.round(draft.holdingCostRate * 100)} onChange={e => updateDraft({ holdingCostRate: Number(e.target.value) / 100 })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">단가 대비 연간 재고 보유비 비율</p>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 8. 노무비 관리 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.labor}
        title="노무비 관리"
        icon="groups"
        isOpen={openSections.has(SECTION_IDS.labor)}
        onToggle={() => toggleSection(SECTION_IDS.labor)}
        headerBg="bg-purple-50 dark:bg-purple-900/20"
        headerTextColor="text-purple-900 dark:text-purple-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">반별 평균 인건비</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1000" min="0" value={draft.avgHourlyWage} onChange={e => updateDraft({ avgHourlyWage: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">원/시간</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">초과근무 할증률</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" min="1" max="5" value={draft.overtimeMultiplier} onChange={e => updateDraft({ overtimeMultiplier: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">배</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">기본급 대비 초과근무 할증 배수</p>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 14. 노무비 기록 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.laborRecords}
        title="노무비 기록 관리"
        icon="badge"
        isOpen={openSections.has(SECTION_IDS.laborRecords)}
        onToggle={() => toggleSection(SECTION_IDS.laborRecords)}
        headerBg="bg-purple-50 dark:bg-purple-900/20"
        headerTextColor="text-purple-900 dark:text-purple-200"
      >
        <LaborRecordAdmin />
      </CollapsibleSection>
      {/* ═══════════ 13. 월간 예산 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.budget}
        title="월간 예산 설정"
        icon="account_balance_wallet"
        isOpen={openSections.has(SECTION_IDS.budget)}
        onToggle={() => toggleSection(SECTION_IDS.budget)}
      >
        <div>
          <p className="text-xs text-gray-500 mb-4">비용 요소별 월간 예산을 설정합니다. 예산 대비 실적 분석에 활용됩니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">원재료 예산 (원)</label>
              <input type="number" value={draft.budgetRawMaterial} onChange={e => updateDraft({ budgetRawMaterial: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부재료 예산 (원)</label>
              <input type="number" value={draft.budgetSubMaterial} onChange={e => updateDraft({ budgetSubMaterial: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">노무비 예산 (원)</label>
              <input type="number" value={draft.budgetLabor} onChange={e => updateDraft({ budgetLabor: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">수도광열전력 예산 (원)</label>
              <input type="number" value={draft.budgetOverhead} onChange={e => updateDraft({ budgetOverhead: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
        </div>
      </CollapsibleSection>
      </CategoryBlock>

      {/* ── 카테고리 3: 채널/매출 관리 ── */}
      <CategoryBlock category={CATEGORIES[2]} isOpen={openCategories.has('channel-management')} onToggle={() => toggleCategory('channel-management')} warningCount={categoryWarnings['channel-management'] || 0}>
      {/* ═══════════ 11. 채널 이익 계산 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.channelProfit}
        title="채널 이익 계산 설정"
        icon="calculate"
        isOpen={openSections.has(SECTION_IDS.channelProfit)}
        onToggle={() => toggleSection(SECTION_IDS.channelProfit)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">평균 주문 단가 (원)</label>
            <input type="number" value={draft.averageOrderValue} onChange={e => updateDraft({ averageOrderValue: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            <p className="text-xs text-gray-500 mt-1">건당 변동비 산출에 사용 (주문 건수 = 매출 / 평균단가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기본 이익률 (%)</label>
            <input type="number" step="0.01" value={Math.round(draft.defaultMarginRate * 100)} onChange={e => updateDraft({ defaultMarginRate: Number(e.target.value) / 100 })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            <p className="text-xs text-gray-500 mt-1">구매 데이터 없을 때 사용하는 추정 이익률</p>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 12. 채널 정산주기 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.channelSettlement}
        title="채널 정산주기 설정"
        icon="schedule"
        isOpen={openSections.has(SECTION_IDS.channelSettlement)}
        onToggle={() => toggleSection(SECTION_IDS.channelSettlement)}
      >
        <div>
          <p className="text-xs text-gray-500 mb-4">각 채널의 매출 입금까지 소요되는 일수를 설정합니다. 현금흐름 분석에 반영됩니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">자사몰 (일)</label>
              <input type="number" value={draft.channelCollectionDaysJasa} onChange={e => updateDraft({ channelCollectionDaysJasa: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
              <p className="text-xs text-gray-500 mt-1">0 = 즉시 입금</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">쿠팡 (일)</label>
              <input type="number" value={draft.channelCollectionDaysCoupang} onChange={e => updateDraft({ channelCollectionDaysCoupang: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">컬리 (일)</label>
              <input type="number" value={draft.channelCollectionDaysKurly} onChange={e => updateDraft({ channelCollectionDaysKurly: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
            </div>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 15. 채널 비용 관리 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.channelCosts}
        title="채널 비용 관리"
        icon="store"
        isOpen={openSections.has(SECTION_IDS.channelCosts)}
        onToggle={() => toggleSection(SECTION_IDS.channelCosts)}
      >
        <ChannelCostAdmin />
      </CollapsibleSection>
      </CategoryBlock>

      {/* ── 카테고리 4: 재고/발주 관리 ── */}
      <CategoryBlock category={CATEGORIES[3]} isOpen={openCategories.has('inventory-order')} onToggle={() => toggleCategory('inventory-order')} warningCount={categoryWarnings['inventory-order'] || 0}>
      {/* ═══════════ 4. 재고 및 원가 기준 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.inventoryCost}
        title="재고 및 원가 기준 (Inventory & Cost Rules)"
        icon="inventory_2"
        isOpen={openSections.has(SECTION_IDS.inventoryCost)}
        onToggle={() => toggleSection(SECTION_IDS.inventoryCost)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">안전재고 산출 기준일수</label>
            <div className="flex items-center gap-2">
              <input type="number" value={safetyDays} onChange={e => setSafetyDays(Number(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">일 평균 출고량 × {safetyDays}일분을 안전재고로 설정합니다.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">저마진 경고 알림 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" value={marginAlert} onChange={e => setMarginAlert(Number(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">마진율이 {marginAlert}% 미만일 경우 대시보드에 경고를 표시합니다.</p>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 6. 재고 분류 기준 (ABC-XYZ) ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.abcXyz}
        title="재고 분류 기준 (ABC-XYZ)"
        icon="grid_view"
        isOpen={openSections.has(SECTION_IDS.abcXyz)}
        onToggle={() => toggleSection(SECTION_IDS.abcXyz)}
        headerBg="bg-teal-50 dark:bg-teal-900/20"
        headerTextColor="text-teal-900 dark:text-teal-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ABC A등급 기준 (금액 비중)</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5" min="0" max="100" value={draft.abcClassAThreshold} onChange={e => updateDraft({ abcClassAThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">상위 금액 비중이 이 값 이하인 품목을 A등급으로 분류</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ABC B등급 기준 (금액 비중)</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5" min="0" max="100" value={draft.abcClassBThreshold} onChange={e => updateDraft({ abcClassBThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">XYZ X등급 변동계수 상한</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" min="0" max="5" value={draft.xyzClassXThreshold} onChange={e => updateDraft({ xyzClassXThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
            </div>
            <p className="text-xs text-gray-500 mt-1">변동계수(CV)가 이 값 이하이면 X등급 (안정 수요)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">XYZ Y등급 변동계수 상한</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" min="0" max="5" value={draft.xyzClassYThreshold} onChange={e => updateDraft({ xyzClassYThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
            </div>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 9. 발주 파라미터 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.orderParams}
        title="발주 파라미터"
        icon="local_shipping"
        isOpen={openSections.has(SECTION_IDS.orderParams)}
        onToggle={() => toggleSection(SECTION_IDS.orderParams)}
        headerBg="bg-cyan-50 dark:bg-cyan-900/20"
        headerTextColor="text-cyan-900 dark:text-cyan-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">기본 리드타임</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="1" max="90" value={draft.defaultLeadTime} onChange={e => updateDraft({ defaultLeadTime: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">일</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">리드타임 표준편차</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" min="0" max="30" value={draft.leadTimeStdDev} onChange={e => updateDraft({ leadTimeStdDev: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">납품기간 변동성 (클수록 안전재고 증가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">기본 서비스 수준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="50" max="99" value={draft.defaultServiceLevel} onChange={e => updateDraft({ defaultServiceLevel: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">품절 방지 목표 확률 (높을수록 안전재고 증가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">주문 비용 (건당)</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5000" min="0" value={draft.orderCost} onChange={e => updateDraft({ orderCost: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">원</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">EOQ 계산에 사용되는 1회 주문 비용</p>
          </div>
        </div>
      </CollapsibleSection>
      </CategoryBlock>

      {/* ── 카테고리 5: 분석/감지 설정 ── */}
      <CategoryBlock category={CATEGORIES[4]} isOpen={openCategories.has('analysis-detection')} onToggle={() => toggleCategory('analysis-detection')} warningCount={categoryWarnings['analysis-detection'] || 0}>
      {/* ═══════════ 3. AI 이상 탐지 설정 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.ai}
        title="AI 이상 탐지 설정 (Anomaly Detection)"
        icon="psychology"
        isOpen={openSections.has(SECTION_IDS.ai)}
        onToggle={() => toggleSection(SECTION_IDS.ai)}
        headerBg="bg-indigo-50 dark:bg-indigo-900/20"
        headerTextColor="text-indigo-900 dark:text-indigo-200"
      >
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">탐지 민감도 (Sensitivity)</label>
              <span className="text-sm font-bold text-primary dark:text-green-400">{aiSensitivity}%</span>
            </div>
            <input type="range" min="0" max="100" value={aiSensitivity} onChange={e => setAiSensitivity(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" />
            <p className="text-xs text-gray-500 mt-2">민감도를 높이면 작은 변동에도 알림이 발생합니다. (권장: 75~85%)</p>
          </div>
          <div className="flex items-center justify-between py-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">자동 BOM 학습 승인</p>
              <p className="text-xs text-gray-500">AI가 95% 이상 확신할 때 표준 BOM을 자동 업데이트합니다.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 7. 이상 감지 기준 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.anomaly}
        title="이상 감지 기준"
        icon="notification_important"
        isOpen={openSections.has(SECTION_IDS.anomaly)}
        onToggle={() => toggleSection(SECTION_IDS.anomaly)}
        headerBg="bg-red-50 dark:bg-red-900/20"
        headerTextColor="text-red-900 dark:text-red-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">폐기율 경고 임계값</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" min="0" max="100" value={draft.wasteThresholdPct} onChange={e => updateDraft({ wasteThresholdPct: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 비율을 초과하면 폐기 경고 발생</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">레시피 오차 허용률</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.recipeVarianceTolerance} onChange={e => updateDraft({ recipeVarianceTolerance: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이상 감지 주의 임계값</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.anomalyWarningThreshold} onChange={e => updateDraft({ anomalyWarningThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이상 감지 위험 임계값</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.anomalyCriticalThreshold} onChange={e => updateDraft({ anomalyCriticalThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">수율 저하 허용률</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" min="0" max="100" value={draft.yieldDropTolerance} onChange={e => updateDraft({ yieldDropTolerance: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">성능 허용 오차</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.performanceTolerance} onChange={e => updateDraft({ performanceTolerance: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 10. 뷰 표시 임계값 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.viewThresholds}
        title="뷰 표시 임계값"
        icon="tune"
        isOpen={openSections.has(SECTION_IDS.viewThresholds)}
        onToggle={() => toggleSection(SECTION_IDS.viewThresholds)}
        headerBg="bg-indigo-50 dark:bg-indigo-900/20"
        headerTextColor="text-indigo-900 dark:text-indigo-200"
        subtitle="각 대시보드 화면의 색상 분기·경고 기준값"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">마진율 양호 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.profitMarginGood} onChange={e => updateDraft({ profitMarginGood: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 이상이면 녹색(양호)으로 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">단가상승 경고 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" max="100" value={draft.priceIncreaseThreshold} onChange={e => updateDraft({ priceIncreaseThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 이상 상승한 원재료를 경고 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이상점수 주의 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5" min="0" max="100" value={draft.anomalyScoreWarning} onChange={e => updateDraft({ anomalyScoreWarning: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">점</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 점수 이상이면 주의(주황) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이상점수 고위험 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5" min="0" max="100" value={draft.anomalyScoreHigh} onChange={e => updateDraft({ anomalyScoreHigh: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">점</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">이상점수 위험 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="5" min="0" max="100" value={draft.anomalyScoreCritical} onChange={e => updateDraft({ anomalyScoreCritical: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">점</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">재고일수 긴급 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" value={draft.stockDaysUrgent} onChange={e => updateDraft({ stockDaysUrgent: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 일수 미만이면 긴급(빨강) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">재고일수 주의 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="1" min="0" value={draft.stockDaysWarning} onChange={e => updateDraft({ stockDaysWarning: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">일</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">저회전 판단 기준</label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" min="0" value={draft.lowTurnoverThreshold} onChange={e => updateDraft({ lowTurnoverThreshold: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border" />
              <span className="text-sm text-gray-500">회전율</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 미만이면 저회전 품목으로 분류</p>
          </div>
        </div>
      </CollapsibleSection>
      </CategoryBlock>

      {/* ── 카테고리 6: 경영 목표/시스템 ── */}
      <CategoryBlock category={CATEGORIES[5]} isOpen={openCategories.has('system-goals')} onToggle={() => toggleCategory('system-goals')} warningCount={categoryWarnings['system-goals'] || 0}>
      {/* ═══════════ 16. 독립채산제 목표 설정 (통합 테이블) ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.profitCenter}
        title="독립채산제 목표 설정"
        icon="emoji_events"
        isOpen={openSections.has(SECTION_IDS.profitCenter)}
        onToggle={() => toggleSection(SECTION_IDS.profitCenter)}
        headerBg="bg-purple-50 dark:bg-purple-900/20"
        headerTextColor="text-purple-900 dark:text-purple-200"
        subtitle="매출 구간별 경영 목표를 설정합니다. 금액 수정 시 배수가 자동 재계산됩니다."
      >
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2 px-1.5">구간</th>
                  <th className="text-center py-2 px-1.5">매출<br/><span className="text-[10px] font-normal">(권장판매가)</span></th>
                  <th className="text-center py-2 px-1.5">매출<br/><span className="text-[10px] font-normal">(생산)</span></th>
                  <th className="text-center py-2 px-1.5">원재료비</th>
                  <th className="text-center py-2 px-1.5">부재료비</th>
                  <th className="text-center py-2 px-1.5">노무비</th>
                  <th className="text-center py-2 px-1.5">수도광열<br/>전력</th>
                  <th className="text-center py-2 px-1.5">폐기율<br/><span className="text-[10px] font-normal">(%)</span></th>
                  <th className="text-center py-2 px-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(draft.profitCenterGoals || []).map((goal: ProfitCenterGoal, idx: number) => {
                  const rev = goal.revenueBracket;
                  const absFields: { key: 'targetRecommendedRevenue' | 'targetProductionRevenue' | 'targetRawMaterialCost' | 'targetSubMaterialCost' | 'targetLaborCost' | 'targetOverheadCost'; multiplierKey?: 'revenueToRawMaterial' | 'revenueToSubMaterial' | 'productionToLabor' | 'revenueToExpense'; step: number }[] = [
                    { key: 'targetRecommendedRevenue', step: 100 },
                    { key: 'targetProductionRevenue', step: 100 },
                    { key: 'targetRawMaterialCost', multiplierKey: 'revenueToRawMaterial', step: 10 },
                    { key: 'targetSubMaterialCost', multiplierKey: 'revenueToSubMaterial', step: 10 },
                    { key: 'targetLaborCost', multiplierKey: 'productionToLabor', step: 10 },
                    { key: 'targetOverheadCost', multiplierKey: 'revenueToExpense', step: 10 },
                  ];
                  return (
                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1.5 px-1.5">
                        <div className="flex items-center gap-1">
                          <input type="number" step="1" min="1" value={Math.round(rev / 100000000)} onChange={e => {
                            const newGoals = [...draft.profitCenterGoals];
                            const updated = { ...goal, revenueBracket: Number(e.target.value) * 100000000, label: `${e.target.value}억` };
                            newGoals[idx] = deriveMultipliersFromTargets(updated);
                            updateDraft({ profitCenterGoals: newGoals });
                          }} className="w-14 text-right rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border" />
                          <span className="text-xs text-gray-400">억</span>
                        </div>
                      </td>
                      {absFields.map(({ key, multiplierKey, step }) => {
                        const val = goal.targets[key];
                        const multiplier = multiplierKey ? goal.targets[multiplierKey] : null;
                        return (
                          <td key={key} className="py-1.5 px-1.5 text-center">
                            <input
                              type="number"
                              step={step}
                              min="0"
                              value={val != null ? Math.round((val as number) / 10000) : ''}
                              onChange={e => {
                                const raw = Number(e.target.value) * 10000;
                                const updated = { ...goal, targets: { ...goal.targets, [key]: raw } };
                                const derived = deriveMultipliersFromTargets(updated);
                                const newGoals = [...draft.profitCenterGoals];
                                newGoals[idx] = derived;
                                updateDraft({ profitCenterGoals: newGoals });
                              }}
                              placeholder="-"
                              className="w-[4.5rem] text-center rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border"
                            />
                            {multiplier != null && (
                              <div className="text-[10px] text-gray-400 mt-0.5">&times;{multiplier}</div>
                            )}
                          </td>
                        );
                      })}
                      {(['wasteRateTarget'] as const).map(key => (
                        <td key={key} className="py-1.5 px-1.5 text-center">
                          <input type="number" step="0.5" min="0" value={goal.targets[key]} onChange={e => {
                            const newGoals = [...draft.profitCenterGoals];
                            newGoals[idx] = { ...goal, targets: { ...goal.targets, [key]: Number(e.target.value) } };
                            updateDraft({ profitCenterGoals: newGoals });
                          }} className="w-14 text-center rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-1 border" />
                        </td>
                      ))}
                      <td className="py-1.5 px-1.5 text-center">
                        <button onClick={() => {
                          const newGoals = draft.profitCenterGoals.filter((_: ProfitCenterGoal, i: number) => i !== idx);
                          updateDraft({ profitCenterGoals: newGoals });
                        }} className="text-gray-400 hover:text-red-500">
                          <span className="material-icons-outlined text-sm">close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-400 px-2">만원 단위 입력 | 배수(&times;)는 생산매출 ÷ 원가 금액으로 자동 계산 (읽기전용)</div>

          <button
            onClick={() => {
              const newGoal: ProfitCenterGoal = {
                revenueBracket: 1600000000,
                label: '16억',
                targets: {
                  productionToLabor: 5.4, revenueToMaterial: 3.8, revenueToRawMaterial: 4.2, revenueToSubMaterial: 40,
                  revenueToExpense: 10.0, wasteRateTarget: 2,
                  targetRecommendedRevenue: 2280000000, targetProductionRevenue: 1140000000,
                  targetRawMaterialCost: 380000000, targetSubMaterialCost: 40000000,
                  targetLaborCost: 296000000, targetOverheadCost: 160000000,
                },
              };
              updateDraft({ profitCenterGoals: [...(draft.profitCenterGoals || []), newGoal] });
            }}
            className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center"
          >
            <span className="material-icons-outlined text-sm mr-1">add</span>
            매출 구간 추가
          </button>
        </div>
      </CollapsibleSection>
      {/* ═══════════ 17. 설정 내보내기/가져오기 ═══════════ */}
      <CollapsibleSection
        id={SECTION_IDS.exportImport}
        title="설정 내보내기/가져오기"
        icon="import_export"
        isOpen={openSections.has(SECTION_IDS.exportImport)}
        onToggle={() => toggleSection(SECTION_IDS.exportImport)}
      >
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            비즈니스 설정, 채널 비용, 노무 기록, 데이터 소스 설정을 JSON 파일로 백업하거나 복원할 수 있습니다.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const exportData = {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  businessConfig: JSON.parse(localStorage.getItem('ZCMS_BUSINESS_CONFIG') || '{}'),
                  channelCosts: JSON.parse(localStorage.getItem('ZCMS_CHANNEL_COSTS_V2') || '[]'),
                  laborRecords: JSON.parse(localStorage.getItem('ZCMS_LABOR_RECORDS') || '[]'),
                  dataSourceConfig: JSON.parse(localStorage.getItem('ZCMS_DATASOURCE_CONFIG') || '{}'),
                  normalizedDataSource: JSON.parse(localStorage.getItem('Z_CMS_DATA_SOURCE_CONFIG') || '{}'),
                  dataSourceMd: localStorage.getItem('Z_CMS_DATA_SOURCE_MD') || '',
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `zcms-settings-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-md text-sm font-medium transition-colors flex items-center"
            >
              <span className="material-icons-outlined text-sm mr-1">download</span>
              JSON 내보내기
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 rounded-md text-sm font-medium transition-colors flex items-center"
            >
              <span className="material-icons-outlined text-sm mr-1">upload</span>
              JSON 가져오기
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (!data.version || !data.businessConfig) {
                      alert('올바른 Z-CMS 설정 파일이 아닙니다.');
                      return;
                    }
                    if (!window.confirm(`설정을 가져오시겠습니까?\n\n내보낸 날짜: ${data.exportedAt || '알 수 없음'}\n\n현재 설정이 덮어씌워집니다.`)) {
                      return;
                    }
                    if (data.businessConfig && Object.keys(data.businessConfig).length > 0) localStorage.setItem('ZCMS_BUSINESS_CONFIG', JSON.stringify(data.businessConfig));
                    if (data.channelCosts) localStorage.setItem('ZCMS_CHANNEL_COSTS_V2', JSON.stringify(data.channelCosts));
                    if (data.laborRecords) localStorage.setItem('ZCMS_LABOR_RECORDS', JSON.stringify(data.laborRecords));
                    if (data.dataSourceConfig && Object.keys(data.dataSourceConfig).length > 0) localStorage.setItem('ZCMS_DATASOURCE_CONFIG', JSON.stringify(data.dataSourceConfig));
                    if (data.normalizedDataSource && Object.keys(data.normalizedDataSource).length > 0) localStorage.setItem('Z_CMS_DATA_SOURCE_CONFIG', JSON.stringify(data.normalizedDataSource));
                    if (data.dataSourceMd) localStorage.setItem('Z_CMS_DATA_SOURCE_MD', data.dataSourceMd);
                    alert('설정을 성공적으로 가져왔습니다. 페이지를 새로고침합니다.');
                    window.location.reload();
                  } catch {
                    alert('파일을 읽을 수 없습니다. 올바른 JSON 파일인지 확인해주세요.');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </CollapsibleSection>
      </CategoryBlock>

      {/* ═══════════ 설정 초기화 ═══════════ */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('모든 비즈니스 설정을 기본값으로 초기화하시겠습니까?')) {
              resetConfig();
              setDraft({ ...config });
            }
          }}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md text-sm font-medium transition-colors flex items-center"
        >
          <span className="material-icons-outlined text-sm mr-1">restart_alt</span>
          비즈니스 설정 초기화
        </button>
      </div>

      {/* ═══════════ 하단 고정 저장 바 ═══════════ */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <span className="material-icons-outlined text-lg">edit_note</span>
              저장하지 않은 변경사항이 있습니다
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1"
              >
                <span className="material-icons-outlined text-sm">save</span>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
