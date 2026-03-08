# PRD: insightService 모놀리식 분해

## Introduction

`insightService.ts`는 3,760줄, 30+ export 함수를 가진 모놀리식 서비스 파일이다. 수익 분석, 원가 계산, 재고 관리, 생산 효율, BOM 분석 등 서로 다른 도메인이 단일 파일에 혼재되어 있어 테스트, 유지보수, 확장이 어렵다.

이 프로젝트는 insightService를 5개 도메인별 서비스로 분리하고, 중복 서비스(costAnalysisService, bomAnalysisService)를 통합 후 제거한다. 기존 import 경로는 barrel re-export로 유지하여 점진적 마이그레이션을 지원한다.

## Goals

- insightService.ts를 5개 도메인 서비스(각 200-400줄)로 분리
- 중복 서비스 파일(costAnalysisService, bomAnalysisService) 로직을 새 서비스로 통합 후 삭제
- 기존 consumer의 import 경로를 barrel re-export로 유지 (breaking change 0건)
- `npx tsc --noEmit` 및 `npm run build` 통과 유지
- 기능 변경 없이 순수 구조 리팩터링만 수행

## User Stories

### US-001: profitService 분리
**Description:** As a developer, I want profit-related functions in a dedicated service so that revenue/profit logic is isolated and testable.

**Target functions (insightService.ts에서 이동):**
- `computeChannelRevenue()` (line 561)
- `computeProductProfit()` (line 735)
- `computeRevenueTrend()` (line 790)
- `computeProfitCenterScore()` (line 2932)
- `computeProductBEP()` (line 2056)

**Output file:** `src/services/profitService.ts`

**Acceptance Criteria:**
- [ ] 위 5개 함수가 profitService.ts에 존재
- [ ] 필요한 타입/인터페이스도 함께 이동 또는 import
- [ ] insightService.ts에서 `export { ... } from './profitService'` re-export 추가
- [ ] 기존 consumer(App.tsx, ProfitAnalysisView, SalesAnalysisView 등)의 import 변경 없이 동작
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-002: costService 분리
**Description:** As a developer, I want cost-related functions in a dedicated service so that cost analysis logic is centralized.

**Target functions (insightService.ts에서 이동):**
- `computeMaterialPrices()` (line 923)
- `computeUtilityCosts()` (line 970)
- `computeCostBreakdown()` (line 1199)
- `computeLimitPrice()` (line 1780)
- `computeCostVarianceBreakdown()` (line 3063)
- `computeDailyPerformance()` (line 3236)
- `computeMaterialPriceImpact()` (line 3361)
- `computeBudgetExpense()` (line 3650)
- `computeCashFlow()` (line 2268, internal)
- `isSubMaterial()` (line 1121)
- `isCostExcluded()` (line 1132)
- `diagnoseSubMaterialClassification()` (line 1140)
- `determineStatus()` (line 3230, internal helper)

**중복 통합:** costAnalysisService.ts의 유틸 함수들(formatCurrency, getMarginColorClass 등)을 costService에 통합

**Output file:** `src/services/costService.ts`

**Acceptance Criteria:**
- [ ] 위 13개 함수가 costService.ts에 존재
- [ ] costAnalysisService.ts에서 사용되는 유틸 함수 통합 완료
- [ ] insightService.ts에서 barrel re-export 추가
- [ ] costAnalysisService.ts의 consumer를 costService로 마이그레이션
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-003: inventoryService 분리
**Description:** As a developer, I want inventory-related functions in a dedicated service for stock management logic isolation.

**Target functions (insightService.ts에서 이동):**
- `computeStatisticalOrder()` (line 1367)
- `computeABCXYZ()` (line 1581)
- `computeFreshness()` (line 1697) + `getFreshnessGrade()` (line 1690)
- `computeInventoryDiscrepancy()` (line 3583)
- `computeInventoryCost()` (line 2403, internal)
- `generateRecommendations()` (line 1492)

**Output file:** `src/services/inventoryInsightService.ts`

**Acceptance Criteria:**
- [ ] 위 6개 함수가 inventoryInsightService.ts에 존재
- [ ] insightService.ts에서 barrel re-export 추가
- [ ] InventoryOrderView.tsx 등 consumer의 import 변경 없이 동작
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-004: productionService 분리
**Description:** As a developer, I want production-related functions in a dedicated service for manufacturing analytics isolation.

**Target functions (insightService.ts에서 이동):**
- `computeWasteAnalysis()` (line 1015)
- `computeProductionEfficiency()` (line 1059)
- `computeYieldTracking()` (line 2151)

**Output file:** `src/services/productionService.ts`

**Acceptance Criteria:**
- [ ] 위 3개 함수가 productionService.ts에 존재
- [ ] insightService.ts에서 barrel re-export 추가
- [ ] ProductionBomView.tsx 등 consumer의 import 변경 없이 동작
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-005: bomService 분리
**Description:** As a developer, I want BOM-related functions in a dedicated service for bill of materials logic isolation.

**Target functions (insightService.ts에서 이동):**
- `computeBomVariance()` (line 1832)
- `computeBomConsumptionAnomaly()` (line 2602, internal)
- `computeBomYieldAnalysis()` (line 3498)

**중복 통합:** bomAnalysisService.ts의 함수들(computeSalesBasedConsumption, computeConsumptionVariance, computeBomCoverage, validateBomData, computeBomHealthScore)을 bomService에 통합

**Output file:** `src/services/bomService.ts`

**Acceptance Criteria:**
- [ ] insightService의 BOM 3개 함수 + bomAnalysisService의 5개 함수가 bomService.ts에 존재
- [ ] insightService.ts에서 barrel re-export 추가
- [ ] bomAnalysisService.ts의 consumer를 bomService로 마이그레이션
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-006: insightService를 오케스트레이터로 축소
**Description:** As a developer, I want insightService.ts to only contain the orchestration function and re-exports so that its role is clear.

**insightService.ts에 남길 것:**
- `computeAllInsights()` (line 2786) — 모든 도메인 서비스를 호출하는 오케스트레이터
- 모든 타입 re-export
- 모든 함수 re-export (barrel)

**Acceptance Criteria:**
- [ ] insightService.ts가 500줄 이하로 축소
- [ ] `computeAllInsights()`가 새 도메인 서비스의 함수를 import하여 호출
- [ ] 모든 기존 consumer의 import가 변경 없이 동작
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-007: 중복 서비스 파일 제거
**Description:** As a developer, I want to remove duplicate service files so that there's a single source of truth for each domain.

**삭제 대상:**
- `src/services/costAnalysisService.ts` (428줄) — costService로 통합됨
- `src/services/bomAnalysisService.ts` (386줄) — bomService로 통합됨

**Acceptance Criteria:**
- [ ] costAnalysisService.ts 삭제 완료
- [ ] bomAnalysisService.ts 삭제 완료
- [ ] 이전 consumer가 새 서비스 경로로 import 변경 완료
- [ ] 프로젝트에 dead import 없음
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

### US-008: 타입 정의 정리
**Description:** As a developer, I want insight-related types organized alongside their domain services so that types and logic are co-located.

**작업 내용:**
- insightService.ts 상단의 타입/인터페이스를 각 도메인 서비스로 이동
- insightService.ts에서 타입도 re-export하여 기존 import 유지

**Acceptance Criteria:**
- [ ] 각 도메인 서비스 파일에 해당 도메인의 타입/인터페이스 위치
- [ ] insightService.ts에서 모든 타입 re-export
- [ ] 기존 `import type { ... } from 'insightService'` 변경 없이 동작
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

## Functional Requirements

- FR-1: 5개 도메인 서비스 파일 생성 (profitService, costService, inventoryInsightService, productionService, bomService)
- FR-2: 각 서비스 파일은 해당 도메인의 함수와 타입만 포함 (200-400줄 목표)
- FR-3: insightService.ts는 computeAllInsights() + barrel re-export로 축소 (500줄 이하)
- FR-4: 기존 모든 consumer의 `import { ... } from 'insightService'` 경로 무변경
- FR-5: costAnalysisService.ts, bomAnalysisService.ts 삭제 후 해당 consumer import 변경
- FR-6: 모든 단계에서 `npx tsc --noEmit` 및 `npm run build` 통과 유지
- FR-7: 기능 변경 0건 — 순수 구조 리팩터링만 수행

## Non-Goals

- 함수 로직 변경 또는 최적화
- 새로운 비즈니스 로직 추가
- dataIntegrationService.ts 리팩터링 (별도 PRD)
- 테스트 코드 작성 (현재 테스트 프레임워크 미설정)
- costManagementService.ts 변경 (다른 도메인)
- UI 컴포넌트 변경 (import 경로만 영향)

## Technical Considerations

- **의존성 순서**: 타입 정의(US-008) → 도메인 서비스(US-001~005) → 오케스트레이터(US-006) → 정리(US-007)
- **순환 참조 방지**: 도메인 서비스 간 직접 import 금지. 공유 타입은 types.ts 또는 insightService re-export 활용
- **barrel re-export 패턴**: `export { computeChannelRevenue, type ChannelRevenueInsight } from './profitService'`
- **내부 헬퍼 함수**: export되지 않은 함수(computeCashFlow, computeInventoryCost 등)는 사용하는 도메인 서비스에 포함
- **빌드 검증**: 각 US 완료 시 반드시 tsc + build 검증

## Success Metrics

- insightService.ts 3,760줄 → 500줄 이하로 축소
- 5개 도메인 서비스 각각 200-400줄
- 중복 서비스 2개 파일 제거
- 기존 consumer import 변경 0건 (barrel re-export)
- tsc 에러 0건, build 성공

## Open Questions

- dataIntegrationService.ts(540줄)도 향후 리팩터링 대상인지 확인 필요
- costManagementService.ts와 costService 간 역할 중복 여부 추후 검토
