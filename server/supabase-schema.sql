-- Z-CMS Supabase 스키마
-- Supabase SQL Editor에서 실행하세요

-- 1. 일별 채널 매출
CREATE TABLE IF NOT EXISTS daily_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  jasa_price numeric DEFAULT 0,
  coupang_price numeric DEFAULT 0,
  kurly_price numeric DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  frozen_soup numeric DEFAULT 0,
  etc numeric DEFAULT 0,
  bibimbap numeric DEFAULT 0,
  jasa_half numeric DEFAULT 0,
  coupang_half numeric DEFAULT 0,
  kurly_half numeric DEFAULT 0,
  frozen_half numeric DEFAULT 0,
  etc_half numeric DEFAULT 0,
  production_qty numeric DEFAULT 0,
  production_revenue numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);

-- 2. 판매 상세
CREATE TABLE IF NOT EXISTS sales_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code varchar(50),
  product_name varchar(200),
  date date,
  customer varchar(200),
  product_desc varchar(200),
  spec varchar(200),
  quantity numeric DEFAULT 0,
  supply_amount numeric DEFAULT 0,
  vat numeric DEFAULT 0,
  total numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_detail_date ON sales_detail(date);

-- 3. 생산/폐기
CREATE TABLE IF NOT EXISTS production_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  prod_qty_normal numeric DEFAULT 0,
  prod_qty_preprocess numeric DEFAULT 0,
  prod_qty_frozen numeric DEFAULT 0,
  prod_qty_sauce numeric DEFAULT 0,
  prod_qty_bibimbap numeric DEFAULT 0,
  prod_qty_total numeric DEFAULT 0,
  prod_kg_normal numeric DEFAULT 0,
  prod_kg_preprocess numeric DEFAULT 0,
  prod_kg_frozen numeric DEFAULT 0,
  prod_kg_sauce numeric DEFAULT 0,
  prod_kg_total numeric DEFAULT 0,
  waste_finished_ea numeric DEFAULT 0,
  waste_finished_pct numeric DEFAULT 0,
  waste_semi_kg numeric DEFAULT 0,
  waste_semi_pct numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);

-- 4. 구매/원자재
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date,
  product_code varchar(50),
  product_name varchar(200),
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  supply_amount numeric DEFAULT 0,
  vat numeric DEFAULT 0,
  total numeric DEFAULT 0,
  inbound_price numeric DEFAULT 0,
  inbound_total numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);

-- 5. 재고 현황
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code varchar(50) NOT NULL,
  product_name varchar(200),
  balance_qty numeric DEFAULT 0,
  warehouse_code varchar(50) NOT NULL DEFAULT 'DEFAULT',
  snapshot_date date DEFAULT CURRENT_DATE,
  synced_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_product_wh ON inventory(product_code, warehouse_code);

-- 6. 유틸리티 사용량
CREATE TABLE IF NOT EXISTS utilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  elec_prev numeric DEFAULT 0,
  elec_curr numeric DEFAULT 0,
  elec_usage numeric DEFAULT 0,
  elec_cost numeric DEFAULT 0,
  water_prev numeric DEFAULT 0,
  water_curr numeric DEFAULT 0,
  water_usage numeric DEFAULT 0,
  water_cost numeric DEFAULT 0,
  gas_prev numeric DEFAULT 0,
  gas_curr numeric DEFAULT 0,
  gas_usage numeric DEFAULT 0,
  gas_cost numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);

-- 7. 동기화 로그
CREATE TABLE IF NOT EXISTS sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(20) NOT NULL,
  status varchar(20) NOT NULL,
  records_synced integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sync_log_source ON sync_log(source, started_at DESC);

-- 8. 채널 비용
CREATE TABLE IF NOT EXISTS channel_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name varchar(100) NOT NULL UNIQUE,
  variable_rate_pct numeric DEFAULT 0,     -- 매출대비 변동비 %
  variable_per_order numeric DEFAULT 0,    -- 건당 변동비 원
  fixed_monthly numeric DEFAULT 0,         -- 월 고정비 원
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_costs_name ON channel_costs(channel_name);

-- 9. 에이전트 상태 저장
CREATE TABLE IF NOT EXISTS agent_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id varchar(100) NOT NULL UNIQUE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_state_agent ON agent_state(agent_id);
