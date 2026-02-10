/**
 * Business Configuration — 비즈니스 상수 중앙 관리
 * 모든 하드코딩된 비즈니스 파라미터를 한 곳에서 관리합니다.
 */

/** 독립채산제 매출구간별 목표 */
export interface ProfitCenterGoal {
  revenueBracket: number;  // 월매출 기준 (원)
  label: string;           // 표시 라벨
  targets: {
    productionToLabor: number;    // 생산매출/노무비 목표배수
    revenueToMaterial: number;    // 매출/재료비 목표배수
    revenueToExpense: number;     // 매출/경비 목표배수
    profitMarginTarget: number;   // 영업이익률 목표 (%)
    wasteRateTarget: number;      // 폐기율 목표 (%)
  };
}

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

  // === 현금 흐름 ===
  /** 자사몰 입금 주기 (일) */
  channelCollectionDaysJasa: number;
  /** 쿠팡 입금 주기 (일) */
  channelCollectionDaysCoupang: number;
  /** 컬리 입금 주기 (일) */
  channelCollectionDaysKurly: number;
  /** 품절 기회비용 배율 (0~1) */
  stockoutCostMultiplier: number;

  // === 레시피/생산 ===
  /** 레시피 오차 허용률 (%) */
  recipeVarianceTolerance: number;
  /** 수율 저하 허용률 (%) */
  yieldDropTolerance: number;

  // === BOM 이상 감지 ===
  /** 초과사용 경고 임계값 (%, 기본 15) */
  bomOveruseThreshold: number;
  /** 미달사용 경고 임계값 (%, 기본 -10) */
  bomUnderuseThreshold: number;
  /** 단가이상 경고 임계값 (%, 기본 20) */
  bomPriceDeviationThreshold: number;
  /** 최소 지출 필터 (원, 기본 50000) */
  bomMinimumSpend: number;
  /** 중간 심각도 기준 (%, 기본 20) */
  bomMediumSeverity: number;
  /** 높은 심각도 기준 (%, 기본 35) */
  bomHighSeverity: number;

  // === 월 고정경비 ===
  /** 월 고정경비 (원) */
  monthlyFixedOverhead: number;
  /** 변동경비 단가 (원/단위) */
  variableOverheadPerUnit: number;

  // === 채널 이익 계산 ===
  /** 평균 주문 단가 (원) — 건당 변동비 산출에 사용 */
  averageOrderValue: number;

  // === 월간 예산 (원) ===
  /** 원재료 월 예산 */
  budgetRawMaterial: number;
  /** 부재료 월 예산 */
  budgetSubMaterial: number;
  /** 노무비 월 예산 */
  budgetLabor: number;
  /** 경비 월 예산 */
  budgetOverhead: number;

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

  // === 독립채산제 ===
  /** 매출구간별 독립채산제 목표 */
  profitCenterGoals: ProfitCenterGoal[];
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

  // 현금 흐름
  channelCollectionDaysJasa: 0,
  channelCollectionDaysCoupang: 14,
  channelCollectionDaysKurly: 7,
  stockoutCostMultiplier: 0.5,

  // 레시피/생산
  recipeVarianceTolerance: 5,
  yieldDropTolerance: 3,

  // BOM 이상 감지
  bomOveruseThreshold: 15,
  bomUnderuseThreshold: -10,
  bomPriceDeviationThreshold: 20,
  bomMinimumSpend: 50000,
  bomMediumSeverity: 20,
  bomHighSeverity: 35,

  // 경비
  monthlyFixedOverhead: 0,
  variableOverheadPerUnit: 0,

  // 채널 이익 계산
  averageOrderValue: 50000,

  // 월간 예산
  budgetRawMaterial: 50000000,   // 5천만원
  budgetSubMaterial: 15000000,   // 1천5백만원
  budgetLabor: 20000000,         // 2천만원
  budgetOverhead: 10000000,      // 1천만원

  // 뷰 표시 임계값
  profitMarginGood: 20,
  priceIncreaseThreshold: 10,
  anomalyScoreHigh: 70,
  anomalyScoreWarning: 60,
  anomalyScoreCritical: 80,
  stockDaysUrgent: 3,
  stockDaysWarning: 7,
  lowTurnoverThreshold: 1.0,

  // 독립채산제
  profitCenterGoals: [
    {
      revenueBracket: 800000000,
      label: '8억',
      targets: {
        productionToLabor: 2.0,
        revenueToMaterial: 2.5,
        revenueToExpense: 5.0,
        profitMarginTarget: 15,
        wasteRateTarget: 3,
      },
    },
    {
      revenueBracket: 900000000,
      label: '9억',
      targets: {
        productionToLabor: 2.2,
        revenueToMaterial: 2.7,
        revenueToExpense: 6.0,
        profitMarginTarget: 18,
        wasteRateTarget: 2.5,
      },
    },
    {
      revenueBracket: 1000000000,
      label: '10억',
      targets: {
        productionToLabor: 2.5,
        revenueToMaterial: 3.0,
        revenueToExpense: 7.0,
        profitMarginTarget: 20,
        wasteRateTarget: 2,
      },
    },
  ],
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
