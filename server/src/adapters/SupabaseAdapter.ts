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
  product_desc: string;
  spec: string;
  quantity: number;
  supply_amount: number;
  vat: number;
  total: number;
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
  inbound_price: number;
  inbound_total: number;
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
    const client = this.getClient();
    let query = client.from('daily_sales').select('*').order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;
    if (error) throw new Error(`daily_sales query failed: ${error.message}`);
    return data || [];
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
    const client = this.getClient();
    let query = client.from('sales_detail').select('*').order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;
    if (error) throw new Error(`sales_detail query failed: ${error.message}`);
    return data || [];
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
    const client = this.getClient();
    let query = client.from('production_daily').select('*').order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;
    if (error) throw new Error(`production_daily query failed: ${error.message}`);
    return data || [];
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
    const client = this.getClient();
    let query = client.from('purchases').select('*').order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;
    if (error) throw new Error(`purchases query failed: ${error.message}`);
    return data || [];
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
    const client = this.getClient();

    const { data, error } = await client
      .from('inventory')
      .select('*')
      .order('product_name', { ascending: true });

    if (error) throw new Error(`inventory query failed: ${error.message}`);
    return data || [];
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
    const client = this.getClient();
    let query = client.from('utilities').select('*').order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;
    if (error) throw new Error(`utilities query failed: ${error.message}`);
    return data || [];
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
    updates: Partial<Pick<SyncLogRow, 'status' | 'records_synced' | 'error_message' | 'completed_at'>>
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

  // ==============================
  // Health Check
  // ==============================

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
