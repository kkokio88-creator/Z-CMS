/**
 * BOM Analysis Service
 * 판매 기반 소비량 산출, BOM 커버리지, 건전성 분석
 */

import type { SalesDetailData, PurchaseData, BomItemData, MaterialMasterItem } from './googleSheetService';
import type { BomConsumptionAnomalyInsight, BomVarianceInsight } from './insightService';
import { parseSopCode, validateBomDataBatch, type BomCoverageResult, type BomHealthScore, type BomValidationResult } from '../utils/sopCodeParser';

// ──── 타입 ────

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

// ──── 1. 판매 기반 예상 소비량 산출 ────

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

// ──── 2. 소비량 차이 분석 ────

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

// ──── 3. BOM 커버리지 분석 ────

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

// ──── 4. BOM 데이터 검증 ────

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

// ──── 5. BOM 건전성 점수 ────

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
