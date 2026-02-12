/**
 * Supabase Adapter
 * Supabase(PostgreSQL) 데이터베이스 CRUD 작업 처리
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================
// 데이터 타입 정의
// ==============================

export interface DailySalesRow {
  id?: string;
  date: string;
  jasa_price: number;
  coupang_price: number;
  kurly_price: number;
  total_revenue: number;
  frozen_soup: number;
  etc: number;
  bibimbap: number;
  jasa_half: number;
  coupang_half: number;
  kurly_half: number;
  frozen_half: number;
  etc_half: number;
  production_qty: number;
  production_revenue: number;
  synced_at?: string;
}

export interface SalesDetailRow {
  id?: string;
  product_code: string;
  product_name: string;
  date: string;
  customer: string;
  quantity: number;
  supply_amount: number;
  vat: number;
  total: number;
  recommended_revenue: number;
  synced_at?: string;
}

export interface ProductionDailyRow {
  id?: string;
  date: string;
  prod_qty_normal: number;
  prod_qty_preprocess: number;
  prod_qty_frozen: number;
  prod_qty_sauce: number;
  prod_qty_bibimbap: number;
  prod_qty_total: number;
  prod_kg_normal: number;
  prod_kg_preprocess: number;
  prod_kg_frozen: number;
  prod_kg_sauce: number;
  prod_kg_total: number;
  waste_finished_ea: number;
  waste_finished_pct: number;
  waste_semi_kg: number;
  waste_semi_pct: number;
  synced_at?: string;
}

export interface PurchaseRow {
  id?: string;
  date: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  vat: number;
  total: number;
  supplier_name: string;
  synced_at?: string;
}

export interface InventoryRow {
  id?: string;
  product_code: string;
  product_name: string;
  balance_qty: number;
  warehouse_code: string;
  snapshot_date?: string;
  synced_at?: string;
}

export interface UtilityRow {
  id?: string;
  date: string;
  elec_prev: number;
  elec_curr: number;
  elec_usage: number;
  elec_cost: number;
  water_prev: number;
  water_curr: number;
  water_usage: number;
  water_cost: number;
  gas_prev: number;
  gas_curr: number;
  gas_usage: number;
  gas_cost: number;
  synced_at?: string;
}

export interface SyncLogRow {
  id?: string;
  source: 'google_sheets' | 'ecount';
  status: 'success' | 'failed' | 'in_progress';
  records_synced: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  content_hash?: string;           // 테이블별 해시 JSON (증분 동기화용)
  tables_updated?: string;         // 실제 업데이트된 테이블 목록
}

export interface LaborDailyRow {
  id?: string;
  date: string;
  department: string;
  week?: string;
  headcount: number;
  weekday_regular_hours: number;
  weekday_overtime_hours: number;
  weekday_night_hours: number;
  weekday_total_hours: number;
  holiday_regular_hours: number;
  holiday_overtime_hours: number;
  holiday_night_hours: number;
  holiday_total_hours: number;
  weekday_regular_pay: number;
  weekday_overtime_pay: number;
  weekday_night_pay: number;
  holiday_regular_pay: number;
  holiday_overtime_pay: number;
  holiday_night_pay: number;
  total_pay: number;
  synced_at?: string;
}

export interface BomRow {
  id?: string;
  source: string;
  product_code: string;
  product_name: string;
  bom_version: string;
  is_existing_bom: boolean;
  production_qty: number;
  material_code: string;
  material_name: string;
  material_bom_version: string;
  consumption_qty: number;
  location: string;
  remark: string;
  additional_qty: number;
  synced_at?: string;
}

export interface MaterialMasterRow {
  id?: string;
  no: number;
  category: string;
  issue_type: string;
  material_code: string;
  material_name: string;
  preprocess_yield: number;
  spec: string;
  unit: string;
  unit_price: number;
  safety_stock: number;
  excess_stock: number;
  lead_time_days: number;
  recent_output_qty: number;
  daily_avg: number;
  note: string;
  in_use: boolean;
  synced_at?: string;
}

// ==============================
// Supabase Adapter
// ==============================

export class SupabaseAdapter {
  private client: SupabaseClient | null = null;

  // dotenv가 먼저 실행된 후 읽히도록 lazy 접근
  private get url(): string {
    return process.env.SUPABASE_URL || '';
  }

  private get key(): string {
    return process.env.SUPABASE_KEY || '';
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.url || !this.key) {
        throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
      }
      this.client = createClient(this.url, this.key);
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!(this.url && this.key);
  }

  /**
   * Supabase PostgREST max-rows (기본 1000행) 제한을 우회하는 페이지네이션 헬퍼.
   * .range()를 사용해 1000행씩 가져와서 전체 데이터를 합친다.
   */
  private async fetchAllPaginated<T>(
    table: string,
    options?: {
      orderBy?: string;
      ascending?: boolean;
      dateFrom?: string;
      dateTo?: string;
      dateColumn?: string;
    }
  ): Promise<T[]> {
    const client = this.getClient();
    const pageSize = 1000;
    const allData: T[] = [];
    let from = 0;

    while (true) {
      let query = client
        .from(table)
        .select('*')
        .order(options?.orderBy || 'date', { ascending: options?.ascending ?? false })
        .range(from, from + pageSize - 1);

      if (options?.dateFrom) query = query.gte(options.dateColumn || 'date', options.dateFrom);
      if (options?.dateTo) query = query.lte(options.dateColumn || 'date', options.dateTo);

      const { data, error } = await query;
      if (error) throw new Error(`${table} query failed: ${error.message}`);
      if (!data || data.length === 0) break;

      allData.push(...(data as T[]));
      if (data.length < pageSize) break; // 마지막 페이지
      from += pageSize;
    }

    return allData;
  }

  // ==============================
  // Daily Sales
  // ==============================

  async upsertDailySales(rows: DailySalesRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { data, error } = await client
      .from('daily_sales')
      .upsert(
        rows.map(r => ({ ...r, synced_at: new Date().toISOString() })),
        { onConflict: 'date' }
      );

    if (error) throw new Error(`daily_sales upsert failed: ${error.message}`);
    return rows.length;
  }

  async getDailySales(dateFrom?: string, dateTo?: string): Promise<DailySalesRow[]> {
    return this.fetchAllPaginated<DailySalesRow>('daily_sales', { dateFrom, dateTo });
  }

  // ==============================
  // Sales Detail
  // ==============================

  async upsertSalesDetail(rows: SalesDetailRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    // sales_detail has no natural unique key, so delete-then-insert
    // Delete existing records for the date range in this batch
    const dates = [...new Set(rows.map(r => r.date).filter(Boolean))];
    if (dates.length > 0) {
      await client.from('sales_detail').delete().in('date', dates);
    }

    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => ({
        ...r,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await client.from('sales_detail').insert(batch);
      if (error) throw new Error(`sales_detail insert failed: ${error.message}`);
    }

    return rows.length;
  }

  async getSalesDetail(dateFrom?: string, dateTo?: string): Promise<SalesDetailRow[]> {
    return this.fetchAllPaginated<SalesDetailRow>('sales_detail', { dateFrom, dateTo });
  }

  // ==============================
  // Production Daily
  // ==============================

  async upsertProductionDaily(rows: ProductionDailyRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { error } = await client
      .from('production_daily')
      .upsert(
        rows.map(r => ({ ...r, synced_at: new Date().toISOString() })),
        { onConflict: 'date' }
      );

    if (error) throw new Error(`production_daily upsert failed: ${error.message}`);
    return rows.length;
  }

  async getProductionDaily(dateFrom?: string, dateTo?: string): Promise<ProductionDailyRow[]> {
    return this.fetchAllPaginated<ProductionDailyRow>('production_daily', { dateFrom, dateTo });
  }

  // ==============================
  // Purchases
  // ==============================

  async upsertPurchases(rows: PurchaseRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    // Delete existing records for the date range
    const dates = [...new Set(rows.map(r => r.date).filter(Boolean))];
    if (dates.length > 0) {
      await client.from('purchases').delete().in('date', dates);
    }

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => ({
        ...r,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await client.from('purchases').insert(batch);
      if (error) throw new Error(`purchases insert failed: ${error.message}`);
    }

    return rows.length;
  }

  async getPurchases(dateFrom?: string, dateTo?: string): Promise<PurchaseRow[]> {
    return this.fetchAllPaginated<PurchaseRow>('purchases', { dateFrom, dateTo });
  }

  // ==============================
  // Inventory
  // ==============================

  async upsertInventory(rows: InventoryRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { error } = await client
      .from('inventory')
      .upsert(
        rows.map(r => ({
          ...r,
          snapshot_date: r.snapshot_date || new Date().toISOString().slice(0, 10),
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'product_code,warehouse_code' }
      );

    if (error) throw new Error(`inventory upsert failed: ${error.message}`);
    return rows.length;
  }

  async getInventory(): Promise<InventoryRow[]> {
    return this.fetchAllPaginated<InventoryRow>('inventory', {
      orderBy: 'product_name',
      ascending: true,
    });
  }

  // ==============================
  // Utilities
  // ==============================

  async upsertUtilities(rows: UtilityRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { error } = await client
      .from('utilities')
      .upsert(
        rows.map(r => ({ ...r, synced_at: new Date().toISOString() })),
        { onConflict: 'date' }
      );

    if (error) throw new Error(`utilities upsert failed: ${error.message}`);
    return rows.length;
  }

  async getUtilities(dateFrom?: string, dateTo?: string): Promise<UtilityRow[]> {
    return this.fetchAllPaginated<UtilityRow>('utilities', { dateFrom, dateTo });
  }

  // ==============================
  // Sync Log
  // ==============================

  async createSyncLog(log: Omit<SyncLogRow, 'id'>): Promise<string> {
    const client = this.getClient();

    const { data, error } = await client
      .from('sync_log')
      .insert(log)
      .select('id')
      .single();

    if (error) throw new Error(`sync_log insert failed: ${error.message}`);
    return data.id;
  }

  async updateSyncLog(
    id: string,
    updates: Partial<Pick<SyncLogRow, 'status' | 'records_synced' | 'error_message' | 'completed_at' | 'content_hash' | 'tables_updated'>>
  ): Promise<void> {
    const client = this.getClient();

    const { error } = await client.from('sync_log').update(updates).eq('id', id);
    if (error) throw new Error(`sync_log update failed: ${error.message}`);
  }

  async getRecentSyncLogs(limit: number = 10): Promise<SyncLogRow[]> {
    const client = this.getClient();

    const { data, error } = await client
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`sync_log query failed: ${error.message}`);
    return data || [];
  }

  async getLastSyncTime(source: string): Promise<string | null> {
    const client = this.getClient();

    const { data, error } = await client
      .from('sync_log')
      .select('completed_at')
      .eq('source', source)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.completed_at;
  }

  /** 마지막 성공 동기화의 content_hash 조회 */
  async getLastContentHash(source: string): Promise<Record<string, string> | null> {
    const client = this.getClient();

    const { data, error } = await client
      .from('sync_log')
      .select('content_hash')
      .eq('source', source)
      .eq('status', 'success')
      .not('content_hash', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.content_hash) return null;
    try {
      return JSON.parse(data.content_hash);
    } catch {
      return null;
    }
  }

  // ==============================
  // Labor Daily
  // ==============================

  async upsertLaborDaily(rows: LaborDailyRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { error } = await client
      .from('labor_daily')
      .upsert(
        rows.map(r => ({ ...r, synced_at: new Date().toISOString() })),
        { onConflict: 'date,department' }
      );

    if (error) throw new Error(`labor_daily upsert failed: ${error.message}`);
    return rows.length;
  }

  async getLaborDaily(dateFrom?: string, dateTo?: string): Promise<LaborDailyRow[]> {
    return this.fetchAllPaginated<LaborDailyRow>('labor_daily', { dateFrom, dateTo });
  }

  // ==============================
  // BOM
  // ==============================

  async upsertBom(rows: BomRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    // BOM 데이터가 많을 수 있으므로 배치 처리
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => ({
        ...r,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await client
        .from('bom')
        .upsert(batch, { onConflict: 'source,product_code,material_code' });

      if (error) throw new Error(`bom upsert failed: ${error.message}`);
    }

    return rows.length;
  }

  async getBom(source?: string): Promise<BomRow[]> {
    const client = this.getClient();
    const pageSize = 1000;
    const allData: BomRow[] = [];
    let from = 0;

    while (true) {
      let query = client
        .from('bom')
        .select('*')
        .order('product_code', { ascending: true })
        .range(from, from + pageSize - 1);

      if (source) query = query.eq('source', source);

      const { data, error } = await query;
      if (error) throw new Error(`bom query failed: ${error.message}`);
      if (!data || data.length === 0) break;

      allData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return allData;
  }

  // ==============================
  // Material Master
  // ==============================

  async upsertMaterialMaster(rows: MaterialMasterRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const client = this.getClient();

    const { error } = await client
      .from('material_master')
      .upsert(
        rows.map(r => ({ ...r, synced_at: new Date().toISOString() })),
        { onConflict: 'material_code' }
      );

    if (error) throw new Error(`material_master upsert failed: ${error.message}`);
    return rows.length;
  }

  async getMaterialMaster(): Promise<MaterialMasterRow[]> {
    return this.fetchAllPaginated<MaterialMasterRow>('material_master', {
      orderBy: 'no',
      ascending: true,
    });
  }

  // ==============================
  // Health Check
  // ==============================

  /**
   * 배치 트랜잭션: 여러 테이블에 동시 저장
   * Supabase RPC를 사용할 수 없는 경우, 순서 보장 + 에러 롤백 로깅
   */
  /**
   * 배치 upsert: 여러 테이블을 순서대로 저장
   * @param stopOnError true면 첫 번째 에러에서 중단 + 이미 저장된 데이터 롤백 시도
   */
  async batchUpsert(operations: {
    dailySales?: DailySalesRow[];
    salesDetail?: SalesDetailRow[];
    production?: ProductionDailyRow[];
    purchases?: PurchaseRow[];
    utilities?: UtilityRow[];
    inventory?: InventoryRow[];
  }, stopOnError = false): Promise<{ success: boolean; records: Record<string, number>; errors: string[] }> {
    const records: Record<string, number> = {};
    const errors: string[] = [];
    const batchTimestamp = new Date().toISOString();
    const completedTables: string[] = [];

    const tableOps = [
      { key: 'dailySales', data: operations.dailySales, fn: () => this.upsertDailySales(operations.dailySales!), table: 'daily_sales' },
      { key: 'salesDetail', data: operations.salesDetail, fn: () => this.upsertSalesDetail(operations.salesDetail!), table: 'sales_detail' },
      { key: 'production', data: operations.production, fn: () => this.upsertProductionDaily(operations.production!), table: 'production_daily' },
      { key: 'purchases', data: operations.purchases, fn: () => this.upsertPurchases(operations.purchases!), table: 'purchases' },
      { key: 'utilities', data: operations.utilities, fn: () => this.upsertUtilities(operations.utilities!), table: 'utilities' },
      { key: 'inventory', data: operations.inventory, fn: () => this.upsertInventory(operations.inventory!), table: 'inventory' },
    ];

    for (const op of tableOps) {
      if (!op.data?.length) continue;

      try {
        records[op.key] = await op.fn();
        completedTables.push(op.table);
      } catch (e: any) {
        errors.push(`${op.key}: ${e.message}`);
        if (stopOnError) {
          // 롤백: 이미 저장된 테이블에서 batchTimestamp 이후 데이터 제거
          console.error(`[SupabaseAdapter] batchUpsert 중단 at ${op.key}, 롤백 시도...`);
          await this.rollbackAfterTimestamp(completedTables, batchTimestamp);
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      records,
      errors,
    };
  }

  /** synced_at >= timestamp 인 행을 삭제하여 롤백 */
  private async rollbackAfterTimestamp(tables: string[], timestamp: string): Promise<void> {
    const client = this.getClient();
    for (const table of tables) {
      try {
        await client.from(table).delete().gte('synced_at', timestamp);
        console.log(`[SupabaseAdapter] 롤백 완료: ${table}`);
      } catch (e: any) {
        console.error(`[SupabaseAdapter] 롤백 실패: ${table} - ${e.message}`);
      }
    }
  }

  // ==============================
  // 에이전트 상태 영구 저장
  // ==============================

  async saveAgentState(agentId: string, state: Record<string, any>): Promise<void> {
    const client = this.getClient();
    const { error } = await client
      .from('agent_state')
      .upsert({
        agent_id: agentId,
        state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });

    if (error) {
      console.error(`[SupabaseAdapter] 에이전트 상태 저장 실패 (${agentId}):`, error.message);
    }
  }

  async loadAgentState(agentId: string): Promise<Record<string, any> | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('agent_state')
      .select('state')
      .eq('agent_id', agentId)
      .single();

    if (error || !data) return null;
    return data.state;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getClient();
      const { error } = await client.from('sync_log').select('id').limit(1);

      if (error) {
        return { success: false, message: `연결 실패: ${error.message}` };
      }

      return { success: true, message: 'Supabase 연결 성공' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

export const supabaseAdapter = new SupabaseAdapter();
