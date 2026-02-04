import {
  AnomalyInsight,
  BomDiffItem,
  TopWasteItem,
  WasteTrendData,
  ChannelProfitData,
  InventorySafetyItem,
  StocktakeAnomalyItem,
  ProfitRankItem,
  CostStructure,
  InventoryHistory,
  StocktakeHistory,
  Notification,
  ChannelMix,
  TurnoverTrendData,
  WasteReasonData,
  BomHistoryItem,
  DashboardSummary,
  Supplier,
  OrderSuggestion,
} from './types.ts';

// --- Existing Data (Updated for Filtering) ---
export const WASTE_TREND_DATA: WasteTrendData[] = [
  { day: '11/01', avg: 140, actual: 120 },
  { day: '11/02', avg: 140, actual: 135 },
  { day: '11/03', avg: 140, actual: 160 },
  { day: '11/04', avg: 140, actual: 155 },
  { day: '11/05', avg: 140, actual: 245 },
  { day: '11/06', avg: 140, actual: 220 },
  { day: '11/07', avg: 140, actual: 210 },
  // Extra data for '30days' filter
  { day: '10/25', avg: 135, actual: 130 },
  { day: '10/26', avg: 135, actual: 140 },
  { day: '10/27', avg: 135, actual: 125 },
  { day: '10/28', avg: 135, actual: 150 },
  { day: '10/29', avg: 135, actual: 160 },
  { day: '10/30', avg: 135, actual: 145 },
  { day: '10/31', avg: 135, actual: 155 },
];

export const TOP_WASTE_ITEMS: TopWasteItem[] = [
  {
    id: '1',
    name: 'Resin-PP-002 (Base)',
    amount: 2450,
    variancePercent: 15,
    percentageOfTotal: 85,
    isAnomaly: false,
    colorClass: 'bg-red-500',
  },
  {
    id: '2',
    name: 'Solvent-X (Cleaner)',
    amount: 840,
    variancePercent: 8,
    isAnomaly: true,
    percentageOfTotal: 45,
    colorClass: 'bg-orange-400',
  },
  {
    id: '3',
    name: 'Pkg-Cardboard-L',
    amount: 320,
    variancePercent: 1.2,
    isAnomaly: false,
    percentageOfTotal: 15,
    colorClass: 'bg-green-600',
  },
  {
    id: '4',
    name: 'Bolt-M5-Steel',
    amount: 110,
    variancePercent: 0.1,
    isAnomaly: false,
    percentageOfTotal: 5,
    colorClass: 'bg-green-600',
  },
];

export const BOM_DIFF_ITEMS: BomDiffItem[] = [
  {
    id: '1',
    skuCode: 'PP',
    skuName: 'Resin-PP-002',
    skuSub: 'Base Plastic',
    process: 'Injection Molding',
    stdQty: 12.0,
    stdUnit: 'kg',
    actualQty: 13.8,
    diffPercent: 15.0,
    anomalyScore: 92,
    costImpact: -2450.0,
    reasoning:
      '최근 습도 증가로 인한 원료 뭉침 현상 발생 가능성이 높습니다 (상관관계 0.82). 믹서 RPM 보정이 필요합니다.',
    status: 'pending',
  },
  {
    id: '2',
    skuCode: 'SX',
    skuName: 'Solvent-X',
    skuSub: 'Cleaner',
    process: 'Post-Process Wash',
    stdQty: 5.0,
    stdUnit: 'L',
    actualQty: 5.4,
    diffPercent: 8.0,
    anomalyScore: 65,
    costImpact: -840.0,
    reasoning: '세척 노즐 #3의 압력 저하 패턴이 감지되었습니다. 노즐 막힘 여부를 점검하세요.',
    status: 'pending',
  },
  {
    id: '3',
    skuCode: 'PC',
    skuName: 'Pkg-Cardboard-L',
    skuSub: 'Packaging',
    process: 'Final Assembly',
    stdQty: 1000,
    stdUnit: 'Units',
    actualQty: 1012,
    diffPercent: 1.2,
    anomalyScore: 15,
    costImpact: -320.0,
    reasoning: '작업자 교대 시간 전후로 소량의 파손 폐기가 반복됩니다.',
    status: 'pending',
  },
  {
    id: '4',
    skuCode: 'BM',
    skuName: 'Bolt-M5-Steel',
    skuSub: 'Fasteners',
    process: 'Sub-Assembly A',
    stdQty: 5000,
    stdUnit: 'Units',
    actualQty: 5005,
    diffPercent: 0.1,
    anomalyScore: 2,
    costImpact: -110.0,
    reasoning: '정상 범위 내 변동입니다.',
    status: 'resolved',
  },
];

export const LATEST_INSIGHT: AnomalyInsight = {
  id: 'insight-001',
  title: 'AI 이상 징후 탐지 인사이트',
  description: '최근 48시간 동안 3번 라인의 Chemical Solvent B 사용량이',
  highlight: '+12.4% 급증했습니다.',
  level: 'critical',
};

// --- Profit Data ---
export const PROFIT_DATA: ChannelProfitData[] = [
  { date: '11/01', revenue: 15000000, profit: 4500000, marginRate: 30 },
  { date: '11/02', revenue: 14200000, profit: 4100000, marginRate: 28.8 },
  { date: '11/03', revenue: 16800000, profit: 5800000, marginRate: 34.5 },
  { date: '11/04', revenue: 13500000, profit: 3200000, marginRate: 23.7 },
  { date: '11/05', revenue: 19000000, profit: 6500000, marginRate: 34.2 },
  { date: '11/06', revenue: 18500000, profit: 5900000, marginRate: 31.8 },
  { date: '11/07', revenue: 21000000, profit: 7200000, marginRate: 34.2 },
  // Extra data
  { date: '10/28', revenue: 13000000, profit: 3900000, marginRate: 30 },
  { date: '10/29', revenue: 16000000, profit: 5000000, marginRate: 31.2 },
  { date: '10/30', revenue: 15500000, profit: 4800000, marginRate: 30.9 },
  { date: '10/31', revenue: 17000000, profit: 5500000, marginRate: 32.3 },
];

export const TOP_PROFIT_ITEMS: ProfitRankItem[] = [
  { id: 't1', rank: 1, skuName: 'Premium-Set-A', channel: '자사몰', profit: 12500000, margin: 42 },
  { id: 't2', rank: 2, skuName: 'Basic-Kit-V2', channel: '쿠팡', profit: 8400000, margin: 28 },
  { id: 't3', rank: 3, skuName: 'Filter-Pack-10', channel: 'B2B', profit: 6200000, margin: 55 },
  { id: 't4', rank: 4, skuName: 'Accessory-Cable', channel: '자사몰', profit: 4100000, margin: 60 },
  { id: 't5', rank: 5, skuName: 'Refill-Liquid-5L', channel: 'B2B', profit: 3800000, margin: 35 },
];

export const BOTTOM_PROFIT_ITEMS: ProfitRankItem[] = [
  {
    id: 'b1',
    rank: 1,
    skuName: 'Old-Stock-Clearance',
    channel: '오프라인',
    profit: -2500000,
    margin: -15,
  },
  { id: 'b2', rank: 2, skuName: 'Heavy-Duty-Stand', channel: '쿠팡', profit: -800000, margin: -5 },
  { id: 'b3', rank: 3, skuName: 'Promo-Bundle-X', channel: '컬리', profit: 100000, margin: 1.2 },
  { id: 'b4', rank: 4, skuName: 'Spare-Part-Z', channel: 'AS센터', profit: 150000, margin: 5 },
  { id: 'b5', rank: 5, skuName: 'Trial-Kit-Mini', channel: '자사몰', profit: 220000, margin: 8 },
];

// --- Inventory Data (Updated with Warehouse/Category) ---
export const INVENTORY_SAFETY_DATA: InventorySafetyItem[] = [
  {
    id: '1',
    skuName: 'Motor-DC-12V',
    currentStock: 120,
    safetyStock: 150,
    status: 'Shortage',
    turnoverRate: 12.5,
    warehouse: 'WH-A',
    category: '전자부품',
  },
  {
    id: '2',
    skuName: 'Housing-Plastic-ABS',
    currentStock: 2500,
    safetyStock: 800,
    status: 'Overstock',
    turnoverRate: 2.1,
    warehouse: 'WH-B',
    category: '기구물',
  },
  {
    id: '3',
    skuName: 'PCB-Main-V3',
    currentStock: 450,
    safetyStock: 400,
    status: 'Normal',
    turnoverRate: 8.4,
    warehouse: 'WH-A',
    category: '전자부품',
  },
  {
    id: '4',
    skuName: 'Screw-M3-10mm',
    currentStock: 100,
    safetyStock: 1000,
    status: 'Shortage',
    turnoverRate: 15.2,
    warehouse: 'WH-C',
    category: '부자재',
  },
  {
    id: '5',
    skuName: 'Pkg-Box-S',
    currentStock: 5000,
    safetyStock: 2000,
    status: 'Overstock',
    turnoverRate: 1.5,
    warehouse: 'WH-B',
    category: '포장재',
  },
  {
    id: '6',
    skuName: 'LED-Array-W',
    currentStock: 800,
    safetyStock: 800,
    status: 'Normal',
    turnoverRate: 9.0,
    warehouse: 'WH-A',
    category: '전자부품',
  },
  {
    id: '7',
    skuName: 'Resin-Clear',
    currentStock: 50,
    safetyStock: 200,
    status: 'Shortage',
    turnoverRate: 18.0,
    warehouse: 'WH-B',
    category: '원자재',
  },
];

export const STOCKTAKE_ANOMALY_DATA: StocktakeAnomalyItem[] = [
  {
    id: '1',
    materialName: 'Resin-PP-002',
    location: 'WH-A-01',
    systemQty: 1000,
    countedQty: 850,
    aiExpectedQty: 980,
    anomalyScore: 95,
    reason: '실사 오류 의심 (패턴 불일치)',
    actionStatus: 'none',
  },
  {
    id: '2',
    materialName: 'Display-OLED-1.5',
    location: 'WH-B-12',
    systemQty: 500,
    countedQty: 498,
    aiExpectedQty: 495,
    anomalyScore: 10,
    reason: '정상 범위',
    actionStatus: 'none',
  },
  {
    id: '3',
    materialName: 'Battery-LiIon-3000',
    location: 'WH-A-05',
    systemQty: 200,
    countedQty: 150,
    aiExpectedQty: 160,
    anomalyScore: 88,
    reason: '도난 또는 누락 가능성',
    actionStatus: 'none',
  },
  {
    id: '4',
    materialName: 'Cable-USB-C',
    location: 'WH-C-03',
    systemQty: 3000,
    countedQty: 3005,
    aiExpectedQty: 3000,
    anomalyScore: 5,
    reason: '정상 범위',
    actionStatus: 'none',
  },
];

// --- Drill-down Mock Data ---
export const MOCK_COST_BREAKDOWN: CostStructure[] = [
  { name: '원재료비', value: 45, color: '#3B82F6' },
  { name: '노무비', value: 30, color: '#10B981' },
  { name: '제조경비', value: 15, color: '#F59E0B' },
  { name: '물류/수수료', value: 10, color: '#EF4444' },
];

export const MOCK_INVENTORY_HISTORY: InventoryHistory[] = [
  { date: '10/10', stock: 180, safety: 150 },
  { date: '10/17', stock: 160, safety: 150 },
  { date: '10/24', stock: 140, safety: 150 },
  { date: '10/31', stock: 110, safety: 150 },
  { date: '11/07', stock: 95, safety: 150 },
];

export const MOCK_STOCKTAKE_HISTORY: StocktakeHistory[] = [
  { date: '2023-07', system: 980, counted: 975, diff: -5 },
  { date: '2023-08', system: 1050, counted: 1048, diff: -2 },
  { date: '2023-09', system: 920, counted: 880, diff: -40 },
  { date: '2023-10', system: 1100, counted: 1000, diff: -100 },
  { date: '2023-11', system: 1000, counted: 850, diff: -150 },
];

// --- Notifications (Updated with Targets) ---
export const NOTIFICATIONS_DATA: Notification[] = [
  {
    id: 'n1',
    type: 'alert',
    title: '폐기량 급증 경고',
    message: '3번 라인 Solvent-X 폐기량이 평균 대비 20% 증가했습니다.',
    time: '10분 전',
    read: false,
    targetView: 'waste',
    targetItemId: '2', // Solvent-X id
  },
  {
    id: 'n2',
    type: 'alert',
    title: '재고 부족 알림',
    message: 'Motor-DC-12V 재고가 안전재고 이하로 떨어졌습니다.',
    time: '1시간 전',
    read: false,
    targetView: 'inventory',
    targetItemId: '1', // Motor-DC id
  },
  {
    id: 'n3',
    type: 'info',
    title: '실사 완료',
    message: 'WH-A 창고 정기 재고 실사가 완료되었습니다.',
    time: '3시간 전',
    read: true,
    targetView: 'stocktake',
  },
  {
    id: 'n4',
    type: 'success',
    title: '수익성 개선',
    message: 'Premium-Set-A의 마진율이 지난달 대비 5% 상승했습니다.',
    time: '어제',
    read: true,
    targetView: 'monthly',
    targetItemId: 't1',
  },
];

// --- Channel Mix Mock ---
export const MOCK_CHANNEL_MIX: ChannelMix[] = [
  { name: '자사몰 (D2C)', value: 40, margin: 45 },
  { name: '쿠팡 (로켓)', value: 35, margin: 15 },
  { name: '컬리', value: 15, margin: 20 },
  { name: 'B2B/도매', value: 10, margin: 30 },
];

// --- NEW: Turnover Trend Data ---
export const MOCK_TURNOVER_TREND: TurnoverTrendData[] = [
  { month: '6월', rate: 5.2, target: 8.0 },
  { month: '7월', rate: 5.8, target: 8.0 },
  { month: '8월', rate: 6.5, target: 8.0 },
  { month: '9월', rate: 7.2, target: 8.0 },
  { month: '10월', rate: 8.1, target: 8.0 },
  { month: '11월', rate: 8.4, target: 8.0 },
];

// --- NEW: Waste Reason Data ---
export const MOCK_WASTE_REASONS: WasteReasonData[] = [
  { name: '기계/설비 고장', value: 45, color: '#EF4444' }, // Red
  { name: '작업자 실수', value: 25, color: '#F59E0B' }, // Yellow
  { name: '원자재 불량', value: 20, color: '#3B82F6' }, // Blue
  { name: '기타 (습도 등)', value: 10, color: '#9CA3AF' }, // Gray
];

// --- NEW: BOM History Data ---
export const MOCK_BOM_HISTORY: BomHistoryItem[] = [
  {
    id: 'h1',
    date: '2023-11-07 14:30',
    skuName: 'Resin-PP-002',
    actionType: 'Update',
    description: '표준 소요량 업데이트 (AI 권장)',
    actor: 'Manager',
    oldValue: '12.0kg',
    newValue: '12.8kg',
  },
  {
    id: 'h2',
    date: '2023-11-06 09:15',
    skuName: 'Solvent-X',
    actionType: 'Fix',
    description: '일시적 이상으로 처리 (노즐 정비 완료)',
    actor: 'Manager',
  },
  {
    id: 'h3',
    date: '2023-11-05 18:00',
    skuName: 'Bolt-M5-Steel',
    actionType: 'Update',
    description: '자동 업데이트 (반복 패턴 감지)',
    actor: 'AI Agent',
    oldValue: '5000ea',
    newValue: '5010ea',
  },
  {
    id: 'h4',
    date: '2023-11-03 10:20',
    skuName: 'Pkg-Box-S',
    actionType: 'Ignore',
    description: '단순 작업자 실수로 인한 폐기 무시',
    actor: 'Manager',
  },
];

// --- NEW: Dashboard Summary Data ---
export const MOCK_DASHBOARD_SUMMARY: DashboardSummary = {
  totalRevenue: 118000000,
  revenueChange: 12.5,
  avgMargin: 32.1,
  marginChange: 1.2,
  wasteRate: 4.8,
  wasteRateChange: -0.5,
  riskItems: 3,
  anomalyCount: 2,
};

// --- NEW: Suppliers Data ---
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'S1',
    name: '한화솔루션',
    method: 'Email',
    contact: 'order@hanwha.com',
    managerName: '김철수',
  },
  { id: 'S2', name: 'LG화학', method: 'Kakao', contact: '010-1234-5678', managerName: '이영희' },
  { id: 'S3', name: '동국제강', method: 'Fax', contact: '02-123-4567', managerName: '박민수' },
  { id: 'S4', name: '3M Korea', method: 'Email', contact: 'orders@3m.com', managerName: '최지원' },
  { id: 'S5', name: '태성산업', method: 'SMS', contact: '010-9876-5432', managerName: '정우성' },
];

// --- NEW: Order Suggestions Data ---
export const MOCK_ORDER_SUGGESTIONS: OrderSuggestion[] = [
  {
    id: 'O1',
    skuCode: 'M-DC-12',
    skuName: 'Motor-DC-12V',
    supplierId: 'S5',
    supplierName: '태성산업',
    method: 'SMS',
    currentStock: 120,
    safetyStock: 150,
    avgDailyConsumption: 15,
    leadTime: 3,
    suggestedQty: 200,
    orderQty: 200,
    unit: 'EA',
    unitPrice: 15000,
    status: 'Ready',
  },
  {
    id: 'O2',
    skuCode: 'R-PP-02',
    skuName: 'Resin-PP-002',
    supplierId: 'S1',
    supplierName: '한화솔루션',
    method: 'Email',
    currentStock: 50,
    safetyStock: 200,
    avgDailyConsumption: 25,
    leadTime: 5,
    suggestedQty: 500,
    orderQty: 500,
    unit: 'KG',
    unitPrice: 2500,
    status: 'Ready',
  },
  {
    id: 'O3',
    skuCode: 'SC-M3-10',
    skuName: 'Screw-M3-10mm',
    supplierId: 'S3',
    supplierName: '동국제강',
    method: 'Fax',
    currentStock: 100,
    safetyStock: 1000,
    avgDailyConsumption: 100,
    leadTime: 2,
    suggestedQty: 2000,
    orderQty: 2000,
    unit: 'EA',
    unitPrice: 15,
    status: 'Ready',
  },
  {
    id: 'O4',
    skuCode: 'CH-SOL-B',
    skuName: 'Chemical Solvent B',
    supplierId: 'S2',
    supplierName: 'LG화학',
    method: 'Kakao',
    currentStock: 80,
    safetyStock: 100,
    avgDailyConsumption: 12,
    leadTime: 4,
    suggestedQty: 150,
    orderQty: 150,
    unit: 'L',
    unitPrice: 4500,
    status: 'Ready',
  },
];
