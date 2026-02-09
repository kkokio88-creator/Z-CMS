/**
 * Business Configuration — 비즈니스 상수 중앙 관리
 * 모든 하드코딩된 비즈니스 파라미터를 한 곳에서 관리합니다.
 */

export interface BusinessConfig {
  // === 수익/마진 ===
  /** 기본 이익률 (0~1, 예: 0.15 = 15%) */
  defaultMarginRate: number;

  // === 폐기 ===
  /** 폐기 기본 단가 (원/개) — 품목별 단가 없을 때 폴백 */
  wasteUnitCost: number;
  /** 폐기율 경고 임계값 (%, 예: 3) */
  wasteThresholdPct: number;
  /** 폐기 Z-score 경고 기준 */
  wasteZScoreWarning: number;
  /** 폐기 Z-score 위험 기준 */
  wasteZScoreCritical: number;

  // === 원가 비율 (추정용) ===
  /** 노무비 추정 비율 (0~1, 총 원가 대비) */
  laborCostRatio: number;
  /** 간접 경비 추정 비율 (0~1, 구매비 대비) */
  overheadRatio: number;

  // === 발주/재고 ===
  /** 기본 리드타임 (일) */
  defaultLeadTime: number;
  /** 리드타임 표준편차 (일) — 납품기간 변동성 */
  leadTimeStdDev: number;
  /** 기본 서비스 수준 (%) */
  defaultServiceLevel: number;
  /** 주문 비용 (원/건) */
  orderCost: number;
  /** 재고 보유비 비율 (0~1, 단가 대비 연간) */
  holdingCostRate: number;

  // === 이상 감지 ===
  /** 이상 감지 - 주의 임계값 (%) */
  anomalyWarningThreshold: number;
  /** 이상 감지 - 위험 임계값 (%) */
  anomalyCriticalThreshold: number;

  // === 예산 ===
  /** 예산 초과 주의 편차 (%) */
  budgetWarningDeviation: number;
  /** 예산 위험 소진율 (%) */
  budgetCriticalBurnRate: number;
  /** 성능 허용 오차 (%) */
  performanceTolerance: number;

  // === 노무비 상세 ===
  /** 반별 평균 인건비 (원/시간) */
  avgHourlyWage: number;
  /** 초과근무 할증률 (배수) */
  overtimeMultiplier: number;

  // === 재고 분류 기준 (ABC-XYZ) ===
  /** ABC 분류 A등급 금액 비중 (%) */
  abcClassAThreshold: number;
  /** ABC 분류 B등급 금액 비중 (%) */
  abcClassBThreshold: number;
  /** XYZ 분류 X등급 변동계수 상한 */
  xyzClassXThreshold: number;
  /** XYZ 분류 Y등급 변동계수 상한 */
  xyzClassYThreshold: number;

  // === 레시피/생산 ===
  /** 레시피 오차 허용률 (%) */
  recipeVarianceTolerance: number;
  /** 수율 저하 허용률 (%) */
  yieldDropTolerance: number;

  // === 월 고정경비 ===
  /** 월 고정경비 (원) */
  monthlyFixedOverhead: number;
  /** 변동경비 단가 (원/단위) */
  variableOverheadPerUnit: number;

  // === 뷰 표시 임계값 ===
  /** 마진율 양호 기준 (%, 예: 20 = 20% 이상이면 녹색) */
  profitMarginGood: number;
  /** 단가상승 경고 기준 (%, 예: 10 = 10% 이상 상승 시 경고) */
  priceIncreaseThreshold: number;
  /** 이상점수 고위험 기준 (점, 0~100) */
  anomalyScoreHigh: number;
  /** 이상점수 주의 기준 (점, 0~100) */
  anomalyScoreWarning: number;
  /** 이상점수 위험 기준 (점, 0~100) */
  anomalyScoreCritical: number;
  /** 재고일수 긴급 기준 (일) */
  stockDaysUrgent: number;
  /** 재고일수 주의 기준 (일) */
  stockDaysWarning: number;
  /** 저회전 판단 기준 (회전율) */
  lowTurnoverThreshold: number;
}

/** 기본 비즈니스 설정값 */
export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  // 수익/마진
  defaultMarginRate: 0.15,

  // 폐기
  wasteUnitCost: 1000,
  wasteThresholdPct: 3,
  wasteZScoreWarning: 1.5,
  wasteZScoreCritical: 2.5,

  // 원가 비율
  laborCostRatio: 0.25,
  overheadRatio: 0.05,

  // 발주/재고
  defaultLeadTime: 3,
  leadTimeStdDev: 1,
  defaultServiceLevel: 95,
  orderCost: 50000,
  holdingCostRate: 0.20,

  // 이상 감지
  anomalyWarningThreshold: 5,
  anomalyCriticalThreshold: 10,

  // 예산
  budgetWarningDeviation: 8,
  budgetCriticalBurnRate: 95,
  performanceTolerance: 5,

  // 노무비
  avgHourlyWage: 13000,
  overtimeMultiplier: 1.5,

  // ABC-XYZ
  abcClassAThreshold: 70,
  abcClassBThreshold: 90,
  xyzClassXThreshold: 0.5,
  xyzClassYThreshold: 1.0,

  // 레시피/생산
  recipeVarianceTolerance: 5,
  yieldDropTolerance: 3,

  // 경비
  monthlyFixedOverhead: 0,
  variableOverheadPerUnit: 0,

  // 뷰 표시 임계값
  profitMarginGood: 20,
  priceIncreaseThreshold: 10,
  anomalyScoreHigh: 70,
  anomalyScoreWarning: 60,
  anomalyScoreCritical: 80,
  stockDaysUrgent: 3,
  stockDaysWarning: 7,
  lowTurnoverThreshold: 1.0,
};

const SETTINGS_STORAGE_KEY = 'ZCMS_BUSINESS_CONFIG';

/** localStorage에서 저장된 설정을 로드 */
export function loadBusinessConfig(): BusinessConfig {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_BUSINESS_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load business config:', e);
  }
  return { ...DEFAULT_BUSINESS_CONFIG };
}

/** 설정을 localStorage에 저장 */
export function saveBusinessConfig(config: BusinessConfig): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save business config:', e);
  }
}
