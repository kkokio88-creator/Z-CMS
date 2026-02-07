import React, { useState, useEffect } from 'react';
import {
  testApiConnection,
  getEcountConfig,
  updateEcountConfig,
  EcountConfig,
} from '../services/ecountService';

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
    </div>
  );
};
