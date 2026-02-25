/**
 * SOP-20-014 기준코드 파서
 * 코드 체계: 용도구분_품목구분_숫자구분 (예: ZIP_M_2034)
 */

// ──── 타입 정의 ────

export type UsageCode = 'ZIP' | 'RES' | 'SAN';
export type CategoryCode = 'M' | 'S' | 'P' | 'H' | 'C' | 'E';

export interface ParsedSopCode {
  raw: string;
  usage: UsageCode | null;
  usageLabel: string;
  category: CategoryCode | null;
  categoryLabel: string;
  number: number | null;
  numberGroup: string;
  isValid: boolean;
  errors: string[];
}

export interface BomValidationResult {
  materialCode: string;
  materialName: string;
  productCode: string;
  productName: string;
  isValid: boolean;
  errors: string[];
}

export interface BomCoverageResult {
  coveredProducts: { code: string; name: string; materialCount: number }[];
  uncoveredProducts: { code: string; name: string }[];
  orphanMaterials: { code: string; name: string }[];
  totalProducts: number;
  totalCovered: number;
  completenessScore: number;
}

export interface BomHealthScore {
  overall: number;
  dataQuality: number;
  coverageScore: number;
  varianceScore: number;
  anomalyScore: number;
}

// ──── 매핑 테이블 ────

const USAGE_LABELS: Record<UsageCode, string> = {
  ZIP: '집반찬연구소',
  RES: '매장 B2B',
  SAN: 'MES',
};

const CATEGORY_LABELS: Record<CategoryCode, string> = {
  M: '원재료',
  S: '부재료',
  P: '제품',
  H: '반제품',
  C: '상품',
  E: '기타',
};

// 원재료/부재료/상품 숫자 그룹
const MATERIAL_NUMBER_GROUPS: Record<string, string> = {
  '1': '농산물',
  '2': '수산물',
  '3': '축산물',
  '4': '가공품(면세)',
  '5': '가공품(과세)',
  '6': '기타',
};

// 집반찬연구소 제품 숫자 그룹
const ZIP_PRODUCT_NUMBER_GROUPS: Record<string, string> = {
  '0': '메인',
  '1': '국/찌개/탕',
  '2': '냉동제품',
  '3': '전/생선/양념/소스',
  '4': '조림',
  '5': '무침',
  '6': '볶음',
  '7': '김치/절임/젓갈',
  '8': '쿠킹박스/요리놀이터',
  '9': '세트/복합제품',
};

// 기타(E) 숫자 그룹
const ETC_NUMBER_GROUPS: Record<string, string> = {
  '0': '포장재',
  '1': '소모품',
  '2': '기타',
};

const VALID_USAGE_CODES = new Set<string>(['ZIP', 'RES', 'SAN']);
const VALID_CATEGORY_CODES = new Set<string>(['M', 'S', 'P', 'H', 'C', 'E']);

// ──── 파서 함수 ────

export function parseSopCode(code: string): ParsedSopCode {
  const raw = code?.trim() || '';
  const errors: string[] = [];

  if (!raw) {
    return { raw, usage: null, usageLabel: '', category: null, categoryLabel: '', number: null, numberGroup: '', isValid: false, errors: ['코드가 비어있습니다'] };
  }

  const parts = raw.split('_');

  // 용도구분
  let usage: UsageCode | null = null;
  let usageLabel = '';
  if (parts.length >= 1 && VALID_USAGE_CODES.has(parts[0])) {
    usage = parts[0] as UsageCode;
    usageLabel = USAGE_LABELS[usage];
  } else if (parts.length >= 1) {
    errors.push(`잘못된 용도코드: ${parts[0]} (ZIP/RES/SAN 필요)`);
  }

  // 품목구분
  let category: CategoryCode | null = null;
  let categoryLabel = '';
  if (parts.length >= 2 && VALID_CATEGORY_CODES.has(parts[1])) {
    category = parts[1] as CategoryCode;
    categoryLabel = CATEGORY_LABELS[category];
  } else if (parts.length >= 2) {
    errors.push(`잘못된 품목코드: ${parts[1]} (M/S/P/H/C/E 필요)`);
  } else {
    errors.push('품목코드가 누락되었습니다');
  }

  // 숫자구분
  let number: number | null = null;
  let numberGroup = '';
  if (parts.length >= 3) {
    const numStr = parts[2];
    const parsed = parseInt(numStr, 10);
    if (!isNaN(parsed)) {
      number = parsed;
      const thousandGroup = Math.floor(parsed / 1000).toString();

      if (category === 'M' || category === 'S' || category === 'C') {
        numberGroup = MATERIAL_NUMBER_GROUPS[thousandGroup] || '알 수 없음';
      } else if (category === 'P' && usage === 'ZIP') {
        numberGroup = ZIP_PRODUCT_NUMBER_GROUPS[thousandGroup] || '알 수 없음';
      } else if (category === 'P' && usage === 'RES') {
        numberGroup = '매장용 제품';
      } else if (category === 'H') {
        numberGroup = '반제품';
      } else if (category === 'E') {
        numberGroup = ETC_NUMBER_GROUPS[thousandGroup] || '알 수 없음';
      }
    } else {
      errors.push(`잘못된 숫자코드: ${numStr}`);
    }
  } else {
    errors.push('숫자코드가 누락되었습니다');
  }

  const isValid = errors.length === 0 && usage !== null && category !== null && number !== null;

  return { raw, usage, usageLabel, category, categoryLabel, number, numberGroup, isValid, errors };
}

// ──── BOM 데이터 검증 ────

interface BomEntry {
  productCode: string;
  productName: string;
  materialCode: string;
  materialName: string;
  consumptionQty: number;
  productionQty: number;
}

export function validateBomEntry(entry: BomEntry): BomValidationResult {
  const errors: string[] = [];

  if (!entry.productCode?.trim()) errors.push('제품코드 누락');
  if (!entry.materialCode?.trim()) errors.push('자재코드 누락');
  if (!entry.consumptionQty || entry.consumptionQty <= 0) errors.push('소비량 누락/음수');
  if (!entry.productionQty || entry.productionQty <= 0) errors.push('배치크기 누락/음수');

  // SOP 코드 형식 검증
  if (entry.productCode?.trim()) {
    const parsed = parseSopCode(entry.productCode.trim());
    if (!parsed.isValid) {
      errors.push(`제품코드 SOP 미준수: ${parsed.errors.join(', ')}`);
    }
  }
  if (entry.materialCode?.trim()) {
    const parsed = parseSopCode(entry.materialCode.trim());
    if (!parsed.isValid) {
      errors.push(`자재코드 SOP 미준수: ${parsed.errors.join(', ')}`);
    }
  }

  return {
    materialCode: entry.materialCode || '',
    materialName: entry.materialName || '',
    productCode: entry.productCode || '',
    productName: entry.productName || '',
    isValid: errors.length === 0,
    errors,
  };
}

export function validateBomDataBatch(entries: BomEntry[]): {
  results: BomValidationResult[];
  validCount: number;
  invalidCount: number;
  errorSummary: Record<string, number>;
} {
  const results = entries.map(validateBomEntry);
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;

  const errorSummary: Record<string, number> = {};
  for (const r of results) {
    for (const err of r.errors) {
      errorSummary[err] = (errorSummary[err] || 0) + 1;
    }
  }

  return { results, validCount, invalidCount, errorSummary };
}
