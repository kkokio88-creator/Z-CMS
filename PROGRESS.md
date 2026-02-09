# Z-CMS 고도화 마스터 진행 상태

> **기반 문서**: `02 기능명세서 고도화 수정사항.md`
> **마지막 업데이트**: 2026-02-09
> **상태 범례**: ✅ 완료 | 🔧 부분완료 | ❌ 미착수 | ⏸ 보류

---

## ====== 명세서 Phase 1: 핵심 고정값 제거 + 채널 어드민 (1~2주) ======

### P1-1. 이익 = 매출 × 0.3 → 진짜 남는 돈(CM) 계산 [✅ 완료]
- computeChannelRevenue(): 3단계 이익 계산 (매출→직접재료비→채널변동비→채널고정비)
- computeRevenueTrend(): 실제 구매비용 기반 월별 이익 (defaultMarginRate 폴백 유지)
- ChannelProfitDetail 타입: profit1/2/3, marginRate1/2/3 필드
- computeAllInsights에 channelCosts 파라미터 추가
- App.tsx에서 getChannelCostSummaries() → insightService 연동
- ProfitAnalysisView: 채널별 3단계 이익 테이블 + KPI 카드 확장
- 수익트렌드 월별 요약 테이블: 재료비/제품이익/최종이익 컬럼 추가
- BusinessConfig에 averageOrderValue(50000) 추가 (건당 변동비용)
- SettingsView에 채널 이익 계산 설정 섹션 추가
- **관련**: 명세서 §3.1, §9

### P1-2. 폐기비용 = 개당 1,000원 → 품목별 실제 단가 [✅ 완료]
- computeWasteAnalysis()에 purchases 참조 추가 → 품목별 평균단가 맵 구축
- 품목 매칭 시 실단가, 미매칭 시 config.wasteUnitCost 폴백
- highWasteDays에 cost 필드 추가, ProductionBomView에서 활용
- **관련**: 명세서 §5.2

### P1-3. 노무비 = 25% → 반별 생산성 관리 [✅ 완료]
- LaborRecordAdmin 컴포넌트: 월별 반별 근무기록 입력 (인원/근무일/정규시간/초과시간)
- getLaborMonthlySummaries(), getMonthlyLaborCost(), getTotalLaborCost() export
- computeCostBreakdown: 실제 노무기록 우선 → 미입력 시 비율추정 폴백
- 월별 원가추이에도 해당월 실제 노무비 적용
- laborDetail.note: 실제/추정 구분 표시
- SettingsView에 LaborRecordAdmin 임베드
- labor_monthly_records Supabase 스키마 추가
- **관련**: 명세서 §4.4

### P1-4. 경비 = 구매액 × 5% → 고정비 + 변동비 분리 [✅ 완료]
- config.monthlyFixedOverhead, variableOverheadPerUnit 필드 + 설정 UI
- insightService computeCostBreakdown(): 고정비+변동비(생산량비례) 적용
- 고정비/변동비 미설정 시 기존 overheadRatio 방식 폴백 유지
- 월별 원가 추이에도 생산량 연동 반영
- **관련**: 명세서 §4.5

### P1-5. 서비스 수준 4개 → 자유 선택 [✅ 완료]
- erfInv/getZScore 수학 함수 구현 (1~99% 연속 지원)
- `orderingService.ts`에 구현됨

### P1-6. 안전재고 공식 개선 [✅ 완료]
- SS = Z × √(L×σd² + μd²×σL²) — 수요+납품기간 변동 모두 반영
- `orderingService.ts`에 구현됨

### P1-7. API 키 .env 이동 + 소스코드 기본값 제거 [✅ 완료]
- ecountService DEFAULT_CONFIG 하드코딩 완전 제거됨

### P1-8. 채널 비용 관리 어드민 [✅ 완료]
- ChannelCostAdmin 완전 재작성: 항목별 개별 행 관리
- CostType: rate(매출대비%) / per_order(건당원) / monthly_fixed(월고정원)
- isVariable 플래그: 변동비(2단계) / 고정비(3단계) 구분
- getChannelCostSummaries() 내보내기 함수 → insightService 연동용
- 채널별 아코디언 UI, 기본 데이터: 자사몰/쿠팡/컬리
- ZCMS_CHANNEL_COSTS_V2 스토리지 키 (V1 호환 안됨)
- **미완료**: Supabase DB 연동 (현재 localStorage만) → Phase 2에서 처리
- **관련**: 명세서 §3.4

---

## ====== 명세서 Phase 2: 보안 및 안정성 (2~3주) ======

### P2-1. 사용자별 데이터 접근 권한 [❌ 미착수]
### P2-2. 입력값 형식 검증 [✅ 완료]
- `src/validation/schemas.ts` — Zod 스키마 구현됨

### P2-3. 화면별 오류 격리 [✅ 완료]
- `src/components/ErrorBoundary.tsx` — 6개 뷰 모두 적용

### P2-4. 증분 동기화 (바뀐 데이터만) [✅ 완료]
- MD5 해시 기반 변경 감지: 테이블별 콘텐츠 해시 계산 후 이전 해시와 비교
- 변경 없는 테이블은 Supabase 쓰기 스킵 (네트워크/DB 부하 절감)
- sync_log에 content_hash, tables_updated 컬럼 추가
- syncFromGoogleSheets(incremental) 파라미터 추가
- syncIncremental(): 5분 미만 완전스킵, 5분+ 해시기반 증분
- 자동동기화(runAutoSync): syncIncremental 사용으로 변경
- API: POST /api/sync/google-sheets?incremental=true 지원

### P2-5. 트랜잭션 (여러 테이블 동시 저장) [✅ 완료]
- batchUpsert(ops, stopOnError) — stopOnError 모드 추가
- 첫 에러 시 중단 + synced_at 기반 롤백 (이미 저장된 테이블 클린업)
- rollbackAfterTimestamp() private 메서드

### P2-6. 에이전트 상태 영구 저장 [🔧 부분완료]
- **완료**: agent_state 테이블 스키마 + SupabaseAdapter saveAgentState/loadAgentState CRUD
- **미완료**: 각 에이전트에서 실제 5분 주기 호출 로직 (에이전트 프레임워크 수정 필요)

---

## ====== 명세서 Phase 3: 핵심 분석 기능 추가 (3~4주) ======

### P3-1. 3단계 이익 계산 [✅ 완료]
- P1-1에서 구현 완료: computeChannelRevenue() 3단계 이익 계산
- ChannelProfitDetail 타입, ProfitAnalysisView 3단계 이익 테이블
- **관련**: 명세서 §3.1, §9

### P3-2. ABC-XYZ 재고 분류 9칸 격자 [✅ 완료]
- computeABCXYZ(): 구매금액 비중(ABC) + 월별 변동계수(XYZ) 분류
- ABCXYZInsight 타입: items[], matrix(9칸), summary
- InventoryOrderView 재고현황 탭에 히트맵 + 분류 배지 테이블 추가
- BusinessConfig abcClassA/B, xyzClassX/Y 임계값 연동
- **관련**: 명세서 §6.1

### P3-3. 신선도 점수 시스템 [✅ 완료]
- computeFreshness(): 최근성(40%)+재고회전(30%)+수요안정성(30%) 기반 0~100점
- FreshnessGrade 5단계: safe/good/caution/warning/danger
- InventoryOrderView 재고현황 탭: 등급 요약 카드 + 위험 품목 테이블
- **관련**: 명세서 §6.1

### P3-4. 레시피 대비 투입 오차 분석 [✅ 완료]
- computeBomVariance(): 전반기(기준) vs 후반기(실제) 비교
- 가격차이 = (실제단가-기준단가)×실제수량, 수량차이 = (실제수량-기준수량)×기준단가
- ProductionBomView에 'BOM 오차' 4번째 서브탭 추가
- purchases prop 추가 (App.tsx 연동)
- **관련**: 명세서 §5.3

### P3-5. 한계단가 계산 + 초과 경고 [✅ 완료]
- computeLimitPrice(): 한계단가 = 평균 + 1σ, 2회 이상 구매 품목 대상
- CostManagementView 원재료 탭: 한계단가 테이블 (초과/정상 배지)
- **관련**: 명세서 §4.2, §12.3

### P3-6. 설정 화면 파라미터 섹션 [✅ 완료]
- 원가설정, ABC-XYZ, 이상감지, 노무비, 발주, 채널비용, 뷰 표시 임계값 — 모두 구현됨

---

## ====== 명세서 Phase 4: 고급 분석 및 시뮬레이션 (4~6주) ======

### P4-1. "만약에?" 손익 시뮬레이션 패널 [❌ 미착수]
- 재료비/판매량/수수료 슬라이더 → 실시간 재계산
- **관련**: 명세서 §3.3

### P4-2. 본전 판매량(BEP) 자동 계산 [❌ 미착수]
- 품목별 BEP, 달성률, 여유비율 컬럼
- **관련**: 명세서 §3.2

### P4-3. 수율 추적 대시보드 [❌ 미착수]
- 기준수율 vs 실제수율, 환산단가
- **관련**: 명세서 §5.3, §12.2

### P4-4. 현금 흐름 대시보드 [❌ 미착수]
- 현금회수기간, 재고회전율, 당좌비율
- **관련**: 명세서 §12.1

### P4-5. 쌓아두는 비용 vs 버리는 비용 최적화 [❌ 미착수]
- **관련**: 명세서 §6.3

---

## ====== 명세서 Phase 5: 성능 및 사용성 (6~8주) ======

### P5-1. 가상 스크롤 + 페이지네이션 [❌ 미착수]
### P5-2. 서버 캐시 [❌ 미착수]
### P5-3. 요청 제한 (Rate Limiting) [❌ 미착수]
### P5-4. 실시간 연결 자동 재연결 [❌ 미착수]
### P5-5. 설정 내보내기/가져오기 [❌ 미착수]
### P5-6. PDF 월간 리포트 [❌ 미착수]

---

## ====== 인프라 작업 (명세서 이전에 완료) ======

### 완료된 인프라
- [x] BusinessConfig 중앙 관리 (30개+ 필드)
- [x] 3-Context 아키텍처 (Settings/Data/UI)
- [x] ErrorBoundary 화면별 오류 격리
- [x] Zod 검증 스키마
- [x] ChannelCostAdmin 기본 UI
- [x] 6개 서비스 BusinessConfig 파라미터 적용
- [x] SettingsView 7개 설정 섹션
- [x] Supabase channel_costs, agent_state 테이블 스키마
- [x] 4개 뷰 하드코딩 → config 참조 교체 (25곳)
- [x] InventoryOrderView computeStatisticalOrder 버그 수정

---

## 전체 진행률 요약

| Phase | 항목수 | ✅완료 | 🔧부분 | ❌미착수 | 진행률 |
|-------|--------|--------|--------|---------|--------|
| Phase 1 (핵심 고정값) | 8 | 8 | 0 | 0 | 100% |
| Phase 2 (보안/안정성) | 6 | 4 | 1 | 1 | 75% |
| Phase 3 (핵심 분석) | 6 | 6 | 0 | 0 | 100% |
| Phase 4 (고급 분석) | 5 | 0 | 0 | 5 | 0% |
| Phase 5 (성능/사용성) | 6 | 0 | 0 | 6 | 0% |
| **합계** | **31** | **18** | **1** | **12** | **~61%** |

## 다음 작업 (Now)

> **Phase 1의 미완료 항목부터 순서대로 진행**
>
> 1. ~~P1-5 서비스수준~~ ✅
> 2. ~~P1-6 안전재고~~ ✅
> 3. ~~P1-7 API키~~ ✅
> 4. ~~P1-4 경비 고정비+변동비~~ ✅
> 5. ~~P1-2 폐기비용 품목별 단가~~ ✅
> 6. ~~P1-8 채널 비용 어드민 고도화~~ ✅
> 7. ~~P1-1 진짜 남는 돈 계산~~ ✅
> 8. ~~P1-3 노무비 반별 생산성~~ ✅
> 9. ~~Phase 1 완료!~~ ✅
> 10. ~~P2-4 증분 동기화~~ ✅
> 11. ~~P2-5 트랜잭션~~ ✅
> 12. ~~P3-2 ABC-XYZ 재고 분류~~ ✅
> 13. ~~P3-3 신선도 점수~~ ✅
> 14. ~~P3-4 레시피 오차 분석~~ ✅
> 15. ~~P3-5 한계단가 + 초과 경고~~ ✅
> 16. ~~Phase 3 완료!~~ ✅
> 17. **P4-1 손익 시뮬레이션** ← NEXT
> 18. **P4-2 BEP 자동 계산** ← NEXT+1
> 19. **P2-1 사용자별 접근 권한** ← 추후 (Supabase Auth 필요)

---

## 커밋 이력
| 커밋 | 내용 | 날짜 |
|------|------|------|
| 730498f | 비즈니스 설정 중앙 관리 고도화 (인프라) | 2026-02-09 |
| a4e79e2 | 뷰 하드코딩→config 교체(25곳) + 8필드 추가 | 2026-02-09 |
| 2e5b25e | P1-4 경비 고정비+변동비 + P1-2 폐기비용 품목별 단가 | 2026-02-09 |
| c8fc557 | P1-8 채널 비용 어드민 고도화: 비용유형 세분화 | 2026-02-09 |
| 99006f7 | P1-1 진짜 남는 돈(CM) 3단계 이익 계산 | 2026-02-09 |
| 0469393 | P1-3 노무비 반별 생산성 관리 | 2026-02-09 |
| 71c52b4 | P2-4 증분 동기화 + P2-5 트랜잭션 | 2026-02-09 |
