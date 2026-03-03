/**
 * BOM Service — BOM 분석 통합 서비스
 * insightService.ts의 BOM 타입/함수 + bomAnalysisService.ts의 함수를 통합
 */

import type {
  SalesDetailData,
  ProductionData,
  PurchaseData,
  BomItemData,
  MaterialMasterItem,
  InventorySnapshotData,
} from './googleSheetService';
import type { BomYieldAnalysisItem, InventoryDiscrepancyItem } from '../types';
import type { BusinessConfig } from '../config/businessConfig';
import { parseSopCode, validateBomDataBatch, type BomCoverageResult, type BomHealthScore, type BomValidationResult } from '../utils/sopCodeParser';

// ==============================
// BOM 타입 정의 (insightService.ts에서 이동)
// ==============================

export interface BomVarianceItem {
  productCode: string;
  productName: string;
  standardPrice: number;     // 기준단가 (BOM materialMaster unitPrice)
  actualPrice: number;       // 실제단가 (구매 평균단가)
  standardQty: number;       // 기준 투입량 (BOM consumptionQty 기반)
  actualQty: number;         // 실제 투입량 (구매량)
  priceVariance: number;     // 단가 차이 금액
  qtyVariance: number;       // 투입량 차이 금액
  totalVariance: number;     // 총 차이 금액
  unit: string;              // 단위 (kg, L, EA 등)
  linkedMenus: { code: string; name: string }[];  // 이 자재를 사용하는 메뉴 목록
  linkedMenuCount: number;   // 연결 메뉴 수
}

export interface BomVarianceInsight {
  items: BomVarianceItem[];
  totalPriceVariance: number;
  totalQtyVariance: number;
  totalVariance: number;
  favorableCount: number;    // 유리 (비용 절감) 품목
  unfavorableCount: number;  // 불리 (비용 초과) 품목
}

// BOM 소진량 이상 감지 타입
export type BomAnomalyType = 'overuse' | 'underuse' | 'price_deviation';
export type BomAnomalySeverity = 'low' | 'medium' | 'high';

export interface BomConsumptionAnomalyItem {
  materialCode: string;
  materialName: string;
  productNames: string[];
  expectedConsumption: number;
  actualConsumption: number;
  deviationPct: number;
  bomUnitPrice: number;
  actualAvgPrice: number;
  priceDeviationPct: number;
  anomalyType: BomAnomalyType;
  severity: BomAnomalySeverity;
  costImpact: number;
  totalSpend: number;
  transactionCount: number;
}

export interface BomConsumptionAnomalyInsight {
  items: BomConsumptionAnomalyItem[];
  summary: {
    totalAnomalies: number;
    overuseCount: number;
    underuseCount: number;
    priceAnomalyCount: number;
    totalCostImpact: number;
    highSeverityCount: number;
  };
  topOveruse: BomConsumptionAnomalyItem[];
  topUnderuse: BomConsumptionAnomalyItem[];
  topPriceDeviation: BomConsumptionAnomalyItem[];
}

// ==============================
// bomAnalysisService.ts 타입 (이동)
// ==============================

export interface ExpectedConsumption {
  materialCode: string;
  materialName: string;
  expectedQty: number;
  /** 기여 제품별 내역 */
  breakdown: {
    productCode: string;
    productName: string;
    salesQty: number;
    consumptionPerUnit: number;
    expectedQty: number;
  }[];
}

export interface ConsumptionVarianceItem {
  materialCode: string;
  materialName: string;
  expectedQty: number;
  actualQty: number;
  qtyDiff: number;
  qtyDiffPct: number;
  standardPrice: number;
  actualAvgPrice: number;
  priceDiff: number;
  priceDiffPct: number;
  priceVariance: number;
  qtyVariance: number;
  totalVariance: number;
  /** 제품별 상세 */
  productBreakdown: {
    productCode: string;
    productName: string;
    salesQty: number;
    expectedConsumption: number;
  }[];
}

export interface ConsumptionVarianceResult {
  items: ConsumptionVarianceItem[];
  totalPriceVariance: number;
  totalQtyVariance: number;
  totalVariance: number;
  favorableCount: number;
  unfavorableCount: number;
  analyzedMaterials: number;
}

export interface BomDataValidationResult {
  validCount: number;
  invalidCount: number;
  totalEntries: number;
  sopCompliance: number;
  errorSummary: Record<string, number>;
  details: BomValidationResult[];
}

// ==============================
// BOM 분석 함수 (insightService.ts에서 이동)
// ==============================

// P3-4 레시피 대비 투입 오차 분석
export function computeBomVariance(
  purchases: PurchaseData[],
  production: ProductionData[],
  bomData: BomItemData[] = [],
  materialMaster: MaterialMasterItem[] = [],
  _inventorySnapshots: InventorySnapshotData[] = [],
  salesDetail: SalesDetailData[] = []
): BomVarianceInsight {
  const emptyResult: BomVarianceInsight = { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0 };
  if (purchases.length === 0 || production.length === 0) return emptyResult;

  const totalProduction = production.reduce((s, p) => s + p.prodQtyTotal, 0);
  if (totalProduction === 0) return emptyResult;

  // materialMaster → 이름/단위/단가 매핑
  const masterNameMap = new Map<string, string>();
  const masterUnitMap = new Map<string, string>();
  const masterPriceMap = new Map<string, number>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (!code) continue;
    if (mm.materialName) masterNameMap.set(code, mm.materialName);
    if (mm.unit) masterUnitMap.set(code, mm.unit);
    if (mm.unitPrice > 0) masterPriceMap.set(code, mm.unitPrice);
  }

  // BOM 연결 메뉴 목록 수집
  const bomLinkedMenus = new Map<string, { code: string; name: string }[]>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (!matCode || !bom.consumptionQty || !bom.productionQty) continue;
    const menus = bomLinkedMenus.get(matCode) || [];
    const menuCode = bom.productCode?.trim() || '';
    const menuName = bom.productName || menuCode;
    if (!menus.some(m => m.code === menuCode)) {
      menus.push({ code: menuCode, name: menuName });
    }
    bomLinkedMenus.set(matCode, menus);
  }

  // ── 판매 기반 예상 소비량 산출 (US-003: 균등 분배 → 판매 비례) ──
  // salesDetail이 있으면 제품별 판매량을 기반으로 자재 소비량을 산출
  // salesDetail이 없으면 기존 생산량 비례 폴백
  const salesByProduct = new Map<string, number>();
  if (salesDetail.length > 0) {
    for (const s of salesDetail) {
      const code = s.productCode?.trim();
      if (!code) continue;
      salesByProduct.set(code, (salesByProduct.get(code) || 0) + (s.quantity || 0));
    }
  }

  const bomStandardQty = new Map<string, number>();
  const hasSalesData = salesByProduct.size > 0;

  if (hasSalesData) {
    // 판매 기반: expectedQty = salesQty × (consumptionQty / productionQty)
    for (const bom of bomData) {
      const matCode = bom.materialCode?.trim();
      const prodCode = bom.productCode?.trim();
      if (!matCode || !prodCode || !bom.consumptionQty || !bom.productionQty) continue;

      const salesQty = salesByProduct.get(prodCode) || 0;
      if (salesQty <= 0) continue;

      const stdQty = (bom.consumptionQty / bom.productionQty) * salesQty;
      bomStandardQty.set(matCode, (bomStandardQty.get(matCode) || 0) + stdQty);
    }
  } else {
    // 폴백: 총 생산량을 BOM 제품수로 균등 분배 (레거시)
    const uniqueBomProducts = new Set(bomData.map(b => b.productCode?.trim()).filter(Boolean));
    const numBomProducts = uniqueBomProducts.size || 1;
    const perProductProduction = totalProduction / numBomProducts;

    for (const bom of bomData) {
      const matCode = bom.materialCode?.trim();
      if (!matCode || !bom.consumptionQty || !bom.productionQty) continue;
      const stdQty = bom.consumptionQty * (perProductProduction / bom.productionQty);
      bomStandardQty.set(matCode, (bomStandardQty.get(matCode) || 0) + stdQty);
    }
  }

  // BOM 데이터가 있는 경우: BOM 기준 로직
  if (bomStandardQty.size > 0) {
    // 실제 소모량 = 구매량 by materialCode
    const purchaseAgg = new Map<string, { qty: number; total: number; name: string }>();
    for (const p of purchases) {
      const code = p.productCode?.trim();
      if (!code || p.quantity === 0) continue;
      const existing = purchaseAgg.get(code) || { qty: 0, total: 0, name: p.productName };
      existing.qty += p.quantity;
      existing.total += p.total;
      purchaseAgg.set(code, existing);
    }

    let totalPriceVar = 0;
    let totalQtyVar = 0;
    const items: BomVarianceItem[] = [];

    for (const [code, stdQty] of bomStandardQty) {
      const purchase = purchaseAgg.get(code);
      const actualQty = purchase ? purchase.qty : 0;
      if (actualQty === 0 && stdQty === 0) continue;

      const standardQty = Math.round(stdQty);
      const standardPrice = masterPriceMap.get(code) || 0;
      const actualPrice = purchase && purchase.qty > 0 ? Math.round(purchase.total / purchase.qty) : standardPrice;
      const name = masterNameMap.get(code) || purchase?.name || code;
      const linkedMenus = bomLinkedMenus.get(code) || [];

      // 가격차이 = (실제단가 - 기준단가) × 실제수량
      const priceVariance = (actualPrice - standardPrice) * actualQty;
      // 수량차이 = (실제수량 - 기준수량) × 기준단가
      const qtyVariance = (actualQty - standardQty) * standardPrice;
      const totalVariance = priceVariance + qtyVariance;

      totalPriceVar += priceVariance;
      totalQtyVar += qtyVariance;

      items.push({
        productCode: code,
        productName: name,
        standardPrice, actualPrice,
        standardQty, actualQty,
        priceVariance, qtyVariance, totalVariance,
        unit: masterUnitMap.get(code) || '개',
        linkedMenus,
        linkedMenuCount: linkedMenus.length,
      });
    }

    items.sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));

    return {
      items,
      totalPriceVariance: totalPriceVar,
      totalQtyVariance: totalQtyVar,
      totalVariance: totalPriceVar + totalQtyVar,
      favorableCount: items.filter(i => i.totalVariance < 0).length,
      unfavorableCount: items.filter(i => i.totalVariance > 0).length,
    };
  }

  // Fallback: BOM 데이터 없을 때 — 전반기/후반기 비교 (레거시)
  const sortedPurchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));
  const midIdx = Math.floor(sortedPurchases.length / 2);
  const basePeriod = sortedPurchases.slice(0, midIdx);
  const recentPeriod = sortedPurchases.slice(midIdx);

  const sortedProd = [...production].sort((a, b) => a.date.localeCompare(b.date));
  const prodMidIdx = Math.floor(sortedProd.length / 2);
  const baseProd = sortedProd.slice(0, prodMidIdx);
  const recentProd = sortedProd.slice(prodMidIdx);

  const baseProdTotal = baseProd.reduce((s, p) => s + p.prodQtyTotal, 0) || 1;
  const recentProdTotal = recentProd.reduce((s, p) => s + p.prodQtyTotal, 0) || 1;

  type PeriodAgg = { qty: number; total: number; name: string };
  const aggregate = (data: PurchaseData[]) => {
    const map = new Map<string, PeriodAgg>();
    data.forEach(p => {
      if (!p.productCode || p.quantity === 0) return;
      const existing = map.get(p.productCode) || { qty: 0, total: 0, name: p.productName };
      existing.qty += p.quantity;
      existing.total += p.total;
      map.set(p.productCode, existing);
    });
    return map;
  };

  const baseAgg = aggregate(basePeriod);
  const recentAgg = aggregate(recentPeriod);
  const allCodes = new Set([...baseAgg.keys(), ...recentAgg.keys()]);
  let totalPriceVar = 0;
  let totalQtyVar = 0;
  const items: BomVarianceItem[] = [];

  allCodes.forEach(code => {
    const base = baseAgg.get(code);
    const recent = recentAgg.get(code);
    if (!base || !recent || base.qty === 0 || recent.qty === 0) return;

    const standardPrice = Math.round(base.total / base.qty);
    const actualPrice = Math.round(recent.total / recent.qty);
    const standardRatio = base.qty / baseProdTotal;
    const standardQty = Math.round(standardRatio * recentProdTotal);
    const actualQty = recent.qty;

    const priceVariance = (actualPrice - standardPrice) * actualQty;
    const qtyVariance = (actualQty - standardQty) * standardPrice;
    const totalVariance = priceVariance + qtyVariance;

    totalPriceVar += priceVariance;
    totalQtyVar += qtyVariance;

    const name = masterNameMap.get(code) || base.name || recent.name;
    items.push({
      productCode: code,
      productName: name,
      standardPrice, actualPrice,
      standardQty, actualQty,
      priceVariance, qtyVariance, totalVariance,
      unit: masterUnitMap.get(code) || '개',
      linkedMenus: [],
      linkedMenuCount: 0,
    });
  });

  items.sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));

  return {
    items,
    totalPriceVariance: totalPriceVar,
    totalQtyVariance: totalQtyVar,
    totalVariance: totalPriceVar + totalQtyVar,
    favorableCount: items.filter(i => i.totalVariance < 0).length,
    unfavorableCount: items.filter(i => i.totalVariance > 0).length,
  };
}

// ==============================
// BOM 기준 자재 소진량 이상 감지
// ==============================

export function computeBomConsumptionAnomaly(
  purchases: PurchaseData[],
  production: ProductionData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[],
  inventorySnapshots: InventorySnapshotData[],
  config: BusinessConfig
): BomConsumptionAnomalyInsight | null {
  if (bomData.length === 0 || purchases.length === 0 || production.length === 0) return null;

  // BOM 자재코드 집합 + 관련 제품명 + 자재명
  const bomMaterialCodes = new Set<string>();
  const bomProductNames = new Map<string, Set<string>>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (!matCode) continue;
    bomMaterialCodes.add(matCode);
    const names = bomProductNames.get(matCode) || new Set<string>();
    const prodName = bom.productName || bom.productCode || '';
    if (prodName) names.add(prodName);
    bomProductNames.set(matCode, names);
  }

  // materialMaster → 자재별 기준 단가 + 이름
  const masterPriceMap = new Map<string, number>();
  const masterNameMap = new Map<string, string>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (!code) continue;
    if (mm.unitPrice > 0) masterPriceMap.set(code, mm.unitPrice);
    if (mm.materialName) masterNameMap.set(code, mm.materialName);
  }

  // 재고 스냅샷 → 자재코드별 현재 재고 잔량
  const inventoryBalance = new Map<string, number>();
  for (const inv of inventorySnapshots) {
    const code = inv.productCode?.trim();
    if (!code) continue;
    inventoryBalance.set(code, (inventoryBalance.get(code) || 0) + inv.balanceQty);
  }

  // BOM 자재만 필터하여 구매 데이터 추출
  const bomPurchases = purchases.filter(p => bomMaterialCodes.has(p.productCode?.trim()));
  if (bomPurchases.length === 0) return null;

  // 기간 분할: 전반기(기준) vs 후반기(최근)
  const sortedPurchases = [...bomPurchases].sort((a, b) => a.date.localeCompare(b.date));
  const midIdx = Math.floor(sortedPurchases.length / 2);
  const basePeriod = sortedPurchases.slice(0, midIdx);
  const recentPeriod = sortedPurchases.slice(midIdx);

  const sortedProd = [...production].sort((a, b) => a.date.localeCompare(b.date));
  const prodMidIdx = Math.floor(sortedProd.length / 2);
  const baseProdTotal = sortedProd.slice(0, prodMidIdx).reduce((s, p) => s + p.prodQtyTotal, 0) || 1;
  const recentProdTotal = sortedProd.slice(prodMidIdx).reduce((s, p) => s + p.prodQtyTotal, 0) || 1;

  // 기간별 자재 집계
  type PeriodAgg = { qty: number; amount: number; count: number; name: string };
  const aggregate = (data: PurchaseData[]) => {
    const map = new Map<string, PeriodAgg>();
    for (const p of data) {
      const code = p.productCode?.trim();
      if (!code) continue;
      const agg = map.get(code) || { qty: 0, amount: 0, count: 0, name: p.productName || code };
      agg.qty += p.quantity || 0;
      agg.amount += p.total || 0;
      agg.count += 1;
      map.set(code, agg);
    }
    return map;
  };

  const baseAgg = aggregate(basePeriod);
  const recentAgg = aggregate(recentPeriod);

  // 이상 감지: 생산량 정규화 비율 비교 (전반기 vs 후반기)
  const items: BomConsumptionAnomalyItem[] = [];
  const overuseThresh = config.bomOveruseThreshold;
  const underuseThresh = config.bomUnderuseThreshold;
  const priceThresh = config.bomPriceDeviationThreshold;
  const minSpend = config.bomMinimumSpend;
  const medSev = config.bomMediumSeverity;
  const highSev = config.bomHighSeverity;

  // BOM 자재 중 구매 이력이 있는 것만 분석
  const allMatCodes = new Set([...baseAgg.keys(), ...recentAgg.keys()]);

  for (const matCode of allMatCodes) {
    const base = baseAgg.get(matCode);
    const recent = recentAgg.get(matCode);
    if (!base || !recent) continue;

    const totalSpend = base.amount + recent.amount;
    if (totalSpend < minSpend) continue;

    // 생산량 정규화: 자재 사용률 = 구매량 / 생산량
    const baseRate = base.qty / baseProdTotal;
    const recentRate = recent.qty / recentProdTotal;

    // 기대 소모량 = 전반기 비율 × 후반기 생산량 (전반기 패턴이 정상이라 가정)
    const expectedQty = Math.round(baseRate * recentProdTotal);
    const actualQty = recent.qty;

    if (expectedQty === 0) continue;

    const deviationPct = ((actualQty - expectedQty) / expectedQty) * 100;

    // 가격 비교: 전반기 평균단가 vs 후반기 평균단가
    const baseAvgPrice = base.qty > 0 ? base.amount / base.qty : 0;
    const recentAvgPrice = recent.qty > 0 ? recent.amount / recent.qty : 0;
    const bomUnitPrice = masterPriceMap.get(matCode) || baseAvgPrice;
    const priceDeviationPct = baseAvgPrice > 0 ? ((recentAvgPrice - baseAvgPrice) / baseAvgPrice) * 100 : 0;

    // 이상 유형 판별
    let anomalyType: BomAnomalyType | null = null;
    if (deviationPct > overuseThresh) {
      anomalyType = 'overuse';
    } else if (deviationPct < underuseThresh) {
      anomalyType = 'underuse';
    } else if (Math.abs(priceDeviationPct) > priceThresh) {
      anomalyType = 'price_deviation';
    }

    if (!anomalyType) continue;

    // 심각도
    const absDeviation = Math.abs(anomalyType === 'price_deviation' ? priceDeviationPct : deviationPct);
    const severity: BomAnomalySeverity = absDeviation >= highSev ? 'high' : absDeviation >= medSev ? 'medium' : 'low';

    // 비용 영향
    const costImpact = anomalyType === 'price_deviation'
      ? Math.round((recentAvgPrice - baseAvgPrice) * actualQty)
      : Math.round((actualQty - expectedQty) * (bomUnitPrice || recentAvgPrice));

    // 자재명: materialMaster 우선 → 구매 데이터 이름
    const materialName = masterNameMap.get(matCode) || recent.name || base.name || matCode;
    const productNames = bomProductNames.get(matCode);

    items.push({
      materialCode: matCode,
      materialName,
      productNames: productNames ? [...productNames] : [],
      expectedConsumption: expectedQty,
      actualConsumption: actualQty,
      deviationPct: Math.round(deviationPct * 10) / 10,
      bomUnitPrice: Math.round(bomUnitPrice),
      actualAvgPrice: Math.round(recentAvgPrice),
      priceDeviationPct: Math.round(priceDeviationPct * 10) / 10,
      anomalyType,
      severity,
      costImpact,
      totalSpend: Math.round(totalSpend),
      transactionCount: (base.count || 0) + (recent.count || 0),
    });
  }

  // 정렬: 심각도 > 비용 영향 순
  const severityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || Math.abs(b.costImpact) - Math.abs(a.costImpact));

  const overuseItems = items.filter(i => i.anomalyType === 'overuse');
  const underuseItems = items.filter(i => i.anomalyType === 'underuse');
  const priceItems = items.filter(i => i.anomalyType === 'price_deviation');

  return {
    items,
    summary: {
      totalAnomalies: items.length,
      overuseCount: overuseItems.length,
      underuseCount: underuseItems.length,
      priceAnomalyCount: priceItems.length,
      totalCostImpact: items.reduce((s, i) => s + i.costImpact, 0),
      highSeverityCount: items.filter(i => i.severity === 'high').length,
    },
    topOveruse: overuseItems.slice(0, 5),
    topUnderuse: underuseItems.slice(0, 5),
    topPriceDeviation: priceItems.slice(0, 5),
  };
}

// ==============================
// BOM Yield Analysis (insightService.ts에서 이동)
// ==============================

export function computeBomYieldAnalysis(
  production: ProductionData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[],
): BomYieldAnalysisItem[] {
  if (production.length === 0 || bomData.length === 0) return [];

  // 제품코드 → BOM 자재 목록
  const bomByProduct = new Map<string, BomItemData[]>();
  for (const b of bomData) {
    const list = bomByProduct.get(b.productCode) || [];
    list.push(b);
    bomByProduct.set(b.productCode, list);
  }

  // 자재코드 → 단가
  const priceMap = new Map<string, number>();
  for (const m of materialMaster) {
    if (m.materialCode && m.unitPrice > 0) priceMap.set(m.materialCode.trim(), m.unitPrice);
  }

  // 자재코드 → 표준 수율(preprocessYield)
  const yieldMap = new Map<string, number>();
  for (const m of materialMaster) {
    if (m.materialCode && m.preprocessYield > 0) yieldMap.set(m.materialCode.trim(), m.preprocessYield);
  }

  const results: BomYieldAnalysisItem[] = [];
  let idx = 0;

  // 생산일별 제품별 수율 분석
  const prodByDate = new Map<string, ProductionData[]>();
  for (const p of production) {
    const list = prodByDate.get(p.date) || [];
    list.push(p);
    prodByDate.set(p.date, list);
  }

  for (const [date, prods] of prodByDate) {
    const totalProdQty = prods.reduce((s, p) => s + p.prodQtyTotal, 0);
    if (totalProdQty <= 0) continue;

    // BOM 기준 총 투입 예정량 vs 실제 생산량으로 수율 추정
    for (const [productCode, bomItems] of bomByProduct) {
      const totalBomInput = bomItems.reduce((s, b) => s + b.consumptionQty * b.productionQty, 0);
      if (totalBomInput <= 0) continue;

      const stdYield = bomItems[0]?.productionQty > 0
        ? yieldMap.get(bomItems[0].materialCode.trim()) ?? 95
        : 95;

      // 실제 수율: 생산량 / (BOM 투입량) × 100 (간소 추정)
      const actualYield = Math.min(100, Math.round((totalProdQty / totalBomInput) * 100 * 10) / 10);
      const yieldGap = Math.round((actualYield - stdYield) * 10) / 10;
      const absGap = Math.abs(yieldGap);

      const anomalyLevel: import('../types').AnomalyLevel =
        absGap > 5 ? 'critical' : absGap > 3 ? 'warning' : 'normal';

      // 원가 영향: 수율 차이 × 자재 단가 × 투입량
      const avgUnitPrice = bomItems.reduce((s, b) => s + (priceMap.get(b.materialCode.trim()) || 0), 0) / bomItems.length;
      const costImpact = Math.round(Math.abs(yieldGap / 100) * avgUnitPrice * totalBomInput);

      results.push({
        id: `yield-${++idx}`,
        productCode,
        productName: bomItems[0]?.productName || productCode,
        process: bomItems[0]?.location || '일반',
        stdYield,
        actualYield,
        yieldGap,
        transactionDate: date,
        anomalyLevel,
        costImpact,
      });
    }
  }

  return results.sort((a, b) => Math.abs(b.yieldGap) - Math.abs(a.yieldGap));
}

// ==============================
// bomAnalysisService.ts 함수 (이동)
// ==============================

// 1. 판매 기반 예상 소비량 산출
export function computeSalesBasedConsumption(
  salesDetail: SalesDetailData[],
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[]
): ExpectedConsumption[] {
  if (bomData.length === 0 || salesDetail.length === 0) return [];

  // 자재명 매핑
  const masterNameMap = new Map<string, string>();
  for (const mm of materialMaster) {
    if (mm.materialCode?.trim() && mm.materialName) {
      masterNameMap.set(mm.materialCode.trim(), mm.materialName);
    }
  }

  // 제품별 판매 수량 집계
  const salesByProduct = new Map<string, { qty: number; name: string }>();
  for (const sale of salesDetail) {
    const code = sale.productCode?.trim();
    if (!code) continue;
    const agg = salesByProduct.get(code) || { qty: 0, name: sale.productName || code };
    agg.qty += sale.quantity || 0;
    salesByProduct.set(code, agg);
  }

  // BOM 레시피: productCode → materialCode → { consumptionQty, productionQty }
  const bomRecipes = new Map<string, Map<string, { consumptionQty: number; productionQty: number; materialName: string; productName: string }>>();
  for (const bom of bomData) {
    const prodCode = bom.productCode?.trim();
    const matCode = bom.materialCode?.trim();
    if (!prodCode || !matCode || !bom.consumptionQty || !bom.productionQty) continue;

    if (!bomRecipes.has(prodCode)) bomRecipes.set(prodCode, new Map());
    const materials = bomRecipes.get(prodCode)!;
    // 동일 제품의 동일 자재가 여러 행이면 합산
    const existing = materials.get(matCode);
    if (existing) {
      existing.consumptionQty += bom.consumptionQty;
    } else {
      materials.set(matCode, {
        consumptionQty: bom.consumptionQty,
        productionQty: bom.productionQty,
        materialName: bom.materialName || masterNameMap.get(matCode) || matCode,
        productName: bom.productName || prodCode,
      });
    }
  }

  // 자재별 예상 소비량 집계
  const consumptionMap = new Map<string, ExpectedConsumption>();

  for (const [prodCode, materials] of bomRecipes) {
    const sales = salesByProduct.get(prodCode);
    if (!sales || sales.qty <= 0) continue;

    for (const [matCode, recipe] of materials) {
      // 단위당 소비량 = consumptionQty / productionQty (배치 기준)
      const consumptionPerUnit = recipe.consumptionQty / recipe.productionQty;
      const expectedQty = sales.qty * consumptionPerUnit;

      const entry = consumptionMap.get(matCode) || {
        materialCode: matCode,
        materialName: recipe.materialName,
        expectedQty: 0,
        breakdown: [],
      };

      entry.expectedQty += expectedQty;
      entry.breakdown.push({
        productCode: prodCode,
        productName: recipe.productName,
        salesQty: sales.qty,
        consumptionPerUnit,
        expectedQty,
      });

      consumptionMap.set(matCode, entry);
    }
  }

  return [...consumptionMap.values()].sort((a, b) => b.expectedQty - a.expectedQty);
}

// 2. 소비량 차이 분석
export function computeConsumptionVariance(
  expected: ExpectedConsumption[],
  purchases: PurchaseData[],
  materialMaster: MaterialMasterItem[]
): ConsumptionVarianceResult {
  if (expected.length === 0 || purchases.length === 0) {
    return { items: [], totalPriceVariance: 0, totalQtyVariance: 0, totalVariance: 0, favorableCount: 0, unfavorableCount: 0, analyzedMaterials: 0 };
  }

  // 자재별 표준 단가 (materialMaster)
  const standardPriceMap = new Map<string, number>();
  for (const mm of materialMaster) {
    const code = mm.materialCode?.trim();
    if (code && mm.unitPrice > 0) standardPriceMap.set(code, mm.unitPrice);
  }

  // 자재별 실제 구매 집계
  const purchaseAgg = new Map<string, { qty: number; total: number }>();
  for (const p of purchases) {
    const code = p.productCode?.trim();
    if (!code) continue;
    const agg = purchaseAgg.get(code) || { qty: 0, total: 0 };
    agg.qty += p.quantity || 0;
    agg.total += p.total || 0;
    purchaseAgg.set(code, agg);
  }

  const items: ConsumptionVarianceItem[] = [];
  let totalPriceVariance = 0;
  let totalQtyVariance = 0;

  for (const exp of expected) {
    const actual = purchaseAgg.get(exp.materialCode);
    if (!actual) continue;

    const standardPrice = standardPriceMap.get(exp.materialCode) || (actual.qty > 0 ? actual.total / actual.qty : 0);
    const actualAvgPrice = actual.qty > 0 ? actual.total / actual.qty : 0;

    const qtyDiff = actual.qty - exp.expectedQty;
    const qtyDiffPct = exp.expectedQty > 0 ? (qtyDiff / exp.expectedQty) * 100 : 0;
    const priceDiff = actualAvgPrice - standardPrice;
    const priceDiffPct = standardPrice > 0 ? (priceDiff / standardPrice) * 100 : 0;

    const priceVariance = Math.round(priceDiff * actual.qty);
    const qtyVariance = Math.round(qtyDiff * standardPrice);
    const totalVar = priceVariance + qtyVariance;

    totalPriceVariance += priceVariance;
    totalQtyVariance += qtyVariance;

    items.push({
      materialCode: exp.materialCode,
      materialName: exp.materialName,
      expectedQty: Math.round(exp.expectedQty * 100) / 100,
      actualQty: actual.qty,
      qtyDiff: Math.round(qtyDiff * 100) / 100,
      qtyDiffPct: Math.round(qtyDiffPct * 10) / 10,
      standardPrice: Math.round(standardPrice),
      actualAvgPrice: Math.round(actualAvgPrice),
      priceDiff: Math.round(priceDiff),
      priceDiffPct: Math.round(priceDiffPct * 10) / 10,
      priceVariance,
      qtyVariance,
      totalVariance: totalVar,
      productBreakdown: exp.breakdown.map(b => ({
        productCode: b.productCode,
        productName: b.productName,
        salesQty: b.salesQty,
        expectedConsumption: Math.round(b.expectedQty * 100) / 100,
      })),
    });
  }

  items.sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));

  return {
    items,
    totalPriceVariance,
    totalQtyVariance,
    totalVariance: totalPriceVariance + totalQtyVariance,
    favorableCount: items.filter(i => i.totalVariance < 0).length,
    unfavorableCount: items.filter(i => i.totalVariance > 0).length,
    analyzedMaterials: items.length,
  };
}

// 3. BOM 커버리지 분석
export function computeBomCoverage(
  bomData: BomItemData[],
  salesDetail: SalesDetailData[],
  purchases: PurchaseData[]
): BomCoverageResult {
  // 판매된 제품 목록
  const soldProducts = new Map<string, string>();
  for (const s of salesDetail) {
    const code = s.productCode?.trim();
    if (code) soldProducts.set(code, s.productName || code);
  }

  // BOM에 등록된 제품 코드
  const bomProducts = new Map<string, Set<string>>();
  for (const bom of bomData) {
    const prodCode = bom.productCode?.trim();
    const matCode = bom.materialCode?.trim();
    if (!prodCode || !matCode) continue;
    if (!bomProducts.has(prodCode)) bomProducts.set(prodCode, new Set());
    bomProducts.get(prodCode)!.add(matCode);
  }

  // BOM에 등록된 자재 코드
  const bomMaterials = new Set<string>();
  for (const bom of bomData) {
    const matCode = bom.materialCode?.trim();
    if (matCode) bomMaterials.add(matCode);
  }

  // 구매된 자재 코드
  const purchasedMaterials = new Map<string, string>();
  for (const p of purchases) {
    const code = p.productCode?.trim();
    if (code) purchasedMaterials.set(code, p.productName || code);
  }

  // 커버리지 계산
  const coveredProducts: BomCoverageResult['coveredProducts'] = [];
  const uncoveredProducts: BomCoverageResult['uncoveredProducts'] = [];

  for (const [code, name] of soldProducts) {
    const bomMats = bomProducts.get(code);
    if (bomMats && bomMats.size > 0) {
      coveredProducts.push({ code, name, materialCount: bomMats.size });
    } else {
      uncoveredProducts.push({ code, name });
    }
  }

  // BOM에 없는데 구매하는 자재 (orphan)
  const orphanMaterials: BomCoverageResult['orphanMaterials'] = [];
  for (const [code, name] of purchasedMaterials) {
    if (!bomMaterials.has(code)) {
      orphanMaterials.push({ code, name });
    }
  }

  const totalProducts = soldProducts.size;
  const totalCovered = coveredProducts.length;
  const completenessScore = totalProducts > 0 ? Math.round((totalCovered / totalProducts) * 100) : 0;

  return {
    coveredProducts: coveredProducts.sort((a, b) => b.materialCount - a.materialCount),
    uncoveredProducts,
    orphanMaterials,
    totalProducts,
    totalCovered,
    completenessScore,
  };
}

// 4. BOM 데이터 검증
export function validateBomData(
  bomData: BomItemData[],
  materialMaster: MaterialMasterItem[]
): BomDataValidationResult {
  const batchResult = validateBomDataBatch(bomData.map(b => ({
    productCode: b.productCode,
    productName: b.productName,
    materialCode: b.materialCode,
    materialName: b.materialName,
    consumptionQty: b.consumptionQty,
    productionQty: b.productionQty,
  })));

  const totalEntries = bomData.length;
  const sopCompliance = totalEntries > 0 ? Math.round((batchResult.validCount / totalEntries) * 100) : 0;

  return {
    validCount: batchResult.validCount,
    invalidCount: batchResult.invalidCount,
    totalEntries,
    sopCompliance,
    errorSummary: batchResult.errorSummary,
    details: batchResult.results,
  };
}

// 5. BOM 건전성 점수
export function computeBomHealthScore(
  coverage: BomCoverageResult,
  validation: BomDataValidationResult,
  bomVariance: BomVarianceInsight | null,
  bomAnomaly: BomConsumptionAnomalyInsight | null
): BomHealthScore {
  // 데이터 품질 (0-100): SOP 준수율
  const dataQuality = validation.sopCompliance;

  // 커버리지 (0-100): BOM 커버리지율
  const coverageScore = coverage.completenessScore;

  // 차이 점수 (0-100): 차이가 작을수록 높은 점수
  let varianceScore = 100;
  if (bomVariance && bomVariance.items.length > 0) {
    const avgAbsDiffPct = bomVariance.items.reduce((s, i) => {
      const stdQty = i.standardQty || 1;
      return s + Math.abs((i.actualQty - stdQty) / stdQty) * 100;
    }, 0) / bomVariance.items.length;
    // 평균 차이 30% 이상이면 0점, 0%면 100점
    varianceScore = Math.max(0, Math.round(100 - (avgAbsDiffPct / 30) * 100));
  }

  // 이상 점수 (0-100): 심각 이상이 적을수록 높은 점수
  let anomalyScore = 100;
  if (bomAnomaly && bomAnomaly.items.length > 0) {
    const highCount = bomAnomaly.summary.highSeverityCount;
    const totalItems = bomAnomaly.items.length;
    const highRatio = totalItems > 0 ? highCount / totalItems : 0;
    // 심각 비율 50% 이상이면 0점
    anomalyScore = Math.max(0, Math.round(100 - highRatio * 200));
  }

  // 종합 점수: 가중 평균
  const overall = Math.round(
    dataQuality * 0.2 +
    coverageScore * 0.3 +
    varianceScore * 0.3 +
    anomalyScore * 0.2
  );

  return { overall, dataQuality, coverageScore, varianceScore, anomalyScore };
}
