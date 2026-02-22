import React, { useState, useMemo, useCallback } from 'react';
import { Sidebar, Header } from '../components/layout';
import { NotificationPanel, Modal, ModalManager } from '../components/modals';
const DashboardHomeView = React.lazy(() => import('../components/views/DashboardHomeView').then(m => ({ default: m.DashboardHomeView })));
const SettingsView = React.lazy(() => import('../components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const ProfitAnalysisView = React.lazy(() => import('../components/views/ProfitAnalysisView').then(m => ({ default: m.ProfitAnalysisView })));
const CostManagementView = React.lazy(() => import('../components/views/CostManagementView').then(m => ({ default: m.CostManagementView })));
const ProductionBomView = React.lazy(() => import('../components/views/ProductionBomView').then(m => ({ default: m.ProductionBomView })));
const InventoryOrderView = React.lazy(() => import('../components/views/InventoryOrderView').then(m => ({ default: m.InventoryOrderView })));
const SalesAnalysisView = React.lazy(() => import('../components/views/SalesAnalysisView').then(m => ({ default: m.SalesAnalysisView })));
import { AIAssistButton, InsightCardsProvider, InsightStatusBar } from '../components/insight';
import { Button } from '../components/ui/button';
import { DynamicIcon } from '../components/ui/icon';
import { countDangerInsights, generatePageInsights } from '../utils/pageInsightGenerator';
import { SettingsProvider } from '../contexts/SettingsContext.tsx';
import { DataProvider, DataContextType } from '../contexts/DataContext.tsx';
import { SyncProvider, SyncContextType } from '../contexts/SyncContext.tsx';
import { UIProvider, useUI, ViewType as UIViewType } from '../contexts/UIContext.tsx';
import { ErrorBoundary } from '../components/common';
import { TooltipProvider } from '../components/ui/tooltip';
import { Notification, ModalItem } from '../types.ts';
import {
  computeChannelRevenue,
  computeCostBreakdown,
  computeWasteAnalysis,
  computeProfitCenterScore,
} from '../services/insightService';
import { getChannelCostSummaries } from '../components/domain';
import { getDateRange, filterByDate } from '../utils/dateRange';
import { exportViewToCsv } from '../utils/csvExport';
import { loadBusinessConfig } from '../config/businessConfig';
import { getPageTitle } from '../config/viewConfig';
import { useSyncManager } from '../hooks/useSyncManager';

type ViewType = UIViewType;

/**
 * App — providers wrapper only
 */
const App = () => {
  return (
    <SettingsProvider>
    <UIProvider>
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
    </UIProvider>
    </SettingsProvider>
  );
};

/**
 * AppContent — consumes UIContext, owns data/business logic
 */
function AppContent() {
  const {
    activeView,
    setActiveView: handleSetActiveView,
    activeSubTab,
    setActiveSubTab,
    dateRange,
    setDateRange,
    isDarkMode,
    toggleDarkMode,
    insightMode,
    setInsightMode,
    isSidebarOpen,
    toggleSidebar,
    pendingView,
    confirmNavigateAway,
    cancelNavigateAway,
  } = useUI();

  // --- Sync Manager Hook (data state + sync logic) ---
  const {
    profitData,
    inventoryData,
    bomItems,
    wasteTrendData,
    topProfitItems,
    bottomProfitItems,
    stocktakeAnomalies,
    orderSuggestions,
    gsDailySales,
    gsSalesDetail,
    gsProduction,
    gsPurchases,
    gsUtilities,
    gsLabor,
    gsBom,
    gsMaterialMaster,
    gsInventorySnapshots,
    gsChannelProfit,
    inventoryAdjustment,
    insights,
    isSyncing,
    lastSyncTime,
    initialLoadDone,
    syncMessage,
    dataAvailability,
    dataSource,
    syncStatus,
    handleEcountSync,
  } = useSyncManager(dateRange);

  // Notification State
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notifications = useMemo<Notification[]>(() => {
    if (!insights) return [];
    const notifs: Notification[] = [];
    if (inventoryData.filter(i => i.status === 'Shortage').length > 0) {
      const shortageItems = inventoryData.filter(i => i.status === 'Shortage');
      notifs.push({
        id: 'n-shortage',
        type: 'alert',
        title: '재고 부족 알림',
        message: `${shortageItems[0].skuName} 외 ${shortageItems.length - 1}건이 안전재고 이하입니다.`,
        time: '방금',
        read: false,
        targetView: 'inventory',
      });
    }
    if (insights.wasteAnalysis && insights.wasteAnalysis.avgWasteRate > 3) {
      notifs.push({
        id: 'n-waste',
        type: 'alert',
        title: '폐기율 주의',
        message: `평균 폐기율 ${insights.wasteAnalysis.avgWasteRate.toFixed(1)}%로 목표(3%) 초과`,
        time: '방금',
        read: false,
        targetView: 'production',
      });
    }
    if (insights.channelRevenue && insights.channelRevenue.totalRevenue > 0) {
      notifs.push({
        id: 'n-revenue',
        type: 'info',
        title: '매출 현황',
        message: `총 매출 ${(insights.channelRevenue.totalRevenue / 10000).toFixed(0)}만원 달성`,
        time: '방금',
        read: true,
        targetView: 'profit',
      });
    }
    if (insights.recommendations.length > 0) {
      notifs.push({
        id: 'n-recommend',
        type: 'success',
        title: '추천 업무',
        message: insights.recommendations[0].description,
        time: '방금',
        read: true,
        targetView: 'home',
      });
    }
    return notifs;
  }, [insights, inventoryData]);
  const hasUnread = notifications.some(n => !n.read);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ModalItem | null>(null);

  const handleItemClick = useCallback((item: ModalItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    setIsNotificationOpen(false);
    if (notification.targetView) {
      handleSetActiveView(notification.targetView as ViewType);
    }
  };

  const handlePurchaseRequest = () => {
    if (selectedItem && selectedItem.kind === 'inventory') {
      alert(
        `[발주 요청 완료]\n품목: ${selectedItem.skuName}\n수량: ${selectedItem.safetyStock * 2 - selectedItem.currentStock}개\n\nERP 시스템으로 전송되었습니다.`
      );
    }
    setIsModalOpen(false);
  };

  // --- Filter Logic (legacy mock data용 — date 필드 없는 배열 슬라이싱) ---
  const getFilteredData = <T,>(allData: T[]): T[] => {
    if (!allData || allData.length === 0) return [];
    const len = allData.length;
    switch (dateRange) {
      case '7days': return allData.slice(Math.max(len - 7, 0));
      case '30days': return allData.slice(Math.max(len - 30, 0));
      case 'lastMonth': return allData.slice(Math.max(len - 31, 0));
      case 'thisMonth': return allData.slice(Math.max(len - 31, 0));
      default: return allData;
    }
  };

  const filteredWasteData = useMemo(
    () => getFilteredData(wasteTrendData),
    [dateRange, wasteTrendData]
  );
  const filteredProfitData = useMemo(
    () => getFilteredData(profitData),
    [dateRange, profitData]
  );

  const handleExport = useCallback(() => {
    exportViewToCsv(activeView, {
      profit: filteredProfitData,
      cost: gsPurchases,
      production: gsProduction,
      inventory: inventoryData,
    });
  }, [activeView, filteredProfitData, gsPurchases, gsProduction, inventoryData]);

  const bizConfig = useMemo(() => loadBusinessConfig(), []);
  const channelCosts = useMemo(() => getChannelCostSummaries(), []);

  const filteredProfitCenterScore = useMemo(() => {
    if (!gsDailySales.length || !gsPurchases.length) return null;
    try {
      const { start, end } = getDateRange(dateRange);
      let fSales = filterByDate(gsDailySales, start, end);
      let fPurchases = filterByDate(gsPurchases, start, end);
      let fProduction = filterByDate(gsProduction, start, end);
      let fUtilities = filterByDate(gsUtilities, start, end);
      let fLabor = filterByDate(gsLabor, start, end);

      if (!fPurchases.length) {
        const pDates = gsPurchases.map(p => p.date).sort();
        const pStart = pDates[0];
        const pEnd = pDates[pDates.length - 1];
        fSales = filterByDate(gsDailySales, pStart, pEnd);
        fPurchases = gsPurchases;
        fProduction = filterByDate(gsProduction, pStart, pEnd);
        fUtilities = filterByDate(gsUtilities, pStart, pEnd);
        fLabor = filterByDate(gsLabor, pStart, pEnd);
      }

      if (!fSales.length || !fPurchases.length) return null;
      const fSalesDetail = filterByDate(gsSalesDetail, fSales[0]?.date || start, fSales[fSales.length - 1]?.date || end);
      const cr = computeChannelRevenue(fSales, fPurchases, channelCosts, bizConfig, fSalesDetail);
      const cb = computeCostBreakdown(fPurchases, fUtilities, fProduction, bizConfig, fLabor, inventoryAdjustment);
      const wa = computeWasteAnalysis(fProduction, bizConfig, fPurchases);
      return computeProfitCenterScore(cr, cb, wa, fProduction, bizConfig);
    } catch {
      return null;
    }
  }, [dateRange, gsDailySales, gsSalesDetail, gsPurchases, gsProduction, gsUtilities, gsLabor, inventoryAdjustment, bizConfig, channelCosts]);

  const renderActiveView = () => {
    if (!initialLoadDone && isSyncing) {
      return <div className="p-10 text-center text-gray-500">ECOUNT ERP 데이터 동기화 중...</div>;
    }

    const hasData = profitData.length > 0 || inventoryData.length > 0 || gsDailySales.length > 0 || gsPurchases.length > 0 || gsProduction.length > 0;
    if (initialLoadDone && !hasData && activeView !== 'settings') {
      return (
        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
          <DynamicIcon name="cloud_off" size={64} className="text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">
            표시할 데이터가 없습니다
          </h3>
          <p className="text-gray-500 mt-2">
            ECOUNT ERP에서 최근 3개월간의 판매/재고/생산 이력을 찾을 수 없습니다.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => handleEcountSync()}>
              다시 시도
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSetActiveView('settings')}
            >
              설정으로 이동
            </Button>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'home':
      default:
        return (
          <ErrorBoundary fallbackTitle="대시보드 로드 중 오류" key="home">
            <DashboardHomeView
              onSync={handleEcountSync}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              dailySales={gsDailySales}
              salesDetail={gsSalesDetail}
              production={gsProduction}
              purchases={gsPurchases}
              onNavigate={view => handleSetActiveView(view as ViewType)}
              dataSource={dataSource}
              syncStatus={syncStatus}
              profitCenterScore={filteredProfitCenterScore}
            />
          </ErrorBoundary>
        );
      case 'profit':
        return (
          <ErrorBoundary fallbackTitle="수익 분석 로드 중 오류" key="profit">
            <ProfitAnalysisView
              dailySales={gsDailySales}
              salesDetail={gsSalesDetail}
              purchases={gsPurchases}
              insights={insights}
              inventoryAdjustment={inventoryAdjustment}
              onItemClick={handleItemClick}
              onTabChange={setActiveSubTab}
            />
          </ErrorBoundary>
        );
      case 'sales':
        return (
          <ErrorBoundary fallbackTitle="매출 분석 로드 중 오류" key="sales">
            <SalesAnalysisView
              dailySales={gsDailySales}
              salesDetail={gsSalesDetail}
              purchases={gsPurchases}
              insights={insights}
              onItemClick={handleItemClick}
              onTabChange={setActiveSubTab}
            />
          </ErrorBoundary>
        );
      case 'cost':
        return (
          <ErrorBoundary fallbackTitle="원가 관리 로드 중 오류" key="cost">
            <CostManagementView
              purchases={gsPurchases}
              utilities={gsUtilities}
              production={gsProduction}
              dailySales={gsDailySales}
              salesDetail={gsSalesDetail}
              labor={gsLabor}
              insights={insights}
              profitCenterScore={filteredProfitCenterScore}
              inventoryAdjustment={inventoryAdjustment}
              bomData={gsBom}
              materialMaster={gsMaterialMaster}
              onItemClick={handleItemClick}
              onTabChange={setActiveSubTab}
            />
          </ErrorBoundary>
        );
      case 'production':
        return (
          <ErrorBoundary fallbackTitle="생산/BOM 로드 중 오류" key="production">
            <ProductionBomView
              production={gsProduction}
              purchases={gsPurchases}
              insights={insights}
              bomData={gsBom}
              materialMaster={gsMaterialMaster}
              onItemClick={handleItemClick}
              onTabChange={setActiveSubTab}
            />
          </ErrorBoundary>
        );
      case 'inventory':
        return (
          <ErrorBoundary fallbackTitle="재고/발주 로드 중 오류" key="inventory">
            <InventoryOrderView
              inventoryData={inventoryData}
              purchases={gsPurchases}
              insights={insights}
              stocktakeAnomalies={stocktakeAnomalies}
              onItemClick={handleItemClick}
              onTabChange={setActiveSubTab}
            />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary fallbackTitle="설정 로드 중 오류" key="settings">
            <SettingsView />
          </ErrorBoundary>
        );
    }
  };

  const pageTitle = getPageTitle(activeView);

  // Context values
  const dataContextValue = useMemo<DataContextType>(() => ({
    dailySales: gsDailySales,
    salesDetail: gsSalesDetail,
    production: gsProduction,
    purchases: gsPurchases,
    utilities: gsUtilities,
    labor: gsLabor,
    bom: gsBom,
    materialMaster: gsMaterialMaster,
    inventoryData,
    stocktakeAnomalies,
    insights,
  }), [gsDailySales, gsSalesDetail, gsProduction, gsPurchases, gsUtilities, gsLabor, gsBom, gsMaterialMaster, inventoryData, stocktakeAnomalies, insights]);

  const syncContextValue = useMemo<SyncContextType>(() => ({
    isSyncing,
    lastSyncTime,
    syncMessage,
    dataAvailability,
    dataSource,
    syncStatus,
    handleSync: handleEcountSync,
  }), [isSyncing, lastSyncTime, syncMessage, dataAvailability, dataSource, syncStatus]);

  const insightCards = useMemo(() =>
    insightMode ? generatePageInsights(activeView, activeSubTab, insights) : [],
    [insightMode, activeView, activeSubTab, insights]
  );

  return (
    <SyncProvider value={syncContextValue}>
    <DataProvider value={dataContextValue}>
      <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden font-sans">
        <Sidebar
          activeView={activeView}
          onNavigate={handleSetActiveView}
          dataAvailability={dataAvailability}
          isOpen={isSidebarOpen}
          onClose={() => toggleSidebar()}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Header
            pageTitle={pageTitle}
            toggleDarkMode={toggleDarkMode}
            isDarkMode={isDarkMode}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onNotificationClick={() => setIsNotificationOpen(!isNotificationOpen)}
            hasUnreadNotifications={hasUnread}
            onExport={handleExport}
            onToggleSidebar={toggleSidebar}
          />

          <NotificationPanel
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
          />

          <div className={`flex-1 overflow-auto p-6 scroll-smooth transition-all duration-300 ${insightMode ? 'bg-gray-100/50 dark:bg-gray-950/50' : ''}`}>
            <InsightCardsProvider value={insightCards}>
              <React.Suspense fallback={<div className="p-10 text-center text-gray-500">로딩 중...</div>}>
                {renderActiveView()}
              </React.Suspense>
            </InsightCardsProvider>
          </div>
          {insightMode && (
            <InsightStatusBar onClose={() => setInsightMode(false)} />
          )}
        </main>

        {/* AI Assist Button */}
        <AIAssistButton
          onClick={() => setInsightMode(!insightMode)}
          dangerCount={countDangerInsights(activeView, activeSubTab, insights)}
          isActive={insightMode}
        />

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            selectedItem
              ? `상세 분석: ${
                  selectedItem.kind === 'stocktake'
                    ? selectedItem.materialName
                    : selectedItem.skuName
                }`
              : '상세 정보'
          }
        >
          <ModalManager selectedItem={selectedItem} insights={insights} onPurchaseRequest={handlePurchaseRequest} />
        </Modal>

        {/* 미저장 설정 경고 모달 */}
        {pendingView && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <div className="flex items-center mb-4">
                <DynamicIcon name="warning" size={20} className="text-amber-500 mr-2" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">저장하지 않은 변경사항</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                설정 페이지에 저장하지 않은 변경사항이 있습니다. 페이지를 이동하면 변경 내용이 사라집니다.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={cancelNavigateAway}>
                  돌아가기
                </Button>
                <Button variant="destructive" onClick={confirmNavigateAway}>
                  저장 안 하고 이동
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DataProvider>
    </SyncProvider>
  );
}

export default App;
