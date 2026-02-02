import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { NotificationPanel } from './components/NotificationPanel.tsx';
import { DashboardHomeView } from './components/DashboardHomeView.tsx';
import { WasteBomView } from './components/WasteBomView.tsx';
import { ChannelProfitView } from './components/ChannelProfitView.tsx';
import { InventorySafetyView } from './components/InventorySafetyView.tsx';
import { StocktakeAnomalyView } from './components/StocktakeAnomalyView.tsx';
import { MonthlyProfitView } from './components/MonthlyProfitView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { OrderManagementView } from './components/OrderManagementView.tsx'; 
import { Modal } from './components/Modal.tsx';
import { 
    MOCK_COST_BREAKDOWN, MOCK_INVENTORY_HISTORY, MOCK_STOCKTAKE_HISTORY, 
    NOTIFICATIONS_DATA, MOCK_CHANNEL_MIX,
    MOCK_DASHBOARD_SUMMARY
} from './constants.ts';
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine,
    BarChart, Bar
} from 'recharts';
import { Notification, ChannelProfitData, InventorySafetyItem, BomDiffItem, DashboardSummary, ProfitRankItem, StocktakeAnomalyItem, OrderSuggestion, WasteTrendData } from './types.ts';
import { syncAllEcountData } from './services/ecountService.ts';

type ViewType = 'home' | 'profit' | 'waste' | 'inventory' | 'stocktake' | 'monthly' | 'settings' | 'order';

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [dateRange, setDateRange] = useState('7days');
  
  // --- Data State Management (Initialized Empty to prove Real Data Fetching) ---
  const [profitData, setProfitData] = useState<ChannelProfitData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventorySafetyItem[]>([]);
  const [bomItems, setBomItems] = useState<BomDiffItem[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>(MOCK_DASHBOARD_SUMMARY); // Summary still needs calculation
  const [wasteTrendData, setWasteTrendData] = useState<WasteTrendData[]>([]);
  
  const [topProfitItems, setTopProfitItems] = useState<ProfitRankItem[]>([]);
  const [bottomProfitItems, setBottomProfitItems] = useState<ProfitRankItem[]>([]);
  const [stocktakeAnomalies, setStocktakeAnomalies] = useState<StocktakeAnomalyItem[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([]);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("-");
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Notification State
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notifications = NOTIFICATIONS_DATA; 
  const hasUnread = notifications.some(n => !n.read);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- Initial Fetch on Mount ---
  useEffect(() => {
      handleEcountSync();
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleItemClick = (item: any) => {
      setSelectedItem(item);
      setIsModalOpen(true);
  };

  // --- ECOUNT ERP Sync Logic ---
  const handleEcountSync = async () => {
      setIsSyncing(true);
      try {
          const result = await syncAllEcountData();
          
          setProfitData(result.profitTrend);
          setTopProfitItems(result.topProfit);
          setBottomProfitItems(result.bottomProfit);
          
          setInventoryData(result.inventory);
          setStocktakeAnomalies(result.anomalies);
          setOrderSuggestions(result.suggestions);

          setBomItems(result.bomItems);
          setWasteTrendData(result.wasteTrend);
          
          setLastSyncTime(result.lastSynced);
          
          // Recalculate Summary from Real Data
          const totalRev = result.profitTrend.reduce((sum, item) => sum + item.revenue, 0);
          const totalProfit = result.profitTrend.reduce((sum, item) => sum + item.profit, 0);
          const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

          setDashboardSummary(prev => ({
              ...prev,
              totalRevenue: totalRev,
              avgMargin: parseFloat(avgMargin.toFixed(1)),
              riskItems: result.inventory.filter(i => i.status !== 'Normal').length,
              anomalyCount: result.anomalies.length
          }));

      } catch (e) {
          console.error(e);
          // Don't alert on initial auto-load to avoid annoying popups if API is down
          if (initialLoadDone) alert("동기화 실패: ECOUNT API 연결을 확인하세요.");
      } finally {
          setIsSyncing(false);
          setInitialLoadDone(true);
      }
  };

  const handleNotificationClick = (notification: Notification) => {
      setIsNotificationOpen(false); 
      if (notification.targetView) {
          setActiveView(notification.targetView as ViewType);
      }
  };

  const handlePurchaseRequest = () => {
      alert(`[발주 요청 완료]\n품목: ${selectedItem.skuName}\n수량: ${selectedItem.safetyStock * 2 - selectedItem.currentStock}개\n\nERP 시스템으로 전송되었습니다.`);
      setIsModalOpen(false);
  };

  // --- Filter Logic ---
  const getFilteredData = (allData: any[], dateKey: string = 'day') => {
      if (!allData || allData.length === 0) return [];
      const dataLength = allData.length;
      if (dateRange === '7days') return allData.slice(Math.max(dataLength - 7, 0));
      else if (dateRange === '30days') return allData.slice(Math.max(dataLength - 30, 0));
      return allData;
  };

  const filteredWasteData = useMemo(() => getFilteredData(wasteTrendData, 'day'), [dateRange, wasteTrendData]);
  const filteredProfitData = useMemo(() => getFilteredData(profitData, 'date'), [dateRange, profitData]);

  const handleExport = () => {
      let dataToExport: any[] = [];
      let filename = `export_${activeView}_${new Date().toISOString().slice(0, 10)}.csv`;

      switch (activeView) {
          case 'waste': dataToExport = filteredWasteData; break;
          case 'profit': dataToExport = filteredProfitData; break;
          case 'monthly': dataToExport = [...topProfitItems, ...bottomProfitItems]; break;
          case 'inventory': dataToExport = inventoryData; break;
          default: dataToExport = [{ message: "No exportable data for this view" }];
      }

      if (dataToExport.length === 0) {
          alert("내보낼 데이터가 없습니다.");
          return;
      }

      const headers = Object.keys(dataToExport[0]).join(',');
      const rows = dataToExport.map(row => Object.values(row).join(',')).join('\n');
      const csvContent = `data:text/csv;charset=utf-8,\uFEFF${headers}\n${rows}`;

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Transform data for mini charts in dashboard
  const profitTrendForChart = profitData.map(d => ({ value: d.profit }));
  const wasteTrendForChart = wasteTrendData.map(d => ({ value: d.actual }));

  const renderActiveView = () => {
    // Show loading skeleton if fetching
    if (!initialLoadDone && isSyncing) {
        return <div className="p-10 text-center text-gray-500">ECOUNT ERP 데이터 동기화 중...</div>;
    }

    // Show empty state if no data
    const hasData = profitData.length > 0 || inventoryData.length > 0;
    if (initialLoadDone && !hasData && activeView !== 'settings') {
         return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <span className="material-icons-outlined text-6xl text-gray-300 mb-4">cloud_off</span>
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">표시할 데이터가 없습니다</h3>
                <p className="text-gray-500 mt-2">ECOUNT ERP에서 최근 3개월간의 판매/재고/생산 이력을 찾을 수 없습니다.</p>
                <button onClick={handleEcountSync} className="mt-6 px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover">
                    다시 시도
                </button>
            </div>
         );
    }

    switch (activeView) {
      case 'home': return (
        <DashboardHomeView 
            onSync={handleEcountSync}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            summaryData={dashboardSummary}
            profitTrend={profitTrendForChart}
            wasteTrend={wasteTrendForChart}
        />
      );
      case 'profit': return <ChannelProfitView data={filteredProfitData} />;
      case 'waste': return <WasteBomView onItemClick={handleItemClick} wasteTrendData={filteredWasteData} bomItems={bomItems} />;
      case 'inventory': return <InventorySafetyView onItemClick={handleItemClick} data={inventoryData} />;
      case 'stocktake': return <StocktakeAnomalyView onItemClick={handleItemClick} data={stocktakeAnomalies} />;
      case 'monthly': return <MonthlyProfitView onItemClick={handleItemClick} topItems={topProfitItems} bottomItems={bottomProfitItems} />;
      case 'settings': return <SettingsView />;
      case 'order': return <OrderManagementView suggestions={orderSuggestions} />;
      default: return (
        <DashboardHomeView 
            onSync={handleEcountSync}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            summaryData={dashboardSummary}
            profitTrend={profitTrendForChart}
            wasteTrend={wasteTrendForChart}
        />
      );
    }
  };

  const getPageTitle = () => {
      switch (activeView) {
          case 'home': return '통합 관제 대시보드';
          case 'profit': return '채널 손익 대시보드';
          case 'waste': return '폐기 및 BOM 차이 분석';
          case 'inventory': return '재고 건전성 분석';
          case 'stocktake': return '재고 실사 이상 탐지';
          case 'monthly': return '월간 수익성 랭킹';
          case 'settings': return '시스템 설정';
          case 'order': return '자재 발주 관리';
          default: return '대시보드';
      }
  };

  const renderModalContent = () => {
    if (!selectedItem) return null;

    if (activeView === 'monthly') {
        return (
            <div className="space-y-6">
                 {/* Top Summary */}
                 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-blue-800 dark:text-blue-200">수익성 분석 리포트: {selectedItem.skuName}</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        마진율: {selectedItem.margin}%
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                        <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">원가 구조 (Cost)</h5>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={MOCK_COST_BREAKDOWN}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {MOCK_COST_BREAKDOWN.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend wrapperStyle={{fontSize: '10px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                        <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">채널별 판매 비중 (Sales Mix)</h5>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={MOCK_CHANNEL_MIX} layout="vertical" margin={{top:5, right:10, bottom:5, left:10}}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={70} tick={{fontSize: 10}} />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" name="판매비중(%)" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                        {MOCK_CHANNEL_MIX.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.margin < 20 ? '#EF4444' : '#3B82F6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === 'inventory') {
        const isShortage = selectedItem.status === 'Shortage';
        return (
             <div className="space-y-4">
                 <div className={`p-3 rounded-md mb-4 border ${isShortage ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-800'}`}>
                    <h4 className={`font-bold ${isShortage ? 'text-red-800 dark:text-red-200' : 'text-gray-800 dark:text-white'}`}>
                        재고 상태: {selectedItem.status === 'Shortage' ? '위험 (발주 필요)' : selectedItem.status}
                    </h4>
                    <p className={`text-xs ${isShortage ? 'text-red-600 dark:text-red-300' : 'text-gray-500'}`}>
                        {isShortage ? '최근 4주 연속 안전재고 미달 상태가 지속되고 있습니다. 즉시 발주가 권장됩니다.' : '현재 재고 수준은 안정적입니다.'}
                    </p>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_INVENTORY_HISTORY} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 12}} />
                            <RechartsTooltip />
                            <ReferenceLine y={selectedItem.safetyStock} label="Safety Stock" stroke="red" strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="stock" stroke="#2F5E3E" fill="#2F5E3E" fillOpacity={0.3} name="현재 재고" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                {isShortage && (
                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button 
                            onClick={handlePurchaseRequest}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
                        >
                            <span className="material-icons-outlined text-sm">shopping_cart</span>
                            긴급 발주 요청
                        </button>
                    </div>
                )}
             </div>
        );
    }

    if (activeView === 'stocktake') {
        return (
            <div className="space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-md mb-4 border border-indigo-100 dark:border-indigo-800">
                    <h4 className="font-bold text-indigo-800 dark:text-indigo-200">실사 이력 분석: {selectedItem.materialName}</h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-300">최근 3회 연속 전산 재고가 실사 재고보다 높게 나타나는 'Loss' 패턴입니다.</p>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MOCK_STOCKTAKE_HISTORY} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 12}} />
                            <RechartsTooltip />
                            <ReferenceLine y={0} stroke="#000" />
                            <Bar dataKey="diff" name="차이 수량" fill="#EF4444" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="text-xs text-gray-500 text-center">
                    * 음수 막대는 전산 재고 > 실물 재고 (분실/Loss)를 의미합니다.
                </div>
            </div>
        );
    }
    
    // Default: BOM Diff
    return (
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <p className="text-xs text-gray-500">표준 소요량</p>
                    <p className="font-bold text-gray-900 dark:text-white">{selectedItem.stdQty} {selectedItem.stdUnit}</p>
                </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <p className="text-xs text-gray-500">실제 소요량</p>
                    <p className="font-bold text-red-600 dark:text-red-400">{selectedItem.actualQty} {selectedItem.stdUnit}</p>
                </div>
            </div>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-md border border-indigo-100 dark:border-indigo-800">
                <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center">
                    <span className="material-icons-outlined text-sm mr-1">psychology</span>
                    AI Reasoning (원인 분석)
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedItem.reasoning || "특이 사항이 발견되지 않았습니다."}
                </p>
            </div>

            {selectedItem.costImpact && (
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">원가 영향</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                        이 차이로 인해 이번 배치에서 총 <span className="font-bold text-red-600">
                            ${Math.abs(selectedItem.costImpact).toLocaleString()}
                        </span>의 추가 비용이 발생했습니다.
                    </p>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden font-sans">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header 
            toggleDarkMode={toggleDarkMode} 
            isDarkMode={isDarkMode} 
            dateRange={dateRange}
            setDateRange={setDateRange}
            onNotificationClick={() => setIsNotificationOpen(!isNotificationOpen)}
            hasUnreadNotifications={hasUnread}
            onExport={handleExport}
        />
        
        <NotificationPanel 
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
        />

        <div className="px-6 pt-4 pb-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white transition-colors">
                {getPageTitle()}
            </h2>
        </div>

        <div className="flex-1 overflow-auto p-6 scroll-smooth">
          {renderActiveView()}
        </div>
      </main>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedItem ? `상세 분석: ${selectedItem.skuName || selectedItem.materialName || selectedItem.name}` : '상세 정보'}
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default App;