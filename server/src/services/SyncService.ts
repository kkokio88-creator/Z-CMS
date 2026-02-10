/**
 * Sync Service
 * Google Sheets / ECOUNT → Supabase 동기화
 * P2-4: 해시 기반 증분 동기화 — 변경된 테이블만 쓰기
 */

import { createHash } from 'crypto';
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
  type LaborDailyRow,
  type BomRow,
  type MaterialMasterRow,
} from '../adapters/SupabaseAdapter.js';

export interface SyncResult {
  source: string;
  success: boolean;
  records: Record<string, number>;
  error?: string;
  duration: number;
  skippedTables?: string[];  // 변경 없어서 스킵된 테이블
}

/** 데이터 배열의 콘텐츠 해시 계산 (MD5, 충분히 빠름) */
function computeHash(data: any[]): string {
  if (data.length === 0) return 'empty';
  const content = JSON.stringify(data);
  return createHash('md5').update(content).digest('hex');
}

export class SyncService {
  /**
   * Google Sheets → Supabase 동기화
   * incremental=true 시 해시 비교로 변경된 테이블만 저장
   */
  async syncFromGoogleSheets(incremental = false): Promise<SyncResult> {
    const startTime = Date.now();
    const records: Record<string, number> = {};
    const skippedTables: string[] = [];
    let logId: string | undefined;

    try {
      logId = await supabaseAdapter.createSyncLog({
        source: 'google_sheets',
        status: 'in_progress',
        records_synced: 0,
        started_at: new Date().toISOString(),
      });

      console.log(`[SyncService] Google Sheets 동기화 시작... (${incremental ? '증분' : '전체'})`);

      // Google Sheets에서 데이터 가져오기
      const sheetData = await googleSheetAdapter.syncAllData();

      // 데이터를 Supabase Row 형식으로 변환
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

      // 노무비 변환
      const laborDailyRows: LaborDailyRow[] = sheetData.labor.map(d => ({
        date: d.date,
        department: d.department,
        week: d.week,
        headcount: d.headcount,
        weekday_regular_hours: d.weekdayRegularHours,
        weekday_overtime_hours: d.weekdayOvertimeHours,
        weekday_night_hours: d.weekdayNightHours,
        weekday_total_hours: d.weekdayTotalHours,
        holiday_regular_hours: d.holidayRegularHours,
        holiday_overtime_hours: d.holidayOvertimeHours,
        holiday_night_hours: d.holidayNightHours,
        holiday_total_hours: d.holidayTotalHours,
        weekday_regular_pay: d.weekdayRegularPay,
        weekday_overtime_pay: d.weekdayOvertimePay,
        weekday_night_pay: d.weekdayNightPay,
        holiday_regular_pay: d.holidayRegularPay,
        holiday_overtime_pay: d.holidayOvertimePay,
        holiday_night_pay: d.holidayNightPay,
        total_pay: d.totalPay,
      }));

      // BOM 변환 (SAN + ZIP 통합)
      const bomRows: BomRow[] = [...sheetData.sanBom, ...sheetData.zipBom].map(d => ({
        source: d.source,
        product_code: d.productCode,
        product_name: d.productName,
        bom_version: d.bomVersion,
        is_existing_bom: d.isExistingBom,
        production_qty: d.productionQty,
        material_code: d.materialCode,
        material_name: d.materialName,
        material_bom_version: d.materialBomVersion,
        consumption_qty: d.consumptionQty,
        location: d.location,
        remark: d.remark,
        additional_qty: d.additionalQty,
      }));

      // 자재 마스터 변환
      const materialMasterRows: MaterialMasterRow[] = sheetData.materialMaster.map(d => ({
        no: d.no,
        category: d.category,
        issue_type: d.issueType,
        material_code: d.materialCode,
        material_name: d.materialName,
        preprocess_yield: d.preprocessYield,
        spec: d.spec,
        unit: d.unit,
        unit_price: d.unitPrice,
        safety_stock: d.safetyStock,
        excess_stock: d.excessStock,
        lead_time_days: d.leadTimeDays,
        recent_output_qty: d.recentOutputQty,
        daily_avg: d.dailyAvg,
        note: d.note,
        in_use: d.inUse,
      }));

      // 테이블별 콘텐츠 해시 계산
      const currentHashes: Record<string, string> = {
        dailySales: computeHash(dailySalesRows),
        salesDetail: computeHash(salesDetailRows),
        production: computeHash(productionRows),
        purchases: computeHash(purchaseRows),
        utilities: computeHash(utilityRows),
        labor: computeHash(laborDailyRows),
        bom: computeHash(bomRows),
        materialMaster: computeHash(materialMasterRows),
      };

      // 증분 모드: 이전 해시와 비교하여 변경된 테이블만 식별
      let prevHashes: Record<string, string> | null = null;
      if (incremental) {
        prevHashes = await supabaseAdapter.getLastContentHash('google_sheets');
        if (prevHashes) {
          console.log('[SyncService] 이전 동기화 해시 발견, 변경 감지 시작...');
        }
      }

      // 각 테이블별 저장 (해시 변경 시에만)
      const tables = [
        { key: 'dailySales', rows: dailySalesRows, upsert: () => supabaseAdapter.upsertDailySales(dailySalesRows), label: 'daily_sales' },
        { key: 'salesDetail', rows: salesDetailRows, upsert: () => supabaseAdapter.upsertSalesDetail(salesDetailRows), label: 'sales_detail' },
        { key: 'production', rows: productionRows, upsert: () => supabaseAdapter.upsertProductionDaily(productionRows), label: 'production_daily' },
        { key: 'purchases', rows: purchaseRows, upsert: () => supabaseAdapter.upsertPurchases(purchaseRows), label: 'purchases' },
        { key: 'utilities', rows: utilityRows, upsert: () => supabaseAdapter.upsertUtilities(utilityRows), label: 'utilities' },
        { key: 'labor', rows: laborDailyRows, upsert: () => supabaseAdapter.upsertLaborDaily(laborDailyRows), label: 'labor_daily' },
        { key: 'bom', rows: bomRows, upsert: () => supabaseAdapter.upsertBom(bomRows), label: 'bom' },
        { key: 'materialMaster', rows: materialMasterRows, upsert: () => supabaseAdapter.upsertMaterialMaster(materialMasterRows), label: 'material_master' },
      ];

      for (const table of tables) {
        const hashChanged = !prevHashes || prevHashes[table.key] !== currentHashes[table.key];

        if (incremental && !hashChanged) {
          skippedTables.push(table.label);
          console.log(`[SyncService] ${table.label}: 변경 없음 → 스킵`);
          continue;
        }

        records[table.key] = await table.upsert();
        console.log(`[SyncService] ${table.label}: ${records[table.key]}건 저장${hashChanged && prevHashes ? ' (변경 감지)' : ''}`);
      }

      const totalRecords = Object.values(records).reduce((a, b) => a + b, 0);
      const tablesUpdated = Object.keys(records).filter(k => records[k] > 0);

      await supabaseAdapter.updateSyncLog(logId, {
        status: 'success',
        records_synced: totalRecords,
        completed_at: new Date().toISOString(),
        content_hash: JSON.stringify(currentHashes),
        tables_updated: tablesUpdated.join(','),
      });

      const duration = Date.now() - startTime;
      const skipMsg = skippedTables.length > 0 ? ` (스킵: ${skippedTables.join(', ')})` : '';
      console.log(`[SyncService] Google Sheets 동기화 완료: ${totalRecords}건 (${duration}ms)${skipMsg}`);

      return { source: 'google_sheets', success: true, records, duration, skippedTables };
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
   * 증분 동기화: 해시 비교로 변경된 테이블만 저장
   * full=true 시 전체 동기화 수행 (해시 비교 없이)
   */
  async syncIncremental(full = false): Promise<SyncResult> {
    if (full) {
      return this.syncFromGoogleSheets(false); // 전체 모드
    }

    const lastSyncTime = await supabaseAdapter.getLastSyncTime('google_sheets');
    if (!lastSyncTime) {
      console.log('[SyncService] 이전 동기화 이력 없음 → 전체 동기화 수행');
      return this.syncFromGoogleSheets(false);
    }

    const minutesSince = Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60));
    console.log(`[SyncService] 증분 동기화: 마지막 동기화 ${minutesSince}분 전 (${lastSyncTime})`);

    if (minutesSince < 5) {
      // 5분 이내면 완전 스킵 (너무 자주 호출 방지)
      console.log('[SyncService] 5분 이내 → 동기화 스킵');
      return { source: 'google_sheets', success: true, records: {}, duration: 0 };
    }

    // 5분 이상 경과 → 해시 기반 증분 동기화 (변경분만 저장)
    console.log('[SyncService] 해시 기반 증분 동기화 수행...');
    return this.syncFromGoogleSheets(true); // 증분 모드
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
