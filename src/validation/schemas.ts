/**
 * Zod 검증 스키마 — 외부 데이터 검증
 * API 응답, Supabase 데이터, 사용자 입력 등 시스템 경계에서 검증합니다.
 */

import { z } from 'zod';

// ==============================
// Google Sheet / Supabase 데이터
// ==============================

export const DailySalesSchema = z.object({
  date: z.string(),
  jasaPrice: z.number().default(0),
  coupangPrice: z.number().default(0),
  kurlyPrice: z.number().default(0),
  totalRevenue: z.number().default(0),
});

export const SalesDetailSchema = z.object({
  date: z.string(),
  productCode: z.string(),
  productName: z.string(),
  customer: z.string().default(''),
  quantity: z.number().default(0),
  unitPrice: z.number().default(0),
  total: z.number().default(0),
});

export const ProductionSchema = z.object({
  date: z.string(),
  prodQtyTotal: z.number().default(0),
  wasteFinishedPct: z.number().default(0),
  wasteSemiPct: z.number().default(0),
  wasteFinishedEa: z.number().default(0),
});

export const PurchaseSchema = z.object({
  date: z.string(),
  productCode: z.string(),
  productName: z.string(),
  quantity: z.number().default(0),
  unitPrice: z.number().default(0),
  total: z.number().default(0),
});

export const UtilitySchema = z.object({
  date: z.string(),
  elecCost: z.number().default(0),
  waterCost: z.number().default(0),
  gasCost: z.number().default(0),
});

// ==============================
// 비즈니스 설정 검증
// ==============================

export const BusinessConfigSchema = z.object({
  defaultMarginRate: z.number().min(0).max(1),
  wasteUnitCost: z.number().min(0),
  wasteThresholdPct: z.number().min(0).max(100),
  laborCostRatio: z.number().min(0).max(1),
  overheadRatio: z.number().min(0).max(1),
  defaultLeadTime: z.number().min(1).max(365),
  leadTimeStdDev: z.number().min(0),
  defaultServiceLevel: z.number().min(1).max(99),
  orderCost: z.number().min(0),
  holdingCostRate: z.number().min(0).max(1),
  anomalyWarningThreshold: z.number().min(0),
  anomalyCriticalThreshold: z.number().min(0),
});

// ==============================
// ECOUNT API 설정 검증
// ==============================

export const EcountConfigSchema = z.object({
  COM_CODE: z.string().min(1, '회사 코드는 필수입니다'),
  USER_ID: z.string().min(1, '사용자 ID는 필수입니다'),
  API_KEY: z.string().min(1, 'API 키는 필수입니다'),
  ZONE: z.string().default('CD'),
});

// ==============================
// 유틸리티 함수
// ==============================

/**
 * 배열 데이터를 스키마로 검증하고, 유효한 항목만 반환
 * 잘못된 데이터를 조용히 필터링 (에러 로깅)
 */
export function validateArray<T>(
  data: unknown[],
  schema: z.ZodType<T>,
  label?: string
): T[] {
  const valid: T[] = [];
  let errorCount = 0;

  for (const item of data) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      errorCount++;
    }
  }

  if (errorCount > 0 && label) {
    console.warn(`[validation] ${label}: ${errorCount}/${data.length}건 검증 실패, 유효한 ${valid.length}건만 사용`);
  }

  return valid;
}
