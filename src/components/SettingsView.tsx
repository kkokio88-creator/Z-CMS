import React, { useState, useEffect } from 'react';
import {
  testApiConnection,
  getEcountConfig,
  updateEcountConfig,
  EcountConfig,
} from '../services/ecountService';
import { useSettings } from '../contexts/SettingsContext';
import { ChannelCostAdmin } from './ChannelCostAdmin';
import { LaborRecordAdmin } from './LaborRecordAdmin';

// 데이터 소스 연결 타입 정의
type DataSourceType = 'googleSheets' | 'ecount' | 'none';

interface DataSourceConfig {
  type: DataSourceType;
  googleSheets?: {
    spreadsheetUrl: string;
    sheetName: string;
  };
  ecount?: {
    enabled: boolean;
  };
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastTested?: string;
  errorMessage?: string;
}

interface DataSourcesConfig {
  mealPlan: DataSourceConfig; // 식단표
  salesHistory: DataSourceConfig; // 판매실적
  bomSan: DataSourceConfig; // BOM (SAN)
  bomZip: DataSourceConfig; // BOM (ZIP)
  inventory: DataSourceConfig; // 재고현황
  purchaseOrders: DataSourceConfig; // 발주현황
  purchaseHistory: DataSourceConfig; // 구매현황
}

const GOOGLE_SHEETS_SERVICE_ACCOUNT = 'z-cms-bot@z-cms-486204.iam.gserviceaccount.com';
const DATASOURCE_CONFIG_KEY = 'ZCMS_DATASOURCE_CONFIG';

const defaultDataSourceConfig: DataSourceConfig = {
  type: 'none',
  googleSheets: { spreadsheetUrl: '', sheetName: '' },
  ecount: { enabled: false },
  status: 'disconnected',
};

const defaultDataSourcesConfig: DataSourcesConfig = {
  mealPlan: { ...defaultDataSourceConfig },
  salesHistory: { ...defaultDataSourceConfig },
  bomSan: { ...defaultDataSourceConfig },
  bomZip: { ...defaultDataSourceConfig },
  inventory: { ...defaultDataSourceConfig },
  purchaseOrders: { ...defaultDataSourceConfig },
  purchaseHistory: { ...defaultDataSourceConfig },
};

export const SettingsView: React.FC = () => {
  const { config, updateConfig, resetConfig } = useSettings();
  const [safetyDays, setSafetyDays] = useState(14);
  const [aiSensitivity, setAiSensitivity] = useState(80);
  const [marginAlert, setMarginAlert] = useState(10);

  // ECOUNT Config State
  const [ecountConfig, setEcountConfig] = useState<EcountConfig>({
    COM_CODE: '',
    USER_ID: '',
    API_KEY: '',
    ZONE: 'CD',
  });

  const [apiTestStatus, setApiTestStatus] = useState<{ success: boolean; message: string } | null>(
    null
  );
  const [isTesting, setIsTesting] = useState(false);

  // 데이터 소스 연결 관리 State
  const [dataSourcesConfig, setDataSourcesConfig] =
    useState<DataSourcesConfig>(defaultDataSourcesConfig);
  const [testingSource, setTestingSource] = useState<keyof DataSourcesConfig | null>(null);

  useEffect(() => {
    // Load existing config on mount
    const current = getEcountConfig();
    setEcountConfig(current);

    // Load data sources config from localStorage
    const savedConfig = localStorage.getItem(DATASOURCE_CONFIG_KEY);
    if (savedConfig) {
      try {
        setDataSourcesConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse data sources config:', e);
      }
    }
  }, []);

  const handleConfigChange = (field: keyof EcountConfig, value: string) => {
    setEcountConfig(prev => ({ ...prev, [field]: value }));
    setApiTestStatus(null); // Reset test status on edit
  };

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setApiTestStatus(null);

    // Save first
    updateEcountConfig(ecountConfig);

    try {
      const result = await testApiConnection();
      setApiTestStatus(result);
    } catch (e) {
      setApiTestStatus({ success: false, message: '알 수 없는 오류가 발생했습니다.' });
    } finally {
      setIsTesting(false);
    }
  };

  // 데이터 소스 설정 변경 핸들러
  const handleDataSourceChange = (
    sourceKey: keyof DataSourcesConfig,
    field: 'type' | 'spreadsheetUrl' | 'sheetName',
    value: string
  ) => {
    setDataSourcesConfig(prev => {
      const updated = { ...prev };
      if (field === 'type') {
        updated[sourceKey] = {
          ...updated[sourceKey],
          type: value as DataSourceType,
          status: 'disconnected',
        };
      } else if (field === 'spreadsheetUrl' || field === 'sheetName') {
        updated[sourceKey] = {
          ...updated[sourceKey],
          googleSheets: {
            ...updated[sourceKey].googleSheets!,
            [field]: value,
          },
          status: 'disconnected',
        };
      }
      // Save to localStorage
      localStorage.setItem(DATASOURCE_CONFIG_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // 구글 시트 연결 테스트
  const testGoogleSheetsConnection = async (sourceKey: keyof DataSourcesConfig) => {
    const config = dataSourcesConfig[sourceKey];
    if (!config.googleSheets?.spreadsheetUrl || !config.googleSheets?.sheetName) {
      return;
    }

    setTestingSource(sourceKey);
    setDataSourcesConfig(prev => ({
      ...prev,
      [sourceKey]: { ...prev[sourceKey], status: 'testing' },
    }));

    try {
      const response = await fetch('http://localhost:4001/api/sheets/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetUrl: config.googleSheets.spreadsheetUrl,
          sheetName: config.googleSheets.sheetName,
        }),
      });

      const result = await response.json();

      setDataSourcesConfig(prev => {
        const updated = {
          ...prev,
          [sourceKey]: {
            ...prev[sourceKey],
            status: result.success ? 'connected' : 'error',
            lastTested: new Date().toISOString(),
            errorMessage: result.success ? undefined : result.message,
          },
        };
        localStorage.setItem(DATASOURCE_CONFIG_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      setDataSourcesConfig(prev => {
        const updated = {
          ...prev,
          [sourceKey]: {
            ...prev[sourceKey],
            status: 'error',
            lastTested: new Date().toISOString(),
            errorMessage: '서버 연결 실패. 백엔드 서버가 실행 중인지 확인하세요.',
          },
        };
        localStorage.setItem(DATASOURCE_CONFIG_KEY, JSON.stringify(updated));
        return updated;
      });
    } finally {
      setTestingSource(null);
    }
  };

  // 상태 배지 렌더링
  const renderStatusBadge = (status: DataSourceConfig['status']) => {
    const styles = {
      connected: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      disconnected: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      testing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    const labels = {
      connected: '연결됨',
      disconnected: '미연결',
      error: '오류',
      testing: '테스트 중...',
    };
    const icons = {
      connected: 'check_circle',
      disconnected: 'radio_button_unchecked',
      error: 'error',
      testing: 'sync',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}
      >
        <span
          className={`material-icons-outlined text-sm mr-1 ${status === 'testing' ? 'animate-spin' : ''}`}
        >
          {icons[status]}
        </span>
        {labels[status]}
      </span>
    );
  };

  // 데이터 소스 카드 렌더링
  const renderDataSourceCard = (
    sourceKey: keyof DataSourcesConfig,
    label: string,
    description: string,
    icon: string
  ) => {
    const config = dataSourcesConfig[sourceKey];
    const isGoogleSheets = config.type === 'googleSheets';
    const isEcount = config.type === 'ecount';
    const isTesting = testingSource === sourceKey;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="material-icons-outlined text-gray-500 dark:text-gray-400 mr-2">
              {icon}
            </span>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{label}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            </div>
          </div>
          {renderStatusBadge(config.status)}
        </div>

        {/* 데이터 소스 타입 선택 */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            연결 방식
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleDataSourceChange(sourceKey, 'type', 'googleSheets')}
              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                isGoogleSheets
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <span className="material-icons-outlined text-sm mr-1 align-middle">table_chart</span>
              Google Sheets
            </button>
            <button
              onClick={() => handleDataSourceChange(sourceKey, 'type', 'ecount')}
              className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                isEcount
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <span className="material-icons-outlined text-sm mr-1 align-middle">api</span>
              ECOUNT API
            </button>
          </div>
        </div>

        {/* Google Sheets 설정 */}
        {isGoogleSheets && (
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                스프레드시트 URL
              </label>
              <input
                type="text"
                value={config.googleSheets?.spreadsheetUrl || ''}
                onChange={e => handleDataSourceChange(sourceKey, 'spreadsheetUrl', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-green-500 focus:ring-green-500 text-xs p-2 border"
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                시트 이름
              </label>
              <input
                type="text"
                value={config.googleSheets?.sheetName || ''}
                onChange={e => handleDataSourceChange(sourceKey, 'sheetName', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-green-500 focus:ring-green-500 text-xs p-2 border"
                placeholder="Sheet1"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                <span className="material-icons-outlined text-xs align-middle mr-1">info</span>
                시트에 편집 권한 공유 필요
              </p>
              <button
                onClick={() => testGoogleSheetsConnection(sourceKey)}
                disabled={
                  isTesting ||
                  !config.googleSheets?.spreadsheetUrl ||
                  !config.googleSheets?.sheetName
                }
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isTesting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
                    테스트 중
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-sm mr-1">play_arrow</span>
                    연결 테스트
                  </>
                )}
              </button>
            </div>
            {config.status === 'error' && config.errorMessage && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                {config.errorMessage}
              </div>
            )}
          </div>
        )}

        {/* ECOUNT API 설정 */}
        {isEcount && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="material-icons-outlined text-sm align-middle mr-1">info</span>
              상단의 ECOUNT API 설정을 사용합니다. 연결 테스트는 상단 섹션에서 진행하세요.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          시스템 및 기준 정보 설정
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AI 분석 로직과 알림 기준을 직접 제어할 수 있습니다.
        </p>
      </div>

      {/* API Connection Panel */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
            <span className="material-icons-outlined mr-2">api</span>
            ERP API 연결 설정 (ECOUNT)
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                회사 코드 (Company Code)
              </label>
              <input
                type="text"
                value={ecountConfig.COM_CODE}
                onChange={e => handleConfigChange('COM_CODE', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                placeholder="예: 12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                사용자 ID (User ID)
              </label>
              <input
                type="text"
                value={ecountConfig.USER_ID}
                onChange={e => handleConfigChange('USER_ID', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                placeholder="예: MASTER"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API 인증키 (API Key)
              </label>
              <input
                type="password"
                value={ecountConfig.API_KEY}
                onChange={e => handleConfigChange('API_KEY', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                placeholder="ECOUNT API 인증키 입력"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Zone
              </label>
              <select
                value={ecountConfig.ZONE}
                onChange={e => handleConfigChange('ZONE', e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
              >
                <option value="CD">CD (운영서버)</option>
                <option value="AA">AA</option>
                <option value="AB">AB</option>
                <option value="BA">BA</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">
              * 저장 시 자동으로 연결 테스트가 수행됩니다. <br />* 변경된 정보는 로컬 브라우저에만
              저장됩니다.
            </p>
            <button
              onClick={handleSaveAndTest}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
            >
              {isTesting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  연결 확인 중...
                </>
              ) : (
                '저장 및 연결 테스트'
              )}
            </button>
          </div>
          {apiTestStatus && (
            <div
              className={`mt-2 p-3 rounded-md text-sm ${apiTestStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
            >
              <div className="flex items-center">
                <span className="material-icons-outlined mr-2 text-sm">
                  {apiTestStatus.success ? 'check_circle' : 'error'}
                </span>
                {apiTestStatus.message}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Source Connection Management */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <h3 className="font-bold text-green-900 dark:text-green-200 flex items-center">
            <span className="material-icons-outlined mr-2">link</span>
            데이터 소스 연결 관리
          </h3>
          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
            각 기능별로 Google Sheets 또는 ECOUNT API 중 데이터 소스를 선택하세요.
          </p>
        </div>

        {/* Google Sheets 서비스 계정 안내 */}
        <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800">
          <div className="flex items-start">
            <span className="material-icons-outlined text-yellow-600 dark:text-yellow-400 mr-2 text-lg">
              warning
            </span>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Google Sheets 사용 시 필수 권한 설정
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                아래 서비스 계정에 스프레드시트 <strong>&quot;편집자&quot;</strong> 권한을 공유해야
                합니다:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded text-xs font-mono text-yellow-900 dark:text-yellow-100">
                  {GOOGLE_SHEETS_SERVICE_ACCOUNT}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(GOOGLE_SHEETS_SERVICE_ACCOUNT)}
                  className="p-1 hover:bg-yellow-200 dark:hover:bg-yellow-700 rounded transition-colors"
                  title="복사"
                >
                  <span className="material-icons-outlined text-sm text-yellow-700 dark:text-yellow-300">
                    content_copy
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* 기본 데이터 섹션 */}
          <div className="mb-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="material-icons-outlined text-sm mr-1">folder</span>
              기본 데이터
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderDataSourceCard(
                'mealPlan',
                '식단표',
                '주간/월간 식단 계획 데이터',
                'restaurant_menu'
              )}
              {renderDataSourceCard(
                'salesHistory',
                '판매실적',
                '일별 메뉴/채널별 판매 데이터',
                'point_of_sale'
              )}
            </div>
          </div>

          {/* BOM 데이터 섹션 */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="material-icons-outlined text-sm mr-1">account_tree</span>
              BOM (자재명세서)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderDataSourceCard(
                'bomSan',
                'BOM (SAN)',
                'SAN 브랜드 메뉴 레시피',
                'receipt_long'
              )}
              {renderDataSourceCard(
                'bomZip',
                'BOM (ZIP)',
                'ZIP 브랜드 메뉴 레시피',
                'receipt_long'
              )}
            </div>
          </div>

          {/* 재고/구매 데이터 섹션 */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="material-icons-outlined text-sm mr-1">warehouse</span>
              재고 및 구매
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderDataSourceCard(
                'inventory',
                '재고현황',
                '현재 원자재 재고 수량',
                'inventory_2'
              )}
              {renderDataSourceCard(
                'purchaseHistory',
                '구매현황',
                '구매 이력 및 단가 정보',
                'shopping_cart'
              )}
              {renderDataSourceCard(
                'purchaseOrders',
                '발주현황',
                '진행 중인 발주 및 입고 예정',
                'local_shipping'
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                <span className="material-icons-outlined text-sm align-middle mr-1">info</span>
                설정은 브라우저에 자동 저장됩니다. 연결 테스트 후 데이터를 불러올 수 있습니다.
              </span>
              <button
                onClick={() => {
                  setDataSourcesConfig(defaultDataSourcesConfig);
                  localStorage.removeItem(DATASOURCE_CONFIG_KEY);
                }}
                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center"
              >
                <span className="material-icons-outlined text-sm mr-1">restart_alt</span>
                초기화
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
          <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center">
            <span className="material-icons-outlined mr-2">psychology</span>
            AI 이상 탐지 설정 (Anomaly Detection)
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                탐지 민감도 (Sensitivity)
              </label>
              <span className="text-sm font-bold text-primary dark:text-green-400">
                {aiSensitivity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={aiSensitivity}
              onChange={e => setAiSensitivity(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
            />
            <p className="text-xs text-gray-500 mt-2">
              민감도를 높이면 작은 변동에도 알림이 발생합니다. (권장: 75~85%)
            </p>
          </div>

          <div className="flex items-center justify-between py-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                자동 BOM 학습 승인
              </p>
              <p className="text-xs text-gray-500">
                AI가 95% 이상 확신할 때 표준 BOM을 자동 업데이트합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Rules */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
            <span className="material-icons-outlined mr-2">inventory_2</span>
            재고 및 원가 기준 (Inventory & Cost Rules)
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              안전재고 산출 기준일수
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={safetyDays}
                onChange={e => setSafetyDays(Number(e.target.value))}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              일 평균 출고량 × {safetyDays}일분을 안전재고로 설정합니다.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              저마진 경고 알림 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={marginAlert}
                onChange={e => setMarginAlert(Number(e.target.value))}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              마진율이 {marginAlert}% 미만일 경우 대시보드에 경고를 표시합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 원가 관련 설정 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <h3 className="font-bold text-orange-900 dark:text-orange-200 flex items-center">
            <span className="material-icons-outlined mr-2">calculate</span>
            원가 관련 설정
          </h3>
          <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
            이익률, 폐기 단가, 경비 비율 등 원가 계산에 사용되는 기준값입니다.
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기본 이익률
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={Math.round(config.defaultMarginRate * 100)}
                onChange={e => updateConfig({ defaultMarginRate: Number(e.target.value) / 100 })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">실제 비용 데이터 없을 때 사용하는 추정 마진율</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              폐기 기본 단가
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="100"
                min="0"
                value={config.wasteUnitCost}
                onChange={e => updateConfig({ wasteUnitCost: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">원/개</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">품목별 단가가 없을 때 사용하는 기본 폐기 비용</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              노무비 추정 비율
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={Math.round(config.laborCostRatio * 100)}
                onChange={e => updateConfig({ laborCostRatio: Number(e.target.value) / 100 })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">총 원가 대비 노무비 추정 비율 (실데이터 없을 때)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              간접 경비 비율
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={Math.round(config.overheadRatio * 100)}
                onChange={e => updateConfig({ overheadRatio: Number(e.target.value) / 100 })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">구매비 대비 기타 간접 경비 비율</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              월 고정경비
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="10000"
                min="0"
                value={config.monthlyFixedOverhead}
                onChange={e => updateConfig({ monthlyFixedOverhead: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              재고 보유비 비율
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={Math.round(config.holdingCostRate * 100)}
                onChange={e => updateConfig({ holdingCostRate: Number(e.target.value) / 100 })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">단가 대비 연간 재고 보유비 비율</p>
          </div>
        </div>
      </div>

      {/* 재고 분류 기준 (ABC-XYZ) */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-teal-50 dark:bg-teal-900/20">
          <h3 className="font-bold text-teal-900 dark:text-teal-200 flex items-center">
            <span className="material-icons-outlined mr-2">grid_view</span>
            재고 분류 기준 (ABC-XYZ)
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ABC A등급 기준 (금액 비중)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.abcClassAThreshold}
                onChange={e => updateConfig({ abcClassAThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">상위 금액 비중이 이 값 이하인 품목을 A등급으로 분류</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ABC B등급 기준 (금액 비중)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.abcClassBThreshold}
                onChange={e => updateConfig({ abcClassBThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              XYZ X등급 변동계수 상한
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={config.xyzClassXThreshold}
                onChange={e => updateConfig({ xyzClassXThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">변동계수(CV)가 이 값 이하이면 X등급 (안정 수요)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              XYZ Y등급 변동계수 상한
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={config.xyzClassYThreshold}
                onChange={e => updateConfig({ xyzClassYThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 이상 감지 기준 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
          <h3 className="font-bold text-red-900 dark:text-red-200 flex items-center">
            <span className="material-icons-outlined mr-2">notification_important</span>
            이상 감지 기준
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              폐기율 경고 임계값
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={config.wasteThresholdPct}
                onChange={e => updateConfig({ wasteThresholdPct: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 비율을 초과하면 폐기 경고 발생</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              레시피 오차 허용률
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.recipeVarianceTolerance}
                onChange={e => updateConfig({ recipeVarianceTolerance: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이상 감지 주의 임계값
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.anomalyWarningThreshold}
                onChange={e => updateConfig({ anomalyWarningThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이상 감지 위험 임계값
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.anomalyCriticalThreshold}
                onChange={e => updateConfig({ anomalyCriticalThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              수율 저하 허용률
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={config.yieldDropTolerance}
                onChange={e => updateConfig({ yieldDropTolerance: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              성능 허용 오차
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.performanceTolerance}
                onChange={e => updateConfig({ performanceTolerance: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 노무비 관리 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
          <h3 className="font-bold text-purple-900 dark:text-purple-200 flex items-center">
            <span className="material-icons-outlined mr-2">groups</span>
            노무비 관리
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              반별 평균 인건비
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1000"
                min="0"
                value={config.avgHourlyWage}
                onChange={e => updateConfig({ avgHourlyWage: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">원/시간</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              초과근무 할증률
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={config.overtimeMultiplier}
                onChange={e => updateConfig({ overtimeMultiplier: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">배</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">기본급 대비 초과근무 할증 배수</p>
          </div>
        </div>
      </div>

      {/* 발주 파라미터 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-cyan-50 dark:bg-cyan-900/20">
          <h3 className="font-bold text-cyan-900 dark:text-cyan-200 flex items-center">
            <span className="material-icons-outlined mr-2">local_shipping</span>
            발주 파라미터
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기본 리드타임
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="1"
                max="90"
                value={config.defaultLeadTime}
                onChange={e => updateConfig({ defaultLeadTime: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              리드타임 표준편차
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={config.leadTimeStdDev}
                onChange={e => updateConfig({ leadTimeStdDev: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">납품기간 변동성 (클수록 안전재고 증가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기본 서비스 수준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="50"
                max="99"
                value={config.defaultServiceLevel}
                onChange={e => updateConfig({ defaultServiceLevel: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">품절 방지 목표 확률 (높을수록 안전재고 증가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              주문 비용 (건당)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5000"
                min="0"
                value={config.orderCost}
                onChange={e => updateConfig({ orderCost: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">EOQ 계산에 사용되는 1회 주문 비용</p>
          </div>
        </div>
      </div>

      {/* 뷰 표시 임계값 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
          <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center">
            <span className="material-icons-outlined mr-2">tune</span>
            뷰 표시 임계값
          </h3>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">각 대시보드 화면의 색상 분기·경고 기준값</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              마진율 양호 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.profitMarginGood}
                onChange={e => updateConfig({ profitMarginGood: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 이상이면 녹색(양호)으로 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              단가상승 경고 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={config.priceIncreaseThreshold}
                onChange={e => updateConfig({ priceIncreaseThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 이상 상승한 원재료를 경고 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이상점수 주의 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.anomalyScoreWarning}
                onChange={e => updateConfig({ anomalyScoreWarning: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">점</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 점수 이상이면 주의(주황) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이상점수 고위험 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.anomalyScoreHigh}
                onChange={e => updateConfig({ anomalyScoreHigh: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">점</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 점수 이상이면 고위험으로 분류</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이상점수 위험 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={config.anomalyScoreCritical}
                onChange={e => updateConfig({ anomalyScoreCritical: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">점</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 점수 이상이면 위험(빨강) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              재고일수 긴급 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                value={config.stockDaysUrgent}
                onChange={e => updateConfig({ stockDaysUrgent: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 일수 미만이면 긴급(빨강) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              재고일수 주의 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                value={config.stockDaysWarning}
                onChange={e => updateConfig({ stockDaysWarning: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">일</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 일수 미만이면 주의(주황) 표시</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              저회전 판단 기준
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                value={config.lowTurnoverThreshold}
                onChange={e => updateConfig({ lowTurnoverThreshold: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm sm:text-sm p-2 border"
              />
              <span className="text-sm text-gray-500">회전율</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">이 값 미만이면 저회전 품목으로 분류</p>
          </div>
        </div>
      </div>

      {/* 채널 이익 계산 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-teal-500">calculate</span>
          채널 이익 계산 설정
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">평균 주문 단가 (원)</label>
            <input type="number" value={config.averageOrderValue} onChange={e => updateConfig('averageOrderValue', Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            <p className="text-xs text-gray-500 mt-1">건당 변동비 산출에 사용 (주문 건수 = 매출 / 평균단가)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기본 이익률 (%)</label>
            <input type="number" step="0.01" value={Math.round(config.defaultMarginRate * 100)} onChange={e => updateConfig('defaultMarginRate', Number(e.target.value) / 100)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            <p className="text-xs text-gray-500 mt-1">구매 데이터 없을 때 사용하는 추정 이익률</p>
          </div>
        </div>
      </div>

      {/* 채널 정산주기 설정 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-purple-500">schedule</span>
          채널 정산주기 설정
        </h3>
        <p className="text-xs text-gray-500 mb-4">각 채널의 매출 입금까지 소요되는 일수를 설정합니다. 현금흐름 분석에 반영됩니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">자사몰 (일)</label>
            <input type="number" value={config.channelCollectionDaysJasa} onChange={e => updateConfig({ channelCollectionDaysJasa: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
            <p className="text-xs text-gray-500 mt-1">0 = 즉시 입금</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">쿠팡 (일)</label>
            <input type="number" value={config.channelCollectionDaysCoupang} onChange={e => updateConfig({ channelCollectionDaysCoupang: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">컬리 (일)</label>
            <input type="number" value={config.channelCollectionDaysKurly} onChange={e => updateConfig({ channelCollectionDaysKurly: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" min={0} />
          </div>
        </div>
      </div>

      {/* 월간 예산 설정 */}
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-orange-500">account_balance_wallet</span>
          월간 예산 설정
        </h3>
        <p className="text-xs text-gray-500 mb-4">비용 요소별 월간 예산을 설정합니다. 예산 대비 실적 분석에 활용됩니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">원재료 예산 (원)</label>
            <input type="number" value={config.budgetRawMaterial} onChange={e => updateConfig({ budgetRawMaterial: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부재료 예산 (원)</label>
            <input type="number" value={config.budgetSubMaterial} onChange={e => updateConfig({ budgetSubMaterial: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">노무비 예산 (원)</label>
            <input type="number" value={config.budgetLabor} onChange={e => updateConfig({ budgetLabor: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">경비 예산 (원)</label>
            <input type="number" value={config.budgetOverhead} onChange={e => updateConfig({ budgetOverhead: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
      </div>

      {/* 노무비 관리 */}
      <LaborRecordAdmin />

      {/* 채널 비용 관리 */}
      <ChannelCostAdmin />

      {/* 설정 초기화 */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (window.confirm('모든 비즈니스 설정을 기본값으로 초기화하시겠습니까?')) {
              resetConfig();
            }
          }}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-md text-sm font-medium transition-colors flex items-center"
        >
          <span className="material-icons-outlined text-sm mr-1">restart_alt</span>
          비즈니스 설정 초기화
        </button>
      </div>
    </div>
  );
};
