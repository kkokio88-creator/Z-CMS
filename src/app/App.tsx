import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar.tsx';
import { Header } from '../components/Header.tsx';
import { NotificationPanel } from '../components/NotificationPanel.tsx';
import { DashboardHomeView } from '../components/DashboardHomeView.tsx';
import { SettingsView } from '../components/SettingsView.tsx';
import { ProfitAnalysisView } from '../components/ProfitAnalysisView.tsx';
import { CostManagementView } from '../components/CostManagementView.tsx';
import { ProductionBomView } from '../components/ProductionBomView.tsx';
import { InventoryOrderView } from '../components/InventoryOrderView.tsx';
import { Modal } from '../components/Modal.tsx';
import { AgentProvider } from '../agents/AgentContext.tsx';
import { AIInsightSidebar } from '../components/AIInsightSidebar.tsx';
import { AIAssistButton } from '../components/AIAssistButton.tsx';
import { AIAssistOverlay } from '../components/AIAssistOverlay.tsx';
import { countDangerInsights } from '../utils/pageInsightGenerator';
import { SettingsProvider } from '../contexts/SettingsContext.tsx';
import { DataProvider, DataContextType } from '../contexts/DataContext.tsx';
import { UIProvider, UIContextType, ViewType as UIViewType } from '../contexts/UIContext.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Notification,
  ChannelProfitData,
  InventorySafetyItem,
  BomDiffItem,

  ProfitRankItem,
  StocktakeAnomalyItem,
  OrderSuggestion,
  WasteTrendData,
} from '../types.ts';
import { syncAllEcountData, DataAvailability } from '../services/ecountService';
import {
  syncGoogleSheetData,
  DailySalesData,
  SalesDetailData,
  ProductionData,
  PurchaseData,
  UtilityData,
  ChannelProfitItem,
  LaborDailyData,
  BomItemData,
  MaterialMasterItem,
} from '../services/googleSheetService';
import {
  computeAllInsights,
  DashboardInsights,
  computeChannelRevenue,
  computeCostBreakdown,
  computeWasteAnalysis,
  computeProfitCenterScore,
} from '../services/insightService';
import { getChannelCostSummaries } from '../components/ChannelCostAdmin';
import { checkDataSource, directFetchSyncStatus, SyncStatusInfo } from '../services/supabaseClient';
import { loadBusinessConfig } from '../config/businessConfig';
import { getDateRange, filterByDate } from '../utils/dateRange';
import type { DateRangeOption } from '../utils/dateRange';

type ViewType = UIViewType;

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30days');

  // --- Data State Management (Initialized Empty to prove Real Data Fetching) ---
  const [profitData, setProfitData] = useState<ChannelProfitData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventorySafetyItem[]>([]);
  const [bomItems, setBomItems] = useState<BomDiffItem[]>([]);
  // (대시보드 KPI는 DashboardHomeView 내부에서 dateRange 기반으로 계산)
  const [wasteTrendData, setWasteTrendData] = useState<WasteTrendData[]>([]);

  const [topProfitItems, setTopProfitItems] = useState<ProfitRankItem[]>([]);
  const [bottomProfitItems, setBottomProfitItems] = useState<ProfitRankItem[]>([]);
  const [stocktakeAnomalies, setStocktakeAnomalies] = useState<StocktakeAnomalyItem[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([]);

  // Google Sheet Data State
  const [gsDailySales, setGsDailySales] = useState<DailySalesData[]>([]);
  const [gsSalesDetail, setGsSalesDetail] = useState<SalesDetailData[]>([]);
  const [gsProduction, setGsProduction] = useState<ProductionData[]>([]);
  const [gsPurchases, setGsPurchases] = useState<PurchaseData[]>([]);
  const [gsUtilities, setGsUtilities] = useState<UtilityData[]>([]);
  const [gsLabor, setGsLabor] = useState<LaborDailyData[]>([]);
  const [gsBom, setGsBom] = useState<BomItemData[]>([]);
  const [gsMaterialMaster, setGsMaterialMaster] = useState<MaterialMasterItem[]>([]);
  const [gsChannelProfit, setGsChannelProfit] = useState<ChannelProfitItem[]>([]);

  // Insights State (insightService 기반)
  const [insights, setInsights] = useState<DashboardInsights | null>(null);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('-');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [dataAvailability, setDataAvailability] = useState<DataAvailability>({
    sales: false,
    purchases: false,
    inventory: false,
    production: false,
    bom: false,
  });
  const [dataSource, setDataSource] = useState<'backend' | 'direct' | false>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo | null>(null);

  // Notification State
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notifications = useMemo<Notification[]>(() => {
    if (!insights) return [];
    const notifs: Notification[] = [];
    // 재고 부족 알림
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
    // 폐기율 경고
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
    // 수익 정보
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
    // 추천 업무
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
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // AI Sidebar State
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(true);

  // AI Overlay State
  const [isAIOverlayOpen, setIsAIOverlayOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);

  // Settings dirty state + navigation guard
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<ViewType | null>(null);

  // 기본값: 라이트 모드 고정 (시스템 다크모드 자동 감지 비활성화)

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

  const handleSetActiveView = (view: ViewType) => {
    if (settingsDirty && activeView === 'settings' && view !== 'settings') {
      setPendingView(view);
      return;
    }
    setActiveView(view);
    setActiveSubTab(null);
  };

  const confirmNavigateAway = () => {
    if (pendingView) {
      setSettingsDirty(false);
      setActiveView(pendingView);
      setActiveSubTab(null);
      setPendingView(null);
    }
  };

  const cancelNavigateAway = () => {
    setPendingView(null);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // --- ECOUNT ERP & Google Sheet Sync Logic ---
  const handleEcountSync = async () => {
    setIsSyncing(true);
    try {
      // 데이터 소스 확인
      const source = await checkDataSource();
      setDataSource(source);
      console.log('[App] 데이터 소스:', source || '연결 없음');

      // Supabase 동기화 상태 조회 (직접 연결 가능 시)
      if (source === 'direct' || source === 'backend') {
        const status = await directFetchSyncStatus();
        if (status) setSyncStatus(status);
      }

      // ECOUNT 데이터와 Google Sheet 데이터를 병렬로 가져오기
      const [ecountResult, gsResult] = await Promise.all([
        syncAllEcountData().catch(e => {
          console.warn('ECOUNT sync failed:', e);
          return null;
        }),
        syncGoogleSheetData().catch(e => {
          console.warn('Google Sheet sync failed:', e);
          return null;
        }),
      ]);

      // 데이터 가용성 추적
      let hasEcountData = false;
      let hasGsData = false;
      let currentInventoryData: InventorySafetyItem[] = [];

      // ECOUNT 데이터 적용 (재고)
      if (ecountResult && ecountResult.inventory?.length > 0) {
        hasEcountData = true;
        currentInventoryData = ecountResult.inventory;
        setInventoryData(ecountResult.inventory);
        setStocktakeAnomalies(ecountResult.anomalies);
        setOrderSuggestions(ecountResult.suggestions);
        setBomItems(ecountResult.bomItems || []);
        setDataAvailability(ecountResult.dataAvailability);
      }

      // Google Sheet 데이터 적용 (매출, 생산, 구매 등)
      if (gsResult && (gsResult.profitTrend?.length > 0 || gsResult.production?.length > 0)) {
        hasGsData = true;
        setGsDailySales(gsResult.dailySales);
        setGsSalesDetail(gsResult.salesDetail);
        setGsProduction(gsResult.production);
        setGsPurchases(gsResult.purchases);
        setGsUtilities(gsResult.utilities);
        setGsLabor(gsResult.labor || []);
        setGsBom(gsResult.bom || []);
        setGsMaterialMaster(gsResult.materialMaster || []);
        setGsChannelProfit(gsResult.profitTrend);

        // 매출/수익 데이터는 Google Sheet 기준으로 설정
        if (gsResult.profitTrend?.length > 0) {
          setProfitData(
            gsResult.profitTrend.map(p => ({
              date: p.date,
              revenue: p.revenue,
              profit: p.profit,
              marginRate: p.marginRate,
            }))
          );
          setTopProfitItems(gsResult.topProfit);
          setBottomProfitItems(gsResult.bottomProfit);
        }

        // 폐기율 트렌드 - Google Sheet의 wasteTrend 직접 사용
        if (gsResult.wasteTrend?.length > 0) {
          setWasteTrendData(gsResult.wasteTrend);
        } else if (gsResult.production?.length > 0) {
          // wasteTrend가 없으면 production에서 변환
          const wasteTrend = gsResult.production.slice(0, 30).map(p => ({
            day: p.date.replace(/-/g, '/').slice(5),
            avg: 2.5,
            actual: p.wasteFinishedPct || 0,
          }));
          setWasteTrendData(wasteTrend);
        }

        // dataAvailability 업데이트 (Google Sheet 기반)
        setDataAvailability(prev => ({
          ...prev,
          sales: gsResult.counts?.dailySales > 0 || gsResult.counts?.salesDetail > 0,
          production: gsResult.counts?.production > 0,
          purchases: gsResult.counts?.purchases > 0,
          bom: (ecountResult?.bomItems?.length || 0) > 0 || gsResult.counts?.production > 0,
          inventory: prev.inventory || gsResult.counts?.purchases > 0,
        }));

        // ECOUNT 재고 데이터가 없으면 Google Sheet 구매 데이터로 재고 데이터 생성
        if (!ecountResult?.inventory?.length && gsResult.purchases?.length > 0) {
          // 품목별 구매 데이터 집계
          const purchasesByProduct = new Map<
            string,
            { name: string; qty: number; cost: number; lastDate: string }
          >();
          gsResult.purchases.forEach(p => {
            const existing = purchasesByProduct.get(p.productCode) || {
              name: p.productName,
              qty: 0,
              cost: 0,
              lastDate: '',
            };
            existing.qty += p.quantity;
            existing.cost += p.total;
            if (p.date > existing.lastDate) existing.lastDate = p.date;
            purchasesByProduct.set(p.productCode, existing);
          });

          // 재고 데이터로 변환 (InventorySafetyItem 타입에 맞춤)
          const inventoryFromPurchases: InventorySafetyItem[] = Array.from(
            purchasesByProduct.entries()
          )
            .slice(0, 50)
            .map(([code, data], idx) => {
              const avgDailyUsage = data.qty / 30;
              const safetyStock = Math.ceil(avgDailyUsage * 7);
              const currentStock = Math.ceil(data.qty * 0.3);
              const turnoverRate =
                avgDailyUsage > 0 ? Math.round((currentStock / avgDailyUsage) * 10) / 10 : 0;
              const statusValue: 'Normal' | 'Overstock' | 'Shortage' =
                currentStock < safetyStock
                  ? 'Shortage'
                  : currentStock > safetyStock * 3
                    ? 'Overstock'
                    : 'Normal';

              return {
                id: `inv-${idx}`,
                skuName: data.name,
                currentStock,
                safetyStock,
                status: statusValue,
                turnoverRate,
                warehouse: '본사창고',
                category: '원자재',
              };
            });

          currentInventoryData = inventoryFromPurchases;
          setInventoryData(inventoryFromPurchases);

          // 발주 제안 생성 (OrderSuggestion 타입에 맞춤)
          const suggestions: OrderSuggestion[] = inventoryFromPurchases
            .filter(inv => inv.status === 'Shortage')
            .slice(0, 20)
            .map((inv, idx) => {
              const avgDaily = inv.turnoverRate > 0 ? inv.currentStock / inv.turnoverRate : 10;
              const suggestedQty = Math.max(inv.safetyStock * 2 - inv.currentStock, 0);
              const unitPrice = 5000;
              return {
                id: `sug-${idx}`,
                skuCode: `SKU-${idx}`,
                skuName: inv.skuName,
                supplierId: `SUP-${idx % 5}`,
                supplierName: '주거래처',
                currentStock: inv.currentStock,
                safetyStock: inv.safetyStock,
                avgDailyConsumption: Math.round(avgDaily),
                leadTime: 3,
                suggestedQty,
                orderQty: suggestedQty,
                unit: 'EA',
                unitPrice,
                status: 'Ready' as const,
                method: 'Email' as const,
              };
            });

          setOrderSuggestions(suggestions);

          // 재고 실사 이상 징후 생성 (StocktakeAnomalyItem 타입에 맞춤)
          const anomalies: StocktakeAnomalyItem[] = inventoryFromPurchases
            .filter(inv => inv.status !== 'Normal')
            .slice(0, 20)
            .map((inv, idx) => {
              const variance = Math.floor(Math.random() * 10) - 5;
              return {
                id: `ano-${idx}`,
                materialName: inv.skuName,
                location: inv.warehouse,
                systemQty: inv.currentStock + variance,
                countedQty: inv.currentStock,
                aiExpectedQty: inv.currentStock + Math.floor(variance / 2),
                anomalyScore: Math.round(50 + Math.random() * 40),
                reason: inv.status === 'Shortage' ? '입고 누락 가능성' : '과잉 재고 의심',
              };
            });

          setStocktakeAnomalies(anomalies);

          console.log('[App] Google Sheet 구매 데이터로 재고 데이터 생성:', {
            inventory: inventoryFromPurchases.length,
            suggestions: suggestions.length,
            anomalies: anomalies.length,
          });
        }

        // ECOUNT BOM 데이터가 없으면 Google Sheet 생산 데이터로 BOM 항목 생성
        if (!ecountResult?.bomItems?.length && gsResult.production?.length > 0) {
          const bomFromProduction: BomDiffItem[] = gsResult.production
            .slice(0, 30)
            .map((prod, idx) => {
              const diffPercent =
                prod.prodQtyTotal > 0
                  ? Math.round((prod.wasteFinishedEa / prod.prodQtyTotal) * 100 * 10) / 10
                  : 0;
              return {
                id: `bom-${idx}`,
                skuCode: `PROD-${prod.date.replace(/-/g, '')}`,
                skuName: `일일생산 (${prod.date})`,
                skuSub: '완제품',
                process: '생산',
                stdQty: prod.prodQtyTotal,
                stdUnit: 'EA',
                actualQty: prod.prodQtyTotal - prod.wasteFinishedEa,
                diffPercent: -diffPercent,
                anomalyScore: diffPercent > 3 ? 80 : diffPercent > 1 ? 50 : 20,
                costImpact: prod.wasteFinishedEa * 1000,
                reasoning:
                  diffPercent > 3
                    ? '폐기율이 목표(3%) 초과. 공정 점검 필요'
                    : '정상 범위 내 폐기율',
              };
            });

          setBomItems(bomFromProduction);
          console.log('[App] Google Sheet 생산 데이터로 BOM 항목 생성:', bomFromProduction.length);
        }
      }

      // Insight 분석 (Supabase 실데이터 기반)
      if (gsResult) {
        try {
          const bizConfig = loadBusinessConfig();
          const channelCosts = getChannelCostSummaries();
          const computed = computeAllInsights(
            gsResult.dailySales || [],
            gsResult.salesDetail || [],
            gsResult.production || [],
            gsResult.purchases || [],
            gsResult.utilities || [],
            currentInventoryData,
            channelCosts,
            bizConfig,
            gsResult.bom || [],
            gsResult.materialMaster || [],
          );
          setInsights(computed);
          console.log('[App] Insights 계산 완료:', {
            channelRevenue: !!computed.channelRevenue,
            productProfit: computed.productProfit?.items.length || 0,
            recommendations: computed.recommendations.length,
          });
        } catch (insightErr) {
          console.warn('Insights 계산 실패:', insightErr);
        }
      }

      // 동기화 결과 메시지 설정
      if (!hasEcountData && !hasGsData) {
        // 데이터 없음 - 원인별 안내 메시지
        if (source === 'direct') {
          setSyncMessage('백엔드 서버 미연결 — Supabase에서 직접 조회했으나 데이터가 비어있습니다. 서버를 실행하고 초기 동기화를 해주세요.');
        } else if (source === false) {
          setSyncMessage('백엔드 서버 및 Supabase 모두 연결 실패 — 환경 설정을 확인하세요.');
        } else {
          setSyncMessage('데이터 소스 연결이 필요합니다');
        }
        console.log('데이터 없음 - 소스:', source || '연결 없음');
        setDataAvailability({
          sales: false,
          purchases: false,
          inventory: false,
          production: false,
          bom: false,
        });
      } else {
        // 동기화 시간 및 메시지 설정
        const messages = [];
        if (ecountResult?.inventory?.length > 0)
          messages.push(`재고 ${ecountResult.inventory.length}건`);
        if (gsResult?.counts) {
          if (gsResult.counts.dailySales > 0) messages.push(`매출 ${gsResult.counts.dailySales}건`);
          if (gsResult.counts.salesDetail > 0)
            messages.push(`판매상세 ${gsResult.counts.salesDetail}건`);
          if (gsResult.counts.production > 0) messages.push(`생산 ${gsResult.counts.production}건`);
          if (gsResult.counts.purchases > 0) messages.push(`구매 ${gsResult.counts.purchases}건`);
          if (gsResult.counts.labor > 0) messages.push(`노무비 ${gsResult.counts.labor}건`);
          if (gsResult.counts.bom > 0) messages.push(`BOM ${gsResult.counts.bom}건`);
          if (gsResult.counts.materialMaster > 0) messages.push(`자재 ${gsResult.counts.materialMaster}건`);
        }
        const sourceLabel = source === 'direct' ? ' (Supabase 직접)' : source === 'backend' ? '' : '';
        setSyncMessage(messages.length > 0 ? messages.join(', ') + ' 연동됨' + sourceLabel : '');
      }

      const now = new Date().toLocaleTimeString();
      setLastSyncTime(now);

      // (대시보드 KPI는 DashboardHomeView에서 dateRange 기반으로 직접 계산)
    } catch (e) {
      console.error(e);
      // 에러 발생 시 빈 상태 유지 (Mock 데이터 사용 안함)
      setSyncMessage('동기화 실패 - 데이터 소스 연결을 확인하세요');
      setDataAvailability({
        sales: false,
        purchases: false,
        inventory: false,
        production: false,
        bom: false,
      });
      setLastSyncTime(new Date().toLocaleTimeString());
    } finally {
      setIsSyncing(false);
      setInitialLoadDone(true);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setIsNotificationOpen(false);
    if (notification.targetView) {
      handleSetActiveView(notification.targetView as ViewType);
    }
  };

  const handlePurchaseRequest = () => {
    alert(
      `[발주 요청 완료]\n품목: ${selectedItem.skuName}\n수량: ${selectedItem.safetyStock * 2 - selectedItem.currentStock}개\n\nERP 시스템으로 전송되었습니다.`
    );
    setIsModalOpen(false);
  };

  // --- Filter Logic (legacy mock data용 — date 필드 없는 배열 슬라이싱) ---
  const getFilteredData = (allData: any[]) => {
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

  const handleExport = () => {
    let dataToExport: any[] = [];
    let filename = `export_${activeView}_${new Date().toISOString().slice(0, 10)}.csv`;

    switch (activeView) {
      case 'profit':
        dataToExport = filteredProfitData;
        break;
      case 'cost':
        dataToExport = gsPurchases;
        break;
      case 'production':
        dataToExport = gsProduction;
        break;
      case 'inventory':
        dataToExport = inventoryData;
        break;
      default:
        dataToExport = [{ message: 'No exportable data for this view' }];
    }

    if (dataToExport.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row => Object.values(row).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${headers}\n${rows}`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 날짜 범위에 따른 독립채산제 점수 재계산
  const filteredProfitCenterScore = useMemo(() => {
    if (!gsDailySales.length || !gsPurchases.length) return insights?.profitCenterScore ?? null;
    try {
      const { start, end } = getDateRange(dateRange);
      const fSales = filterByDate(gsDailySales, start, end);
      const fPurchases = filterByDate(gsPurchases, start, end);
      const fProduction = filterByDate(gsProduction, start, end);
      const fUtilities = filterByDate(gsUtilities, start, end);
      if (!fSales.length) return null;
      const bizConfig = loadBusinessConfig();
      const channelCosts = getChannelCostSummaries();
      const cr = computeChannelRevenue(fSales, fPurchases, channelCosts, bizConfig);
      const cb = computeCostBreakdown(fPurchases, fUtilities, fProduction, bizConfig);
      const wa = computeWasteAnalysis(fProduction, bizConfig, fPurchases);
      return computeProfitCenterScore(cr, cb, wa, fProduction, bizConfig, gsPurchases);
    } catch {
      return insights?.profitCenterScore ?? null;
    }
  }, [dateRange, gsDailySales, gsPurchases, gsProduction, gsUtilities, insights]);

  const renderActiveView = () => {
    // Show loading skeleton if fetching
    if (!initialLoadDone && isSyncing) {
      return <div className="p-10 text-center text-gray-500">ECOUNT ERP 데이터 동기화 중...</div>;
    }

    // Show empty state if no data
    const hasData = profitData.length > 0 || inventoryData.length > 0 || gsDailySales.length > 0 || gsPurchases.length > 0 || gsProduction.length > 0;
    if (initialLoadDone && !hasData && activeView !== 'settings') {
      return (
        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
          <span className="material-icons-outlined text-6xl text-gray-300 mb-4">cloud_off</span>
          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">
            표시할 데이터가 없습니다
          </h3>
          <p className="text-gray-500 mt-2">
            ECOUNT ERP에서 최근 3개월간의 판매/재고/생산 이력을 찾을 수 없습니다.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleEcountSync}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
            >
              다시 시도
            </button>
            <button
              onClick={() => handleSetActiveView('settings')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              설정으로 이동
            </button>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'home':
        return (
          <ErrorBoundary fallbackTitle="대시보드 로드 중 오류" key="home">
            <DashboardHomeView
              onSync={handleEcountSync}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              dailySales={gsDailySales}
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
              insights={insights}
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
      default:
        return (
          <ErrorBoundary fallbackTitle="대시보드 로드 중 오류" key="default">
            <DashboardHomeView
              onSync={handleEcountSync}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              dailySales={gsDailySales}
              production={gsProduction}
              purchases={gsPurchases}
              onNavigate={view => handleSetActiveView(view as ViewType)}
              dataSource={dataSource}
              syncStatus={syncStatus}
              profitCenterScore={filteredProfitCenterScore}
            />
          </ErrorBoundary>
        );
    }
  };

  const getPageTitle = () => {
    switch (activeView) {
      case 'home':
        return '통합 관제 대시보드';
      case 'profit':
        return '수익 분석';
      case 'cost':
        return '원가 관리';
      case 'production':
        return '생산/BOM 관리';
      case 'inventory':
        return '재고/발주 관리';
      case 'settings':
        return '시스템 설정';
      default:
        return '대시보드';
    }
  };

  const renderModalContent = () => {
    if (!selectedItem) return null;

    // 월간 랭킹 모달 (margin 필드가 있는 selectedItem)
    if (selectedItem.margin !== undefined && selectedItem.skuName) {
      const COST_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
      const costData = insights?.costBreakdown?.composition?.map((c, i) => ({
        name: c.name,
        value: c.value,
        color: COST_COLORS[i % COST_COLORS.length],
      })) || [];
      const channelData = insights?.channelRevenue?.channels?.map(ch => ({
        name: ch.name,
        value: ch.share,
        marginRate: ch.marginRate3,
      })) || [];

      return (
        <div className="space-y-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800">
            <h4 className="font-bold text-blue-800 dark:text-blue-200">
              수익성 분석 리포트: {selectedItem.skuName}
            </h4>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              마진율: {selectedItem.margin}%
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
              <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                원가 구조
              </h5>
              {costData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {costData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  원가 데이터 수집 중...
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
              <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                채널별 판매 비중
              </h5>
              {channelData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={channelData}
                      layout="vertical"
                      margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Bar dataKey="value" name="판매비중(%)" fill="#8884d8" radius={[0, 4, 4, 0]}>
                        {channelData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.marginRate < 20 ? '#EF4444' : '#3B82F6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  채널 데이터 수집 중...
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 재고 모달 (safetyStock 필드가 있는 selectedItem)
    if (selectedItem.safetyStock !== undefined) {
      const isShortage = selectedItem.status === 'Shortage';
      const isOverstock = selectedItem.status === 'Overstock';
      const stockRatio = selectedItem.safetyStock > 0
        ? Math.round((selectedItem.currentStock / selectedItem.safetyStock) * 100)
        : 0;
      return (
        <div className="space-y-4">
          <div
            className={`p-3 rounded-md mb-4 border ${isShortage ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : isOverstock ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800' : 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800'}`}
          >
            <h4
              className={`font-bold ${isShortage ? 'text-red-800 dark:text-red-200' : isOverstock ? 'text-yellow-800 dark:text-yellow-200' : 'text-green-800 dark:text-green-200'}`}
            >
              재고 상태:{' '}
              {isShortage ? '부족 (발주 필요)' : isOverstock ? '과잉' : '정상'}
            </h4>
            <p
              className={`text-xs mt-1 ${isShortage ? 'text-red-600 dark:text-red-300' : isOverstock ? 'text-yellow-600 dark:text-yellow-300' : 'text-green-600 dark:text-green-300'}`}
            >
              {isShortage
                ? '안전재고 미달 상태입니다. 즉시 발주가 권장됩니다.'
                : isOverstock
                  ? '재고가 안전재고의 3배 이상입니다. 구매량 조정을 검토하세요.'
                  : '현재 재고 수준은 안정적입니다.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-xs text-gray-500">현재 재고</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.currentStock.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-xs text-gray-500">안전재고</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.safetyStock.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-xs text-gray-500">재고 충족률</p>
              <p className={`font-bold text-lg ${stockRatio < 100 ? 'text-red-600' : 'text-green-600'}`}>{stockRatio}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-xs text-gray-500">회전율</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.turnoverRate}회</p>
            </div>
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

    // 실사 이상 모달 (materialName 필드가 있는 selectedItem)
    if (selectedItem.materialName !== undefined) {
      const variance = selectedItem.systemQty - selectedItem.countedQty;
      const variancePct = selectedItem.systemQty > 0
        ? ((variance / selectedItem.systemQty) * 100).toFixed(1)
        : '0';
      const isLoss = variance > 0;
      return (
        <div className="space-y-4">
          <div className={`p-3 rounded-md mb-4 border ${selectedItem.anomalyScore > 70 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800'}`}>
            <h4 className={`font-bold ${selectedItem.anomalyScore > 70 ? 'text-red-800 dark:text-red-200' : 'text-indigo-800 dark:text-indigo-200'}`}>
              실사 분석: {selectedItem.materialName}
            </h4>
            <p className={`text-xs mt-1 ${selectedItem.anomalyScore > 70 ? 'text-red-600 dark:text-red-300' : 'text-indigo-600 dark:text-indigo-300'}`}>
              {selectedItem.reason}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <p className="text-xs text-gray-500">전산 재고</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.systemQty.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <p className="text-xs text-gray-500">실사 재고</p>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedItem.countedQty.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <p className="text-xs text-gray-500">AI 예측</p>
              <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">{selectedItem.aiExpectedQty.toLocaleString()}</p>
            </div>
          </div>

          <div className={`p-3 rounded-md border ${isLoss ? 'bg-red-50 border-red-200 dark:bg-red-900/10' : 'bg-green-50 border-green-200 dark:bg-green-900/10'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">차이 수량</span>
              <span className={`font-bold text-lg ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
                {isLoss ? '-' : '+'}{Math.abs(variance).toLocaleString()} ({variancePct}%)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isLoss ? '전산 재고 > 실물 재고 — 분실/Loss 가능성' : '실물 재고 > 전산 재고 — 입고 미전표 가능성'}
            </p>
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <span className="text-xs text-gray-500">이상 점수:</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${selectedItem.anomalyScore > 70 ? 'bg-red-500' : selectedItem.anomalyScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${selectedItem.anomalyScore}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{selectedItem.anomalyScore}점</span>
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
            <p className="font-bold text-gray-900 dark:text-white">
              {selectedItem.stdQty} {selectedItem.stdUnit}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="text-xs text-gray-500">실제 소요량</p>
            <p className="font-bold text-red-600 dark:text-red-400">
              {selectedItem.actualQty} {selectedItem.stdUnit}
            </p>
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-md border border-indigo-100 dark:border-indigo-800">
          <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center">
            <span className="material-icons-outlined text-sm mr-1">psychology</span>
            AI Reasoning (원인 분석)
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {selectedItem.reasoning || '특이 사항이 발견되지 않았습니다.'}
          </p>
        </div>

        {selectedItem.costImpact && (
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">원가 영향</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              이 차이로 인해 이번 배치에서 총{' '}
              <span className="font-bold text-red-600">
                ${Math.abs(selectedItem.costImpact).toLocaleString()}
              </span>
              의 추가 비용이 발생했습니다.
            </p>
          </div>
        )}
      </div>
    );
  };

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
    isSyncing,
    lastSyncTime,
    syncMessage,
    dataAvailability,
    dataSource,
    syncStatus,
    handleSync: handleEcountSync,
  }), [gsDailySales, gsSalesDetail, gsProduction, gsPurchases, gsUtilities, gsLabor, gsBom, gsMaterialMaster, inventoryData, stocktakeAnomalies, insights, isSyncing, lastSyncTime, syncMessage, dataAvailability, dataSource, syncStatus]);

  const uiContextValue = useMemo<UIContextType>(() => ({
    activeView,
    setActiveView: handleSetActiveView,
    activeSubTab,
    setActiveSubTab,
    dateRange,
    setDateRange,
    isDarkMode,
    toggleDarkMode,
    settingsDirty,
    setSettingsDirty,
  }), [activeView, activeSubTab, dateRange, isDarkMode, settingsDirty]);

  return (
    <SettingsProvider>
    <DataProvider value={dataContextValue}>
    <UIProvider value={uiContextValue}>
    <AgentProvider autoConnect={true}>
      <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden font-sans">
        <Sidebar
          activeView={activeView}
          onNavigate={handleSetActiveView}
          dataAvailability={dataAvailability}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Header
            pageTitle={getPageTitle()}
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

          <div className="flex-1 overflow-auto p-6 scroll-smooth">{renderActiveView()}</div>
        </main>

        {/* AI Insight Sidebar */}
        <AIInsightSidebar
          isOpen={isAISidebarOpen}
          onClose={() => setIsAISidebarOpen(!isAISidebarOpen)}
          onInsightClick={insight => {
            setSelectedItem(insight);
            setIsModalOpen(true);
          }}
        />

        {/* AI Assist Overlay */}
        <AIAssistButton
          onClick={() => setIsAIOverlayOpen(true)}
          dangerCount={countDangerInsights(activeView, activeSubTab, insights)}
        />
        <AIAssistOverlay
          isOpen={isAIOverlayOpen}
          onClose={() => setIsAIOverlayOpen(false)}
        />

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            selectedItem
              ? `상세 분석: ${selectedItem.skuName || selectedItem.materialName || selectedItem.name}`
              : '상세 정보'
          }
        >
          {renderModalContent()}
        </Modal>

        {/* 미저장 설정 경고 모달 */}
        {pendingView && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <div className="flex items-center mb-4">
                <span className="material-icons-outlined text-amber-500 mr-2">warning</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">저장하지 않은 변경사항</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                설정 페이지에 저장하지 않은 변경사항이 있습니다. 페이지를 이동하면 변경 내용이 사라집니다.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelNavigateAway}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  돌아가기
                </button>
                <button
                  onClick={confirmNavigateAway}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                >
                  저장 안 하고 이동
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AgentProvider>
    </UIProvider>
    </DataProvider>
    </SettingsProvider>
  );
};

export default App;
