import { useState, useEffect, useMemo } from 'react';
import {
  ChannelProfitData,
  InventorySafetyItem,
  BomDiffItem,
  ProfitRankItem,
  StocktakeAnomalyItem,
  OrderSuggestion,
  WasteTrendData,
} from '../types';
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
  InventorySnapshotData,
} from '../services/googleSheetService';
import {
  computeAllInsights,
  DashboardInsights,
  isSubMaterial,
  type InventoryAdjustment,
} from '../services/insightService';
import { fetchInventoryByLocation } from '../services/costManagementService';
import { getChannelCostSummaries } from '../components/domain';
import { checkDataSource, directFetchSyncStatus, SyncStatusInfo } from '../services/supabaseClient';
import { loadBusinessConfig } from '../config/businessConfig';
import { getDateRange } from '../utils/dateRange';
import type { DateRangeOption } from '../utils/dateRange';
import { loadCache, saveCache } from './useDataCache';
import { generateInventoryFromPurchases } from '../services/inventoryFallbackService';
import { toShippingDateBasis } from '../utils/shippingDateTransform';

export function useSyncManager(dateRange: DateRangeOption) {
  console.log('[Z-CMS] useSyncManager v3');
  // --- Memoized config values (computed once, stable across renders) ---
  const bizConfig = useMemo(() => loadBusinessConfig(), []);
  const channelCosts = useMemo(() => getChannelCostSummaries(), []);

  // --- Data State ---
  const [profitData, setProfitData] = useState<ChannelProfitData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventorySafetyItem[]>([]);
  const [bomItems, setBomItems] = useState<BomDiffItem[]>([]);
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
  const [gsInventorySnapshots, setGsInventorySnapshots] = useState<InventorySnapshotData[]>([]);
  const [gsChannelProfit, setGsChannelProfit] = useState<ChannelProfitItem[]>([]);
  const [inventoryAdjustment, setInventoryAdjustment] = useState<InventoryAdjustment | null>(
    bizConfig.manualInventoryAdjustment ?? null
  );

  // Insights State
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

  // --- ECOUNT ERP & Google Sheet Sync Logic ---
  const handleEcountSync = async (background = false) => {
    if (!background) setIsSyncing(true);
    try {
      // 데이터 소스 확인
      const source = await checkDataSource();
      setDataSource(source);

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

      // Google Sheet 데이터 적용 (매출, 생산, 구매 등) — 출고일 변환 적용
      if (gsResult && (gsResult.profitTrend?.length > 0 || gsResult.production?.length > 0)) {
        hasGsData = true;
        setGsDailySales(toShippingDateBasis(gsResult.dailySales));
        setGsSalesDetail(gsResult.salesDetail);
        setGsProduction(gsResult.production);
        setGsPurchases(gsResult.purchases);
        setGsUtilities(gsResult.utilities);
        setGsLabor(gsResult.labor || []);
        setGsBom(gsResult.bom || []);
        setGsMaterialMaster(gsResult.materialMaster || []);
        setGsInventorySnapshots(gsResult.inventorySnapshots || []);
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
          const fallback = generateInventoryFromPurchases(gsResult.purchases);
          currentInventoryData = fallback.inventory;
          setInventoryData(fallback.inventory);
          setOrderSuggestions(fallback.suggestions);
          setStocktakeAnomalies(fallback.anomalies);
        }

        // 캐시 저장
        saveCache(gsResult);

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
        }
      }

      // Insight 분석 (출고일 변환된 dailySales 기반, purchases는 원본 유지)
      if (gsResult) {
        try {
          const computed = computeAllInsights(
            toShippingDateBasis(gsResult.dailySales || []),
            gsResult.salesDetail || [],
            gsResult.production || [],
            gsResult.purchases || [],
            gsResult.utilities || [],
            currentInventoryData,
            channelCosts,
            bizConfig,
            gsResult.bom || [],
            gsResult.materialMaster || [],
            gsResult.labor || [],
            gsResult.inventorySnapshots || [],
            inventoryAdjustment,
          );
          setInsights(computed);
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

  // --- Initial Fetch on Mount ---
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      // 캐시에서 즉시 로드 → 화면 즉시 표시 (출고일 변환 적용)
      const ds = toShippingDateBasis(cached.dailySales || []);
      const sd = cached.salesDetail || [];
      const prod = cached.production || [];
      const purch = cached.purchases || [];
      const util = cached.utilities || [];
      const lab = cached.labor || [];
      const bom = cached.bom || [];
      const mm = cached.materialMaster || [];
      const invSnap = cached.inventorySnapshots || [];
      setGsDailySales(ds);
      setGsSalesDetail(sd);
      setGsProduction(prod);
      setGsPurchases(purch);
      setGsUtilities(util);
      setGsLabor(lab);
      setGsBom(bom);
      setGsMaterialMaster(mm);
      setGsInventorySnapshots(invSnap);
      setGsChannelProfit(cached.profitTrend || []);
      if (cached.profitTrend?.length > 0) {
        setProfitData(cached.profitTrend.map((p: ChannelProfitItem) => ({
          date: p.date, revenue: p.revenue, profit: p.profit, marginRate: p.marginRate,
        })));
      }
      // 캐시 데이터로 insights 계산
      try {
        const computed = computeAllInsights(ds, sd, prod, purch, util, [], channelCosts, bizConfig, bom, mm, lab, invSnap, inventoryAdjustment);
        setInsights(computed);
      } catch (e) { console.warn('캐시 insights 계산 실패:', e); }
      setInitialLoadDone(true);
      setSyncMessage('캐시 데이터 로드됨');
      setLastSyncTime(new Date(cached.timestamp).toLocaleTimeString());
      // 백그라운드에서 최신 데이터 동기화
      handleEcountSync(true);
    } else {
      handleEcountSync(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 날짜 범위 변경 시 기초/기말 재고 fetch → 재고 조정 원가 계산용
  useEffect(() => {
    const fetchInventoryAdjustment = async () => {
      try {
        const { start, end } = getDateRange(dateRange);
        // 기초재고일 = rangeStart - 1일
        const beginDate = new Date(start);
        beginDate.setDate(beginDate.getDate() - 1);
        const beginDateStr = beginDate.toISOString().slice(0, 10).replace(/-/g, '');
        const endDateStr = end.replace(/-/g, '');

        const [beginInventory, endInventory] = await Promise.all([
          fetchInventoryByLocation(beginDateStr),
          fetchInventoryByLocation(endDateStr),
        ]);

        // materialMaster 단가 lookup (있으면 사용, 없으면 ECOUNT 응답의 unitPrice)
        const masterPriceMap = new Map<string, number>();
        gsMaterialMaster.forEach(m => {
          if (m.unitPrice > 0) masterPriceMap.set(m.materialCode, m.unitPrice);
        });

        // fetchInventoryByLocation 실패 시 gsInventorySnapshots 폴백
        let effectiveBegin = beginInventory;
        let effectiveEnd = endInventory;
        if (beginInventory.length === 0 && endInventory.length === 0 && gsInventorySnapshots.length > 0) {
          const beginTarget = beginDate.toISOString().slice(0, 10);
          const endTarget = end;
          // 스냅샷에서 가장 가까운 날짜 찾기
          const dates = [...new Set(gsInventorySnapshots.map(s => s.snapshotDate))].sort();
          const findClosest = (target: string) => dates.reduce((best, d) => Math.abs(new Date(d).getTime() - new Date(target).getTime()) < Math.abs(new Date(best).getTime() - new Date(target).getTime()) ? d : best, dates[0]);
          const beginSnapDate = findClosest(beginTarget);
          const endSnapDate = findClosest(endTarget);
          const toInventory = (snapDate: string) => gsInventorySnapshots
            .filter(s => s.snapshotDate === snapDate)
            .map(s => ({
              warehouseCode: s.warehouseCode || '001',
              warehouseName: s.warehouseCode || '메인창고',
              productCode: s.productCode,
              productName: s.productName,
              quantity: s.balanceQty,
              unitPrice: masterPriceMap.get(s.productCode) || 0,
              totalValue: s.balanceQty * (masterPriceMap.get(s.productCode) || 0),
              category: '일반',
            }));
          effectiveBegin = toInventory(beginSnapDate);
          effectiveEnd = toInventory(endSnapDate);
          console.log(`[inventoryAdjustment] 스냅샷 폴백: 기초(${beginSnapDate}) ${effectiveBegin.length}건, 기말(${endSnapDate}) ${effectiveEnd.length}건`);
        }

        if (effectiveBegin.length === 0 && effectiveEnd.length === 0) {
          // 최종 폴백: businessConfig의 수동 재고 조정값
          if (bizConfig.manualInventoryAdjustment) {
            console.log('[inventoryAdjustment] 수동 설정값 사용:', bizConfig.manualInventoryAdjustment);
            setInventoryAdjustment(bizConfig.manualInventoryAdjustment);
          } else {
            setInventoryAdjustment(null);
          }
          return;
        }

        const calcValue = (items: typeof effectiveBegin, type: 'raw' | 'sub') => {
          return items
            .filter(inv => type === 'sub' ? isSubMaterial(inv.productName, inv.productCode) : !isSubMaterial(inv.productName, inv.productCode))
            .reduce((sum, inv) => {
              const price = masterPriceMap.get(inv.productCode) || inv.unitPrice || 0;
              return sum + inv.quantity * price;
            }, 0);
        };

        const adj = {
          beginningRawInventoryValue: calcValue(effectiveBegin, 'raw'),
          endingRawInventoryValue: calcValue(effectiveEnd, 'raw'),
          beginningSubInventoryValue: calcValue(effectiveBegin, 'sub'),
          endingSubInventoryValue: calcValue(effectiveEnd, 'sub'),
        };
        console.log('[inventoryAdjustment] 결과:', adj);
        setInventoryAdjustment(adj);
      } catch (err) {
        console.warn('[App] 재고 조정 데이터 fetch 실패:', err);
        if (bizConfig.manualInventoryAdjustment) {
          setInventoryAdjustment(bizConfig.manualInventoryAdjustment);
        } else {
          setInventoryAdjustment(null);
        }
      }
    };

    fetchInventoryAdjustment();
  }, [dateRange, gsMaterialMaster, gsInventorySnapshots]);

  // inventoryAdjustment 변경 시 insights 재계산 (비동기 fetch 완료 후 원가 반영)
  useEffect(() => {
    if (!inventoryAdjustment || gsPurchases.length === 0) return;
    try {
      const computed = computeAllInsights(
        gsDailySales, gsSalesDetail, gsProduction, gsPurchases, gsUtilities,
        inventoryData, channelCosts, bizConfig, gsBom, gsMaterialMaster,
        gsLabor, gsInventorySnapshots, inventoryAdjustment,
      );
      setInsights(computed);
    } catch (e) {
      console.warn('[useSyncManager] inventoryAdjustment 재계산 실패:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryAdjustment]);

  return {
    // Data
    profitData,
    inventoryData,
    bomItems,
    wasteTrendData,
    topProfitItems,
    bottomProfitItems,
    stocktakeAnomalies,
    orderSuggestions,
    // Google Sheet data
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
    // Insights
    insights,
    // Sync
    isSyncing,
    lastSyncTime,
    initialLoadDone,
    syncMessage,
    dataAvailability,
    dataSource,
    syncStatus,
    handleEcountSync,
  };
}
