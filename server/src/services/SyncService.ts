/**
 * Sync Service
 * Google Sheets / ECOUNT → Supabase 동기화
 */

import { googleSheetAdapter } from '../adapters/GoogleSheetAdapter.js';
import { ecountAdapter } from '../adapters/EcountAdapter.js';
import {
  supabaseAdapter,
  type DailySalesRow,
  type SalesDetailRow,
  type ProductionDailyRow,
  type PurchaseRow,
  type InventoryRow,
  type UtilityRow,
  type SyncLogRow,
} from '../adapters/SupabaseAdapter.js';

export interface SyncResult {
  source: string;
  success: boolean;
  records: Record<string, number>;
  error?: string;
  duration: number;
}

export class SyncService {
  /**
   * Google Sheets → Supabase 동기화
   */
  async syncFromGoogleSheets(): Promise<SyncResult> {
    const startTime = Date.now();
    const records: Record<string, number> = {};
    let logId: string | undefined;

    try {
      // 동기화 로그 시작
      logId = await supabaseAdapter.createSyncLog({
        source: 'google_sheets',
        status: 'in_progress',
        records_synced: 0,
        started_at: new Date().toISOString(),
      });

      console.log('[SyncService] Google Sheets 동기화 시작...');

      // Google Sheets에서 데이터 가져오기
      const sheetData = await googleSheetAdapter.syncAllData();

      // 1. Daily Sales 저장
      const dailySalesRows: DailySalesRow[] = sheetData.dailySales.map(d => ({
        date: d.date,
        jasa_price: d.jasaPrice,
        coupang_price: d.coupangPrice,
        kurly_price: d.kurlyPrice,
        total_revenue: d.totalRevenue,
        frozen_soup: d.frozenSoup,
        etc: d.etc,
        bibimbap: d.bibimbap,
        jasa_half: d.jasaHalf,
        coupang_half: d.coupangHalf,
        kurly_half: d.kurlyHalf,
        frozen_half: d.frozenHalf,
        etc_half: d.etcHalf,
        production_qty: d.productionQty,
        production_revenue: d.productionRevenue,
      }));
      records.dailySales = await supabaseAdapter.upsertDailySales(dailySalesRows);
      console.log(`[SyncService] daily_sales: ${records.dailySales}건 저장`);

      // 2. Sales Detail 저장
      const salesDetailRows: SalesDetailRow[] = sheetData.salesDetail.map(d => ({
        product_code: d.productCode,
        product_name: d.productName,
        date: d.date,
        customer: d.customer,
        product_desc: d.productDesc,
        spec: d.spec,
        quantity: d.quantity,
        supply_amount: d.supplyAmount,
        vat: d.vat,
        total: d.total,
      }));
      records.salesDetail = await supabaseAdapter.upsertSalesDetail(salesDetailRows);
      console.log(`[SyncService] sales_detail: ${records.salesDetail}건 저장`);

      // 3. Production Daily 저장
      const productionRows: ProductionDailyRow[] = sheetData.production.map(d => ({
        date: d.date,
        prod_qty_normal: d.prodQtyNormal,
        prod_qty_preprocess: d.prodQtyPreprocess,
        prod_qty_frozen: d.prodQtyFrozen,
        prod_qty_sauce: d.prodQtySauce,
        prod_qty_bibimbap: d.prodQtyBibimbap,
        prod_qty_total: d.prodQtyTotal,
        prod_kg_normal: d.prodKgNormal,
        prod_kg_preprocess: d.prodKgPreprocess,
        prod_kg_frozen: d.prodKgFrozen,
        prod_kg_sauce: d.prodKgSauce,
        prod_kg_total: d.prodKgTotal,
        waste_finished_ea: d.wasteFinishedEa,
        waste_finished_pct: d.wasteFinishedPct,
        waste_semi_kg: d.wasteSemiKg,
        waste_semi_pct: d.wasteSemiPct,
      }));
      records.production = await supabaseAdapter.upsertProductionDaily(productionRows);
      console.log(`[SyncService] production_daily: ${records.production}건 저장`);

      // 4. Purchases 저장
      const purchaseRows: PurchaseRow[] = sheetData.purchases.map(d => ({
        date: d.date,
        product_code: d.productCode,
        product_name: d.productName,
        quantity: d.quantity,
        unit_price: d.unitPrice,
        supply_amount: d.supplyAmount,
        vat: d.vat,
        total: d.total,
        inbound_price: d.inboundPrice,
        inbound_total: d.inboundTotal,
      }));
      records.purchases = await supabaseAdapter.upsertPurchases(purchaseRows);
      console.log(`[SyncService] purchases: ${records.purchases}건 저장`);

      // 5. Utilities 저장
      const utilityRows: UtilityRow[] = sheetData.utilities.map(d => ({
        date: d.date,
        elec_prev: d.elecPrev,
        elec_curr: d.elecCurr,
        elec_usage: d.elecUsage,
        elec_cost: d.elecCost,
        water_prev: d.waterPrev,
        water_curr: d.waterCurr,
        water_usage: d.waterUsage,
        water_cost: d.waterCost,
        gas_prev: d.gasPrev,
        gas_curr: d.gasCurr,
        gas_usage: d.gasUsage,
        gas_cost: d.gasCost,
      }));
      records.utilities = await supabaseAdapter.upsertUtilities(utilityRows);
      console.log(`[SyncService] utilities: ${records.utilities}건 저장`);

      const totalRecords = Object.values(records).reduce((a, b) => a + b, 0);

      // 로그 업데이트
      await supabaseAdapter.updateSyncLog(logId, {
        status: 'success',
        records_synced: totalRecords,
        completed_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      console.log(`[SyncService] Google Sheets 동기화 완료: ${totalRecords}건 (${duration}ms)`);

      return { source: 'google_sheets', success: true, records, duration };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[SyncService] Google Sheets 동기화 실패:', error.message);

      if (logId) {
        await supabaseAdapter.updateSyncLog(logId, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        }).catch(() => {});
      }

      return { source: 'google_sheets', success: false, records, error: error.message, duration };
    }
  }

  /**
   * ECOUNT → Supabase 동기화 (재고)
   */
  async syncFromEcount(): Promise<SyncResult> {
    const startTime = Date.now();
    const records: Record<string, number> = {};
    let logId: string | undefined;

    try {
      logId = await supabaseAdapter.createSyncLog({
        source: 'ecount',
        status: 'in_progress',
        records_synced: 0,
        started_at: new Date().toISOString(),
      });

      console.log('[SyncService] ECOUNT 동기화 시작...');

      const inventoryData = await ecountAdapter.fetchInventory();

      const inventoryRows: InventoryRow[] = inventoryData.map((item: any) => ({
        product_code: item.PROD_CD || item.productCode || '',
        product_name: item.PROD_DES || item.productName || '',
        balance_qty: Number(item.BAL_QTY || item.balanceQty || 0),
        warehouse_code: item.WH_CD || item.warehouseCode || 'DEFAULT',
      }));

      records.inventory = await supabaseAdapter.upsertInventory(inventoryRows);
      console.log(`[SyncService] inventory: ${records.inventory}건 저장`);

      const totalRecords = Object.values(records).reduce((a, b) => a + b, 0);

      await supabaseAdapter.updateSyncLog(logId, {
        status: 'success',
        records_synced: totalRecords,
        completed_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      console.log(`[SyncService] ECOUNT 동기화 완료: ${totalRecords}건 (${duration}ms)`);

      return { source: 'ecount', success: true, records, duration };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[SyncService] ECOUNT 동기화 실패:', error.message);

      if (logId) {
        await supabaseAdapter.updateSyncLog(logId, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        }).catch(() => {});
      }

      return { source: 'ecount', success: false, records, error: error.message, duration };
    }
  }

  /**
   * 증분 동기화: 마지막 성공 동기화 이후 데이터만 가져오기
   * full=true 시 전체 동기화 수행
   */
  async syncIncremental(full = false): Promise<SyncResult> {
    if (full) {
      return this.syncFromGoogleSheets();
    }

    const lastSyncTime = await supabaseAdapter.getLastSyncTime('google_sheets');
    if (!lastSyncTime) {
      console.log('[SyncService] 이전 동기화 이력 없음 → 전체 동기화 수행');
      return this.syncFromGoogleSheets();
    }

    const minutesSince = Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60));
    console.log(`[SyncService] 증분 동기화: 마지막 동기화 ${minutesSince}분 전 (${lastSyncTime})`);

    // 마지막 동기화 이후 충분한 시간이 지났으면 전체 동기화
    // (Google Sheets는 변경 추적이 어려우므로, 시간 기반으로 판단)
    if (minutesSince > 60) {
      console.log('[SyncService] 60분 이상 경과 → 전체 동기화 수행');
      return this.syncFromGoogleSheets();
    }

    // 60분 이내면 전체 동기화 스킵 (데이터 변경 적을 가능성)
    console.log('[SyncService] 최근 동기화 완료됨 → 증분 동기화 스킵');
    return {
      source: 'google_sheets',
      success: true,
      records: {},
      duration: 0,
    };
  }

  /**
   * 최근 동기화 상태 조회
   */
  async getLastSyncStatus(): Promise<SyncLogRow[]> {
    return supabaseAdapter.getRecentSyncLogs(10);
  }

  /**
   * 마지막 동기화 후 경과 시간 확인 (분 단위)
   */
  async getMinutesSinceLastSync(source: string): Promise<number | null> {
    const lastSync = await supabaseAdapter.getLastSyncTime(source);
    if (!lastSync) return null;

    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    return Math.floor((now - lastSyncTime) / (1000 * 60));
  }
}

export const syncService = new SyncService();
