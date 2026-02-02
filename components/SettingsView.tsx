import React, { useState, useEffect } from 'react';
import { testApiConnection, getEcountConfig, updateEcountConfig, EcountConfig } from '../services/ecountService';

export const SettingsView: React.FC = () => {
    const [safetyDays, setSafetyDays] = useState(14);
    const [aiSensitivity, setAiSensitivity] = useState(80);
    const [marginAlert, setMarginAlert] = useState(10);
    
    // ECOUNT Config State
    const [ecountConfig, setEcountConfig] = useState<EcountConfig>({
        COM_CODE: '',
        USER_ID: '',
        API_KEY: '',
        ZONE: 'CD'
    });
    
    const [apiTestStatus, setApiTestStatus] = useState<{success: boolean; message: string} | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        // Load existing config on mount
        const current = getEcountConfig();
        setEcountConfig(current);
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
            setApiTestStatus({ success: false, message: "알 수 없는 오류가 발생했습니다." });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">시스템 및 기준 정보 설정</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI 분석 로직과 알림 기준을 직접 제어할 수 있습니다.</p>
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
                                onChange={(e) => handleConfigChange('COM_CODE', e.target.value)}
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
                                onChange={(e) => handleConfigChange('USER_ID', e.target.value)}
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
                                onChange={(e) => handleConfigChange('API_KEY', e.target.value)}
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
                                onChange={(e) => handleConfigChange('ZONE', e.target.value)}
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
                             * 저장 시 자동으로 연결 테스트가 수행됩니다. <br/>
                             * 변경된 정보는 로컬 브라우저에만 저장됩니다.
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
                        <div className={`mt-2 p-3 rounded-md text-sm ${apiTestStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
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
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">탐지 민감도 (Sensitivity)</label>
                            <span className="text-sm font-bold text-primary dark:text-green-400">{aiSensitivity}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={aiSensitivity} 
                            onChange={(e) => setAiSensitivity(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                        />
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">안전재고 산출 기준일수</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={safetyDays} 
                                onChange={(e) => setSafetyDays(Number(e.target.value))}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                            />
                            <span className="text-sm text-gray-500">일</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">일 평균 출고량 × {safetyDays}일분을 안전재고로 설정합니다.</p>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">저마진 경고 알림 기준</label>
                         <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={marginAlert} 
                                onChange={(e) => setMarginAlert(Number(e.target.value))}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
                            />
                            <span className="text-sm text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">마진율이 {marginAlert}% 미만일 경우 대시보드에 경고를 표시합니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};