export interface WasteTrendData {
  day: string;
  avg: number;
  actual: number;
}

export interface TopWasteItem {
  id: string;
  name: string;
  subText?: string; 
  amount: number;
  variancePercent: number;
  percentageOfTotal?: number;
  isAnomaly: boolean;
  colorClass: string; 
}

export interface BomDiffItem {
  id: string;
  skuCode: string; 
  skuName: string;
  skuSub: string;
  process: string;
  stdQty: number;
  stdUnit: string;
  actualQty: number;
  diffPercent: number;
  anomalyScore: number;
  costImpact: number;
  reasoning?: string; // AI Analysis text
  // New field for UI state
  status?: 'pending' | 'resolved' | 'updated'; 
}

export interface AnomalyInsight {
  id: string;
  title: string;
  description: string;
  highlight: string;
  level: 'info' | 'warning' | 'critical';
}

// --- Profit Dashboard ---
export interface ChannelProfitData {
  date: string;
  revenue: number;
  profit: number;
  marginRate: number;
}

export interface KPICardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: string;
}

// --- Monthly Profit Ranking ---
export interface ProfitRankItem {
  id: string;
  rank: number;
  skuName: string;
  channel: string;
  profit: number;
  margin: number;
}

// --- Inventory Dashboard ---
export interface InventorySafetyItem {
  id: string;
  skuName: string;
  currentStock: number;
  safetyStock: number;
  status: 'Normal' | 'Overstock' | 'Shortage';
  turnoverRate: number;
  // NEW FIELDS
  warehouse: string;
  category: string;
}

// NEW: Turnover Trend
export interface TurnoverTrendData {
    month: string;
    rate: number;
    target: number;
}

// --- Stocktake Anomaly Dashboard ---
export interface StocktakeAnomalyItem {
  id: string;
  materialName: string;
  location: string;
  systemQty: number; // 전산 재고
  countedQty: number; // 실사 재고
  aiExpectedQty: number; // AI 예측 재고
  anomalyScore: number;
  reason: string;
  // UI state for actions
  actionStatus?: 'none' | 'adjusted' | 'recount_requested';
}

// --- Drill-down Data Types ---
export interface CostStructure {
  name: string;
  value: number;
  color: string;
}

export interface InventoryHistory {
  date: string;
  stock: number;
  safety: number;
}

export interface StocktakeHistory {
  date: string;
  system: number;
  counted: number;
  diff: number;
}

// --- Notification Type (Enhanced) ---
export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
  // Smart Navigation targets
  targetView?: 'home' | 'profit' | 'waste' | 'inventory' | 'stocktake' | 'monthly' | 'settings' | 'order';
  targetItemId?: string; 
}

// --- Channel Mix Data ---
export interface ChannelMix {
    name: string;
    value: number; // Sales volume or percentage
    margin: number; // Margin rate for this channel
}

// NEW: Waste Reason Data
export interface WasteReasonData {
    name: string;
    value: number;
    color: string;
}

// --- NEW: BOM History Log ---
export interface BomHistoryItem {
  id: string;
  date: string;
  skuName: string;
  actionType: 'Update' | 'Fix' | 'Ignore';
  description: string;
  actor: 'AI Agent' | 'Manager';
  oldValue?: string;
  newValue?: string;
}

// --- NEW: Dashboard Summary Data ---
export interface DashboardSummary {
    totalRevenue: number;
    revenueChange: number;
    avgMargin: number;
    marginChange: number;
    wasteRate: number;
    wasteRateChange: number;
    riskItems: number;
    anomalyCount: number;
}

// --- NEW: Order Management Types ---
export type OrderMethod = 'Email' | 'Kakao' | 'SMS' | 'Fax';

export interface Supplier {
    id: string;
    name: string;
    method: OrderMethod;
    contact: string; // Email address or Phone number
    managerName: string;
}

export interface OrderSuggestion {
    id: string;
    skuCode: string;
    skuName: string;
    supplierId: string;
    supplierName: string;
    currentStock: number;
    safetyStock: number;
    avgDailyConsumption: number; // 일 평균 소모량
    leadTime: number; // 조달 리드타임 (일)
    suggestedQty: number; // 통계적 추천 수량
    orderQty: number; // 실제 발주 수량 (User Editable)
    unit: string;
    unitPrice: number;
    status: 'Ready' | 'Sent';
    method: OrderMethod; // Denormalized for easier UI
}

// --- ECOUNT ERP RAW DATA TYPES ---

// 1. 공통 응답 구조
export interface EcountResponse<T> {
    Status: string; // "200" is success
    Error: any;
    Data: {
        Result: T[];
        TotalCount?: number;
    }
}

// 2. 판매 (Sale) - 매출 분석용
export interface EcountSaleRaw {
    IO_DATE: string; // 날짜 (YYYYMMDD)
    PROD_CD: string; // 품목코드
    PROD_DES: string; // 품목명
    QTY: string; // 수량
    PRICE: string; // 단가
    SUPPLY_AMT: string; // 공급가액 (매출)
    CUST_DES: string; // 거래처명 (채널 구분용)
    WH_CD: string; // 출하창고
}

// 3. 재고 (Inventory) - 재고 분석용
export interface EcountInventoryRaw {
    PROD_CD: string;
    PROD_DES: string;
    BAL_QTY: string; // 재고수량
    WH_CD: string; // 창고코드
}

// 4. 생산 (Production) - 폐기/BOM 분석용
export interface EcountProductionRaw {
    IO_DATE: string;
    PROD_CD: string; // 생산품
    QTY: string; // 생산량
    USE_PROD_CD: string; // 소모 자재 코드 (BOM 전개)
    USE_QTY: string; // 실제 소모량
}

// 5. BOM (Standard) - 표준 원가용
export interface EcountBomRaw {
    PROD_CD: string; // 모품목
    USE_PROD_CD: string; // 자품목
    USE_QTY: string; // 표준 소요량
}

// 6. 매입 (Purchase) - 비용 분석용 (New)
export interface EcountPurchaseRaw {
    IO_DATE: string;
    PROD_CD: string;
    PROD_DES: string;
    QTY: string;
    PRICE: string; // 매입 단가
    SUPPLY_AMT: string; // 매입 금액
    CUST_DES: string; // 공급처
}