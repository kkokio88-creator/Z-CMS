export interface WasteTrendData {
  day: string;
  avg: number;
  actual: number;
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

// --- Notification Type ---
export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
  targetView?: 'home' | 'profit' | 'cost' | 'production' | 'inventory' | 'settings';
  targetItemId?: string;
}

// --- Dashboard Summary Data ---
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
  };
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

// ========================================
// 원가 관리 대시보드 타입 정의
// ========================================

// --- 모듈 1: BOM 정합성 검토 (Audit & Integrity) ---

export type AnomalyLevel = 'normal' | 'warning' | 'critical';
export type ActionStatus = 'pending' | 'investigating' | 'resolved';

/** BOM Yield 분석 항목 */
export interface BomYieldAnalysisItem {
  id: string;
  productCode: string;
  productName: string;
  process: string;
  stdYield: number; // 표준 수율 (%)
  actualYield: number; // 실제 수율 (%)
  yieldGap: number; // 수율 차이 (%)
  transactionDate: string; // 전표 등록일
  anomalyLevel: AnomalyLevel;
  costImpact: number; // 원가 영향 (원)
  reasoning?: string; // AI 분석 의견
}

/** 재고 괴리 항목 */
export interface InventoryDiscrepancyItem {
  id: string;
  materialCode: string;
  materialName: string;
  warehouse: string;
  transactionQty: number; // 전표 상 수량
  physicalQty: number; // 실사 수량
  discrepancyQty: number; // 차이 수량
  discrepancyRate: number; // 괴리율 (%)
  discrepancyReason?: string;
  actionStatus: ActionStatus;
  lastCheckedDate: string;
}

// --- 모듈 2: 원재료 단가 변동 분석 (Cost Impact Analysis) ---

/** 단가 이력 포인트 */
export interface PricePoint {
  date: string;
  unitPrice: number;
  supplierName?: string;
}

/** 원재료 단가 이력 */
export interface MaterialPriceHistory {
  materialCode: string;
  materialName: string;
  category: string;
  unit: string;
  priceHistory: PricePoint[];
  currentPrice: number;
  previousWeekPrice: number;
  previousMonthPrice: number;
  priceChangeWeek: number; // 전주 대비 변동률 (%)
  priceChangeMonth: number; // 전월 대비 변동률 (%)
  avgPrice30Days: number; // 30일 평균 단가
}

/** 영향받는 제품 정보 */
export interface AffectedProduct {
  productCode: string;
  productName: string;
  bomQty: number; // BOM 소요량
  currentCost: number; // 현재 원가
  newCost: number; // 변경 후 예상 원가
  deltaCost: number; // 제품별 원가 상승분
  deltaPercent: number; // 원가 상승률 (%)
}

/** 원재료 원가 영향 분석 */
export interface MaterialCostImpact {
  materialCode: string;
  materialName: string;
  priceIncrease: number; // 단가 상승폭
  priceIncreasePercent: number; // 단가 상승률 (%)
  affectedProducts: AffectedProduct[];
  totalDeltaCost: number; // 총 원가 영향
  urgencyLevel: AnomalyLevel;
}

// --- 모듈 3: 채널별 수익률 분석 (Profitability by Channel) ---

/** COGS 분해 구조 */
export interface COGSBreakdown {
  rawMaterial: number; // 원재료비
  labor: number; // 노무비
  logistics: number; // 물류비
  commission: number; // 수수료
  packaging: number; // 포장비
  other: number; // 기타
}

/** 채널별 상세 수익성 */
export interface ChannelProfitabilityDetail {
  channelId: string;
  channelName: string;
  channelType: 'D2C' | 'Marketplace' | 'B2B' | 'Wholesale' | 'Other';
  revenue: number;
  cogs: COGSBreakdown;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number; // 매출총이익률 (%)
  contributionMargin: number; // 공헌이익률 (%)
  netProfit: number;
  netMargin: number; // 순이익률 (%)
  profitTrend: 'up' | 'down' | 'stable';
  trendPercent: number;
  orderCount: number;
  avgOrderValue: number;
}

// --- 모듈 4: 목표 대비 일일 달성률 (Performance Tracking) ---

export type PerformanceStatus = 'on-target' | 'below-target' | 'above-target';

/** 일일 성과 지표 */
export interface DailyPerformanceMetric {
  date: string;
  dayOfWeek: string;

  // 생산 지표
  productionQty: number;
  productionTarget: number;
  productionAchievement: number; // 생산 달성률 (%)

  // 노무비 지표
  targetLaborRatio: number; // 목표 노무비율 (%)
  actualLaborRatio: number; // 실제 노무비율 (%)
  laborCost: number; // 노무비 (원)
  laborVariance: number; // 노무비 차이 (%)
  laborStatus: PerformanceStatus;

  // 원재료비 지표
  targetMaterialRatio: number; // 목표 원재료비율 (%)
  actualMaterialRatio: number; // 실제 원재료비율 (%)
  materialCost: number; // 원재료비 (원)
  materialVariance: number; // 원재료비 차이 (%)
  materialStatus: PerformanceStatus;

  // 종합 효율
  efficiency: number; // 생산 효율 (%)
  overallStatus: PerformanceStatus;
}

/** 인력 배치 제안 */
export interface StaffingSuggestion {
  date: string;
  department: string;
  currentHeadcount: number;
  suggestedHeadcount: number;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

// --- 모듈 5: 경비 및 예산 관리 (Expense Control) ---

export type BudgetCategory = 'fixed' | 'variable';
export type BudgetStatus = 'normal' | 'warning' | 'critical';

/** 예산 항목 */
export interface BudgetItem {
  id: string;
  category: BudgetCategory;
  accountCode: string; // 계정과목 코드
  accountName: string; // 계정과목명
  vendorId?: string; // 업체 ID (해당시)
  vendorName?: string; // 업체명 (해당시)
  budgetAmount: number; // 배정 예산
  usedAmount: number; // 사용액
  remainingAmount: number; // 잔액
  burnRate: number; // 소진율 (%)
  dailyBurnRate: number; // 일 평균 소진액
  projectedTotal: number; // 월말 예상 사용액
  projectedOverrun: number; // 예상 초과액
  daysElapsed: number; // 경과일
  daysRemaining: number; // 월말까지 잔여일
  status: BudgetStatus;
  lastUpdated: string;
}

/** 경비 요약 */
export interface ExpenseSummary {
  period: string; // YYYY-MM
  totalBudget: number;
  totalUsed: number;
  totalRemaining: number;
  overallBurnRate: number; // 전체 소진율 (%)
  fixedCostBudget: number;
  fixedCostUsed: number;
  variableCostBudget: number;
  variableCostUsed: number;
  overrunRisk: boolean; // 초과 위험 여부
  projectedMonthEnd: number; // 월말 예상 총액
  healthScore: number; // 예산 건전성 점수 (0-100)
}

/** 예산 경고 알림 */
export interface BudgetAlert {
  id: string;
  budgetItemId: string;
  accountName: string;
  alertType: 'approaching' | 'exceeded' | 'irregular';
  message: string;
  severity: BudgetStatus;
  createdAt: string;
  acknowledged: boolean;
}

// --- 드릴다운 모달 공통 타입 ---

export type DrilldownType =
  | 'material-impact'
  | 'bom-yield'
  | 'channel-cogs'
  | 'budget-detail'
  | 'inventory-discrepancy';

export interface DrilldownData {
  type: DrilldownType;
  title: string;
  subtitle?: string;
  data: unknown;
}

// --- 원가 분석 API 응답 타입 ---

export interface CostAnalysisSyncResult {
  bomYield: BomYieldAnalysisItem[];
  inventoryDiscrepancy: InventoryDiscrepancyItem[];
  materialPriceHistory: MaterialPriceHistory[];
  materialImpacts: MaterialCostImpact[];
  channelProfitability: ChannelProfitabilityDetail[];
  dailyPerformance: DailyPerformanceMetric[];
  budgetItems: BudgetItem[];
  expenseSummary: ExpenseSummary;
  lastUpdated: string;
}

// ========================================
// 통계적 발주 자동화 시스템 타입 정의
// ========================================

/** 식단 히스토리 (미래 식단 계획) */
export interface MealPlanItem {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 월, 화, 수, 목, 금, 토, 일
  mealType: string; // 조식, 중식, 석식
  corner: string; // A코너, B코너, 일품 등
  menuCode: string; // 메뉴 코드
  menuName: string; // 메뉴명
  plannedQty?: number; // 계획 수량 (있을 경우)
}

/** 과거 판매 실적 (요일별 통계용) */
export interface SalesHistoryItem {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 월, 화, 수, 목, 금, 토, 일
  menuCode: string;
  menuName: string;
  corner: string;
  soldQty: number; // 판매 수량
  wasteQty?: number; // 폐기 수량
}

/** 메뉴별 레시피 (BOM) */
export interface MenuRecipe {
  menuCode: string;
  menuName: string;
  ingredientCode: string;
  ingredientName: string;
  requiredQty: number; // 1인분당 소요량
  unit: string; // g, ml, EA 등
  lossRate?: number; // 로스율 (%)
  netQty?: number; // 순소요량 (로스 반영)
}

/** 식자재 마스터 */
export interface IngredientMaster {
  ingredientCode: string;
  ingredientName: string;
  category: string; // 육류, 채소, 양념 등
  unit: string;
  moq: number; // 최소 발주 수량
  packagingUnit: number; // 포장 단위
  leadTime: number; // 리드타임 (일)
  safetyDays?: number; // 안전재고 일수
  supplierCode?: string;
  supplierName?: string;
  unitPrice?: number; // 단가
}

/** 요일별 판매 통계 */
export interface DayOfWeekStats {
  dayOfWeek: string;
  menuCode: string;
  menuName: string;
  avgSales: number; // 평균 판매량
  stdDev: number; // 표준편차
  maxSales: number;
  minSales: number;
  sampleCount: number; // 샘플 수 (N주)
}

/** 발주 계산 결과 */
export interface OrderCalculation {
  ingredientCode: string;
  ingredientName: string;
  category: string;
  unit: string;

  // 소요량 계산
  grossRequirement: number; // 총 소요량
  safetyStock: number; // 안전재고
  totalRequirement: number; // 총 필요량 (소요량 + 안전재고)

  // 재고 현황
  currentStock: number; // 현재 재고
  inTransit: number; // 입고 예정량 (미입고 발주)
  availableStock: number; // 가용 재고 (현재 + 입고예정)

  // 발주량 계산
  netRequirement: number; // 순 소요량 (필요량 - 가용재고)
  orderQty: number; // 발주 수량 (MOQ, 포장단위 반영)

  // 메타 정보
  leadTime: number;
  moq: number;
  unitPrice?: number;
  estimatedCost?: number; // 예상 금액

  // 통계 정보
  avgDailySales: number; // 일 평균 소모량
  stdDev: number; // 표준편차
  serviceLevel: number; // 서비스 수준 (%)

  // 상태
  status: 'normal' | 'urgent' | 'shortage' | 'overstock';
  statusMessage?: string;
}

/** 발주 권고 요약 */
export interface OrderRecommendation {
  orderDate: string; // 발주일 (오늘)
  deliveryDate: string; // 예상 입고일
  targetPeriodStart: string; // 대상 기간 시작
  targetPeriodEnd: string; // 대상 기간 종료

  items: OrderCalculation[];

  // 요약 통계
  totalItems: number;
  urgentItems: number;
  shortageItems: number;
  totalEstimatedCost: number;

  // 설정값
  serviceLevel: number; // 서비스 수준 (기본 95%)
  forecastWeeks: number; // 예측에 사용한 주수 (기본 4주)
  leadTimeDays: number; // 기본 리드타임
}

/** 발주 시스템 설정 */
export interface OrderingConfig {
  serviceLevel: number; // 서비스 수준 (0.90 ~ 0.99)
  zScore: number; // 서비스 계수 (95% = 1.65)
  forecastWeeks: number; // 예측 주수 (기본 4주)
  defaultLeadTime: number; // 기본 리드타임 (일)
  safetyDays: number; // 기본 안전재고 일수
  mealPlanSpreadsheetId: string; // 식단표 스프레드시트 ID
}

/** 발주서 (최종 출력) */
export interface PurchaseOrder {
  poNumber: string; // 발주번호
  orderDate: string;
  deliveryDate: string;
  supplierCode: string;
  supplierName: string;
  items: PurchaseOrderLine[];
  totalAmount: number;
  status: 'draft' | 'confirmed' | 'sent';
  createdAt: string;
}

export interface PurchaseOrderLine {
  lineNo: number;
  ingredientCode: string;
  ingredientName: string;
  orderQty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  requestedDeliveryDate: string;
  remark?: string;
}
